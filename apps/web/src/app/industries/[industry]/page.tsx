import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Pager, RangeNote } from '@/components/Browse';
import { SponsorList } from '@/components/SponsorList';
import { readCursor } from '@/lib/browse';
import { formatNumber } from '@/lib/format';
import { browseIndustry, findIndustry, getIndustryCounts, INDUSTRIES, industryPreview } from '@/lib/industries';
import { getCurrentUser } from '@/lib/session';

/** Rendered per request: the full list depends on who's signed in, and cursors would otherwise be stored ISR pages. */
export const instant = false;

const PREVIEW = 10;

export async function generateMetadata({ params, searchParams }: PageProps<'/industries/[industry]'>): Promise<Metadata> {
  const { industry: slug } = await params;
  const ind = findIndustry(slug);
  if (!ind) return { title: 'Not found', robots: { index: false } };
  const total = (await getIndustryCounts())[ind.slug] ?? 0;
  const paged = Object.keys(await searchParams).length > 0;
  return {
    title: `${ind.title}: ${formatNumber(total)} UK visa sponsors`,
    description: `${formatNumber(total)} employers in ${ind.phrase} are licensed to sponsor Skilled Worker visas. ${ind.intro}`,
    alternates: { canonical: `/industries/${ind.slug}` },
    robots: paged ? { index: false, follow: true } : undefined,
  };
}

export default async function IndustryPage({ params, searchParams }: PageProps<'/industries/[industry]'>) {
  await connection();
  const { industry: slug } = await params;
  const ind = findIndustry(slug);
  if (!ind) notFound();
  const [user, counts] = await Promise.all([getCurrentUser(), getIndustryCounts()]);
  const total = counts[ind.slug] ?? 0;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/industries" className="hover:underline">Industries</Link> / {ind.title}
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{ind.title}: visa sponsors</h1>
        <p className="max-w-3xl text-slate-600">{ind.intro}</p>
        {ind.careRegister ? (
          <p className="max-w-3xl text-sm text-slate-500">
            Confirmed against the care regulators&apos; registers of home-care services (
            <a href="https://www.cqc.org.uk/about-us/transparency/using-cqc-data" rel="noopener" target="_blank" className="underline hover:text-slate-700">CQC</a> in England,
            the <a href="https://www.careinspectorate.scot/resources-data/data-and-statistics/datastore" rel="noopener" target="_blank" className="underline hover:text-slate-700">Care Inspectorate</a> in
            Scotland), plus organisations whose names say home care, mainly in Wales and Northern Ireland. Being licensed doesn&apos;t mean every role is eligible
            for sponsorship: check the job advert or ask the employer. Contains public sector information licensed under the Open Government Licence v3.0.
          </p>
        ) : (
          <p className="max-w-3xl text-sm text-slate-500">
            Based on Companies House industry codes where we have them, and on organisations&apos; names. Being licensed doesn&apos;t mean every role is
            eligible for sponsorship: check the job advert or ask the employer.
          </p>
        )}
      </header>

      {user ? <FullList slug={ind.slug} total={total} searchParams={searchParams} /> : <Preview slug={ind.slug} total={total} />}

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold">Other industries</h2>
        <ul className="flex flex-wrap gap-2">
          {INDUSTRIES.filter((i) => i.slug !== ind.slug).map((i) => (
            <li key={i.slug}>
              <Link href={`/industries/${i.slug}`} prefetch={false} className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
                {i.title} <span className="text-slate-400 tabular-nums">{formatNumber(counts[i.slug] ?? 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Signed out (and search engines): the first few A–Z, then a sign-in prompt. */
async function Preview({ slug, total }: { slug: string; total: number }) {
  const rows = await industryPreview(findIndustry(slug)!, PREVIEW);
  return (
    <>
      <RangeNote total={total} />
      <SponsorList items={rows} prefetch={false} />
      {total > rows.length && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
          <p className="font-medium text-slate-900">Showing {rows.length} of {formatNumber(total)} sponsors.</p>
          <p className="mt-1 text-sm text-slate-600">Sign in free to see the full list A–Z, plus each company&apos;s website, careers page and open roles.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/industries/${slug}`)}`}
            className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Sign in to see all {formatNumber(total)}
          </Link>
        </div>
      )}
    </>
  );
}

/** Signed in: everything, 50 per page with next/previous. */
async function FullList({ slug, total, searchParams }: { slug: string; total: number; searchParams: PageProps<'/industries/[industry]'>['searchParams'] }) {
  const page = await browseIndustry(findIndustry(slug)!, readCursor(await searchParams));
  if (!page.rows.length) {
    return (
      <p className="text-slate-600">
        No more sponsors here. <Link href={`/industries/${slug}`} className="text-indigo-700 hover:underline">Back to the start</Link>
      </p>
    );
  }
  return (
    <>
      <RangeNote total={total} first={page.rows[0]?.name} last={page.rows.at(-1)?.name} />
      <SponsorList items={page.rows} prefetch={false} />
      <Pager path={`/industries/${slug}`} prev={page.prev} next={page.next} />
    </>
  );
}
