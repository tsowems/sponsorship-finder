import { decodeEntities, extractLinks, type Link } from './html';
import { fetchPage } from './http';
import type { FetchedJob } from './jobs';
import { isUkLocation } from './location';

/**
 * Jobs listed on a company's own careers page (Teamtailor, Pinpoint, Personio, BambooHR, custom sites…),
 * for when there is no hiring-platform API we can read.
 *
 * We only accept a role when its page carries a schema.org `JobPosting` (the structured data Google for
 * Jobs requires), so titles, locations and dates are the employer's own, and links that merely *look*
 * like jobs ("/careers/life-at-acme") are never shown as openings.
 */

/** Detail pages fetched per company per check. Known roles are reused rather than re-fetched. */
export const MAX_JOB_PAGES = 25;
const MAX_LISTED = 200;

const JOB_PATH = /\/(?:jobs?|vacanc(?:y|ies)|positions?|openings?|roles?|opportunit(?:y|ies)|careers?|job-?posts?|postings?)\/(?:[^/?#]+\/)*[^/?#]+\/?$/i;
const NOT_A_JOB = /^(?:search|alerts?|faqs?|benefits|life|culture|teams?|departments?|locations?|students?|graduates?|early-?careers|internships?|apprenticeships?|how-?we-?hire|hiring-?process|apply|login|sign-?in|register|connect|talent-?(?:pool|community)|privacy|cookies?|all|index|page|feed|rss|people|about|values|why-?\w+)$/i;
const NOT_A_TITLE = /^(?:view|see|show|browse|explore|apply|read|learn|find|discover|search|more|all|back|next|previous|open (?:roles|positions)|current (?:roles|vacancies)|careers?|jobs?|vacancies)\b/i;

/** Links on a careers page that point at individual job adverts, best guess first. */
export function jobLinkCandidates(links: Link[], pageUrl: string): string[] {
  const page = new URL(pageUrl);
  const host = page.hostname.replace(/^www\./, '');
  const out = new Set<string>();
  for (const l of links) {
    if (!l.text || l.text.length < 3 || l.text.length > 140 || NOT_A_TITLE.test(l.text)) continue;
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, '') !== host) continue;
    const path = u.pathname.replace(/\/$/, '');
    if (path === page.pathname.replace(/\/$/, '') || !JOB_PATH.test(path)) continue;
    const last = path.split('/').pop() ?? '';
    // A job advert's address names the role ("8582485-compliance-analyst", "senior-engineer", "R12345").
    if (NOT_A_JOB.test(last) || !(/[a-z]-[a-z0-9]/i.test(last) || /\d{3,}/.test(last))) continue;
    out.add(`${u.origin}${u.pathname}`);
    if (out.size >= MAX_LISTED) break;
  }
  return [...out];
}

type Json = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? decodeEntities(v).replace(/\s+/g, ' ').trim() : '');

/** Every schema.org JobPosting in a page's JSON-LD (including inside @graph and arrays). */
export function jobPostingsInHtml(html: string): Json[] {
  const found: Json[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 5 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1));
    const obj = node as Json;
    const type = obj['@type'];
    if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) found.push(obj);
    else if (obj['@graph']) visit(obj['@graph'], depth + 1);
  };
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()), 0);
    } catch {
      /* malformed JSON-LD: ignore */
    }
  }
  return found;
}

/** "London, England, GB" from schema.org jobLocation (object or array), plus the first country code seen. */
function readLocation(p: Json): { text: string | null; country: string | null } {
  const locs = (Array.isArray(p.jobLocation) ? p.jobLocation : p.jobLocation ? [p.jobLocation] : []) as Json[];
  const parts: string[] = [];
  let country: string | null = null;
  for (const loc of locs) {
    const a = (loc?.address ?? {}) as Json;
    const c = typeof a.addressCountry === 'object' && a.addressCountry ? str((a.addressCountry as Json).name) : str(a.addressCountry);
    if (c && !country) country = c;
    const line = [str(a.addressLocality), str(a.addressRegion), c].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(', ');
    if (line && !parts.includes(line)) parts.push(line);
  }
  if (!parts.length) {
    const req = p.applicantLocationRequirements as Json | Json[] | undefined;
    const name = str((Array.isArray(req) ? req[0] : req)?.name);
    if (name) parts.push(name);
  }
  return { text: parts.slice(0, 4).join(' / ') || null, country };
}

/** Turn one JobPosting into our job shape. Returns null when it has no title. */
export function jobFromPosting(p: Json, pageUrl: string): FetchedJob | null {
  const title = str(p.title) || str(p.name);
  if (!title) return null;
  const { text, country } = readLocation(p);
  const remote = /telecommute/i.test(str(p.jobLocationType)) || /\bremote\b/i.test(text ?? '');
  const url = (str(p.url) || pageUrl).split('#')[0];
  const identifier = p.identifier as Json | string | undefined;
  const id = (typeof identifier === 'object' ? str(identifier?.value) : str(identifier)) || new URL(url).pathname;
  const posted = new Date(str(p.datePosted));
  const isCode = country !== null && country.length <= 3;
  return {
    externalId: id.slice(0, 200),
    title: title.slice(0, 300),
    location: text,
    department: null,
    url,
    isUk: isUkLocation(text, isCode ? country : null) || (!isCode && isUkLocation(country)),
    remote,
    postedAt: Number.isNaN(posted.getTime()) ? null : posted,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const n = i++;
      out[n] = await fn(items[n]);
    }
  }));
  return out;
}

/**
 * Current openings listed on a careers page.
 *   null → the page couldn't be read (keep whatever we had)
 *   []   → read fine, no job adverts on it
 * `known` (url → job) lets refreshes reuse roles we've already read instead of fetching each advert again.
 */
export async function jobsFromCareersPage(careersUrl: string, known: Map<string, FetchedJob> = new Map()): Promise<FetchedJob[] | null> {
  const page = await fetchPage(careersUrl);
  if (!page) return null;
  const jobs = new Map<string, FetchedJob>();
  for (const p of jobPostingsInHtml(page.text)) {
    const j = jobFromPosting(p, page.url);
    if (j) jobs.set(j.url, j);
  }
  const links = jobLinkCandidates(extractLinks(page.text, page.url), page.url).filter((u) => !jobs.has(u));
  const reused = links.filter((u) => known.has(u));
  for (const u of reused) jobs.set(u, known.get(u)!);
  const toFetch = links.filter((u) => !known.has(u)).slice(0, MAX_JOB_PAGES);
  const fetched = await mapLimit(toFetch, 4, async (u) => {
    const p = await fetchPage(u);
    if (!p) return null;
    const posting = jobPostingsInHtml(p.text)[0];
    return posting ? jobFromPosting(posting, p.url) : null;
  });
  for (const j of fetched) if (j) jobs.set(j.url, j);
  // Some pages list the same advert under two addresses: keep one per external id.
  return [...new Map([...jobs.values()].map((j) => [j.externalId, j])).values()];
}
