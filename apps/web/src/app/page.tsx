import Link from 'next/link';
import type { ReactNode } from 'react';
import { CompactChangeList } from '@/components/ChangeList';
import { SearchForm } from '@/components/SearchForm';
import { getChanges, getOverview } from '@/lib/data';
import { formatDate, formatNumber } from '@/lib/format';

/** Most rows shown in each home page list (it scrolls); beyond this we link to /changes. */
const HOME_LIST_MAX = 300;

export default async function HomePage() {
  const [overview, added, removed] = await Promise.all([
    getOverview(),
    getChanges('added', 1, HOME_LIST_MAX, 30),
    getChanges('removed', 1, HOME_LIST_MAX, 30),
  ]);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-4xl space-y-3">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">UK Skilled Worker sponsors</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-balance text-slate-900 sm:text-5xl">
            Find employers who can sponsor you<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-lg text-slate-600">
            Every licensed sponsor on the Home Office register, checked daily, with new licences and removals tracked.
          </p>
        </div>
        {overview.latestSnapshot && (
          <p className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
            <CalendarIcon />
            Register updated <span className="font-semibold">{formatDate(overview.latestSnapshot.publishedAt)}</span>
          </p>
        )}
      </section>

      {/* Search banner. Decorations sit in their own clipped layer so the autocomplete dropdown isn't cut off. */}
      <section className="relative rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-indigo-400 p-6 shadow-lg shadow-indigo-600/20 sm:p-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden>
          <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full border border-white/15" />
          <div className="absolute -top-8 right-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-white/5" />
        </div>
        <div className="relative space-y-5">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/15 text-amber-200">
              <SparkIcon />
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-white/75 uppercase">Search the register</p>
              <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {formatNumber(overview.activeSponsors)} licensed employers
              </p>
            </div>
          </div>
          <SearchForm size="lg" onBrand />
          <p className="text-sm text-white/80">Type a company name, a town, or both. Results appear as you type.</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard tone="violet" icon={<BuildingIcon />} eyebrow="On the register" value={overview.activeSponsors} label="Licensed sponsors" note="Skilled Worker route" />
        <StatCard tone="green" icon={<PlusIcon />} eyebrow="30 days" value={overview.last30.added} label="New sponsors" note="Newly licensed" href="/changes?type=added" />
        <StatCard tone="red" icon={<MinusIcon />} eyebrow="30 days" value={overview.last30.removed} label="Removed" note="No longer on the register" href="/changes?type=removed" />
        <StatCard tone="amber" icon={<DownIcon />} eyebrow="30 days" value={overview.last30.downgraded} label="Downgraded to B" note="Rating lowered" href="/changes?type=downgraded" />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <ChangeColumn title="New sponsors" tone="green" type="added" data={added} since={overview.trackingSince} />
        <ChangeColumn title="Removed from the register" tone="red" type="removed" data={removed} since={overview.trackingSince} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

const chip = {
  violet: 'bg-indigo-50 text-indigo-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
};

function StatCard(props: { tone: keyof typeof chip; icon: ReactNode; eyebrow: string; value: number; label: string; note: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${chip[props.tone]}`}>{props.icon}</span>
        <span className="pt-1 text-right text-[0.65rem] font-bold tracking-[0.14em] text-slate-500 uppercase">{props.eyebrow}</span>
      </div>
      <div className="mt-4 text-3xl font-extrabold text-slate-900 tabular-nums">{formatNumber(props.value)}</div>
      <div className="mt-1 font-semibold text-slate-800">{props.label}</div>
      <div className="mt-0.5 text-xs text-slate-500">{props.note}</div>
    </>
  );
  const cls = 'block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
  return props.href ? (
    <Link href={props.href} className={`${cls} transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ChangeColumn(props: { title: string; tone: 'green' | 'red'; type: 'added' | 'removed'; data: Awaited<ReturnType<typeof getChanges>>; since: Date | null }) {
  const { title, tone, type, data, since } = props;
  const green = tone === 'green';
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm sm:p-5 ${green ? 'border-t-emerald-500' : 'border-t-red-500'}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.14em] text-slate-500 uppercase">Last 30 days</p>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            {title}
            <span className={`rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${green ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {formatNumber(data.total)}
            </span>
          </h2>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${green ? chip.green : chip.red}`}>{green ? <PlusIcon /> : <MinusIcon />}</span>
      </div>
      {data.rows.length ? <CompactChangeList rows={data.rows} tone={tone} /> : <EmptyChanges since={since} />}
      {data.total > data.rows.length && (
        <Link href={`/changes?type=${type}`} className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline">
          Showing the latest {formatNumber(data.rows.length)}. See all {formatNumber(data.total)} →
        </Link>
      )}
    </section>
  );
}

function EmptyChanges({ since }: { since: Date | null }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      No changes yet. We started tracking the register{since ? ` on ${formatDate(since)}` : ''}; changes appear here as each new
      daily file is published.
    </p>
  );
}

// ---------------------------------------------------------------- icons (inline, no icon library)

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const PlusIcon = () => <svg {...svg} className="h-5 w-5"><path d="M12 5v14M5 12h14" /></svg>;
const MinusIcon = () => <svg {...svg} className="h-5 w-5"><path d="M5 12h14" /></svg>;
const DownIcon = () => <svg {...svg} className="h-5 w-5"><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
const BuildingIcon = () => (
  <svg {...svg} className="h-5 w-5"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4" /></svg>
);
const CalendarIcon = () => (
  <svg {...svg} className="h-4 w-4 text-indigo-500"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
const SparkIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden><path d="M12 2c.6 4.7 2.9 7.3 8 8-5.1.7-7.4 3.3-8 8-.6-4.7-2.9-7.3-8-8 5.1-.7 7.4-3.3 8-8Z" /></svg>
);
