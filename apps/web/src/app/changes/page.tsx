import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChangeList } from '@/components/ChangeList';
import { buildHref, Pagination } from '@/components/Pagination';
import { getChanges, type ChangeFilter } from '@/lib/data';
import { firstParam, formatNumber, pageParam } from '@/lib/format';

type Search = Promise<Record<string, string | string[] | undefined>>;

const TABS: { id: ChangeFilter; label: string }[] = [
  { id: 'all', label: 'All changes' },
  { id: 'added', label: 'New sponsors' },
  { id: 'removed', label: 'Removed' },
  { id: 'downgraded', label: 'Downgraded to B' },
  { id: 'readded', label: 'Back on register' },
  { id: 'moved', label: 'Location changed' },
  { id: 'routes', label: 'Routes changed' },
];

const readFilter = (v: string | undefined): ChangeFilter => (TABS.some((t) => t.id === v) ? (v as ChangeFilter) : 'all');

export const metadata: Metadata = {
  title: 'Latest changes to the UK sponsor register',
  description: 'New Skilled Worker visa sponsors, sponsors removed from the register, downgrades to a B rating, location and visa-route changes, updated daily.',
  alternates: { canonical: '/changes' },
};

export default function ChangesPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Latest changes to the register</h1>
        <p className="mt-1 text-slate-600">What changed each time the Home Office published a new register, for the Skilled Worker route.</p>
      </div>
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <Changes searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Changes({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const filter = readFilter(firstParam(sp.type));
  const page = pageParam(sp.page);
  const { rows, total, pageSize } = await getChanges(filter, page);
  const href = (p: number) => buildHref('/changes', { type: filter === 'all' ? undefined : filter, page: p });

  return (
    <>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={buildHref('/changes', { type: t.id === 'all' ? undefined : t.id })}
            className={`rounded-full px-3 py-1 text-sm font-medium ${t.id === filter ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <div>
          <p className="mb-3 text-sm text-slate-600">{formatNumber(total)} changes</p>
          <ChangeList rows={rows} />
          <Pagination page={page} totalPages={Math.min(Math.ceil(total / pageSize), 200)} href={href} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          No changes recorded yet. They appear here each time a new register is published.
        </p>
      )}
    </>
  );
}
