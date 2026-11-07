import { cacheLife, cacheTag } from 'next/cache';
import { and, asc, count, desc, eq, gte, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import {
  getDb,
  jobs,
  normalizeName,
  normalizeTown,
  registerSnapshots,
  sponsorEvents,
  sponsorProfiles,
  sponsors,
  type SponsorEventType,
} from '@sponsors/db';

export const PAGE_SIZE = 25;
export const SITEMAP_CHUNK = 45_000;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const listColumns = {
  id: sponsors.id,
  slug: sponsors.slug,
  name: sponsors.name,
  town: sponsors.town,
  county: sponsors.county,
  rating: sponsors.rating,
  status: sponsors.status,
  firstSeenAt: sponsors.firstSeenAt,
  removedAt: sponsors.removedAt,
  inBaseline: sponsors.inBaseline,
};

export type SponsorListItem = Awaited<ReturnType<typeof searchSponsors>>['results'][number];

// ---------------------------------------------------------------- sponsor page

export async function getSponsorBySlug(slug: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('sponsors', `sponsor:${slug}`);

  const db = getDb();
  const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.slug, slug)).limit(1);
  if (!sponsor) return null;

  const events = await db
    .select({ id: sponsorEvents.id, type: sponsorEvents.type, oldValue: sponsorEvents.oldValue, newValue: sponsorEvents.newValue, occurredAt: sponsorEvents.occurredAt })
    .from(sponsorEvents)
    .where(eq(sponsorEvents.sponsorId, sponsor.id))
    .orderBy(desc(sponsorEvents.occurredAt), desc(sponsorEvents.id));

  const [tracking] = await db
    .select({ since: sql<Date>`min(${registerSnapshots.publishedAt})`.mapWith((v) => new Date(v)) })
    .from(registerSnapshots);

  // Other sponsors with the same name in other towns (often branches / separate licences)
  const sameName = await db
    .select({ slug: sponsors.slug, name: sponsors.name, town: sponsors.town, status: sponsors.status })
    .from(sponsors)
    .where(and(eq(sponsors.normalizedName, sponsor.normalizedName), sql`${sponsors.id} <> ${sponsor.id}`))
    .limit(10);

  const [profile] = await db.select().from(sponsorProfiles).where(eq(sponsorProfiles.sponsorId, sponsor.id));

  // UK roles first, newest first
  const openJobs = profile?.jobsCount
    ? await db
        .select({ id: jobs.id, title: jobs.title, location: jobs.location, department: jobs.department, url: jobs.url, isUk: jobs.isUk, remote: jobs.remote, postedAt: jobs.postedAt })
        .from(jobs)
        .where(eq(jobs.sponsorId, sponsor.id))
        .orderBy(desc(jobs.isUk), sql`${jobs.postedAt} desc nulls last`, asc(jobs.title))
        .limit(12)
    : [];

  return { sponsor, events, trackingSince: tracking?.since ?? null, sameName, profile: profile ?? null, jobs: openJobs };
}

// ---------------------------------------------------------------- search

export interface SearchInput {
  q?: string;
  town?: string;
  rating?: 'A' | 'B';
  status?: 'active' | 'removed' | 'all';
  page: number;
}

export async function searchSponsors(input: SearchInput) {
  'use cache';
  cacheLife('hours');
  cacheTag('sponsors');

  const db = getDb();
  const nq = input.q ? normalizeName(input.q) : '';
  const nt = input.town ? normalizeTown(input.town) : '';
  const status = input.status ?? 'active';

  const filters: (SQL | undefined)[] = [
    status === 'all' ? undefined : eq(sponsors.status, status),
    nt ? eq(sponsors.normalizedTown, nt) : undefined,
    input.rating === 'B' ? sql`${sponsors.rating} like 'B%'` : input.rating === 'A' ? sql`${sponsors.rating} like 'A%'` : undefined,
  ];
  const where = and(...filters, nq ? ilike(sponsors.normalizedName, `%${escapeLike(nq)}%`) : undefined);

  const orderBy = nq
    ? [sql`(${sponsors.normalizedName} like ${`${escapeLike(nq)}%`}) desc`, sql`length(${sponsors.normalizedName})`, asc(sponsors.normalizedName)]
    : [asc(sponsors.normalizedName)];

  const [results, [{ total }]] = await Promise.all([
    db.select(listColumns).from(sponsors).where(where).orderBy(...orderBy).limit(PAGE_SIZE).offset((input.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(sponsors).where(where),
  ]);

  // Nothing matched literally: offer close spellings ("did you mean")
  let suggestions: typeof results = [];
  if (total === 0 && nq.length >= 3) {
    // Default threshold (0.6) misses transposed letters ("delloite" vs "deloitte" scores 0.5).
    // SET LOCAL scopes the lower threshold to this transaction; `<%` still uses the trigram index.
    suggestions = await db.transaction(async (tx) => {
      await tx.execute(sql`set local pg_trgm.word_similarity_threshold = 0.45`);
      return tx
        .select(listColumns)
        .from(sponsors)
        .where(and(...filters, sql`${nq} <% ${sponsors.normalizedName}`))
        .orderBy(sql`word_similarity(${nq}, ${sponsors.normalizedName}) desc`, sql`length(${sponsors.normalizedName})`)
        .limit(10);
    });
  }

  return { results, total, suggestions };
}

// ---------------------------------------------------------------- changes feed

export type ChangeFilter = 'all' | 'added' | 'removed' | 'downgraded' | 'readded' | 'moved' | 'routes';

export async function getChanges(filter: ChangeFilter, page: number, pageSize = 50) {
  'use cache';
  cacheLife('hours');
  cacheTag('sponsors');

  const db = getDb();
  const typeFilter: Record<ChangeFilter, SQL | undefined> = {
    all: undefined,
    added: eq(sponsorEvents.type, 'added'),
    removed: eq(sponsorEvents.type, 'removed'),
    readded: eq(sponsorEvents.type, 'readded'),
    downgraded: and(eq(sponsorEvents.type, 'rating_changed'), sql`${sponsorEvents.newValue} like 'B%'`),
    moved: eq(sponsorEvents.type, 'location_changed'),
    routes: eq(sponsorEvents.type, 'routes_changed'),
  };
  const where = typeFilter[filter];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: sponsorEvents.id,
        type: sponsorEvents.type,
        oldValue: sponsorEvents.oldValue,
        newValue: sponsorEvents.newValue,
        occurredAt: sponsorEvents.occurredAt,
        slug: sponsors.slug,
        name: sponsors.name,
        town: sponsors.town,
      })
      .from(sponsorEvents)
      .innerJoin(sponsors, eq(sponsors.id, sponsorEvents.sponsorId))
      .where(where)
      .orderBy(desc(sponsorEvents.occurredAt), asc(sponsors.normalizedName))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(sponsorEvents).where(where),
  ]);
  return { rows, total, pageSize };
}

