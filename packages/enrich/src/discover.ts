import { normalizeName } from '@sponsors/db/normalize';
import { jobsFromCareersPage } from './careers-page';
import { COMMON_CAREERS_PATHS, detectAts, FETCHABLE_ATS, findCareersLinks, looksLikeCareersPage, type AtsMatch } from './careers';
import { companiesHouseEnabled, findCompany, type CompanyRecord } from './companies-house';
import { candidateDomains } from './domains';
import { extractLinks, htmlToText } from './html';
import { fetchPage, resolvesPublicly, type FetchedPage } from './http';
import { fetchJobs, type FetchedJob } from './jobs';
import { legalPageCandidates, verifyPage, type VerifiedBy } from './verify';
import { govukCouncilWebsite, isProtectedHost, nhsOdsWebsite, publicBodyKind, publicDomainGuesses } from './public-bodies';
import { websiteByCompanyNumber, websitesByName } from './wikidata';

export interface SponsorInput {
  id: number;
  /** Page to refresh on the website once results are saved. */
  slug?: string;
  name: string;
  normalizedName: string;
  town: string;
  normalizedTown: string;
}

export interface Discovery {
  company: CompanyRecord | null;
  website: string | null;
  websiteSource: 'suggested' | 'wikidata' | 'govuk' | 'nhs_ods' | 'wikidata_search' | 'domain_guess' | null;
  /** 'admin' = a user suggested it and an admin approved it. */
  websiteVerifiedBy: VerifiedBy | 'wikidata' | 'govuk' | 'nhs_ods' | 'admin' | null;
  careersUrl: string | null;
  /** The hiring system's vacancy list, when we can only link to it and it differs from the careers page. */
  vacanciesUrl: string | null;
  ats: AtsMatch | null;
  jobs: FetchedJob[] | null;
  /** Where `jobs` came from: the hiring platform's API, or adverts read off the careers page. */
  jobsSource: string | null;
  log: string[];
}

/** Links users suggested and we accepted (see link_suggestions). Tried before our own search, on every check. */
export interface KnownLinks {
  /** `trusted`: an admin approved it, so it's used even if the site can't be fetched or doesn't name the company. */
  website?: { url: string; trusted: boolean };
  careers?: string;
}

/** `jobs.source` for adverts read off a company's own careers page. */
export const CAREERS_PAGE_SOURCE = 'careers_page';

const originOf = (url: string) => `${new URL(url).origin}/`;
/** A suggested page on a group's site ("…/our-care-homes/grosvenor-park/") is kept as is, minus query and fragment. */
const pageOf = (url: string) => {
  const u = new URL(url);
  return u.pathname === '/' ? `${u.origin}/` : `${u.origin}${u.pathname}`;
};

