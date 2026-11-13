import { normalizeName } from '@sponsors/db/normalize';
import type { FetchedJob } from './jobs';
import { safeFetch } from './http';
import { nhsNameKey } from './public-bodies';

/**
 * NHS Jobs (England and Wales), via its official, free Self-Serve Job Adverts API, which NHSBSA publishes for showing
 * an employer's adverts on other websites (https://www.nhsbsa.nhs.uk/new-nhs-jobs-service/nhs-jobs-integration-and-benefits).
 *   GET https://www.jobs.nhs.uk/api/v1/search_xml?employerCode=C9273&externalOnly=true&limit=100&page=1
 * Each employer has a code (e.g. C9273), which is also the start of its advert IDs ("C9273-26-0253").
 * Only external adverts are used: internal-only ones are meant for the employer's own staff.
 */

const API = 'https://www.jobs.nhs.uk/api/v1/search_xml';
const PAGE_SIZE = 100;
const MAX_PAGES = 3;

export const isNhsEmployerCode = (s: string | null | undefined): s is string => Boolean(s && /^[A-Z]\d{3,5}$/.test(s));
export const nhsJobsResultsUrl = (code: string) => `https://www.jobs.nhs.uk/candidate/search/results?employerCode=${encodeURIComponent(code)}`;

/** Employers outside the NHS that often advertise on NHS Jobs (GP practices, hospices…). */
export const NHS_JOBS_EMPLOYER = /\b(nhs|health board|ambulance service|surgery|medical practice|medical centre|health centre|hospice|primary care network)\b/;

export interface NhsVacancy {
  id: string;
  title: string;
  employer: string;
  salary: string | null;
  closeDate: string | null;
  postDate: string | null;
  location: string | null;
  url: string;
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&').trim();
const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decode(m[1]) : null;
};

/** "£66274.00 to £73496.00" → "£66,274 to £73,496"; other text (e.g. "Negotiable") as given. */
export function tidySalary(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/£(\d+)(?:\.(\d{2}))?/g, (_, whole: string, pence?: string) => {
    const n = Number(whole);
    return pence && pence !== '00' && n < 200 ? `£${n}.${pence}` : `£${n.toLocaleString('en-GB')}`;
  });
}

export function parseNhsJobsXml(xml: string): { total: number; vacancies: NhsVacancy[] } {
  const total = Number(tag(xml, 'totalResults') ?? 0) || 0;
  const vacancies: NhsVacancy[] = [];
  for (const m of xml.matchAll(/<vacancyDetails>([\s\S]*?)<\/vacancyDetails>/g)) {
    const v = m[1];
    const url = tag(v, 'url');
    const title = tag(v, 'title');
    if (!url || !title) continue;
    // The first town of <locations><location>Oxford, OX3 7LE</location>…</locations> (the guidance shows the inner tag as
    // <locations>; the live feed uses <location>, so accept both).
    const firstLocation = /<locations>\s*<locations?>([\s\S]*?)<\/locations?>/.exec(v)?.[1];
    vacancies.push({
      id: tag(v, 'id') ?? url,
      title,
      employer: tag(v, 'employer') ?? '',
      salary: tidySalary(tag(v, 'salary')),
      closeDate: tag(v, 'closeDate'),
      postDate: tag(v, 'postDate') ?? tag(v, 'postdate'),
      location: firstLocation ? decode(firstLocation).split(',')[0].trim() || null : null,
      url,
    });
  }
  return { total, vacancies };
}

/** "https://www.jobs.nhs.uk/candidate/jobadvert/C9273-26-0253" → "C9273" */
export function employerCodeFromAdvertUrl(url: string): string | null {
  const code = /\/jobadvert\/([A-Z]\d{3,5})-/.exec(url)?.[1];
  return isNhsEmployerCode(code) ? code : null;
}

async function search(query: string): Promise<{ total: number; vacancies: NhsVacancy[] } | null> {
  try {
    const page = await safeFetch(`${API}?${query}`, { accept: 'application/xml,text/xml', maxBytes: 4_000_000, timeoutMs: 20_000 });
    return page.status === 200 ? parseNhsJobsXml(page.text) : null;
  } catch {
    return null;
  }
}

/**
 * An employer's NHS Jobs code, found by searching its name: the search ranks that employer's adverts first, and we
 * take the code from adverts whose employer name matches (ignoring "The", "NHS", "Foundation", word order…).
 * Null when the employer has no live adverts or the name doesn't match.
 */
export async function nhsEmployerCode(names: string[]): Promise<string | null> {
  for (const name of names) {
    const key = nhsNameKey(normalizeName(name));
    if (key.split(' ').length < 2) continue;
    const res = await search(`employer=${encodeURIComponent(name)}&externalOnly=true&limit=20`);
    for (const v of res?.vacancies ?? []) {
      if (nhsNameKey(normalizeName(v.employer)) === key) {
        const code = employerCodeFromAdvertUrl(v.url);
        if (code) return code;
      }
    }
  }
  return null;
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
/** "2026-11-22" → "closes 22 Nov" */
function closes(d: string | null): string | null {
  const t = d ? new Date(`${d.slice(0, 10)}T12:00:00Z`) : null;
  return t && !Number.isNaN(t.getTime()) ? `closes ${dayMonth.format(t)}` : null;
}

/** All external adverts for an employer code (up to 300), newest first. */
export async function fetchNhsJobs(code: string): Promise<FetchedJob[] | null> {
  if (!isNhsEmployerCode(code)) return null;
  const out: FetchedJob[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await search(`employerCode=${encodeURIComponent(code)}&externalOnly=true&limit=${PAGE_SIZE}&page=${page}`);
    if (!res) return page === 1 ? null : out;
    for (const v of res.vacancies) {
      const posted = v.postDate ? new Date(v.postDate) : null;
      out.push({
        externalId: v.id,
        title: v.title,
        location: v.location,
        department: [v.salary, closes(v.closeDate)].filter(Boolean).join(' · ') || null,
        url: v.url.replace('://beta.jobs.nhs.uk/', '://www.jobs.nhs.uk/'),
        isUk: true,
        remote: false,
        postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
      });
    }
    if (res.vacancies.length < PAGE_SIZE || out.length >= res.total) break;
  }
  return out;
}
