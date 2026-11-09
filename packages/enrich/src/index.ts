/**
 * Finding sponsors' websites, careers pages and open roles. Used by the worker (background sweeps,
 * daily job refreshes) and by the website (looking up a company the moment someone opens its page).
 */
import { and, eq } from 'drizzle-orm';
import { getDb, jobs, sponsors } from '@sponsors/db';
import { FETCHABLE_ATS, type AtsProvider } from './careers';
import { jobsFromCareersPage } from './careers-page';
import { CAREERS_PAGE_SOURCE, discover, type Discovery, type SponsorInput } from './discover';
import { fetchJobs, type FetchedJob } from './jobs';
import { markJobsChecked, replaceJobs, saveDiscovery, saveError } from './store';

export { FETCHABLE_ATS, type AtsProvider } from './careers';
export { CAREERS_PAGE_SOURCE, discover, type Discovery, type SponsorInput } from './discover';
export { fetchJobs, type FetchedJob } from './jobs';
export { jobsFromCareersPage } from './careers-page';
export { companiesHouseEnabled } from './companies-house';
export { markJobsChecked, replaceJobs, saveDiscovery, saveError } from './store';

export const sponsorInputColumns = {
  id: sponsors.id,
  slug: sponsors.slug,
  name: sponsors.name,
  normalizedName: sponsors.normalizedName,
  town: sponsors.town,
  normalizedTown: sponsors.normalizedTown,
};

/** Look up one sponsor and save what we find (errors are saved too). Returns null if the sponsor doesn't exist. */
export async function enrichSponsor(sponsorId: number): Promise<Discovery | null> {
  const [s] = await getDb().select(sponsorInputColumns).from(sponsors).where(eq(sponsors.id, sponsorId));
  if (!s) return null;
  try {
    const d = await discover(s);
    await saveDiscovery(s.id, d);
    return d;
  } catch (err) {
    await saveError(s.id, err);
    throw err;
  }
}

export interface JobSource {
  sponsorId: number;
  provider: string | null;
  slug: string | null;
  careersUrl: string | null;
}

/**
 * Re-read one sponsor's open roles: from its hiring platform's API when we can, otherwise from the
 * adverts on its careers page (reusing roles we've already read). Returns how many roles it has now,
 * or null if the list couldn't be read this time.
 */
export async function refreshSponsorJobs(p: JobSource): Promise<number | null> {
  let fetched: FetchedJob[] | null = null;
  let source: string | null = null;
  if (p.provider && p.slug && FETCHABLE_ATS.has(p.provider as AtsProvider)) {
    fetched = await fetchJobs(p.provider as AtsProvider, p.slug);
    source = p.provider;
  } else if (p.careersUrl) {
    const known = await getDb()
      .select({ externalId: jobs.externalId, title: jobs.title, location: jobs.location, department: jobs.department, url: jobs.url, isUk: jobs.isUk, remote: jobs.remote, postedAt: jobs.postedAt })
      .from(jobs)
      .where(and(eq(jobs.sponsorId, p.sponsorId), eq(jobs.source, CAREERS_PAGE_SOURCE)));
    fetched = await jobsFromCareersPage(p.careersUrl, new Map(known.map((j) => [j.url, j])));
    source = CAREERS_PAGE_SOURCE;
  }
  if (!fetched || !source) {
    await markJobsChecked(p.sponsorId);
    return null;
  }
  await replaceJobs(p.sponsorId, source, fetched);
  return fetched.length;
}
