import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb, jobs, sponsorProfiles } from '@sponsors/db';
import type { Discovery } from './discover';
import type { FetchedJob } from './jobs';

const DAY = 24 * 60 * 60 * 1000;
/** Re-check found websites every 60 days, misses every 30, errors after 1–7 days. */
const RECHECK = { found: 60 * DAY, notFound: 30 * DAY };

export async function saveDiscovery(sponsorId: number, d: Discovery): Promise<void> {
  const now = new Date();
  const values = {
    sponsorId,
    status: (d.website ? 'done' : 'not_found') as 'done' | 'not_found',
    priority: 0,
    companyNumber: d.company?.companyNumber ?? null,
    companyName: d.company?.companyName ?? null,
    companyStatus: d.company?.companyStatus ?? null,
    incorporatedOn: d.company?.incorporatedOn ?? null,
    sicCodes: d.company?.sicCodes ?? null,
    website: d.website,
    websiteSource: d.websiteSource,
    websiteVerifiedBy: d.websiteVerifiedBy,
    careersUrl: d.careersUrl,
    vacanciesUrl: d.vacanciesUrl,
    atsProvider: d.ats?.provider ?? null,
    atsSlug: d.ats?.slug ?? null,
    checkedAt: now,
    nextCheckAt: new Date(now.getTime() + (d.website ? RECHECK.found : RECHECK.notFound)),
    attempts: 0,
    error: null,
  };
  await getDb().insert(sponsorProfiles).values(values).onConflictDoUpdate({ target: sponsorProfiles.sponsorId, set: values });
  if (d.jobs && d.jobsSource) await replaceJobs(sponsorId, d.jobsSource, d.jobs);
}

export async function saveError(sponsorId: number, err: unknown): Promise<void> {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  await getDb()
    .insert(sponsorProfiles)
    .values({ sponsorId, status: 'error', error: message, attempts: 1, checkedAt: new Date(), nextCheckAt: new Date(Date.now() + DAY) })
    .onConflictDoUpdate({
      target: sponsorProfiles.sponsorId,
      set: {
        status: 'error',
        error: message,
        attempts: sql`${sponsorProfiles.attempts} + 1`,
        checkedAt: new Date(),
        nextCheckAt: sql`now() + least(${sponsorProfiles.attempts} + 1, 7) * interval '1 day'`,
      },
    });
}

/** A job list couldn't be read this time: note it so we don't retry on every run. */
export async function markJobsChecked(sponsorId: number): Promise<void> {
  await getDb().update(sponsorProfiles).set({ jobsCheckedAt: new Date() }).where(eq(sponsorProfiles.sponsorId, sponsorId));
}

/** Make the stored jobs for this sponsor exactly match the latest fetch. */
export async function replaceJobs(sponsorId: number, source: string, fetched: FetchedJob[]): Promise<void> {
  const db = getDb();
  const runStart = new Date();
  await db.transaction(async (tx) => {
    for (let i = 0; i < fetched.length; i += 200) {
      const batch = fetched.slice(i, i + 200).map((j) => ({ sponsorId, source, ...j, lastSeenAt: runStart }));
      await tx
        .insert(jobs)
        .values(batch)
        .onConflictDoUpdate({
          target: [jobs.sponsorId, jobs.source, jobs.externalId],
          set: {
            title: sql`excluded.title`, location: sql`excluded.location`, department: sql`excluded.department`, url: sql`excluded.url`,
            isUk: sql`excluded.is_uk`, remote: sql`excluded.remote`, postedAt: sql`excluded.posted_at`, lastSeenAt: runStart,
          },
        });
    }
    await tx.delete(jobs).where(and(eq(jobs.sponsorId, sponsorId), lt(jobs.lastSeenAt, runStart)));
    await tx
      .update(sponsorProfiles)
      .set({ jobsCount: fetched.length, ukJobsCount: fetched.filter((j) => j.isUk).length, jobsCheckedAt: runStart })
      .where(eq(sponsorProfiles.sponsorId, sponsorId));
  });
}
