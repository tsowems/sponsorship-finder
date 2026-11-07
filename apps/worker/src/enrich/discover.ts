import { normalizeName } from '@sponsors/db/normalize';
import { COMMON_CAREERS_PATHS, detectAts, FETCHABLE_ATS, findCareersLinks, looksLikeCareersPage, type AtsMatch } from './careers';
import { companiesHouseEnabled, findCompany, type CompanyRecord } from './companies-house';
import { candidateDomains } from './domains';
import { extractLinks, htmlToText } from './html';
import { fetchPage, resolvesPublicly, type FetchedPage } from './http';
import { fetchJobs, type FetchedJob } from './jobs';
import { legalPageCandidates, verifyPage, type VerifiedBy } from './verify';
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
  websiteSource: 'wikidata' | 'wikidata_search' | 'domain_guess' | null;
  websiteVerifiedBy: VerifiedBy | 'wikidata' | null;
  careersUrl: string | null;
  ats: AtsMatch | null;
  jobs: FetchedJob[] | null;
  log: string[];
}

const originOf = (url: string) => `${new URL(url).origin}/`;

/** Find everything we can about one sponsor. Makes network requests; never writes to the database. */
export async function discover(s: SponsorInput): Promise<Discovery> {
  const log: string[] = [];
  const out: Discovery = { company: null, website: null, websiteSource: null, websiteVerifiedBy: null, careersUrl: null, ats: null, jobs: null, log };

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
    if (trusted) {
      // Wikidata matched on company number: authoritative even if the site blocks bots.
      out.website = originOf(page?.url ?? url);
      out.websiteSource = source;
      out.websiteVerifiedBy = 'wikidata';
      homepage = page;
      log.push(`website: ${out.website} (wikidata by company number${page ? '' : ', page not fetchable'})`);
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
    out.website = originOf(page.url);
    out.websiteSource = source;
    out.websiteVerifiedBy = verified;
    homepage = page;
    log.push(`website: ${out.website} (${source}, verified by ${verified})`);
    return true;
  };

  if (companyNumber) {
    const wd = await websiteByCompanyNumber(companyNumber);
    if (wd) await tryCandidate(wd, 'wikidata', true);
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
    return out;
  }

  // 3. Careers page + hiring platform
  const home = homepage as FetchedPage | null;
  if (home) {
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
  log.push(`careers: ${out.careersUrl ?? 'not found'}${out.ats ? ` (${out.ats.provider}: ${out.ats.slug})` : ''}`);

  // 4. Live openings from the hiring platform
  if (out.ats && FETCHABLE_ATS.has(out.ats.provider)) {
    out.jobs = await fetchJobs(out.ats.provider, out.ats.slug);
    log.push(`jobs: ${out.jobs?.length ?? 'unavailable'} (${out.jobs?.filter((j) => j.isUk).length ?? 0} in the UK)`);
  }
  return out;
}
