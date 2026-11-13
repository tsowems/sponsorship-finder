import { normalizeName } from '@sponsors/db/normalize';
import type { FetchedJob } from './jobs';
import { USER_AGENT } from './http';

/**
 * Reed.co.uk job search (free Jobseeker API: https://www.reed.co.uk/developers/jobseeker).
 * Auth is HTTP Basic with the API key as the user name and an empty password. Results are capped at 100 per call.
 * We search by the sponsor's name and keep only adverts whose advertiser *is* the sponsor, so jobs posted by
 * recruitment agencies on someone's behalf (or by other companies with similar words in their name) are left out.
 */

export const REED_SOURCE = 'reed';
const API = 'https://www.reed.co.uk/api/1.0/search';

export interface ReedResult {
  jobId: number;
  employerId?: number;
  employerName?: string;
  jobTitle?: string;
  locationName?: string;
  minimumSalary?: number | null;
  maximumSalary?: number | null;
  currency?: string | null;
  date?: string; // dd/mm/yyyy
  expirationDate?: string;
  jobUrl?: string;
}

export const reedEnabled = () => Boolean(process.env.REED_API_KEY);

/** "Bright Care (UK) Ltd t/a Bluebird Care Leeds" → "bright care"; same rule for the sponsor and Reed's advertiser name. */
export function employerKey(name: string): string {
  return normalizeName(name)
    .replace(/\b(t a|ta|trading as)\b.*$/, '')
    .replace(/\b(limited|plc|llp|lp|cic|the|uk|company|group)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words to search Reed for: the name without "Ltd", brackets, "t/a …". */
export function reedKeywords(name: string): string {
  return employerKey(name).split(' ').slice(0, 6).join(' ');
}

const money = (n: number) => (n < 200 ? `£${n.toFixed(2)}` : `£${Math.round(n).toLocaleString('en-GB')}`);

/** "£24,000–£27,000" / "£12.50–£13.00 an hour" / null. Reed gives hourly rates as small numbers. */
export function salaryText(r: ReedResult): string | null {
  if (r.currency && r.currency !== 'GBP') return null;
  const lo = r.minimumSalary || null;
  const hi = r.maximumSalary || null;
  const first = lo ?? hi;
  if (!first) return null;
  const range = lo && hi && lo !== hi ? `${money(lo)}–${money(hi)}` : money(first);
  return first < 200 ? `${range} an hour` : range;
}

const ukDate = (v?: string): Date | null => {
  const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
};

/** Reed results → our jobs, keeping only the sponsor's own adverts. Salary goes in `department` (shown under the title). */
export function reedJobsFor(sponsorName: string, results: ReedResult[]): FetchedJob[] {
  const key = employerKey(sponsorName);
  if (key.length < 3) return [];
  return results
    .filter((r) => r.jobId && r.jobTitle && r.jobUrl && r.employerName && employerKey(r.employerName) === key)
    .map((r) => ({
      externalId: String(r.jobId),
      title: r.jobTitle!.replace(/\s+/g, ' ').trim(),
      location: r.locationName?.trim() || null,
      department: salaryText(r),
      url: r.jobUrl!,
      isUk: true,
      remote: /remote|work from home|home based/i.test(`${r.jobTitle} ${r.locationName ?? ''}`),
      postedAt: ukDate(r.date),
    }));
}

/** One search call. Returns null when Reed can't be reached or refuses (bad key, over its limit). */
export async function searchReed(sponsorName: string): Promise<ReedResult[] | null> {
  const key = process.env.REED_API_KEY;
  if (!key) return null;
  const url = `${API}?keywords=${encodeURIComponent(reedKeywords(sponsorName))}&resultsToTake=100`;
  try {
    const res = await fetch(url, {
      // Never follow a redirect: the key must only ever go to Reed.
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: ReedResult[] };
    return Array.isArray(body.results) ? body.results : [];
  } catch {
    return null;
  }
}
