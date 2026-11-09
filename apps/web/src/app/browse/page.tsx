import type { Metadata } from 'next';
import Link from 'next/link';
import { LetterStrip } from '@/components/Browse';
import { getLetterCounts, getTowns, LETTERS, letterLabel } from '@/lib/browse';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Browse licensed Skilled Worker sponsors A–Z and by town',
  description: 'Every employer on the Home Office register of licensed Skilled Worker visa sponsors, listed A–Z and by town.',
  alternates: { canonical: '/browse' },
};

const TOP_TOWNS = 48;

export default async function BrowsePage() {
  const [counts, towns] = await Promise.all([getLetterCounts(), getTowns()]);
  const biggest = [...towns].sort((a, b) => b.count - a.count).slice(0, TOP_TOWNS);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Browse licensed sponsors</h1>
        <p className="max-w-2xl text-slate-600">
          All {formatNumber(total)} employers currently licensed to sponsor Skilled Worker visas, listed A–Z and by the town on the register.
          Looking for one company? <Link href="/sponsors" className="text-indigo-700 hover:underline">Search by name</Link>.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">A–Z</h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-9">
          {LETTERS.map((l) => (
            <li key={l}>
              {counts[l] > 0 ? (
                <Link
                  href={`/browse/${l}`}
                  prefetch={false}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="text-lg font-semibold text-slate-900">{letterLabel(l)}</span>
                  <span className="text-xs text-slate-500">{formatNumber(counts[l])}</span>
                </Link>
              ) : (
                <span className="flex flex-col rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-slate-300">
                  <span className="text-lg font-semibold">{letterLabel(l)}</span>
                  <span className="text-xs">0</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Towns with the most sponsors</h2>
          <Link href="/browse/towns" prefetch={false} className="text-sm font-medium text-indigo-700 hover:underline">
            All {formatNumber(towns.length)} towns A–Z →
          </Link>
        </div>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          {biggest.map((t) => (
            <li key={t.slug}>
              <Link href={`/browse/towns/${t.slug}`} prefetch={false} className="flex justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-indigo-50">
                <span className="truncate text-slate-800">{t.name}</span>
                <span className="text-slate-500 tabular-nums">{formatNumber(t.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Jump to a letter</h2>
        <LetterStrip counts={counts} />
      </section>
    </div>
  );
}
