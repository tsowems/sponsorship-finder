import { normalizeName, normalizeTown } from '@sponsors/db/normalize';
import { coreTokens, domainLabel } from './domains';
import { htmlToText, pageTitle } from './html';

export type VerifiedBy = 'company_number' | 'company_name' | 'domain_and_title';

const PARKED = [
  /domain (?:name )?(?:is )?for sale/i, /buy this domain/i, /this domain (?:may be|is) for sale/i, /parked (?:free|domain)/i,
  /sedoparking|parkingcrew|bodis\.com|dan\.com|afternic|hugedomains|domainmarket|undeveloped\.com/i,
  /this site can.t be reached|account suspended|default web site page|welcome to nginx|it works!/i,
];

export function isParkedPage(html: string): boolean {
  const sample = html.slice(0, 60_000);
  return PARKED.some((re) => re.test(sample));
}

/** "SC123456", "01234567" or "1234567" → canonical 8-character Companies House number. */
export function canonicalCompanyNumber(n: string): string {
  const v = n.toUpperCase().replace(/\s+/g, '');
  return /^\d+$/.test(v) ? v.padStart(8, '0') : v;
}

/** Company numbers mentioned on a page, canonicalised. Looks near words like "company number" and "registered". */
export function companyNumbersOnPage(text: string): Set<string> {
  const found = new Set<string>();
  const re = /(?:company|registration|registered|reg\.?|crn)[^0-9a-z]{0,40}(?:no\.?|number|num\.?|#)?[^0-9a-z]{0,10}((?:SC|NI|OC|SO|NC|R0|FC|GE|LP|SL|SE)?\s?\d{6,8})\b/gi;
  for (const m of text.matchAll(re)) found.add(canonicalCompanyNumber(m[1]));
  return found;
}

export interface VerifyInput {
  html: string;
  url: string;
  companyNumber: string | null;
  /** Normalised registered name, e.g. "acme robotics limited". */
  normalizedName: string;
  town: string;
}

/**
 * Is this page the company's own website? Strongest evidence first:
 *  1. its Companies House number appears (UK companies must show it on their website)
 *  2. its full registered name appears ("Acme Robotics Ltd")
 *  3. the domain *is* the name, the page title names it, and the page mentions its town
 */
export function verifyPage(input: VerifyInput): VerifiedBy | null {
  if (isParkedPage(input.html)) return null;
  const text = htmlToText(input.html);

  if (input.companyNumber && companyNumbersOnPage(text).has(canonicalCompanyNumber(input.companyNumber))) return 'company_number';

  const normText = ` ${normalizeName(text)} `;
  const hasSuffix = /\b(limited|plc|llp|cic)\b/.test(input.normalizedName);
  if (hasSuffix && input.normalizedName.length >= 10 && normText.includes(` ${input.normalizedName} `)) return 'company_name';

  const core = coreTokens(input.normalizedName);
  const coreJoined = core.join('');
  const label = domainLabel(new URL(input.url).hostname);
  const normTitle = ` ${normalizeName(pageTitle(input.html))} `;
  const town = normalizeTown(input.town);
  if (
    coreJoined.length >= 6 &&
    (label === coreJoined || label === `${coreJoined}uk` || label === `${coreJoined}group`) &&
    normTitle.includes(` ${core.join(' ')} `) &&
    town.length > 2 &&
    normText.includes(` ${town} `)
  ) {
    return 'domain_and_title';
  }
  return null;
}

/** Links worth checking for the company number when the homepage doesn't show it. */
export function legalPageCandidates(links: { href: string; text: string }[], origin: string): string[] {
  const re = /privacy|terms|legal|imprint|contact|about|cookie|company-information|disclaimer/i;
  return [...new Set(links.filter((l) => l.href.startsWith(origin) && (re.test(l.href) || re.test(l.text))).map((l) => l.href.split('#')[0]))].slice(0, 3);
}
