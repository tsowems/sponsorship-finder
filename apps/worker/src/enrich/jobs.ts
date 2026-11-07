import type { AtsProvider } from './careers';
import { fetchJson } from './http';
import { isUkLocation } from './location';

export interface FetchedJob {
  externalId: string;
  title: string;
  location: string | null;
  department: string | null;
  url: string;
  isUk: boolean;
  remote: boolean;
  postedAt: Date | null;
}

const date = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(typeof v === 'number' ? v : String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

async function greenhouse(slug: string): Promise<FetchedJob[] | null> {
  const j = await fetchJson<{ jobs?: { id: number; title: string; location?: { name?: string }; absolute_url: string; first_published?: string; updated_at?: string; departments?: { name: string }[] }[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
  );
  return j?.jobs?.map((x) => ({
    externalId: String(x.id),
    title: clean(x.title),
    location: clean(x.location?.name) || null,
    department: x.departments?.[0]?.name ?? null,
    url: x.absolute_url,
    isUk: isUkLocation(x.location?.name),
    remote: /remote/i.test(x.location?.name ?? ''),
    postedAt: date(x.first_published ?? x.updated_at),
  })) ?? null;
}

async function lever(slug: string): Promise<FetchedJob[] | null> {
  const j = await fetchJson<{ id: string; text: string; hostedUrl: string; createdAt?: number; country?: string; workplaceType?: string; categories?: { location?: string; team?: string; allLocations?: string[] } }[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  );
  if (!Array.isArray(j)) return null;
  return j.map((x) => {
    const loc = x.categories?.allLocations?.join(' / ') || x.categories?.location || null;
    return {
      externalId: x.id,
      title: clean(x.text),
      location: loc,
      department: x.categories?.team ?? null,
      url: x.hostedUrl,
      isUk: isUkLocation(loc, x.country) || (x.categories?.allLocations ?? []).some((l) => isUkLocation(l)),
      remote: x.workplaceType === 'remote',
      postedAt: date(x.createdAt),
    };
  });
}

async function ashby(slug: string): Promise<FetchedJob[] | null> {
  const j = await fetchJson<{ jobs?: { id: string; title: string; department?: string; location?: string; secondaryLocations?: { location?: string }[]; isListed?: boolean; isRemote?: boolean; jobUrl: string; publishedAt?: string; address?: { postalAddress?: { addressCountry?: string } } }[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
  );
  return j?.jobs
    ?.filter((x) => x.isListed !== false)
    .map((x) => {
      const all = [x.location, ...(x.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean) as string[];
      const country = x.address?.postalAddress?.addressCountry;
      return {
        externalId: x.id,
        title: clean(x.title),
        location: all.join(' / ') || null,
        department: x.department ?? null,
        url: x.jobUrl,
        isUk: all.some((l) => isUkLocation(l)) || /united kingdom|^uk$|^gb$/i.test(country ?? ''),
        remote: Boolean(x.isRemote),
        postedAt: date(x.publishedAt),
      };
    }) ?? null;
}

async function workable(slug: string): Promise<FetchedJob[] | null> {
  const j = await fetchJson<{ jobs?: { shortcode: string; title: string; url: string; city?: string; country?: string; telecommuting?: boolean; department?: string; published_on?: string; locations?: { city?: string; country?: string; countryCode?: string }[] }[] }>(
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`,
  );
  return j?.jobs?.map((x) => {
    const locs = x.locations?.length ? x.locations : [{ city: x.city, country: x.country }];
    const text = locs.map((l) => [l.city, l.country].filter(Boolean).join(', ')).join(' / ');
    return {
      externalId: x.shortcode,
      title: clean(x.title),
      location: text || null,
      department: x.department || null,
      url: x.url,
      isUk: locs.some((l) => isUkLocation([l.city, l.country].filter(Boolean).join(', '), 'countryCode' in l ? (l.countryCode as string) : null)),
      remote: Boolean(x.telecommuting),
      postedAt: date(x.published_on),
    };
  }) ?? null;
}

async function recruitee(slug: string): Promise<FetchedJob[] | null> {
  const j = await fetchJson<{ offers?: { id: number; title: string; careers_url: string; location?: string; country_code?: string; remote?: boolean; department?: string; published_at?: string }[] }>(
    `https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`,
  );
  return j?.offers?.map((x) => ({
    externalId: String(x.id),
    title: clean(x.title),
    location: x.location || null,
    department: x.department ?? null,
    url: x.careers_url,
    isUk: isUkLocation(x.location, x.country_code),
    remote: Boolean(x.remote),
    postedAt: date(x.published_at?.replace(' UTC', 'Z').replace(' ', 'T')),
  })) ?? null;
}

const FETCHERS: Partial<Record<AtsProvider, (slug: string) => Promise<FetchedJob[] | null>>> = { greenhouse, lever, ashby, workable, recruitee };

/** Current openings on a hiring platform, or null if the board doesn't exist / can't be read. */
export async function fetchJobs(provider: AtsProvider, slug: string): Promise<FetchedJob[] | null> {
  const f = FETCHERS[provider];
  if (!f) return null;
  try {
    const jobs = await f(slug);
    return jobs?.filter((j) => j.title && j.url).slice(0, 2000) ?? null;
  } catch {
    return null;
  }
}