export type ChangeRow = Awaited<ReturnType<typeof getChanges>>['rows'][number];

// ---------------------------------------------------------------- home page

export async function getOverview() {
  'use cache';
  cacheLife('hours');
  cacheTag('sponsors');

  const db = getDb();
  const [[{ active }], [latest], [first], recent] = await Promise.all([
    db.select({ active: count() }).from(sponsors).where(eq(sponsors.status, 'active')),
    db.select().from(registerSnapshots).orderBy(desc(registerSnapshots.publishedAt)).limit(1),
    db.select({ publishedAt: registerSnapshots.publishedAt }).from(registerSnapshots).orderBy(asc(registerSnapshots.publishedAt)).limit(1),
    db
      .select({ type: sponsorEvents.type, n: count() })
      .from(sponsorEvents)
      .where(and(gte(sponsorEvents.occurredAt, sql`now() - interval '30 days'`), inArray(sponsorEvents.type, ['added', 'removed'] satisfies SponsorEventType[])))
      .groupBy(sponsorEvents.type),
  ]);
  const [[{ downgraded }]] = await Promise.all([
    db
      .select({ downgraded: count() })
      .from(sponsorEvents)
      .where(and(eq(sponsorEvents.type, 'rating_changed'), sql`${sponsorEvents.newValue} like 'B%'`, gte(sponsorEvents.occurredAt, sql`now() - interval '30 days'`))),
  ]);
  const last30 = Object.fromEntries(recent.map((r) => [r.type, r.n])) as Partial<Record<SponsorEventType, number>>;
  return {
    activeSponsors: active,
    latestSnapshot: latest ?? null,
    trackingSince: first?.publishedAt ?? null,
    last30: { added: last30.added ?? 0, removed: last30.removed ?? 0, downgraded },
  };
}

// ---------------------------------------------------------------- sitemaps

export async function getSponsorSitemapCount() {
  'use cache';
  cacheLife('days');
  const [{ n }] = await getDb().select({ n: count() }).from(sponsors);
  return Math.max(1, Math.ceil(n / SITEMAP_CHUNK));
}

export async function getSponsorSitemapChunk(chunk: number) {
  'use cache';
  cacheLife('hours');
  return getDb()
    .select({ slug: sponsors.slug, updatedAt: sponsors.updatedAt })
    .from(sponsors)
    .orderBy(asc(sponsors.id))
    .limit(SITEMAP_CHUNK)
    .offset(chunk * SITEMAP_CHUNK);
}

// ---------------------------------------------------------------- type-ahead

export interface Suggestion {
  slug: string;
  name: string;
  town: string;
  status: 'active' | 'removed';
  rating: string;
}

/** Fast, small result set for the search box. Licensed sponsors rank above removed ones. */
export async function suggestSponsors(q: string): Promise<Suggestion[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('sponsors');

  const nq = normalizeName(q);
  if (nq.length < 2) return [];
  const db = getDb();
  const cols = { slug: sponsors.slug, name: sponsors.name, town: sponsors.town, status: sponsors.status, rating: sponsors.rating };
  const like = escapeLike(nq);

  const rows = await db
    .select(cols)
    .from(sponsors)
    // 2 characters: prefix only (trigram index needs 3+). 3+: anywhere in the name.
    .where(nq.length < 3 ? sql`${sponsors.normalizedName} like ${`${like}%`}` : ilike(sponsors.normalizedName, `%${like}%`))
    .orderBy(
      sql`(${sponsors.status} = 'active') desc`,
      sql`(${sponsors.normalizedName} like ${`${like}%`}) desc`,
      sql`length(${sponsors.normalizedName})`,
      asc(sponsors.normalizedName),
    )
    .limit(8);
  if (rows.length || nq.length < 4) return rows;

  return db.transaction(async (tx) => {
    await tx.execute(sql`set local pg_trgm.word_similarity_threshold = 0.45`);
    return tx
      .select(cols)
      .from(sponsors)
      .where(sql`${nq} <% ${sponsors.normalizedName}`)
      .orderBy(sql`word_similarity(${nq}, ${sponsors.normalizedName}) desc`, sql`length(${sponsors.normalizedName})`)
      .limit(8);
  });
}
