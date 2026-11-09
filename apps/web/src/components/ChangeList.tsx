import Link from 'next/link';
import type { ChangeRow } from '@/lib/data';
import { dayKey, formatLongDate } from '@/lib/format';

/** "Routes: + Global Business Mobility, − Creative Worker" */
export function describeRoutes(oldValue: string | null, newValue: string | null) {
  const split = (v: string | null) => (v ? v.split(' | ').filter(Boolean) : []);
  const before = new Set(split(oldValue));
  const after = new Set(split(newValue));
  const short = (r: string) => r.replace(/^Global Business Mobility: /, 'GBM: ');
  const parts = [...[...after].filter((r) => !before.has(r)).map((r) => `+ ${short(r)}`), ...[...before].filter((r) => !after.has(r)).map((r) => `− ${short(r)}`)];
  return `Routes: ${parts.join(', ') || 'changed'}`;
}

export function describeEvent(e: { type: string; oldValue: string | null; newValue: string | null }) {
  switch (e.type) {
    case 'added':
      return { label: 'New sponsor', tone: 'emerald' as const };
    case 'removed':
      return { label: 'Removed from register', tone: 'red' as const };
    case 'readded':
      return { label: 'Back on register', tone: 'sky' as const };
    case 'rating_changed':
      return e.newValue?.startsWith('B')
        ? { label: `Downgraded ${e.oldValue} → ${e.newValue}`, tone: 'amber' as const }
        : { label: `Rating ${e.oldValue} → ${e.newValue}`, tone: 'sky' as const };
    case 'location_changed':
      return { label: `Moved to ${e.newValue}`, tone: 'slate' as const };
    case 'routes_changed':
      return { label: describeRoutes(e.oldValue, e.newValue), tone: 'slate' as const };
    default:
      return { label: e.type, tone: 'slate' as const };
  }
}

const toneClass = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

export function EventPill(props: { type: string; oldValue: string | null; newValue: string | null }) {
  const { label, tone } = describeEvent(props);
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${toneClass[tone]}`}>{label}</span>;
}

/** Changes grouped by register date. */
export function ChangeList({ rows }: { rows: ChangeRow[] }) {
  const groups = new Map<string, ChangeRow[]>();
  for (const r of rows) {
    const k = dayKey(r.occurredAt);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <h3 className="mb-2 text-sm font-semibold text-slate-500">{formatLongDate(items[0].occurredAt)}</h3>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/sponsors/${r.slug}`} prefetch={true} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                    {r.name}
                  </Link>
                  <span className="ml-2 text-sm text-slate-500">{r.town}</span>
                </div>
                <EventPill {...r} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Compact, scrollable list for the home page columns: name + town only (the heading already says
 * whether these are new or removed), grouped by date with sticky date headers. Green = added, red = removed.
 */
export function CompactChangeList({ rows, tone }: { rows: ChangeRow[]; tone: 'green' | 'red' }) {
  const groups = new Map<string, ChangeRow[]>();
  for (const r of rows) {
    const k = dayKey(r.occurredAt);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const t =
    tone === 'green'
      ? { head: 'bg-emerald-50 text-emerald-800 border-emerald-100', dot: 'bg-emerald-500', hover: 'hover:bg-emerald-50/60' }
      : { head: 'bg-red-50 text-red-800 border-red-100', dot: 'bg-red-500', hover: 'hover:bg-red-50/60' };
  return (
    <div className="max-h-[28rem] overflow-y-auto overscroll-contain rounded-xl border border-slate-200">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <h3 className={`sticky top-0 z-10 flex justify-between border-b px-4 py-1.5 text-xs font-semibold ${t.head}`}>
            <span>{formatLongDate(items[0].occurredAt)}</span>
            <span className="tabular-nums">{tone === 'green' ? '+' : '−'}{items.length}</span>
          </h3>
          <ul className="divide-y divide-slate-100">
            {items.map((r) => (
              <li key={r.id}>
                <Link href={`/sponsors/${r.slug}`} prefetch={false} className={`flex items-center gap-3 px-4 py-2.5 ${t.hover}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900" title={r.name}>{r.name}</span>
                  <span className="shrink-0 text-sm text-slate-500">{r.town}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
