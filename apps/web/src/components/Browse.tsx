import Link from 'next/link';
import { LETTERS, letterLabel, type Letter } from '@/lib/browse';
import { formatNumber } from '@/lib/format';

/** A–Z strip linking to each letter page; the current letter is highlighted. */
export function LetterStrip({ current, counts }: { current?: Letter; counts?: Record<Letter, number> }) {
  return (
    <nav aria-label="Browse by letter" className="flex flex-wrap gap-1.5">
      {LETTERS.map((l) => {
        const empty = counts ? counts[l] === 0 : false;
        const cls = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium';
        if (empty) return <span key={l} className={`${cls} text-slate-300`}>{letterLabel(l)}</span>;
        return (
          <Link
            key={l}
            href={`/browse/${l}`}
            prefetch={false}
            aria-current={l === current ? 'page' : undefined}
            className={l === current ? `${cls} bg-indigo-600 text-white` : `${cls} border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700`}
          >
            {letterLabel(l)}
          </Link>
        );
      })}
    </nav>
  );
}

/** "← Previous / Next →" for keyset paging. */
export function Pager({ path, prev, next }: { path: string; prev: number | null; next: number | null }) {
  if (prev === null && next === null) return null;
  const base = 'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium';
  const link = `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
  const off = `${base} border border-slate-200 text-slate-300`;
  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      {prev !== null ? (
        <Link className={link} href={`${path}?before=${prev}`} rel="prev" prefetch={false}>← Previous</Link>
      ) : (
        <span className={off} aria-hidden>← Previous</span>
      )}
      {prev !== null && (
        <Link className="text-sm text-indigo-700 hover:underline" href={path} prefetch={false}>Back to start</Link>
      )}
      {next !== null ? (
        <Link className={link} href={`${path}?after=${next}`} rel="next" prefetch={false}>Next →</Link>
      ) : (
        <span className={off} aria-hidden>Next →</span>
      )}
    </nav>
  );
}

/** "1–50 of 2,744" style range is unknowable with keyset paging, so show the total and the names covered. */
export function RangeNote({ total, first, last }: { total: number; first?: string; last?: string }) {
  return (
    <p className="text-sm text-slate-600">
      {formatNumber(total)} licensed sponsor{total === 1 ? '' : 's'}
      {first && last ? (
        <>
          {' '}· showing <span className="font-medium text-slate-800">{first}</span> to <span className="font-medium text-slate-800">{last}</span>
        </>
      ) : null}
    </p>
  );
}
