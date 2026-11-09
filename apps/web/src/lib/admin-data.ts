import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@sponsors/db';

/** Admin queries. Not cached: always live. Days are London calendar days. */

const TZ = 'Europe/London';
const rows = async <T>(q: SQL): Promise<T[]> => (await getDb().execute(q)) as unknown as T[];
const date = (v: unknown) => (v ? new Date(v as string) : null);

export async function getUserStats() {
  const [r] = await rows<Record<string, string>>(sql`
    select
      (select count(*) from "user") as total,
      (select count(*) from "user" where (created_at at time zone 'UTC' at time zone ${TZ})::date = (now() at time zone ${TZ})::date) as today,
      (select count(*) from "user" where created_at >= now() - interval '7 days') as week,
      (select count(*) from "user" where created_at >= now() - interval '30 days') as month,
      (select count(*) from "user" where last_sign_in_at >= now() - interval '7 days') as active_week,
      (select count(*) from "user" where alerts_enabled) as alerts_on,
      (select count(distinct user_id) from watches) as watchers,
      (select count(*) from watches) as watches`);
  const n = (k: string) => Number(r?.[k] ?? 0);
  return {
    total: n('total'), today: n('today'), week: n('week'), month: n('month'), activeWeek: n('active_week'),
    alertsOn: n('alerts_on'), watchers: n('watchers'), watches: n('watches'),
  };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  lastSignInAt: Date | null;
  alertsEnabled: boolean;
  providers: string[];
  watches: number;
  searches: number;
}

export const USERS_PAGE_SIZE = 50;
export type UserSort = 'joined' | 'signin';

export async function listUsers(opts: { q?: string; page: number; sort?: UserSort; limit?: number }) {
  const limit = opts.limit ?? USERS_PAGE_SIZE;
  const like = opts.q ? `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const where = like ? sql`where u.email ilike ${like} or u.name ilike ${like}` : sql``;
  const order = opts.sort === 'signin' ? sql`u.last_sign_in_at desc nulls last, u.created_at desc` : sql`u.created_at desc`;
  const [items, [{ total }]] = await Promise.all([
    rows<Record<string, unknown>>(sql`
      select u.id, u.name, u.email, u.created_at, u.last_sign_in_at, u.alerts_enabled,
        coalesce((select array_agg(distinct a.provider_id) from account a where a.user_id = u.id), '{}') as providers,
        (select count(*) from watches w where w.user_id = u.id) as watches,
        (select count(*) from saved_searches s where s.user_id = u.id) as searches
      from "user" u ${where}
      order by ${order}
      limit ${limit} offset ${(opts.page - 1) * limit}`),
    rows<{ total: string }>(sql`select count(*) as total from "user" u ${where}`),
  ]);
  return {
    total: Number(total),
    users: items.map(
      (r): AdminUserRow => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        email: String(r.email),
        createdAt: date(r.created_at)!,
        lastSignInAt: date(r.last_sign_in_at),
        alertsEnabled: Boolean(r.alerts_enabled),
        providers: (r.providers as string[]) ?? [],
        watches: Number(r.watches),
        searches: Number(r.searches),
      }),
    ),
  };
}
