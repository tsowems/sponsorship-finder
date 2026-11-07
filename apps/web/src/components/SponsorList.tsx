import Link from 'next/link';
import type { SponsorListItem } from '@/lib/data';
import { RatingBadge, StatusBadge } from './Badges';

export function SponsorList({ items }: { items: SponsorListItem[] }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {items.map((s) => (
        <li key={s.id}>
          <Link href={`/sponsors/${s.slug}`} prefetch={true} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
            <div className="min-w-0">
              <div className="font-medium text-slate-900">{s.name}</div>
              <div className="text-sm text-slate-500">
                {s.town}
                {s.county ? `, ${s.county}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              {s.rating !== 'A' && <RatingBadge rating={s.rating} />}
              <StatusBadge status={s.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
