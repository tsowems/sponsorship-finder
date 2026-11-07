import Link from 'next/link';

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
  const link = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50';
  return (
    <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? <Link className={link} href={href(page - 1)}>← Previous</Link> : <span />}
      <span className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? <Link className={link} href={href(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}

export function buildHref(path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && !(k === 'page' && v === 1)) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
