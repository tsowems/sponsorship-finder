import { and, eq, lt, notInArray, sql } from 'drizzle-orm';
import { apiUsage, boardChecks, getDb, jobs } from '@sponsors/db';
import { reedEnabled, reedJobsFor, REED_SOURCE, searchReed } from './reed';
import type { FetchedJob } from './jobs';

/** Job boards whose adverts sit alongside (not instead of) the company's own careers-page jobs. */
export const BOARD_SOURCES = [REED_SOURCE];

/** How long a board check is reused before searching again. */
export const BOARD_REFRESH_MS = 3 * 24 * 60 * 60 * 1000;
/** A failed search is retried after this long. */
const RETRY_MS = 60 * 60 * 1000;

/** Reed's free allowance is shared by page views and the background worker. Override with REED_DAILY_LIMIT. */
export const reedDailyLimit = () => Number(process.env.REED_DAILY_LIMIT) || 900;

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

/** Count one call against today's allowance; false when the allowance is used up. */
export async function takeApiCall(service: string, limit: number): Promise<boolean> {
  const rows = await getDb()
    .insert(apiUsage)
    .values({ day: londonDay(), service, calls: 1 })
    .onConflictDoUpdate({ target: [apiUsage.day, apiUsage.service], set: { calls: sql`${apiUsage.calls} + 1` }, setWhere: lt(apiUsage.calls, limit) })
    .returning({ calls: apiUsage.calls });
  return rows.length > 0;
}

/** Claim a sponsor's board check if it's due (never checked, or older than BOARD_REFRESH_MS). Only one caller wins. */
async function claimCheck(sponsorId: number, board: string): Promise<boolean> {
  const due = new Date(Date.now() - BOARD_REFRESH_MS);
  const rows = await getDb()
    .insert(boardChecks)
    .values({ sponsorId, board, checkedAt: new Date(), found: null })
    .onConflictDoUpdate({ target: [boardChecks.sponsorId, boardChecks.board], set: { checkedAt: new Date() }, setWhere: lt(boardChecks.checkedAt, due) })
    .returning({ sponsorId: boardChecks.sponsorId });
  return rows.length > 0;
}

/** Make the stored adverts from one board exactly match the latest search (other sources untouched). */
export async function replaceBoardJobs(sponsorId: number, board: string, fetched: FetchedJob[]): Promise<void> {
  const db = getDb();
  const runStart = new Date();
  await db.transaction(async (tx) => {
    if (fetched.length) {
      await tx
        .insert(jobs)
        .values(fetched.map((j) => ({ sponsorId, source: board, ...j, lastSeenAt: runStart })))
        .onConflictDoUpdate({
          target: [jobs.sponsorId, jobs.source, jobs.externalId],
          set: {
            title: sql`excluded.title`, location: sql`excluded.location`, department: sql`excluded.department`, url: sql`excluded.url`,
            isUk: sql`excluded.is_uk`, remote: sql`excluded.remote`, postedAt: sql`excluded.posted_at`, lastSeenAt: runStart,
          },
        });
    }
    await tx.delete(jobs).where(and(eq(jobs.sponsorId, sponsorId), eq(jobs.source, board), lt(jobs.lastSeenAt, runStart)));
  });
}

export type BoardRefresh = 'refreshed' | 'fresh' | 'over_limit' | 'failed' | 'disabled';

/**
 * Search Reed for a sponsor's own adverts if the last check is older than 3 days and today's allowance isn't used up.
 * Safe to call on every page view: at most one search per sponsor per 3 days.
 */
export async function refreshReedJobs(sponsor: { id: number; name: string }): Promise<BoardRefresh> {
  if (!reedEnabled()) return 'disabled';
  const db = getDb();
  // Cheap check first, so page views of recently checked companies don't touch the allowance.
  const [last] = await db
    .select({ checkedAt: boardChecks.checkedAt })
    .from(boardChecks)
    .where(and(eq(boardChecks.sponsorId, sponsor.id), eq(boardChecks.board, REED_SOURCE)));
  if (last && Date.now() - last.checkedAt.getTime() < BOARD_REFRESH_MS) return 'fresh';
  if (!(await takeApiCall(REED_SOURCE, reedDailyLimit()))) return 'over_limit';
  if (!(await claimCheck(sponsor.id, REED_SOURCE))) return 'fresh';

  const results = await searchReed(sponsor.name);
  if (!results) {
    // Try again in an hour rather than in 3 days.
    await db
      .update(boardChecks)
      .set({ checkedAt: new Date(Date.now() - BOARD_REFRESH_MS + RETRY_MS) })
      .where(and(eq(boardChecks.sponsorId, sponsor.id), eq(boardChecks.board, REED_SOURCE)));
    return 'failed';
  }
  const found = reedJobsFor(sponsor.name, results);
  await replaceBoardJobs(sponsor.id, REED_SOURCE, found);
  await db.update(boardChecks).set({ found: found.length }).where(and(eq(boardChecks.sponsorId, sponsor.id), eq(boardChecks.board, REED_SOURCE)));
  return 'refreshed';
}

/** Only the company's own jobs (careers page / hiring system), not job-board adverts. */
export const ownSiteJobs = () => notInArray(jobs.source, BOARD_SOURCES);
