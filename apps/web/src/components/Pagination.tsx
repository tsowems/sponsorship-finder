import Link from 'next/link';

/** Page numbers to show: first, last, and a window around the current page, with gaps ("…") between. */
export function pageItems(page: number, totalPages: number, window = 2): (number | 'gap')[] {
  const pages = new Set<number>([1, totalPages]);
  for (let p = page - window; p <= page + window; p++) if (p >= 1 && p <= totalPages) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : 'gap');
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const base = 'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm';
  const link = `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      {page > 1 ? (
        <Link className={link} href={href(page - 1)} rel="prev" aria-label="Previous page">←<span className="ml-1 hidden sm:inline">Previous</span></Link>
      ) : (
        <span className={`${base} border border-slate-200 text-slate-300`} aria-hidden>←</span>
      )}
      {pageItems(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400" aria-hidden>…</span>
        ) : p === page ? (
          <span key={p} className={`${base} bg-slate-900 font-medium text-white`} aria-current="page">{p}</span>
        ) : (
          <Link key={p} className={link} href={href(p)} aria-label={`Page ${p}`}>{p}</Link>
        ),
      )}
      {page < totalPages ? (
        <Link className={link} href={href(page + 1)} rel="next" aria-label="Next page"><span className="mr-1 hidden sm:inline">Next</span>→</Link>
      ) : (
        <span className={`${base} border border-slate-200 text-slate-300`} aria-hidden>→</span>
      )}
    </nav>
  );
}

export function buildHref(path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && !(k === 'page' && v === 1)) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
