import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  alertDeliveries,
  getDb,
  registerSnapshots,
  savedSearches,
  sponsorEvents,
  sponsors,
  user,
  watches,
} from '@sponsors/db';
import { alertEmail, sendEmail, unsubscribeUrl } from '@sponsors/email';
import { buildUserAlerts, type SearchMatch, type WatchedChange } from './build';

const SITE_URL = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
/** Resend's default limit is 2 requests/second. */
const SEND_INTERVAL_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const dateLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(d);

export interface AlertRunResult {
  snapshots: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Send alert emails for every snapshot that has changes and hasn't been processed yet.
 * Safe to re-run: each (user, snapshot) pair is recorded before sending, so nobody gets the same alert twice.
 */
export async function sendPendingAlerts(log: (m: string) => void = console.log): Promise<AlertRunResult> {
  const db = getDb();
  const result: AlertRunResult = { snapshots: 0, sent: 0, failed: 0, skipped: 0 };

  const pending = await db
    .select()
    .from(registerSnapshots)
    .where(and(eq(registerSnapshots.hasChanges, true), eq(registerSnapshots.isBaseline, false), isNull(registerSnapshots.alertsProcessedAt)))
    .orderBy(asc(registerSnapshots.publishedAt));

  for (const snap of pending) {
    result.snapshots++;

    const watchedRows: WatchedChange[] = await db
      .select({
        userId: watches.userId,
        name: sponsors.name,
        town: sponsors.town,
        slug: sponsors.slug,
        type: sponsorEvents.type,
        oldValue: sponsorEvents.oldValue,
        newValue: sponsorEvents.newValue,
      })
      .from(sponsorEvents)
      .innerJoin(watches, eq(watches.sponsorId, sponsorEvents.sponsorId))
      .innerJoin(sponsors, eq(sponsors.id, sponsorEvents.sponsorId))
      .innerJoin(user, eq(user.id, watches.userId))
      .where(and(eq(sponsorEvents.snapshotId, snap.id), eq(user.alertsEnabled, true)));

    // New (or returning) sponsors matching saved searches. normalizeName() strips % and _, so the
    // stored query is safe inside LIKE.
    const searchRows: SearchMatch[] = await db
      .select({
        userId: savedSearches.userId,
        searchId: savedSearches.id,
        query: savedSearches.query,
        town: savedSearches.town,
        name: sponsors.name,
        sponsorTown: sponsors.town,
        slug: sponsors.slug,
      })
      .from(sponsorEvents)
      .innerJoin(sponsors, eq(sponsors.id, sponsorEvents.sponsorId))
      .innerJoin(
        savedSearches,
        and(
          sql`(${savedSearches.normalizedQuery} = '' or ${sponsors.normalizedName} like '%' || ${savedSearches.normalizedQuery} || '%')`,
          sql`(${savedSearches.normalizedTown} = '' or ${sponsors.normalizedTown} = ${savedSearches.normalizedTown})`,
        ),
      )
      .innerJoin(user, eq(user.id, savedSearches.userId))
      .where(and(eq(sponsorEvents.snapshotId, snap.id), inArray(sponsorEvents.type, ['added', 'readded']), eq(user.alertsEnabled, true)))
      .orderBy(asc(sponsors.normalizedName));

    const alerts = buildUserAlerts(watchedRows, searchRows, SITE_URL());
    log(`[alerts] snapshot #${snap.id} (${dateLabel(snap.publishedAt)}): ${alerts.length} users to notify`);

    const emails = alerts.length
      ? new Map((await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, alerts.map((a) => a.userId)))).map((u) => [u.id, u.email]))
      : new Map<string, string>();

    for (const alert of alerts) {
      const to = emails.get(alert.userId);
      if (!to) continue;

      // Claim this (user, snapshot) first. If it already exists, an earlier run handled it.
      const [claim] = await db
        .insert(alertDeliveries)
        .values({ userId: alert.userId, snapshotId: snap.id, itemCount: alert.itemCount })
        .onConflictDoNothing()
        .returning({ id: alertDeliveries.id });
      if (!claim) {
        result.skipped++;
        continue;
      }

      const unsub = unsubscribeUrl(SITE_URL(), alert.userId);
      const msg = alertEmail({
        dateLabel: dateLabel(snap.publishedAt),
        watched: alert.watched,
        searches: alert.searches,
        accountUrl: `${SITE_URL()}/account`,
        unsubscribeUrl: unsub,
      });
      try {
        const sent = await sendEmail({
          to,
          ...msg,
          headers: {
            'List-Unsubscribe': `<${unsub.replace('/unsubscribe?', '/api/unsubscribe?')}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        await db.update(alertDeliveries).set({ status: 'sent', providerId: sent.id, sentAt: new Date() }).where(eq(alertDeliveries.id, claim.id));
        result.sent++;
      } catch (err) {
        await db
          .update(alertDeliveries)
          .set({ status: 'failed', error: err instanceof Error ? err.message : String(err) })
          .where(eq(alertDeliveries.id, claim.id));
        result.failed++;
        log(`[alerts] failed for user ${alert.userId}: ${err instanceof Error ? err.message : err}`);
      }
      await sleep(SEND_INTERVAL_MS);
    }

    await db.update(registerSnapshots).set({ alertsProcessedAt: new Date() }).where(eq(registerSnapshots.id, snap.id));
  }
  return result;
}
