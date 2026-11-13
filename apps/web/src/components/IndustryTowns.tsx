import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import type { IndustryTown } from '@/lib/industries';

const TOP = 20;

/** "By city" for an industry: the biggest places as chips, then every place in a collapsible list. */
export function IndustryTowns({ industry, towns, current }: { industry: string; towns: IndustryTown[]; current?: string }) {
  if (towns.length < 2) return null;
  const top = towns.slice(0, TOP);
  const rest = [...towns].sort((a, b) => a.name.localeCompare(b.name));
  const chip = (t: IndustryTown) => (
    <Link
      href={`/industries/${industry}/${t.slug}`}
      prefetch={false}
      aria-current={t.slug === current ? 'page' : undefined}
      className={`inline-block rounded-lg border px-3 py-1.5 text-sm ${
        t.slug === current ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
      }`}
    >
      {t.name} <span className="text-slate-400 tabular-nums">{formatNumber(t.count)}</span>
    </Link>
  );
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">By city</h2>
      <ul className="flex flex-wrap gap-2">
        {top.map((t) => (
          <li key={t.slug}>{chip(t)}</li>
        ))}
      </ul>
      {towns.length > TOP && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-indigo-700 hover:underline">
            <span className="group-open:hidden">Show all {formatNumber(towns.length)} cities and towns</span>
            <span className="hidden group-open:inline">Hide the full list</span>
          </summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/industries/${industry}/${t.slug}`}
                  prefetch={false}
                  className="flex justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-indigo-50"
                >
                  <span className="truncate text-slate-800">{t.name}</span>
                  <span className="text-slate-500 tabular-nums">{formatNumber(t.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
