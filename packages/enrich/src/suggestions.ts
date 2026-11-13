import { normalizeName } from '@sponsors/db/normalize';
import { discover, type Discovery, type KnownLinks, type SponsorInput } from './discover';
import { fetchPage, resolvesPublicly } from './http';
import { legalPageCandidates, verifyPage } from './verify';
import { extractLinks } from './html';

/**
 * Checking a website or careers link that a user suggested for a sponsor.
 * Accepted automatically only when it passes the same rules as our own search; otherwise it waits for an admin.
 */

/** Not a company's own site: social networks, job boards, search engines, directories and this site. */
const NOT_A_COMPANY_SITE = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com',
  'google.com', 'google.co.uk', 'bing.com', 'indeed.com', 'indeed.co.uk', 'uk.indeed.com', 'glassdoor.com', 'glassdoor.co.uk',
  'reed.co.uk', 'totaljobs.com', 'cv-library.co.uk', 'monster.co.uk', 'adzuna.co.uk', 'jobsite.co.uk', 'yell.com',
  'company-information.service.gov.uk', 'companieshouse.gov.uk', 'wikipedia.org', 'endole.co.uk', 'opencorporates.com',
  'sponsorshiphunter.com', 'bit.ly', 'tinyurl.com',
];

const onHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Tidy a typed link ("www.acme.co.uk/careers" → "https://www.acme.co.uk/careers"), or null if it can't be used. */
export function normalizeSuggestedUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 500 || /\s/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return null; // no bare names or IP addresses
  if (NOT_A_COMPANY_SITE.some((d) => onHost(host, d))) return null;
  u.hash = '';
  return u.toString();
}

/** "careers.acme.co.uk" and "www.acme.co.uk" are the same site. */
export function sameSite(a: string, b: string): boolean {
  const h = (u: string) => new URL(u).hostname.toLowerCase().replace(/^www\./, '');
  const [x, y] = [h(a), h(b)];
  return onHost(x, y) || onHost(y, x);
}

export interface SuggestionCheck {
  accepted: boolean;
  /** Plain-words reason, kept for admins. */
  note: string;
  /** For an accepted website: the full result, ready to save. */
  discovery?: Discovery;
}

export interface SuggestionContext {
  sponsor: SponsorInput;
  /** Links already accepted for this sponsor (kept while checking the new one). */
  known: KnownLinks;
  /** What we currently show (from the saved profile). */
  website: string | null;
  companyNumber: string | null;
  companyName: string | null;
}

/** Does this page (or its privacy/terms/contact pages) show the company's number or full registered name? */
async function pageProvesOwner(url: string, ctx: SuggestionContext): Promise<{ fetched: boolean; verified: string | null }> {
  const page = await fetchPage(url);
  if (!page) return { fetched: false, verified: null };
  const input = { url: page.url, companyNumber: ctx.companyNumber, normalizedName: normalizeName(ctx.companyName ?? ctx.sponsor.name), town: ctx.sponsor.town };
  let verified = verifyPage({ ...input, html: page.text });
  if (!verified) {
    for (const legal of legalPageCandidates(extractLinks(page.text, page.url), new URL(page.url).origin)) {
      const lp = await fetchPage(legal);
      if (lp && (verified = verifyPage({ ...input, html: lp.text, url: lp.url }))) break;
    }
  }
  return { fetched: true, verified };
}

const UNFETCHABLE = 'Not confirmed automatically: the page could not be fetched (it may block automated checks).';

/**
 * Makes network requests; never writes to the database. Only the suggested link is checked (a few seconds);
 * the full lookup (careers page, jobs) runs only once a website passes.
 */
export async function checkSuggestion(kind: 'website' | 'careers', url: string, ctx: SuggestionContext): Promise<SuggestionCheck> {
  if (!(await resolvesPublicly(new URL(url).hostname))) return { accepted: false, note: 'The address does not exist (no DNS record).' };

  if (kind === 'website') {
    const { fetched, verified } = await pageProvesOwner(url, ctx);
    if (!fetched) return { accepted: false, note: UNFETCHABLE };
    if (!verified) return { accepted: false, note: 'Not confirmed automatically: the site doesn’t show the company number or full registered name.' };
    const d = await discover(ctx.sponsor, { ...ctx.known, website: { url, trusted: false } });
    return d.websiteSource === 'suggested'
      ? { accepted: true, note: `Confirmed automatically (${d.websiteVerifiedBy}).`, discovery: d }
      : { accepted: false, note: 'Not confirmed automatically: the site passed once but not on the full check.' };
  }

  // Careers page: fine when it's on the company's confirmed website, or when the page itself proves who it belongs to.
  if (ctx.website && sameSite(url, ctx.website)) return { accepted: true, note: 'Confirmed automatically: on the company’s confirmed website.' };
  const { fetched, verified } = await pageProvesOwner(url, ctx);
  if (!fetched) return { accepted: false, note: UNFETCHABLE };
  return verified
    ? { accepted: true, note: `Confirmed automatically (${verified} on the careers site).` }
    : { accepted: false, note: 'Not confirmed automatically: the careers page doesn’t show the company number or full registered name.' };
}
