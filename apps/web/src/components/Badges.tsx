export function StatusBadge({ status }: { status: 'active' | 'removed' }) {
  return status === 'active' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Licensed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Removed
    </span>
  );
}

export function RatingBadge({ rating }: { rating: string }) {
  const b = rating.startsWith('B');
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        b ? 'bg-amber-50 text-amber-800 ring-amber-600/30' : 'bg-slate-100 text-slate-700 ring-slate-500/20'
      }`}
      title={b ? 'B rating: the Home Office has downgraded this sponsor' : undefined}
    >
      {rating} rating
    </span>
  );
}
