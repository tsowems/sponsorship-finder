import { and, asc, desc, eq, inArray, isNull, lt, notExists, or, sql } from 'drizzle-orm';
import { getDb, sponsorProfiles, sponsors } from '@sponsors/db';
import { FETCHABLE_ATS, type AtsProvider } from './careers';
import { discover, type SponsorInput } from './discover';
import { fetchJobs } from './jobs';
import { revalidateSite } from '../revalidate';
import { replaceJobs, saveDiscovery, saveError } from './store';

const cols = { id: sponsors.id, slug: sponsors.slug, name: sponsors.name, normalizedName: sponsors.normalizedName, town: sponsors.town, normalizedTown: sponsors.normalizedTown };

/** What to work on next: requested first, then due re-checks, then sponsors never checked (newest first). */
export async function pickSponsors(limit: number): Promise<SponsorInput[]> {
  const db = getDb();
  const picked: SponsorInput[] = [];
  const take = async (rows: Promise<SponsorInput[]>) => {
    const ids = new Set(picked.map((p) => p.id));
    for (const r of await rows) if (!ids.has(r.id) && picked.length < limit) picked.push(r);
  };
  await take(
    db.select(cols).from(sponsorProfiles).innerJoin(sponsors, eq(sponsors.id, sponsorProfiles.sponsorId))
      .where(and(eq(sponsorProfiles.status, 'queued'), eq(sponsors.status, 'active')))
      .orderBy(desc(sponsorProfiles.priority), asc(sponsorProfiles.requestedAt)).limit(limit),
  );
  if (picked.length < limit) {
    await take(
      db.select(cols).from(sponsorProfiles).innerJoin(sponsors, eq(sponsors.id, sponsorProfiles.sponsorId))
        .where(and(lt(sponsorProfiles.nextCheckAt, sql`now()`), eq(sponsors.status, 'active')))
        .orderBy(asc(sponsorProfiles.nextCheckAt)).limit(limit - picked.length),
    );
  }
  if (picked.length < limit) {
    await take(
      db.select(cols).from(sponsors)
        .where(and(eq(sponsors.status, 'active'), notExists(db.select({ x: sql`1` }).from(sponsorProfiles).where(eq(sponsorProfiles.sponsorId, sponsors.id)))))
        .orderBy(asc(sponsors.inBaseline), desc(sponsors.firstSeenAt), asc(sponsors.id)).limit(limit - picked.length),
    );
  }
  return picked;
}

async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

export interface EnrichResult {
  checked: number;
  websites: number;
  careers: number;
  withJobs: number;
  errors: number;
}

export async function runEnrichment(opts: { limit: number; concurrency?: number; log?: (m: string) => void }): Promise<EnrichResult> {
  const log = opts.log ?? console.log;
  const batch = await pickSponsors(opts.limit);
  const result: EnrichResult = { checked: 0, websites: 0, careers: 0, withJobs: 0, errors: 0 };
  log(`[enrich] ${batch.length} sponsors to check`);
  // Refresh company pages on the website as results land (every 25), not only at the end.
  let pending: string[] = [];
  const flush = async () => {
    const slugs = pending;
    pending = [];
    if (slugs.length) await revalidateSite({ slugs }, log);
  };
  await pool(batch, opts.concurrency ?? 6, async (s) => {
    try {
      const d = await discover(s);
      await saveDiscovery(s.id, d);
      if (s.slug) pending.push(s.slug);
      if (pending.length >= 25) await flush();
      result.checked++;
      if (d.website) result.websites++;
      if (d.careersUrl) result.careers++;
      if (d.jobs?.length) result.withJobs++;
      log(`[enrich] ${s.name} (${s.town}): ${d.website ?? 'no website'}${d.careersUrl ? ` | careers ${d.careersUrl}` : ''}${d.jobs ? ` | ${d.jobs.length} jobs` : ''}`);
    } catch (err) {
      result.errors++;
      await saveError(s.id, err);
      log(`[enrich] ${s.name}: error ${err instanceof Error ? err.message : err}`);
    }
  });
  await flush();
  return result;
}

/** Refresh job lists for sponsors on a hiring platform we can read (daily is plenty). */
export async function refreshJobs(opts: { limit: number; log?: (m: string) => void }): Promise<{ refreshed: number; jobs: number }> {
  const log = opts.log ?? console.log;
  const due = await getDb()
    .select({ sponsorId: sponsorProfiles.sponsorId, provider: sponsorProfiles.atsProvider, slug: sponsorProfiles.atsSlug, pageSlug: sponsors.slug })
    .from(sponsorProfiles)
    .innerJoin(sponsors, eq(sponsors.id, sponsorProfiles.sponsorId))
    .where(and(
      inArray(sponsorProfiles.atsProvider, [...FETCHABLE_ATS]),
      or(isNull(sponsorProfiles.jobsCheckedAt), lt(sponsorProfiles.jobsCheckedAt, sql`now() - interval '20 hours'`)),
    ))
    .orderBy(asc(sponsorProfiles.jobsCheckedAt))
    .limit(opts.limit);
  let total = 0;
  const refreshed: string[] = [];
  await pool(due, 6, async (p) => {
    const fetched = await fetchJobs(p.provider as AtsProvider, p.slug!);
    if (fetched) {
      await replaceJobs(p.sponsorId, p.provider!, fetched);
      total += fetched.length;
      refreshed.push(p.pageSlug);
    }
  });
  await revalidateSite({ slugs: refreshed }, log);
  log(`[jobs] refreshed ${due.length} job boards, ${total} openings`);
  return { refreshed: due.length, jobs: total };
}
