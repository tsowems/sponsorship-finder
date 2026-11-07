import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RatingBadge, StatusBadge } from '@/components/Badges';
import { EventPill } from '@/components/ChangeList';
import { ProfileRequest } from '@/components/ProfileRequest';
import { WatchButton } from '@/components/WatchButton';
import { getSponsorBySlug } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

/**
 * Company pages must reach Google as complete HTML (no loading placeholders), so the whole
 * route is required to be static. Unknown slugs render on first request and are then cached.
 */
export const ensureStatic = 'navigation';
/** Deliberately blocking: we want the full page (for SEO), not an instant placeholder shell. */
export const instant = false;

export async function generateStaticParams() {
  // Pages are generated on demand; one placeholder satisfies the build requirement.
  return [{ slug: '__placeholder__' }];
}

export async function generateMetadata({ params }: PageProps<'/sponsors/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSponsorBySlug(slug);
  if (!data) return { title: 'Sponsor not found', robots: { index: false } };
  const { sponsor } = data;
  const active = sponsor.status === 'active';
  return {
    title: `${sponsor.name} (${sponsor.town}) – ${active ? 'licensed' : 'former'} Skilled Worker visa sponsor`,
    description: active
      ? `${sponsor.name} in ${sponsor.town} is on the Home Office register of licensed sponsors for the Skilled Worker visa route, with an ${sponsor.rating} rating. See its licence history.`
      : `${sponsor.name} in ${sponsor.town} was removed from the Home Office register of licensed Skilled Worker sponsors on ${formatDate(sponsor.removedAt ?? sponsor.lastSeenAt)}.`,
    alternates: { canonical: `/sponsors/${sponsor.slug}` },
  };
}

