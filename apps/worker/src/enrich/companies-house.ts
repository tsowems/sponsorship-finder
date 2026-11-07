import { normalizeName, normalizeTown } from '@sponsors/db/normalize';
import { fetchJson } from './http';

const API = 'https://api.company-information.service.gov.uk';
/** Companies House allows 600 requests per 5 minutes; stay well under. */
const MIN_INTERVAL_MS = 600;
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

export const companiesHouseEnabled = () => Boolean(process.env.COMPANIES_HOUSE_API_KEY);

async function ch<T>(path: string): Promise<T | null> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return null;
  await throttle();
  return fetchJson<T>(`${API}${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` } });
}

interface SearchItem {
  title: string;
  company_number: string;
  company_status?: string;
  date_of_creation?: string;
  address?: { locality?: string; post_town?: string };
  address_snippet?: string;
}

export interface CompanyRecord {
  companyNumber: string;
  companyName: string;
  companyStatus: string | null;
  incorporatedOn: string | null;
  sicCodes: string[];
}

/** Pick the Companies House company that is this sponsor: exact name match, active first, same town first. */
export function pickCompany(items: SearchItem[], normalizedName: string, normalizedTown: string): SearchItem | null {
  const exact = items.filter((i) => normalizeName(i.title) === normalizedName);
  if (exact.length === 0) return null;
  const score = (i: SearchItem) =>
    (i.company_status === 'active' ? 2 : 0) +
    (normalizeTown(i.address?.locality ?? i.address?.post_town ?? '') === normalizedTown ? 2 : 0) +
    (normalizeTown(i.address_snippet ?? '').includes(normalizedTown) ? 1 : 0);
  return [...exact].sort((a, b) => score(b) - score(a))[0];
}

export async function findCompany(name: string, normalizedName: string, normalizedTown: string): Promise<CompanyRecord | null> {
  const search = await ch<{ items?: SearchItem[] }>(`/search/companies?q=${encodeURIComponent(name)}&items_per_page=20`);
  const hit = pickCompany(search?.items ?? [], normalizedName, normalizedTown);
  if (!hit) return null;
  const profile = await ch<{ company_name?: string; company_status?: string; date_of_creation?: string; sic_codes?: string[] }>(
    `/company/${encodeURIComponent(hit.company_number)}`,
  );
  return {
    companyNumber: hit.company_number,
    companyName: profile?.company_name ?? hit.title,
    companyStatus: profile?.company_status ?? hit.company_status ?? null,
    incorporatedOn: profile?.date_of_creation ?? hit.date_of_creation ?? null,
    sicCodes: profile?.sic_codes ?? [],
  };
}
