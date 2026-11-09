import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SponsorList } from '@/components/SponsorList';
import { findNation, getCouncils, NATIONS } from '@/lib/councils';
import { formatNumber } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';

/** Rendered per request: the full list depends on who's signed in. The council list itself is one cached query. */
export const instant = false;

const PREVIEW = 10;

export async function generateMetadata({ params }: PageProps<'/councils/[nation]'>): Promise<Metadata> {
  const nation = findNation((await params).nation);
  if (!nation) return { title: 'Not found', robots: { index: false } };
  const total = (await getCouncils())[nation.slug].length;
  return {
    title: `Councils in ${nation.title} that sponsor visas (${formatNumber(total)})`,
    description: `${formatNumber(total)} local councils in ${nation.title} are licensed to sponsor Skilled Worker visas.`,
    alternates: { canonical: `/councils/${nation.slug}` },
  };
}

export default async function NationCouncilsPage({ params }: PageProps<'/councils/[nation]'>) {
  await connection();
  const nation = findNation((await params).nation);
  if (!nation) notFound();
  const [user, councils] = await Promise.all([getCurrentUser(), getCouncils()]);
  const all = councils[nation.slug];
  if (!all.length) notFound();
  const rows = user ? all : all.slice(0, PREVIEW);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/councils" className="hover:underline">Councils</Link> / {nation.title}
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Councils in {nation.title} that sponsor visas</h1>
        <p className="max-w-3xl text-slate-600">
          {formatNumber(all.length)} local {all.length === 1 ? 'council is' : 'councils are'} currently licensed to sponsor Skilled Worker visas in{' '}
          {nation.title}. Being licensed doesn&apos;t mean every role is eligible: check the job advert or ask the council.
        </p>
      </header>

      <SponsorList items={rows} prefetch={false} />

      {!user && all.length > rows.length && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
          <p className="font-medium text-slate-900">Showing {rows.length} of {formatNumber(all.length)} councils.</p>
          <p className="mt-1 text-sm text-slate-600">Sign in free to see the full list, plus each council&apos;s website and vacancies.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/councils/${nation.slug}`)}`}
            className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Sign in to see all {formatNumber(all.length)}
          </Link>
        </div>
      )}

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold">Other nations</h2>
        <ul className="flex flex-wrap gap-2">
          {NATIONS.filter((n) => n.slug !== nation.slug && councils[n.slug].length > 0).map((n) => (
            <li key={n.slug}>
              <Link href={`/councils/${n.slug}`} prefetch={false} className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
                {n.title} <span className="text-slate-400 tabular-nums">{formatNumber(councils[n.slug].length)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
