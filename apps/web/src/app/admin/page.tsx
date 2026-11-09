import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { DailyChart } from '@/components/admin/DailyChart';
import { requireAdmin } from '@/lib/admin';
import { getTraffic, getUserStats, listUsers } from '@/lib/admin-data';
import { firstParam, formatNumber } from '@/lib/format';

type Search = Promise<Record<string, string | string[] | undefined>>;
const RANGES = [7, 30, 90] as const;
const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const countryName = new Intl.DisplayNames(['en-GB'], { type: 'region' });

export default function AdminOverviewPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading dashboard…</p>}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const asked = Number(firstParam((await searchParams).days));
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const [traffic, users, recent] = await Promise.all([getTraffic(days), getUserStats(days), listUsers({ page: 1 })]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">Admin</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Overview<span className="text-indigo-500">.</span></h1>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-sm font-semibold" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin?days=${r}`}
              aria-current={r === days ? 'true' : undefined}
              className={`rounded-lg px-3 py-1.5 ${r === days ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi eyebrow="Today" value={traffic.today.visitors} label="Visitors" note={`${formatNumber(traffic.today.views)} page views`} />
        <Kpi eyebrow={`${days} days`} value={traffic.totals.visitors} label="Visitors" note={`${formatNumber(traffic.totals.views)} page views`} />
        <Kpi eyebrow={`${days} days`} value={users.recent} label="New sign-ups" note={`${formatNumber(users.today)} today`} />
        <Kpi eyebrow="All time" value={users.total} label="Registered users" note={`${formatNumber(users.alertsOn)} with alerts on`} />
      </section>

      <Card title="Visitors per day" eyebrow={`Last ${days} days`}>
        <DailyChart series={traffic.series} />
        <p className="mt-3 text-xs text-slate-500">
          A visitor is counted once per day (cookieless; bots excluded). Hover a bar for page views and sign-ups.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top pages" eyebrow={`${days} days`}>
          <Table rows={traffic.pages} first="Page" render={(l) => <span className="font-mono text-xs">{l}</span>} />
        </Card>
        <Card title="Where visitors come from" eyebrow={`${days} days`}>
          <Table rows={traffic.referrers} first="Source" />
        </Card>
        <Card title="Countries" eyebrow={`${days} days`}>
          <Table rows={traffic.countries} first="Country" render={(l) => (l === '??' ? 'Unknown' : safeCountry(l))} />
        </Card>
        <Card title="Devices" eyebrow={`${days} days`}>
          <Table rows={traffic.devices} first="Device" render={(l) => l[0].toUpperCase() + l.slice(1)} />
          <p className="mt-3 text-xs text-slate-500">
            {formatNumber(traffic.totals.signedInViews)} of {formatNumber(traffic.totals.views)} page views were by signed-in users.
          </p>
        </Card>
      </div>

      <Card
        title="Latest sign-ups"
        eyebrow="Users"
        action={<Link href="/admin/users" className="text-sm font-semibold text-indigo-700 hover:underline">All users →</Link>}
      >
        {recent.users.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.users.slice(0, 8).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 truncate font-medium">{u.email}</span>
                <span className="text-sm text-slate-500">{when.format(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No one has signed up yet.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {formatNumber(users.watchers)} users watch {formatNumber(users.watches)} companies · {formatNumber(users.searches)} saved searches
        </p>
      </Card>
    </div>
  );
}

function safeCountry(code: string) {
  try {
    return countryName.of(code) ?? code;
  } catch {
    return code;
  }
}

function Kpi(props: { eyebrow: string; value: number; label: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[0.65rem] font-bold tracking-[0.14em] text-slate-500 uppercase">{props.eyebrow}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{formatNumber(props.value)}</p>
      <p className="mt-1 font-semibold text-slate-800">{props.label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{props.note}</p>
    </div>
  );
}

function Card(props: { title: string; eyebrow: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.14em] text-slate-500 uppercase">{props.eyebrow}</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">{props.title}</h2>
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

function Table(props: { rows: { label: string; views: number; visitors: number }[]; first: string; render?: (label: string) => ReactNode }) {
  if (!props.rows.length) return <p className="text-sm text-slate-500">No data yet.</p>;
  const max = Math.max(...props.rows.map((r) => r.visitors), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="pb-2 font-semibold">{props.first}</th>
            <th className="w-20 pb-2 text-right font-semibold">Visitors</th>
            <th className="w-16 pb-2 text-right font-semibold">Views</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="relative py-2 pr-3">
                {/* proportional background bar = visitors */}
                <span className="absolute inset-y-1 left-0 rounded-md bg-indigo-50" style={{ width: `${(r.visitors / max) * 100}%` }} aria-hidden />
                <span className="relative block truncate px-1.5" title={r.label}>{props.render ? props.render(r.label) : r.label}</span>
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">{formatNumber(r.visitors)}</td>
              <td className="py-2 pl-3 text-right text-slate-500 tabular-nums">{formatNumber(r.views)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
