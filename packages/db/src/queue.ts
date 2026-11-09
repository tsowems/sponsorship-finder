import { inArray, sql } from 'drizzle-orm';
import type { Database } from './index';
import { sponsorProfiles } from './schema';

/** Priorities for the enrichment queue (higher runs first). */
export const PROFILE_PRIORITY = { watched: 10, viewed: 5, background: 0 } as const;

/**
 * Ask the enrichment worker to look up these sponsors' websites and jobs.
 * Raises the priority of a request that's still queued; never re-queues a finished profile.
 */
export async function requestProfiles(db: Database, sponsorIds: number[], priority: number): Promise<void> {
  if (!sponsorIds.length) return;
  await db
    .insert(sponsorProfiles)
    .values(sponsorIds.map((sponsorId) => ({ sponsorId, priority })))
    .onConflictDoUpdate({
      target: sponsorProfiles.sponsorId,
      set: { priority: sql`greatest(${sponsorProfiles.priority}, excluded.priority)` },
      setWhere: inArray(sponsorProfiles.status, ['queued']),
    });
}

/** Immediate lookups the website may start in any 10 minutes, across all visitors (the rest wait for the worker). */
export const LIVE_LOOKUPS_PER_10_MIN = 40;

/**
 * Claim a sponsor for an immediate lookup by the website. True when the caller should look it up now:
 * never researched (or still queued), or a "not found"/error result more than a day old, and nobody
 * else started a lookup in the last 15 minutes. Always leaves the sponsor queued for the worker too.
 */
export async function claimLiveLookup(db: Database, sponsorId: number): Promise<boolean> {
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(sponsorProfiles)
    .where(sql`${sponsorProfiles.lookupStartedAt} > now() - interval '10 minutes'`);
  if (recent >= LIVE_LOOKUPS_PER_10_MIN) return false;
  const rows = await db
    .insert(sponsorProfiles)
    .values({ sponsorId, priority: PROFILE_PRIORITY.viewed, lookupStartedAt: sql`now()` })
    .onConflictDoUpdate({
      target: sponsorProfiles.sponsorId,
      set: { lookupStartedAt: sql`now()`, priority: sql`greatest(${sponsorProfiles.priority}, excluded.priority)` },
      setWhere: sql`(${sponsorProfiles.lookupStartedAt} is null or ${sponsorProfiles.lookupStartedAt} < now() - interval '15 minutes')
        and (${sponsorProfiles.status} = 'queued' or ${sponsorProfiles.checkedAt} is null
             or (${sponsorProfiles.status} in ('not_found', 'error') and ${sponsorProfiles.checkedAt} < now() - interval '1 day'))`,
    })
    .returning({ id: sponsorProfiles.sponsorId });
  return rows.length > 0;
}

/** A visitor may trigger a fresh lookup for this profile (same rule as claimLiveLookup, minus the locks). */
export function profileNeedsLookup(profile: { status: string; checkedAt: Date | null } | null, now = Date.now()): boolean {
  if (!profile || profile.status === 'queued' || !profile.checkedAt) return true;
  return (profile.status === 'not_found' || profile.status === 'error') && now - new Date(profile.checkedAt).getTime() > 24 * 60 * 60 * 1000;
}
