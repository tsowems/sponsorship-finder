import type { Metadata } from 'next';
import Link from 'next/link';
import { getCouncils, NATIONS } from '@/lib/councils';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Councils that sponsor Skilled Worker visas: England, Scotland and Wales',
  description: 'Local councils licensed by the Home Office to sponsor Skilled Worker visas, listed by nation: England, Scotland and Wales.',
  alternates: { canonical: '/councils' },
};

export default async function CouncilsPage() {
  const councils = await getCouncils();
  const nations = NATIONS.filter((n) => councils[n.slug].length > 0);
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Councils that sponsor visas</h1>
        <p className="max-w-2xl text-slate-600">
          Local councils (city, county, borough and district councils, and London boroughs) licensed to sponsor Skilled Worker visas. Councils
          often sponsor social workers, care staff, teachers and specialist roles. Town and parish councils aren&apos;t included.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-3">
        {nations.map((n) => (
          <li key={n.slug}>
            <Link
              href={`/councils/${n.slug}`}
              prefetch={false}
              className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-px hover:border-indigo-300"
            >
              <span className="text-lg font-semibold text-slate-900">{n.title}</span>
              <span className="text-sm text-slate-500">
                <span className="font-semibold text-indigo-700 tabular-nums">{formatNumber(councils[n.slug].length)}</span> licensed councils
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="max-w-2xl text-sm text-slate-500">
        A licence means a council can sponsor workers, not that every role is eligible. Council vacancies are usually on the council&apos;s own jobs
        site: sign in to see each council&apos;s website and vacancies link on its page.
      </p>
    </div>
  );
}
