import { fetchJson } from './http';

/**
 * Councils, NHS bodies, universities, colleges, schools and police forces aren't companies: no Companies House
 * number and no "Ltd", so the usual website checks can't confirm them. Instead we rely on:
 *  - GOV.UK's local-authority lookup (official council homepages), and
 *  - protected public-sector domains (.gov.uk, .nhs.uk, .ac.uk…), which only genuine public bodies can register:
 *    a page on one of these that names the organisation is accepted.
 */

/** Domains only issued to UK public bodies (or their schools/colleges). */
const PROTECTED_SUFFIXES = ['.gov.uk', '.nhs.uk', '.ac.uk', '.sch.uk', '.police.uk', '.mod.uk', '.parliament.uk', '.gov.scot', '.nhs.scot', '.gov.wales', '.llyw.cymru'];

export function isProtectedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return PROTECTED_SUFFIXES.some((s) => h.endsWith(s));
}

export type PublicBodyKind = 'council' | 'university' | 'college' | 'nhs' | 'school' | 'police';

export function publicBodyKind(normalizedName: string): PublicBodyKind | null {
  const n = ` ${normalizedName} `;
  if (/ nhs | health board | ambulance service /.test(n)) return 'nhs';
  if (/ council | borough of /.test(n)) return 'council';
  if (/ university /.test(n)) return 'university';
  if (/ college /.test(n)) return 'college';
  if (/ police | constabulary /.test(n)) return 'police';
  if (/ school | academy | academies /.test(n)) return 'school';
  return null;
}

const COUNCIL_WORDS = new Set(['the', 'council', 'city', 'county', 'borough', 'district', 'metropolitan', 'royal', 'of', 'london', 'corporation']);

/** "leeds city council" → ["leeds"]; "london borough of tower hamlets" → ["tower-hamlets"]; "city of york council" → ["york"] */
export function councilSlugs(normalizedName: string): string[] {
  const words = normalizedName.split(' ');
  const place = words.filter((w) => !COUNCIL_WORDS.has(w));
  if (!place.length) return [];
  const slugs = [place.join('-')];
  // Some GOV.UK slugs keep "city of" / "county" ("city-of-london", "county-durham").
  if (words.includes('city')) slugs.push(`city-of-${place.join('-')}`);
  if (words.includes('county')) slugs.push(`county-${place.join('-')}`);
  return [...new Set(slugs)];
}

const sameName = (a: string, b: string) => a === b || a.includes(b) || b.includes(a);

/** A council's homepage from GOV.UK's "find your local council" data, if the name matches. */
export async function govukCouncilWebsite(normalizedName: string, normalize: (s: string) => string): Promise<string | null> {
  for (const slug of councilSlugs(normalizedName)) {
    const j = await fetchJson<{ local_authority?: { name?: string; homepage_url?: string } }>(
      `https://www.gov.uk/api/local-authority/${encodeURIComponent(slug)}`,
    ).catch(() => null);
    const la = j?.local_authority;
    if (la?.homepage_url && la.name && sameName(normalize(la.name), normalizedName)) return la.homepage_url;
  }
  return null;
}

/** Likely public-sector domains: "university of leeds" → leeds.ac.uk; "leeds city council" → leeds.gov.uk. */
export function publicDomainGuesses(normalizedName: string, kind: PublicBodyKind | null): string[] {
  if (!kind) return [];
  const words = normalizedName.split(' ');
  const join = (ws: string[]) => ws.join('');
  const hyph = (ws: string[]) => ws.join('-');
  const out: string[] = [];
  if (kind === 'council') {
    const place = words.filter((w) => !COUNCIL_WORDS.has(w));
    if (place.length) out.push(`${join(place)}.gov.uk`, `${hyph(place)}.gov.uk`);
  } else if (kind === 'university') {
    const core = words.filter((w) => !['the', 'university', 'of'].includes(w));
    if (core.length) out.push(`${join(core)}.ac.uk`, `${hyph(core)}.ac.uk`);
  } else if (kind === 'college') {
    const all = words.filter((w) => w !== 'the');
    const core = all.filter((w) => w !== 'college' && w !== 'of');
    out.push(`${join(all)}.ac.uk`);
    if (core.length) out.push(`${join(core)}.ac.uk`);
  }
  return [...new Set(out)].filter((d) => d.split('.')[0].length >= 3);
}

const ODS = 'https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations';

/** An NHS organisation's website from the NHS Organisation Data Service (ODS), matched on its exact name. */
/** Words that don't tell NHS bodies apart, and common short forms. */
const NHS_FILLER = new Set(['the', 'nhs', 'foundation', 'trust', 'and', 'of', 'for']);
const NHS_SHORT: Record<string, string[]> = { icb: ['integrated', 'care', 'board'], uhb: ['university', 'health', 'board'], hosp: ['hospital'] };

/**
 * Key words of an NHS body's name, order-free: "The Great Western Hospitals NHS Foundation Trust" and
 * "GREAT WESTERN HOSPITALS NHS FOUNDATION TRUST" → "great hospitals western"; "Bradford District Care Trust NHS" and
 * "Bradford District Care NHS Foundation Trust" → "bradford care district"; "NHS Kent and Medway ICB" →
 * "board care integrated kent medway".
 */
export function nhsNameKey(normalizedName: string): string {
  const words = normalizedName.split(' ').flatMap((w) => NHS_SHORT[w] ?? [w]).filter((w) => w && !NHS_FILLER.has(w));
  return [...new Set(words)].sort().join(' ');
}

/** The distinctive words in their original order, for searching ("great western hospitals"). */
const nhsSearchTerm = (normalizedName: string) =>
  normalizedName.split(' ').flatMap((w) => NHS_SHORT[w] ?? [w]).filter((w) => w && !NHS_FILLER.has(w)).slice(0, 3).join(' ');

/** Looks like an NHS organisation's own name in the NHS directory (not a GP surgery or pharmacy listed there). */
const NHS_ORG_NAME = /\b(nhs|trust|board|ambulance|health and social care|commissioning support)\b/;

export async function nhsOdsWebsite(normalizedName: string, normalize: (s: string) => string): Promise<string | null> {
  const key = nhsNameKey(normalizedName);
  const search = nhsSearchTerm(normalizedName);
  if (key.split(' ').length < 2 || search.length < 4) return null;
  // ODS searches by name fragment, so the distinctive words find the body whatever "The" / "Foundation" it has.
  const list = await fetchJson<{ Organisations?: { Name: string; Status: string; OrgLink: string }[] }>(
    `${ODS}?Name=${encodeURIComponent(search)}&Status=Active&Limit=50`,
  ).catch(() => null);
  const match = list?.Organisations?.find((o) => {
    const n = normalize(o.Name);
    return o.Status === 'Active' && NHS_ORG_NAME.test(n) && nhsNameKey(n) === key;
  });
  if (!match || !match.OrgLink.startsWith(`${ODS}/`)) return null;
  const detail = await fetchJson<{ Organisation?: { Contacts?: { Contact?: { type: string; value: string }[] } } }>(match.OrgLink).catch(() => null);
  const site = detail?.Organisation?.Contacts?.Contact?.find((c) => c.type === 'http')?.value;
  if (!site) return null;
  const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  try {
    const u = new URL(url.toLowerCase());
    return `${u.protocol}//${u.hostname}/`;
  } catch {
    return null;
  }
}
