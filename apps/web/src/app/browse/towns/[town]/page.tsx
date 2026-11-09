import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { Pager, RangeNote } from '@/components/Browse';
import { SponsorList } from '@/components/SponsorList';
import { browseTown, findTownByName, getTowns, MIN_INDEXED_TOWN, readCursor, townFromSlug } from '@/lib/browse';
import { formatNumber } from '@/lib/format';

/** Rendered per request (like company pages): each ?after= cursor would otherwise be a stored ISR page. */
export const instant = false;

async function findTown(slug: string) {
  if (!townFromSlug(slug)) return null;
  return (await getTowns()).find((t) => t.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: PageProps<'/browse/towns/[town]'>): Promise<Metadata> {
  const { town: slug } = await params;
  const town = await findTown(slug);
  if (!town) return { title: 'Town not found', robots: { index: false } };
  const paged = Object.keys(await searchParams).length > 0;
  return {
    title: `Visa sponsors in ${town.name}: ${formatNumber(town.count)} licensed Skilled Worker employers`,
    description: `${formatNumber(town.count)} employers in ${town.name} are licensed to sponsor Skilled Worker visas. Browse them A–Z, from the Home Office register.`,
    alternates: { canonical: `/browse/towns/${town.slug}` },
    robots: paged || town.count < MIN_INDEXED_TOWN ? { index: false, follow: true } : undefined,
  };
}

export default async function TownPage({ params, searchParams }: PageProps<'/browse/towns/[town]'>) {
  await connection();
  const { town: slug } = await params;
  const town = await findTown(slug);
  if (!town) {
    // Another spelling of a merged place (/browse/towns/greater-london → /browse/towns/london).
    const merged = townFromSlug(slug) ? await findTownByName(townFromSlug(slug)!) : null;
    if (merged) permanentRedirect(`/browse/towns/${merged.slug}`);
    notFound();
  }
  const page = await browseTown(town.variants, readCursor(await searchParams));

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/browse" className="hover:underline">Sponsors by city</Link> /{' '}
        <Link href="/browse/towns" className="hover:underline">All cities and towns</Link> / {town.name}
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Visa sponsors in {town.name}</h1>
        <p className="max-w-2xl text-slate-600">
          Employers in {town.name} licensed to sponsor Skilled Worker visas, A–Z. The register lists each sponsor&apos;s registered address,
          so some may hire elsewhere.{' '}
          <Link href={`/sponsors?town=${encodeURIComponent(town.name)}`} className="text-indigo-700 hover:underline">Search within {town.name}</Link>
        </p>
      </header>
      {page.rows.length ? (
        <>
          <RangeNote total={page.total} first={page.rows[0]?.name} last={page.rows.at(-1)?.name} />
          <SponsorList items={page.rows} prefetch={false} />
          <Pager path={`/browse/towns/${town.slug}`} prev={page.prev} next={page.next} />
        </>
      ) : (
        <p className="text-slate-600">
          No more sponsors here. <Link href={`/browse/towns/${town.slug}`} className="text-indigo-700 hover:underline">Back to the start</Link>
        </p>
      )}
    </div>
  );
}
