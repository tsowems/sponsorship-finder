import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { buildHref, Pagination } from '@/components/Pagination';
import { SearchForm } from '@/components/SearchForm';
import { SponsorList } from '@/components/SponsorList';
import { PAGE_SIZE, searchSponsors, type SearchInput } from '@/lib/data';
import { firstParam, formatNumber, pageParam } from '@/lib/format';

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const town = firstParam(sp.town);
  const filtered = Object.keys(sp).length > 0;
  return {
    title: q ? `“${q}” – sponsor search` : town ? `Skilled Worker sponsors in ${town}` : 'Search licensed Skilled Worker sponsors',
    alternates: { canonical: '/sponsors' },
    // Only the unfiltered list is worth indexing; company pages carry the SEO weight.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

function readInput(sp: Awaited<Search>): SearchInput {
  const rating = firstParam(sp.rating);
  const status = firstParam(sp.status);
  return {
    q: firstParam(sp.q)?.slice(0, 100),
    town: firstParam(sp.town)?.slice(0, 60),
    rating: rating === 'A' || rating === 'B' ? rating : undefined,
    status: status === 'removed' || status === 'all' ? status : 'active',
    page: pageParam(sp.page),
  };
}

export default function SponsorsPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Search licensed sponsors</h1>
      <Suspense fallback={<SearchForm showFilters />}>
        <Form searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="text-slate-500">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: Search }) {
  const input = readInput(await searchParams);
  return <SearchForm q={input.q} town={input.town} rating={input.rating} status={input.status} showFilters />;
}

async function Results({ searchParams }: { searchParams: Search }) {
  const input = readInput(await searchParams);
  const { results, total, suggestions } = await searchSponsors(input);
  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), 200);

  if (total === 0) {
    return (
      <div className="space-y-4">
        <p className="text-slate-600">
          No {input.status === 'removed' ? 'removed' : input.status === 'all' ? '' : 'licensed'} sponsors match
          {input.q ? ` “${input.q}”` : ''}
          {input.town ? ` in ${input.town}` : ''}.
        </p>
        {suggestions.length > 0 && (
          <>
            <h2 className="font-medium">Did you mean…</h2>
            <SponsorList items={suggestions} />
          </>
        )}
        {input.town && (
          <p className="text-sm text-slate-500">
            Tip: the register lists the town of the sponsor&apos;s registered address, which may differ from where the job is.{' '}
            <Link className="text-indigo-700 hover:underline" href={buildHref('/sponsors', { ...input, status: input.status === 'active' ? undefined : input.status, town: undefined, page: undefined })}>
              Search all towns
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">{formatNumber(total)} sponsors</p>
      <SponsorList items={results} />
      <Pagination page={input.page} totalPages={totalPages} href={(page) => buildHref('/sponsors', { ...input, status: input.status === 'active' ? undefined : input.status, page })} />
    </div>
  );
}
