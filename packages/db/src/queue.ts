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
