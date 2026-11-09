import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { LetterStrip, Pager, RangeNote } from '@/components/Browse';
import { SponsorList } from '@/components/SponsorList';
import { browseLetter, getLetterCounts, isLetter, letterLabel, readCursor } from '@/lib/browse';

/** Rendered per request (like company pages): each ?after= cursor would otherwise be a stored ISR page. */
export const instant = false;

export async function generateMetadata({ params, searchParams }: PageProps<'/browse/[letter]'>): Promise<Metadata> {
  const { letter } = await params;
  if (!isLetter(letter)) return { title: 'Not found', robots: { index: false } };
  const paged = Object.keys(await searchParams).length > 0;
  const label = letterLabel(letter);
  return {
    title: `Skilled Worker visa sponsors starting with ${label}`,
    description: `Employers licensed to sponsor Skilled Worker visas whose names start with ${label}, from the Home Office register.`,
    alternates: { canonical: `/browse/${letter}` },
    // Later pages are for people; search engines get the first page and follow links from there.
    robots: paged ? { index: false, follow: true } : undefined,
  };
}

export default async function LetterPage({ params, searchParams }: PageProps<'/browse/[letter]'>) {
  await connection();
  const { letter } = await params;
  if (!isLetter(letter)) notFound();
  const cursor = readCursor(await searchParams);
  const [page, counts] = await Promise.all([browseLetter(letter, cursor), getLetterCounts()]);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/browse" className="hover:underline">Sponsors by city</Link> / A–Z
      </nav>
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sponsors starting with {letterLabel(letter)}</h1>
        <LetterStrip current={letter} counts={counts} />
      </header>
      {page.rows.length ? (
        <>
          <RangeNote total={page.total} first={page.rows[0]?.name} last={page.rows.at(-1)?.name} />
          <SponsorList items={page.rows} prefetch={false} />
          <Pager path={`/browse/${letter}`} prev={page.prev} next={page.next} />
        </>
      ) : (
        <p className="text-slate-600">
          No licensed sponsors here. <Link href={`/browse/${letter}`} className="text-indigo-700 hover:underline">Back to the start of {letterLabel(letter)}</Link>
        </p>
      )}
    </div>
  );
}