/** Find everything we can about one sponsor. Makes network requests; never writes to the database. */
export async function discover(s: SponsorInput, known: KnownLinks = {}): Promise<Discovery> {
  const log: string[] = [];
  const out: Discovery = { company: null, website: null, websiteSource: null, websiteVerifiedBy: null, careersUrl: null, vacanciesUrl: null, ats: null, jobs: null, jobsSource: null, log };

  // 1. Companies House: the registered name and number make website verification much stronger.
  if (companiesHouseEnabled()) {
    out.company = await findCompany(s.name, s.normalizedName, s.normalizedTown).catch(() => null);
    log.push(out.company ? `companies house: ${out.company.companyNumber} ${out.company.companyName} (${out.company.companyStatus})` : 'companies house: no exact match');
  }
  const registeredName = out.company ? normalizeName(out.company.companyName) : s.normalizedName;
  const companyNumber = out.company?.companyNumber ?? null;

  // 2. Website
  let homepage: FetchedPage | null = null;
  const tried = new Set<string>();
  const tryCandidate = async (url: string, source: NonNullable<Discovery['websiteSource']>, trusted: boolean): Promise<boolean> => {
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return false;
    }
    if (tried.has(host)) return false;
    tried.add(host);
    const page = await fetchPage(url);
    const siteUrl = (u: string) => (source === 'suggested' ? pageOf(u) : originOf(u));
    if (trusted) {
      // Wikidata matched on company number, GOV.UK's council list, or an admin-approved suggestion: authoritative even if the site blocks bots.
      out.website = siteUrl(page?.url ?? url);
      out.websiteSource = source;
      out.websiteVerifiedBy = source === 'govuk' || source === 'nhs_ods' ? source : source === 'suggested' ? 'admin' : 'wikidata';
      homepage = page;
      const label = { govuk: 'GOV.UK council list', nhs_ods: 'NHS organisation directory', suggested: 'suggested, approved by an admin' }[source as string] ?? 'wikidata by company number';
      log.push(`website: ${out.website} (${label}${page ? '' : ', page not fetchable'})`);
      return true;
    }
    if (!page) return false;
    const check = (html: string) => verifyPage({ html, url: page.url, companyNumber, normalizedName: registeredName, town: s.town });
    let verified = check(page.text);
    if (!verified) {
      for (const legal of legalPageCandidates(extractLinks(page.text, page.url), new URL(page.url).origin)) {
        const lp = await fetchPage(legal);
        if (lp && (verified = check(lp.text))) break;
      }
    }
    if (!verified) {
      log.push(`rejected ${page.url}: no matching company number or name`);
      return false;
    }
    out.website = siteUrl(page.url);
    out.websiteSource = source;
    out.websiteVerifiedBy = verified;
    homepage = page;
    log.push(`website: ${out.website} (${source}, verified by ${verified})`);
    return true;
  };

  if (known.website) await tryCandidate(known.website.url, 'suggested', known.website.trusted);
  if (!out.website && companyNumber) {
    const wd = await websiteByCompanyNumber(companyNumber);
    if (wd) await tryCandidate(wd, 'wikidata', true);
  }
  // Public bodies (councils, NHS, universities…): official sources and protected domains first.
  const kind = publicBodyKind(s.normalizedName);
  if (!out.website && kind === 'council') {
    const gov = await govukCouncilWebsite(s.normalizedName, normalizeName);
    if (gov) await tryCandidate(gov, 'govuk', true);
  }
  if (!out.website && kind === 'nhs') {
    const nhs = await nhsOdsWebsite(s.normalizedName, normalizeName);
    if (nhs) await tryCandidate(nhs, 'nhs_ods', true);
  }
  if (!out.website && kind) {
    for (const d of publicDomainGuesses(s.normalizedName, kind)) {
      const host = (await resolvesPublicly(d)) ? d : (await resolvesPublicly(`www.${d}`)) ? `www.${d}` : null;
      if (host && (await tryCandidate(`https://${host}/`, 'domain_guess', false))) break;
    }
  }
  if (!out.website) {
    for (const url of await websitesByName(s.name)) if (await tryCandidate(url, 'wikidata_search', false)) break;
  }
  if (!out.website) {
    // Look up every guess in parallel (cheap), then fetch only the ones that exist, in order.
    const guesses = candidateDomains(registeredName);
    const exists = await Promise.all(guesses.map(async (d) => (await resolvesPublicly(d)) || (await resolvesPublicly(`www.${d}`))));
    const live = guesses.filter((_, i) => exists[i]);
    if (live.length) log.push(`domain guesses that exist: ${live.join(', ')}`);
    for (const domain of live) {
      if (await tryCandidate(`https://${domain}/`, 'domain_guess', false)) break;
    }
  }
  if (!out.website) {
    log.push('website: not found');
    if (!known.careers) return out;
  }

  // 3. Careers page + hiring platform. A suggested careers page wins over our own search.
  if (known.careers) {
    const page = await fetchPage(known.careers);
    out.careersUrl = page?.url ?? known.careers;
    out.ats = detectAts(known.careers) ?? (page ? detectAts(page.text, page.url) : null);
  }
  const home = homepage as FetchedPage | null;
  if (home && !out.careersUrl) {
    const origin = new URL(home.url).origin;
    out.ats = detectAts(home.text);
    for (const link of findCareersLinks(extractLinks(home.text, home.url), origin)) {
      const ats = detectAts(link);
      const page = await fetchPage(link);
      if (page) out.ats = out.ats ?? detectAts(page.text, page.url, link) ?? ats;
      else if (ats) out.ats = out.ats ?? ats;
      if (ats || (page && looksLikeCareersPage(htmlToText(page.text)))) {
        out.careersUrl = page?.url ?? link;
        break;
      }
    }
    if (!out.careersUrl) {
      for (const path of COMMON_CAREERS_PATHS) {
        const page = await fetchPage(`${origin}${path}`);
        if (!page || originOf(page.url) === page.url) continue; // redirected back to the homepage
        if (looksLikeCareersPage(htmlToText(page.text))) {
          out.careersUrl = page.url;
          out.ats = out.ats ?? detectAts(page.text);
          break;
        }
      }
    }
  }
  if (!out.careersUrl && out.ats) out.careersUrl = out.ats.url;
  // Official public-sector sites (often blocking bots, like fife.gov.uk): a jobs./careers. subdomain of the same
  // protected domain belongs to the same body. Checked by DNS only; the site itself isn't fetched.
  if (!out.careersUrl && out.website) {
    const base = new URL(out.website).hostname.replace(/^www\./, '');
    if (isProtectedHost(base)) {
      for (const sub of ['jobs', 'careers', 'recruitment', 'vacancies']) {
        if (await resolvesPublicly(`${sub}.${base}`)) {
          out.careersUrl = `https://${sub}.${base}/`; // a subdomain of the official site, not fetched
          break;
        }
      }
    }
  }
  if (out.ats && !FETCHABLE_ATS.has(out.ats.provider) && out.ats.url !== out.careersUrl) out.vacanciesUrl = out.ats.url;
  log.push(`careers: ${out.careersUrl ?? 'not found'}${known.careers ? ' (suggested)' : ''}${out.ats ? ` (${out.ats.provider}: ${out.ats.slug})` : ''}`);
  if (out.vacanciesUrl) log.push(`vacancies: ${out.vacanciesUrl}`);

  // 4. Live openings: from the hiring platform's API, else from adverts on the careers page itself
  if (out.ats && FETCHABLE_ATS.has(out.ats.provider)) {
    out.jobs = await fetchJobs(out.ats.provider, out.ats.slug);
    out.jobsSource = out.jobs ? out.ats.provider : null;
  }
  if (!out.jobs?.length && out.careersUrl) {
    const fromPage = await jobsFromCareersPage(out.careersUrl);
    if (fromPage?.length) {
      out.jobs = fromPage;
      out.jobsSource = CAREERS_PAGE_SOURCE;
    }
  }
  if (out.jobs) log.push(`jobs: ${out.jobs.length} from ${out.jobsSource} (${out.jobs.filter((j) => j.isUk).length} in the UK)`);
  else if (out.careersUrl) log.push('jobs: none readable (careers link only)');
  return out;
}
