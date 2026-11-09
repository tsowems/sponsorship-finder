import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@sponsors/db';

/** Admin dashboard queries. Days are London calendar days. Not cached: always live. */

const TZ = 'Europe/London';

export interface DayPoint {
  day: string; // YYYY-MM-DD
  visitors: number;
  views: number;
  signups: number;
}

const rows = async <T,>(q: ReturnType<typeof sql>) => (await getDb().execute(q)) as unknown as T[];

export async function getTraffic(days: number) {
  const since = sql`(date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ}`;

  const [series, totals, today, pages, referrers, countries, devices] = await Promise.all([
    rows<{ day: string; visitors: string; views: string; signups: string }>(sql`
      with d as (
        select generate_series(
          (now() at time zone ${TZ})::date - ${days - 1}::int,
          (now() at time zone ${TZ})::date, interval '1 day')::date as day
      ),
      v as (
        select (created_at at time zone ${TZ})::date as day, count(*) as views, count(distinct visitor_id) as visitors
        from page_views where created_at >= ${since} group by 1
      ),
      s as (
        select (created_at at time zone 'UTC' at time zone ${TZ})::date as day, count(*) as signups
        from "user" where created_at >= ${since} at time zone 'UTC' group by 1
      )
      select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(v.visitors, 0) as visitors, coalesce(v.views, 0) as views, coalesce(s.signups, 0) as signups
      from d left join v using (day) left join s using (day) order by d.day`),
    rows<{ views: string; visitors: string; signed_in: string }>(sql`
      select count(*) as views,
             count(distinct (visitor_id, (created_at at time zone ${TZ})::date)) as visitors,
             count(*) filter (where signed_in) as signed_in
      from page_views where created_at >= ${since}`),
    rows<{ views: string; visitors: string }>(sql`
      select count(*) as views, count(distinct visitor_id) as visitors
      from page_views where created_at >= (date_trunc('day', now() at time zone ${TZ})) at time zone ${TZ}`),
    rows<{ label: string; views: string; visitors: string }>(sql`
      select path as label, count(*) as views, count(distinct visitor_id) as visitors
      from page_views where created_at >= ${since} group by path order by views desc limit 15`),
    rows<{ label: string; views: string; visitors: string }>(sql`
      select coalesce(referrer, 'Direct / none') as label, count(*) as views, count(distinct visitor_id) as visitors
      from page_views where created_at >= ${since} group by 1 order by visitors desc limit 10`),
    rows<{ label: string; views: string; visitors: string }>(sql`
      select coalesce(country, '??') as label, count(*) as views, count(distinct visitor_id) as visitors
      from page_views where created_at >= ${since} group by 1 order by visitors desc limit 10`),
    rows<{ label: string; views: string; visitors: string }>(sql`
      select coalesce(device, 'unknown') as label, count(*) as views, count(distinct visitor_id) as visitors
      from page_views where created_at >= ${since} group by 1 order by visitors desc`),
  ]);

  const n = (v: string | number | null | undefined) => Number(v ?? 0);
  const list = (r: { label: string; views: string; visitors: string }[]) => r.map((x) => ({ label: x.label, views: n(x.views), visitors: n(x.visitors) }));
  return {
    series: series.map((r) => ({ day: r.day, visitors: n(r.visitors), views: n(r.views), signups: n(r.signups) })) as DayPoint[],
    totals: { views: n(totals[0]?.views), visitors: n(totals[0]?.visitors), signedInViews: n(totals[0]?.signed_in) },
    today: { views: n(today[0]?.views), visitors: n(today[0]?.visitors) },
    pages: list(pages),
    referrers: list(referrers),
    countries: list(countries),
    devices: list(devices),
  };
}

export async function getUserStats(days: number) {
  const [r] = await rows<{ total: string; recent: string; today: string; alerts_on: string; watchers: string; watches: string; searches: string }>(sql`
    select
      (select count(*) from "user") as total,
      (select count(*) from "user" where created_at >= now() - make_interval(days => ${days})) as recent,
      (select count(*) from "user" where (created_at at time zone 'UTC' at time zone ${TZ})::date = (now() at time zone ${TZ})::date) as today,
      (select count(*) from "user" where alerts_enabled) as alerts_on,
      (select count(distinct user_id) from watches) as watchers,
      (select count(*) from watches) as watches,
      (select count(*) from saved_searches) as searches`);
  const n = (v: string | undefined) => Number(v ?? 0);
  return { total: n(r?.total), recent: n(r?.recent), today: n(r?.today), alertsOn: n(r?.alerts_on), watchers: n(r?.watchers), watches: n(r?.watches), searches: n(r?.searches) };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  alertsEnabled: boolean;
  providers: string[];
  watches: number;
  searches: number;
  lastActive: Date | null;
}

export const USERS_PAGE_SIZE = 50;

export async function listUsers(opts: { q?: string; page: number }) {
  const like = opts.q ? `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const where = like ? sql`where u.email ilike ${like} or u.name ilike ${like}` : sql``;
  const [items, [{ total }]] = await Promise.all([
    rows<Record<string, unknown>>(sql`
      select u.id, u.name, u.email, u.email_verified, u.created_at, u.alerts_enabled,
        coalesce((select array_agg(distinct a.provider_id) from account a where a.user_id = u.id), '{}') as providers,
        (select count(*) from watches w where w.user_id = u.id) as watches,
        (select count(*) from saved_searches s where s.user_id = u.id) as searches,
        (select max(coalesce(s.updated_at, s.created_at)) from session s where s.user_id = u.id) as last_active
      from "user" u ${where}
      order by u.created_at desc
      limit ${USERS_PAGE_SIZE} offset ${(opts.page - 1) * USERS_PAGE_SIZE}`),
    rows<{ total: string }>(sql`select count(*) as total from "user" u ${where}`),
  ]);
  const date = (v: unknown) => (v ? new Date(v as string) : null);
  return {
    total: Number(total),
    users: items.map(
      (r): AdminUserRow => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        email: String(r.email),
        emailVerified: Boolean(r.email_verified),
        createdAt: date(r.created_at)!,
        alertsEnabled: Boolean(r.alerts_enabled),
        providers: (r.providers as string[]) ?? [],
        watches: Number(r.watches),
        searches: Number(r.searches),
        lastActive: date(r.last_active),
      }),
    ),
  };
}
