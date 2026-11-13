import { parse } from 'csv-parse/sync';
import type { Regulator, ServiceRecord } from './match';

/**
 * The two public care registers, both published under the Open Government Licence:
 *  - England: CQC's monthly "care directory" CSV (https://www.cqc.org.uk/about-us/transparency/using-cqc-data).
 *    Service type "Homecare agencies" = home care.
 *  - Scotland: the Care Inspectorate's monthly datastore CSV
 *    (https://www.careinspectorate.scot/resources-data/data-and-statistics/datastore). Subtype "Care at Home" = home care.
 * File names change every month, so each run finds the latest link on the publisher's page.
 */

const USER_AGENT = 'SponsorshipHunter/0.1 (care register importer; +https://www.sponsorshiphunter.com/about)';

const CQC_PAGE = 'https://www.cqc.org.uk/about-us/transparency/using-cqc-data';
const CI_PAGE = 'https://www.careinspectorate.scot/resources-data/data-and-statistics/datastore';
const CI_ORIGIN = 'https://www.careinspectorate.scot';

/** Below these, a file is treated as broken and the previous month's matches are kept. */
export const MIN_HOME_CARE_SERVICES: Record<Regulator, number> = { cqc: 5000, care_inspectorate: 500 };

export interface RegisterFile {
  regulator: Regulator;
  url: string;
  services: ServiceRecord[];
}

async function get(url: string, timeoutMs = 120_000): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res;
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

// ---------------------------------------------------------------- England (CQC)

/** The ratings spreadsheet's link on the same CQC page. */
export async function cqcRatingsUrl(): Promise<string> {
  const html = await (await get(CQC_PAGE, 30_000)).text();
  const url = hrefs(html).find((h) => /Latest_ratings\.ods$/i.test(h));
  if (!url) throw new Error('CQC: no ratings spreadsheet link found on the data page');
  return new URL(url, CQC_PAGE).toString();
}

export { USER_AGENT as CARE_USER_AGENT };

export async function cqcDirectoryUrl(): Promise<string> {
  const html = await (await get(CQC_PAGE, 30_000)).text();
  const url = hrefs(html).find((h) => /CQC_directory\.csv$/i.test(h));
  if (!url) throw new Error('CQC: no directory CSV link found on the data page');
  return new URL(url, CQC_PAGE).toString();
}

/** CQC's CSV starts with a few title lines; the table starts at the "Name,…" row. */
export function parseCqcDirectory(text: string): ServiceRecord[] {
  const rows: string[][] = parse(text, { relax_column_count: true, skip_empty_lines: true, bom: true });
  const h = rows.findIndex((r) => r[0] === 'Name' && r.includes('Provider name'));
  if (h < 0) throw new Error('CQC: header row not found');
  const col = (name: string) => {
    const i = rows[h].findIndex((c) => c.startsWith(name));
    if (i < 0) throw new Error(`CQC: column "${name}" missing`);
    return i;
  };
  const [type, provider, providerId, address, la, locationId] = [col('Service types'), col('Provider name'), col('CQC Provider ID'), col('Address'), col('Local authority'), col('CQC Location ID')];
  return rows
    .slice(h + 1)
    .filter((r) => r[provider] && r[providerId])
    .map((r) => ({
      regulator: 'cqc' as const,
      providerId: r[providerId],
      providerName: r[provider],
      homeCare: /homecare agencies/i.test(r[type] ?? ''),
      locationId: r[locationId],
      place: `${r[address] ?? ''} ${r[la] ?? ''}`,
    }));
}

// ---------------------------------------------------------------- Scotland (Care Inspectorate)

/** The datastore page lists monthly releases newest first; each release page links to its CSV ("260930datastoreexternal.csv"). */
export async function careInspectorateUrl(): Promise<string> {
  const html = await (await get(CI_PAGE, 30_000)).text();
  const releases = [...new Set(hrefs(html).filter((h) => /\/library\/datastore-/.test(h)))].slice(0, 3);
  const found: string[] = [];
  for (const r of releases) {
    const page = await (await get(new URL(r, CI_ORIGIN).toString(), 30_000)).text();
    const csv = hrefs(page).find((h) => /datastore[^/]*\.csv$/i.test(h));
    if (csv) found.push(new URL(csv, CI_ORIGIN).toString());
  }
  // Newest by the date at the start of the file name (yymmdd), in case the page order ever changes.
  const stamp = (u: string) => u.split('/').pop()!.match(/^\d{6}/)?.[0] ?? '';
  const best = found.sort((a, b) => stamp(b).localeCompare(stamp(a)))[0];
  if (!best) throw new Error('Care Inspectorate: no datastore CSV found');
  return best;
}

export function parseCareInspectorate(text: string): ServiceRecord[] {
  const rows: Record<string, string>[] = parse(text, { columns: true, relax_column_count: true, skip_empty_lines: true, bom: true });
  if (!rows.length || !('ServiceProvider' in rows[0])) throw new Error('Care Inspectorate: unexpected columns');
  return rows
    .filter((r) => r.ServiceStatus === 'Active' && r.ServiceProvider && r.SP_number)
    .map((r) => ({
      regulator: 'care_inspectorate' as const,
      providerId: r.SP_number,
      providerName: r.ServiceProvider,
      homeCare: /care at home/i.test(`${r.Subtype ?? ''} ${r.AdditionalSubtypes ?? ''}`),
      place: [r.Address_line_2, r.Address_line_3, r.Address_line_4, r.Service_town, r.Council_Area_Name].filter(Boolean).join(' '),
    }));
}

// ---------------------------------------------------------------- download

export async function downloadRegister(regulator: Regulator): Promise<RegisterFile> {
  if (regulator === 'cqc') {
    const url = await cqcDirectoryUrl();
    return { regulator, url, services: parseCqcDirectory(await (await get(url)).text()) };
  }
  const url = await careInspectorateUrl();
  // The Scottish file isn't UTF-8.
  const text = new TextDecoder('windows-1252').decode(await (await get(url)).arrayBuffer());
  return { regulator, url, services: parseCareInspectorate(text) };
}
