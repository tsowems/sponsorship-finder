import Link from 'next/link';
import { ChangeList } from '@/components/ChangeList';
import { SearchForm } from '@/components/SearchForm';
import { getChanges, getOverview } from '@/lib/data';
import { formatDate, formatNumber } from '@/lib/format';

export default async function HomePage() {
  const [overview, added, removed] = await Promise.all([
    getOverview(),
    getChanges('added', 1, 8),
    getChanges('removed', 1, 8),
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
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">New sponsors</h2>
            <Link href="/changes?type=added" className="text-sm text-indigo-700 hover:underline">See all</Link>
          </div>
          {added.rows.length ? <ChangeList rows={added.rows} /> : <EmptyChanges since={overview.trackingSince} />}
        </section>
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Removed from the register</h2>
            <Link href="/changes?type=removed" className="text-sm text-indigo-700 hover:underline">See all</Link>
          </div>
          {removed.rows.length ? <ChangeList rows={removed.rows} /> : <EmptyChanges since={overview.trackingSince} />}
        </section>
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
