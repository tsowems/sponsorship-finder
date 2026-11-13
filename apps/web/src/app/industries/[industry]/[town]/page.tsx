import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { Pager, RangeNote } from '@/components/Browse';
import { IndustryTowns } from '@/components/IndustryTowns';
import { SponsorList } from '@/components/SponsorList';
import { findTownByName, getTowns, MIN_INDEXED_TOWN, readCursor, townFromSlug } from '@/lib/browse';
import { formatNumber } from '@/lib/format';
import { browseIndustryTown, findIndustry, getIndustryTowns, MOVED_INDUSTRIES } from '@/lib/industries';
import { getCurrentUser } from '@/lib/session';

/** Rendered per request: the full list depends on who's signed in, and cursors would otherwise be stored ISR pages. */
export const instant = false;

const PREVIEW = 10;

async function load(industrySlug: string, townSlug: string) {
  const ind = findIndustry(industrySlug);
  if (!ind || !townFromSlug(townSlug)) return null;
  const town = (await getTowns()).find((t) => t.slug === townSlug);
  return town ? { ind, town } : { ind, town: null };
}

export async function generateMetadata({ params, searchParams }: PageProps<'/industries/[industry]/[town]'>): Promise<Metadata> {
  const { industry, town: townSlug } = await params;
  const found = await load(industry, townSlug);
  if (!found?.town) return { title: 'Not found', robots: { index: false } };
  const { ind, town } = found;
  const total = (await getIndustryTowns(ind.slug)).find((t) => t.slug === town.slug)?.count ?? 0;
  const paged = Object.keys(await searchParams).length > 0;
  return {
    title: `${ind.title} visa sponsors in ${town.name} (${formatNumber(total)})`,
    description: `${formatNumber(total)} employers in ${ind.phrase} in ${town.name} are licensed to sponsor Skilled Worker visas.`,
    alternates: { canonical: `/industries/${ind.slug}/${town.slug}` },
    robots: paged || total < MIN_INDEXED_TOWN ? { index: false, follow: true } : undefined,
  };
}

export default async function IndustryTownPage({ params, searchParams }: PageProps<'/industries/[industry]/[town]'>) {
  await connection();
  const { industry, town: townSlug } = await params;
  const moved = MOVED_INDUSTRIES[industry];
  if (moved) permanentRedirect(`/industries/${moved}/${townSlug}`);
  const found = await load(industry, townSlug);
  if (!found) notFound();
  const { ind } = found;
  if (!found.town) {
    // Another spelling of a merged place (…/greater-london → …/london).
    const merged = await findTownByName(townFromSlug(townSlug)!);
    if (merged) permanentRedirect(`/industries/${ind.slug}/${merged.slug}`);
    notFound();
  }
  const town = found.town;
  const [user, towns] = await Promise.all([getCurrentUser(), getIndustryTowns(ind.slug)]);
  if (!towns.some((t) => t.slug === town.slug)) notFound();
  const page = await browseIndustryTown(ind, town, user ? readCursor(await searchParams) : {});
  const rows = user ? page.rows : page.rows.slice(0, PREVIEW);
  const path = `/industries/${ind.slug}/${town.slug}`;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/industries" className="hover:underline">Industries</Link> /{' '}
        <Link href={`/industries/${ind.slug}`} className="hover:underline">{ind.title}</Link> / {town.name}
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {ind.title}: visa sponsors in {town.name}
        </h1>
        <p className="max-w-3xl text-slate-600">
          {formatNumber(page.total)} {page.total === 1 ? 'employer' : 'employers'} in {ind.phrase} registered in {town.name} and licensed to sponsor
          Skilled Worker visas. The town is the sponsor&apos;s registered address, so some also work in nearby areas.
        </p>
      </header>

      {rows.length ? (
        <>
          <RangeNote total={page.total} first={user ? rows[0]?.name : undefined} last={user ? rows.at(-1)?.name : undefined} />
          <SponsorList items={rows} prefetch={false} />
          {user ? (
            <Pager path={path} prev={page.prev} next={page.next} />
          ) : (
            page.total > rows.length && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
                <p className="font-medium text-slate-900">Showing {rows.length} of {formatNumber(page.total)} sponsors.</p>
                <p className="mt-1 text-sm text-slate-600">Sign in free to see the full list, plus each company&apos;s website, careers page and open roles.</p>
                <Link href={`/login?next=${encodeURIComponent(path)}`} className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  Sign in to see all {formatNumber(page.total)}
                </Link>
              </div>
            )
          )}
        </>
      ) : (
        <p className="text-slate-600">
          No more sponsors here. <Link href={path} className="text-indigo-700 hover:underline">Back to the start</Link>
        </p>
      )}

      <div className="border-t border-slate-200 pt-6">
        <IndustryTowns industry={ind.slug} towns={towns} current={town.slug} />
      </div>
    </div>
  );
}
