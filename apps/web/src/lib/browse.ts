import { cacheLife, cacheTag } from 'next/cache';
import { and, asc, count, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { getDb, sponsors } from '@sponsors/db';

/**
 * Browse pages: A–Z and by town, with "next / previous" paging that continues from the last
 * company shown (keyset paging), so every licensed sponsor is reachable and deep pages stay fast.
 *
 * The small indexes (letters, towns) are cached for everyone. The paged lists are NOT cached:
 * each cursor would be a separate Vercel ISR write (see docs/08-glossary-and-decisions.md).
 */

export const BROWSE_PAGE_SIZE = 50;
/** Town pages with fewer licensed sponsors than this are kept out of search engines (thin pages). */
export const MIN_INDEXED_TOWN = 3;

export const LETTERS = ['0-9', ...'abcdefghijklmnopqrstuvwxyz'.split('')] as const;
export type Letter = (typeof LETTERS)[number];

export const isLetter = (v: string): v is Letter => (LETTERS as readonly string[]).includes(v);
export const letterLabel = (l: Letter) => (l === '0-9' ? '0–9' : l.toUpperCase());

/** Normalised names are only [a-z0-9 ], so a letter is a simple range (and uses the name index). */
function letterRange(l: Letter): SQL {
  if (l === '0-9') return and(gte(sponsors.normalizedName, '0'), lt(sponsors.normalizedName, 'a'))!;
  const next = l === 'z' ? '{' : String.fromCharCode(l.charCodeAt(0) + 1);
  return and(gte(sponsors.normalizedName, l), lt(sponsors.normalizedName, next))!;
}

/** "milton keynes" ⇄ "milton-keynes". Normalised towns are only [a-z0-9 ], so this is reversible. */
export const townSlug = (normalizedTown: string) => normalizedTown.replace(/ /g, '-');
export const townFromSlug = (slug: string) => (/^[a-z0-9-]{1,80}$/.test(slug) ? slug.replace(/-/g, ' ') : null);

// ---------------------------------------------------------------- indexes (cached)

export async function getLetterCounts(): Promise<Record<Letter, number>> {
  'use cache';
  cacheLife('days');
  cacheTag('sponsors');
  const rows = await getDb()
    .select({ first: sql<string>`left(${sponsors.normalizedName}, 1)`, n: count() })
    .from(sponsors)
    .where(eq(sponsors.status, 'active'))
    .groupBy(sql`1`);
  const out = Object.fromEntries(LETTERS.map((l) => [l, 0])) as Record<Letter, number>;
  for (const r of rows) {
    const key: Letter | null = /[0-9]/.test(r.first) ? '0-9' : isLetter(r.first) ? r.first : null;
    if (key) out[key] += r.n;
  }
  return out;
}

export interface TownCount {
  slug: string;
  /** Most common spelling on the register, e.g. "Milton Keynes". */
  name: string;
  count: number;
}

/** Every town with at least one licensed sponsor, A–Z. */
export async function getTowns(): Promise<TownCount[]> {
  'use cache';
  cacheLife('days');
  cacheTag('sponsors');
  const rows = await getDb()
    .select({
      normalized: sponsors.normalizedTown,
      name: sql<string>`mode() within group (order by ${sponsors.town})`,
      count: count(),
    })
    .from(sponsors)
    .where(and(eq(sponsors.status, 'active'), sql`${sponsors.normalizedTown} <> ''`))
    .groupBy(sponsors.normalizedTown)
    .orderBy(asc(sponsors.normalizedTown));
  return rows.map((r) => ({ slug: townSlug(r.normalized), name: r.name, count: r.count }));
}

// ---------------------------------------------------------------- paged lists (not cached)

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

export interface Cursor {
  after?: number;
  before?: number;
}

export interface BrowsePage {
  rows: Awaited<ReturnType<typeof pageOf>>['rows'];
  total: number;
  /** id to put in ?before= for the previous page, or null on the first page. */
  prev: number | null;
  /** id to put in ?after= for the next page, or null on the last page. */
  next: number | null;
}

async function pageOf(where: SQL, cursor: Cursor) {
  const db = getDb();
  const anchorId = cursor.after ?? cursor.before;
  // Position = (normalized_name, id) of the company the cursor points at.
  const anchor = anchorId
    ? sql`(select ${sponsors.normalizedName}, ${sponsors.id} from ${sponsors} where ${sponsors.id} = ${anchorId})`
    : null;
  const backwards = cursor.before !== undefined;
  const position = anchor ? (backwards ? sql`(${sponsors.normalizedName}, ${sponsors.id}) < ${anchor}` : sql`(${sponsors.normalizedName}, ${sponsors.id}) > ${anchor}`) : undefined;
  const order = backwards ? [desc(sponsors.normalizedName), desc(sponsors.id)] : [asc(sponsors.normalizedName), asc(sponsors.id)];

  const fetched = await db.select(listColumns).from(sponsors).where(and(where, position)).orderBy(...order).limit(BROWSE_PAGE_SIZE + 1);
  const more = fetched.length > BROWSE_PAGE_SIZE;
  const rows = fetched.slice(0, BROWSE_PAGE_SIZE);
  if (backwards) rows.reverse();
  return { rows, more, backwards, hasAnchor: Boolean(anchor) };
}

async function browse(where: SQL, cursor: Cursor): Promise<BrowsePage> {
  const [{ rows, more, backwards, hasAnchor }, [{ total }]] = await Promise.all([
    pageOf(where, cursor),
    getDb().select({ total: count() }).from(sponsors).where(where),
  ]);
  const first = rows[0]?.id ?? null;
  const last = rows.at(-1)?.id ?? null;
  return {
    rows,
    total,
    // Going forwards there's a previous page whenever we started from a cursor; going backwards, only if more rows remain.
    prev: (backwards ? more : hasAnchor) ? first : null,
    next: (backwards ? true : more) && rows.length ? last : null,
  };
}

export function browseLetter(letter: Letter, cursor: Cursor) {
  return browse(and(eq(sponsors.status, 'active'), letterRange(letter))!, cursor);
}

export function browseTown(normalizedTown: string, cursor: Cursor) {
  return browse(and(eq(sponsors.status, 'active'), eq(sponsors.normalizedTown, normalizedTown))!, cursor);
}

/** Read ?after= / ?before= (positive integer ids). */
export function readCursor(sp: Record<string, string | string[] | undefined>): Cursor {
  const num = (v: string | string[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const after = num(sp.after);
  const before = after ? undefined : num(sp.before);
  return { after, before };
}
