import Link from 'next/link';
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

  const stats = [
    { label: 'Licensed Skilled Worker sponsors', value: formatNumber(overview.activeSponsors) },
    { label: 'New sponsors (30 days)', value: formatNumber(overview.last30.added) },
    { label: 'Removed (30 days)', value: formatNumber(overview.last30.removed) },
    { label: 'Downgraded to B (30 days)', value: formatNumber(overview.last30.downgraded) },
  ];

  return (
    <div className="space-y-12">
      <section className="space-y-6 pt-4 text-center">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Find UK employers that can sponsor your Skilled Worker visa
        </h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Search every licensed sponsor on the Home Office register, updated daily. See who&apos;s newly licensed, and who has
          been removed or downgraded.
        </p>
        <div className="mx-auto max-w-3xl">
          <SearchForm size="lg" />
        </div>
        {overview.latestSnapshot && (
          <p className="text-sm text-slate-500">Register last updated {formatDate(overview.latestSnapshot.publishedAt)}</p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">{s.value}</div>
            <div className="mt-1 text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <ChangeColumn title="New sponsors" type="added" data={added} since={overview.trackingSince} />
        <ChangeColumn title="Removed from the register" type="removed" data={removed} since={overview.trackingSince} />
      </div>
    </div>
  );
}

function EmptyChanges({ since }: { since: Date | null }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
      No changes yet. We started tracking the register{since ? ` on ${formatDate(since)}` : ''}; changes appear here as each new
      daily file is published.
    </p>
  );
}

function ChangeColumn(props: { title: string; type: 'added' | 'removed'; data: Awaited<ReturnType<typeof getChanges>>; since: Date | null }) {
  const { title, type, data, since } = props;
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {title}{' '}
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-sm font-medium text-slate-700 tabular-nums">
            {formatNumber(data.total)}
          </span>
        </h2>
        <span className="shrink-0 text-xs text-slate-500">last 30 days</span>
      </div>
      {data.rows.length ? <CompactChangeList rows={data.rows} /> : <EmptyChanges since={since} />}
      {data.total > data.rows.length && (
        <Link href={`/changes?type=${type}`} className="mt-2 inline-block text-sm text-indigo-700 hover:underline">
          Showing the latest {formatNumber(data.rows.length)}. See all {formatNumber(data.total)}
        </Link>
      )}
    </section>
  );
}
