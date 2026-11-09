import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { and, asc, desc, eq, gt, gte, ilike, lt, sql, type SQL } from 'drizzle-orm';
import {
  getDb,
  jobs,
  normalizeName,
  normalizeTown,
  sponsorEvents,
  sponsorEventType,
  sponsorProfiles,
  sponsors,
  type SponsorEventType,
} from '@sponsors/db';
import { SITE_URL } from './site';

/**
 * Data API for our own other apps/services: /api/v1/*.
 *
 * Access: `Authorization: Bearer <key>` (or `x-api-key: <key>`), where <key> is one of the
 * comma-separated values in the API_KEYS env var. No keys configured = API switched off.
 * API_CORS_ORIGINS (comma-separated, optional) allows browser calls from those origins, but a
 * key used in a browser is visible to anyone, so prefer calling from a server.
 */

const sha = (s: string) => createHash('sha256').update(s).digest();

function configuredKeys(): Buffer[] {
  return (process.env.API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length >= 16)
    .map(sha);
}

function presentedKey(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-api-key')?.trim() || null;
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowed = (process.env.API_CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!origin || !(allowed.includes(origin) || allowed.includes('*'))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function apiJson(request: Request, data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', ...corsHeaders(request) } });
}

export function apiError(request: Request, status: number, message: string) {
  return apiJson(request, { error: message }, status);
}

/** Preflight for browser callers. */
export function apiOptions(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

/** Returns an error Response when the caller isn't allowed, otherwise null. */
export function requireApiKey(request: Request): Response | null {
  const keys = configuredKeys();
  if (keys.length === 0) return apiError(request, 503, 'API not enabled (API_KEYS is not set)');
  const given = presentedKey(request);
  if (!given) return apiError(request, 401, 'Missing API key: send "Authorization: Bearer <key>"');
  const h = sha(given);
  // Compare against every key (constant time per key) so timing doesn't reveal which matched.
  let ok = false;
  for (const k of keys) ok = timingSafeEqual(h, k) || ok;
  return ok ? null : apiError(request, 401, 'Invalid API key');
}

// ---------------------------------------------------------------- parameter parsing

export class BadRequest extends Error {}

function parseDate(name: string, v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequest(`${name} must be an ISO date, e.g. 2026-11-01 or 2026-11-01T09:00:00Z`);
  return d;
}

function parseLimit(v: string | null, def: number, max: number): number {
  if (!v) return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new BadRequest('limit must be a positive integer');
  return Math.min(n, max);
}

function parseCursor(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new BadRequest('cursor must be the next_cursor value from a previous response');
  return n;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------------------------------------------------------------- sponsors list

const sponsorColumns = {
  id: sponsors.id,
  slug: sponsors.slug,
  name: sponsors.name,
  town: sponsors.town,
  county: sponsors.county,
  rating: sponsors.rating,
  routes: sponsors.routes,
  status: sponsors.status,
  firstSeenAt: sponsors.firstSeenAt,
  lastSeenAt: sponsors.lastSeenAt,
  removedAt: sponsors.removedAt,
  inBaseline: sponsors.inBaseline,
  updatedAt: sponsors.updatedAt,
  companyNumber: sponsorProfiles.companyNumber,
  website: sponsorProfiles.website,
  careersUrl: sponsorProfiles.careersUrl,
  atsProvider: sponsorProfiles.atsProvider,
  jobsCount: sponsorProfiles.jobsCount,
  ukJobsCount: sponsorProfiles.ukJobsCount,
};

type SponsorRow = { [K in keyof typeof sponsorColumns]: unknown } & { slug: string; jobsCount: number | null; ukJobsCount: number | null };

function shapeSponsor<T extends SponsorRow>(r: T) {
  const { jobsCount, ukJobsCount, ...rest } = r;
  return { ...rest, jobsCount: jobsCount ?? 0, ukJobsCount: ukJobsCount ?? 0, pageUrl: `${SITE_URL}/sponsors/${r.slug}` };
}

/**
 * GET /api/v1/sponsors
 *   q             name contains (case/punctuation-insensitive)
 *   town          exact town (normalised)
 *   rating        A | B
 *   status        active (default) | removed | all
 *   route         visa route held, e.g. "Skilled Worker"
 *   has_website   true | false
 *   has_jobs      true  (sponsors with at least one open role found)
 *   updated_since ISO date: only sponsors whose register data changed since then (use status=all to see removals)
 *   limit         1-1000 (default 100)
 *   cursor        next_cursor from the previous page
 * Ordered by id; follow next_cursor until it is null to read everything.
 */
export async function listSponsorsApi(sp: URLSearchParams) {
  const status = sp.get('status') ?? 'active';
  if (!['active', 'removed', 'all'].includes(status)) throw new BadRequest('status must be active, removed or all');
  const rating = sp.get('rating')?.toUpperCase();
  if (rating && rating !== 'A' && rating !== 'B') throw new BadRequest('rating must be A or B');
  const nq = normalizeName((sp.get('q') ?? '').slice(0, 100));
  const nt = normalizeTown((sp.get('town') ?? '').slice(0, 60));
  const route = sp.get('route')?.trim().slice(0, 80);
  const hasWebsite = sp.get('has_website');
  const updatedSince = parseDate('updated_since', sp.get('updated_since'));
  const limit = parseLimit(sp.get('limit'), 100, 1000);
  const cursor = parseCursor(sp.get('cursor'));

  const where = and(
    status === 'all' ? undefined : eq(sponsors.status, status as 'active' | 'removed'),
    nq ? ilike(sponsors.normalizedName, `%${escapeLike(nq)}%`) : undefined,
    nt ? eq(sponsors.normalizedTown, nt) : undefined,
    rating ? sql`${sponsors.rating} like ${`${rating}%`}` : undefined,
    route ? sql`exists (select 1 from unnest(${sponsors.routes}) r where lower(r) = lower(${route}))` : undefined,
    hasWebsite === 'true' ? sql`${sponsorProfiles.website} is not null` : hasWebsite === 'false' ? sql`${sponsorProfiles.website} is null` : undefined,
    sp.get('has_jobs') === 'true' ? gt(sponsorProfiles.jobsCount, 0) : undefined,
    updatedSince ? gte(sponsors.updatedAt, updatedSince) : undefined,
    cursor ? gt(sponsors.id, cursor) : undefined,
  );

  const rows = await getDb()
    .select(sponsorColumns)
    .from(sponsors)
    .leftJoin(sponsorProfiles, eq(sponsorProfiles.sponsorId, sponsors.id))
    .where(where)
    .orderBy(asc(sponsors.id))
    .limit(limit + 1);

  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  return { data: page.map(shapeSponsor), next_cursor: more ? String(page[page.length - 1].id) : null };
}

// ---------------------------------------------------------------- one sponsor

/** GET /api/v1/sponsors/{slug or id}: register data, Companies House/website details, full history and open roles. */
export async function getSponsorApi(idOrSlug: string) {
  const db = getDb();
  const byId = /^\d+$/.test(idOrSlug) ? Number(idOrSlug) : null;
  const [row] = await db
    .select({
      ...sponsorColumns,
      companyName: sponsorProfiles.companyName,
      companyStatus: sponsorProfiles.companyStatus,
      incorporatedOn: sponsorProfiles.incorporatedOn,
      sicCodes: sponsorProfiles.sicCodes,
      jobsCheckedAt: sponsorProfiles.jobsCheckedAt,
      profileCheckedAt: sponsorProfiles.checkedAt,
    })
    .from(sponsors)
    .leftJoin(sponsorProfiles, eq(sponsorProfiles.sponsorId, sponsors.id))
    // Slugs always end in the town, so an all-digit value is an id.
    .where(byId ? eq(sponsors.id, byId) : eq(sponsors.slug, idOrSlug))
    .limit(1);
  if (!row) return null;

  const [events, openRoles] = await Promise.all([
    db
      .select({ id: sponsorEvents.id, type: sponsorEvents.type, oldValue: sponsorEvents.oldValue, newValue: sponsorEvents.newValue, occurredAt: sponsorEvents.occurredAt })
      .from(sponsorEvents)
      .where(eq(sponsorEvents.sponsorId, row.id))
      .orderBy(desc(sponsorEvents.occurredAt), desc(sponsorEvents.id)),
    db
      .select({ id: jobs.id, title: jobs.title, location: jobs.location, department: jobs.department, url: jobs.url, isUk: jobs.isUk, remote: jobs.remote, postedAt: jobs.postedAt, firstSeenAt: jobs.firstSeenAt })
      .from(jobs)
      .where(eq(jobs.sponsorId, row.id))
      .orderBy(desc(jobs.isUk), sql`${jobs.postedAt} desc nulls last`, asc(jobs.title))
      .limit(500),
  ]);

  return { data: { ...shapeSponsor(row), events, jobs: openRoles } };
}

// ---------------------------------------------------------------- changes feed

const EVENT_TYPES = sponsorEventType.enumValues;

/**
 * GET /api/v1/changes
 *   type    added | removed | readded | rating_changed | location_changed | routes_changed (comma-separate several)
 *   since   ISO date: changes on or after this date
 *   until   ISO date: changes before this date
 *   limit   1-1000 (default 100)
 *   cursor  next_cursor from the previous page
 * Newest first.
 */
export async function listChangesApi(sp: URLSearchParams) {
  const types = (sp.get('type') ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  for (const t of types) if (!EVENT_TYPES.includes(t as SponsorEventType)) throw new BadRequest(`type must be one of: ${EVENT_TYPES.join(', ')}`);
  const since = parseDate('since', sp.get('since'));
  const until = parseDate('until', sp.get('until'));
  const limit = parseLimit(sp.get('limit'), 100, 1000);
  const cursor = parseCursor(sp.get('cursor'));

  const filters: (SQL | undefined)[] = [
    types.length ? sql`${sponsorEvents.type} in (${sql.join(types.map((t) => sql`${t}`), sql`, `)})` : undefined,
    since ? gte(sponsorEvents.occurredAt, since) : undefined,
    until ? lt(sponsorEvents.occurredAt, until) : undefined,
    cursor ? lt(sponsorEvents.id, cursor) : undefined,
  ];

  // Ordered by id desc: events are inserted in import order, so this is newest first and a stable cursor.
  const rows = await getDb()
    .select({
      id: sponsorEvents.id,
      type: sponsorEvents.type,
      oldValue: sponsorEvents.oldValue,
      newValue: sponsorEvents.newValue,
      occurredAt: sponsorEvents.occurredAt,
      sponsor: { id: sponsors.id, slug: sponsors.slug, name: sponsors.name, town: sponsors.town, status: sponsors.status, rating: sponsors.rating },
    })
    .from(sponsorEvents)
    .innerJoin(sponsors, eq(sponsors.id, sponsorEvents.sponsorId))
    .where(and(...filters))
    .orderBy(desc(sponsorEvents.id))
    .limit(limit + 1);

  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  return { data: page, next_cursor: more ? String(page[page.length - 1].id) : null };
}

/** Shared wrapper: key check, error handling. */
export async function handleApi(request: Request, run: () => Promise<Response>): Promise<Response> {
  const denied = requireApiKey(request);
  if (denied) return denied;
  try {
    return await run();
  } catch (e) {
    if (e instanceof BadRequest) return apiError(request, 400, e.message);
    console.error('[api/v1]', e);
    return apiError(request, 500, 'Internal error');
  }
}
