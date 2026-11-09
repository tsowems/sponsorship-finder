import type { Metadata } from 'next';
import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import { getIndustryCounts, INDUSTRIES } from '@/lib/industries';

export const metadata: Metadata = {
  title: 'UK visa sponsors by industry',
  description: 'Employers licensed to sponsor Skilled Worker visas, grouped by industry: care, healthcare and NHS, IT, education, hospitality, construction and more.',
  alternates: { canonical: '/industries' },
};

export default async function IndustriesPage() {
  const counts = await getIndustryCounts();
  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-500">
        <Link href="/browse" className="hover:underline">Sponsors by city</Link> / Industries
      </nav>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Visa sponsors by industry</h1>
        <p className="max-w-2xl text-slate-600">
          Licensed Skilled Worker sponsors grouped by the kind of work they do, based on their Companies House industry code where we have it, or
          their name. Some organisations appear in more than one industry, and not every sponsor fits one of these groups.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((i) => (
          <li key={i.slug}>
            <Link
              href={`/industries/${i.slug}`}
              prefetch={false}
              className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-indigo-300"
            >
              <span className="font-semibold text-slate-900">{i.title}</span>
              <span className="text-sm text-slate-500">
                <span className="font-semibold text-indigo-700 tabular-nums">{formatNumber(counts[i.slug] ?? 0)}</span> licensed sponsors
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
