import type { Metadata } from 'next';
import Link from 'next/link';
import { getTowns, MIN_INDEXED_TOWN } from '@/lib/browse';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Skilled Worker visa sponsors by town',
  description: 'Towns and cities with employers licensed to sponsor Skilled Worker visas, A–Z, with the number of sponsors in each.',
  alternates: { canonical: '/browse/towns' },
};

export default async function TownsPage() {
  const all = await getTowns();
  // Very small places (1–2 sponsors, often typos on the register) are left out of the list; they're still searchable.
  const towns = all.filter((t) => t.count >= MIN_INDEXED_TOWN);
  const groups = new Map<string, typeof towns>();
  for (const t of towns) {
    const key = /^[a-z]/.test(t.slug) ? t.slug[0].toUpperCase() : '0–9';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-500">
        <Link href="/browse" className="hover:underline">Browse</Link> / Towns
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sponsors by town</h1>
        <p className="max-w-2xl text-slate-600">
          {formatNumber(towns.length)} towns and cities with {MIN_INDEXED_TOWN} or more licensed sponsors. The register lists the town of each
          sponsor&apos;s registered address, which isn&apos;t always where the jobs are. Smaller places can be found with the{' '}
          <Link href="/sponsors" className="text-indigo-700 hover:underline">search</Link>.
        </p>
        <nav aria-label="Jump to letter" className="flex flex-wrap gap-1.5 pt-2">
          {[...groups.keys()].map((k) => (
            <a key={k} href={`#town-${k}`} className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 hover:border-indigo-300">
              {k}
            </a>
          ))}
        </nav>
      </header>

      {[...groups.entries()].map(([k, list]) => (
        <section key={k} id={`town-${k}`} className="scroll-mt-24 space-y-2">
          <h2 className="border-b border-slate-200 pb-1 text-lg font-semibold">{k}</h2>
          <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((t) => (
              <li key={t.slug}>
                <Link href={`/browse/towns/${t.slug}`} prefetch={false} className="flex justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-indigo-50">
                  <span className="truncate text-slate-800">{t.name}</span>
                  <span className="text-slate-500 tabular-nums">{formatNumber(t.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