export default async function SponsorPage({ params }: PageProps<'/sponsors/[slug]'>) {
  const { slug } = await params;
  const data = await getSponsorBySlug(slug);
  if (!data) notFound();
  const { sponsor, events, trackingSince, sameName, profile, jobs } = data;
  const active = sponsor.status === 'active';
  const downgraded = sponsor.rating.startsWith('B');

  const companiesHouse = profile?.companyNumber
    ? `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(profile.companyNumber)}`
    : `https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(sponsor.name)}`;
  const webSearch = `https://www.google.com/search?q=${encodeURIComponent(`"${sponsor.name}" ${sponsor.town}`)}`;
  const routes = sponsor.routes.length ? sponsor.routes : ['Skilled Worker'];
  const researched = profile && profile.status !== 'queued';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: sponsor.name,
    url: `${SITE_URL}/sponsors/${sponsor.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: sponsor.town, addressRegion: sponsor.county ?? undefined, addressCountry: 'GB' },
    ...(profile?.website ? { sameAs: [profile.website] } : {}),
  };

  return (
    <article className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav className="text-sm text-slate-500">
        <Link href="/sponsors" className="hover:underline">Sponsors</Link> /{' '}
        <Link href={`/sponsors?town=${encodeURIComponent(sponsor.town)}`} className="hover:underline">{sponsor.town}</Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={sponsor.status} />
          <RatingBadge rating={sponsor.rating} />
          <span className="text-xs text-slate-500">Skilled Worker route</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{sponsor.name}</h1>
        <p className="text-slate-600">
          {sponsor.town}
          {sponsor.county ? `, ${sponsor.county}` : ''}
        </p>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 pt-1 text-sm">
          <div>
            <dt className="text-slate-500">{sponsor.inBaseline ? 'On the register since' : 'Licensed since'}</dt>
            <dd className="font-medium text-slate-900">
              {sponsor.inBaseline ? `at least ${formatDate(sponsor.firstSeenAt)}` : formatDate(sponsor.firstSeenAt)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Visa routes</dt>
            <dd className="font-medium text-slate-900">{routes.join(' · ')}</dd>
          </div>
          {profile?.incorporatedOn && (
            <div>
              <dt className="text-slate-500">Incorporated</dt>
              <dd className="font-medium text-slate-900">{formatDate(profile.incorporatedOn)}</dd>
            </div>
          )}
        </dl>
      </header>

      <section
        className={`rounded-lg border p-5 ${active ? (downgraded ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50') : 'border-red-200 bg-red-50'}`}
      >
        {active && !downgraded && (
          <p className="text-slate-800">
            <strong>{sponsor.name}</strong> holds a Skilled Worker sponsor licence, so it can sponsor eligible roles. Being licensed doesn&apos;t
            guarantee a specific job is eligible: the role and salary still need to meet the Skilled Worker requirements.
          </p>
        )}
        {active && downgraded && (
          <p className="text-slate-800">
            <strong>This sponsor has a B rating.</strong> The Home Office has downgraded it, usually because it isn&apos;t fully meeting its
            sponsor duties, and put it on an action plan. B-rated sponsors generally can&apos;t assign certificates of sponsorship to new workers
            until the rating is restored.
          </p>
        )}
        {!active && (
          <p className="text-slate-800">
            <strong>No longer on the register</strong> since {formatDate(sponsor.removedAt ?? sponsor.lastSeenAt)}. A sponsor can disappear from the
            register because its licence was suspended, revoked, surrendered by the employer or expired, or because the organisation was
            renamed. The register doesn&apos;t say which.
          </p>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Website and jobs</h2>
          {!researched && <ProfileRequest sponsorId={sponsor.id} />}
          {profile?.website ? (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap gap-3">
                <a href={profile.website} rel="noopener nofollow" target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                  Visit {new URL(profile.website).hostname.replace(/^www\./, '')} ↗
                </a>
                {profile.careersUrl && (
                  <a href={profile.careersUrl} rel="noopener nofollow" target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                    Careers page ↗
                  </a>
                )}
              </div>
              {jobs.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    {profile.ukJobsCount > 0 ? `${profile.ukJobsCount} open role${profile.ukJobsCount === 1 ? '' : 's'} in the UK` : 'Open roles (none listed in the UK)'}
                    {profile.jobsCount > profile.ukJobsCount && <span className="font-normal text-slate-500"> · {profile.jobsCount} worldwide</span>}
                  </h3>
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
                    {jobs.map((j) => (
                      <li key={j.id}>
                        <a href={j.url} rel="noopener nofollow" target="_blank" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2.5 hover:bg-slate-50">
                          <span className="font-medium text-slate-900">{j.title}</span>
                          <span className="text-sm text-slate-500">
                            {[j.location, j.department].filter(Boolean).join(' · ')}
                            {j.postedAt ? ` · posted ${formatDate(j.postedAt)}` : ''}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  {profile.jobsCount > jobs.length && profile.careersUrl && (
                    <a href={profile.careersUrl} rel="noopener nofollow" target="_blank" className="mt-2 inline-block text-sm text-indigo-700 hover:underline">
                      See all {profile.jobsCount} roles on their careers site ↗
                    </a>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Listed on the company&apos;s own hiring page{profile.jobsCheckedAt ? `, checked ${formatDate(profile.jobsCheckedAt)}` : ''}. Not every role
                    is eligible for sponsorship: check the job advert or ask the employer.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {profile.careersUrl
                    ? 'Open roles are listed on their careers page.'
                    : 'We couldn’t find a careers page on their website. Try their site’s “Careers” or “Jobs” section, or ask them directly.'}
                </p>
              )}
              <p className="text-xs text-slate-500">
                {profile.websiteVerifiedBy === 'company_number' || profile.websiteVerifiedBy === 'wikidata'
                  ? 'Website confirmed using the company’s registration number.'
                  : 'Website confirmed by the company’s registered name appearing on it.'}
              </p>
            </div>
          ) : researched ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
              We couldn&apos;t find a website we could confirm belongs to this organisation.{' '}
              <a href={webSearch} rel="noopener nofollow" target="_blank" className="text-indigo-700 hover:underline">Search the web ↗</a>
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
              We&apos;re looking up this organisation&apos;s website and open roles. Check back soon, or{' '}
              <a href={webSearch} rel="noopener nofollow" target="_blank" className="text-indigo-700 hover:underline">search the web ↗</a>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Licence history</h2>
          <ol className="space-y-3 border-l-2 border-slate-200 pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                <div className="flex flex-wrap items-center gap-2">
                  <time className="text-sm font-medium text-slate-700" dateTime={new Date(e.occurredAt).toISOString()}>
                    {formatDate(e.occurredAt)}
                  </time>
                  <EventPill {...e} />
                </div>
              </li>
            ))}
            <li className="relative">
              <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-white bg-slate-300" />
              <p className="text-sm text-slate-600">
                {sponsor.inBaseline
                  ? `On the register since at least ${formatDate(sponsor.firstSeenAt)} (when we started tracking).`
                  : `First appeared on the register ${formatDate(sponsor.firstSeenAt)}.`}
              </p>
            </li>
          </ol>
          {trackingSince && (
            <p className="text-xs text-slate-500">We check the Home Office register daily and have tracked changes since {formatDate(trackingSince)}.</p>
          )}
        </section>
        </div>

        <aside className="space-y-4">
          <WatchButton sponsorId={sponsor.id} slug={sponsor.slug} />
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold">Find out more</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a className="text-indigo-700 hover:underline" href={companiesHouse} rel="noopener nofollow" target="_blank">
                  {profile?.companyNumber ? `Companies House record (${profile.companyNumber}) ↗` : 'Look up on Companies House ↗'}
                </a>
                {profile?.companyStatus && profile.companyStatus !== 'active' && (
                  <span className="ml-1 font-medium text-red-700">({profile.companyStatus.replace(/-/g, ' ')})</span>
                )}
              </li>
              <li><a className="text-indigo-700 hover:underline" href={webSearch} rel="noopener nofollow" target="_blank">Search the web ↗</a></li>
            </ul>
          </div>
          {sameName.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 font-semibold">Same name, other locations</h2>
              <ul className="space-y-2 text-sm">
                {sameName.map((s) => (
                  <li key={s.slug}>
                    <Link className="text-indigo-700 hover:underline" href={`/sponsors/${s.slug}`}>{s.town}</Link>
                    {s.status === 'removed' && <span className="ml-1 text-slate-500">(removed)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
