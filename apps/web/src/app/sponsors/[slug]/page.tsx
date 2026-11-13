import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { RatingBadge, StatusBadge } from '@/components/Badges';
import { EventPill } from '@/components/ChangeList';
import { JobBoardLinks } from '@/components/JobBoardLinks';
import { JobsPanel } from '@/components/JobsPanel';
import { ProfileRequest } from '@/components/ProfileRequest';
import { SuggestLink } from '@/components/SuggestLink';
import { WatchButton } from '@/components/WatchButton';
import { profileNeedsLookup } from '@sponsors/db';
import { getSponsorBySlug } from '@/lib/data';
import { getCurrentUser } from '@/lib/session';
import { publicBodyKind } from '@sponsors/enrich';
import { formatDate } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

/**
 * Company pages are rendered per request and NOT stored as ISR pages. With ~122k companies,
 * storing each page cost ~5 Vercel "ISR writes" (HTML, RSC data and prefetch segments), so a
 * single crawl of the site would use ~600k writes (Hobby allows 200k/month).
 * The page still arrives as complete HTML (we await everything before responding, no
 * placeholders), so search engines see the full content. The sponsor data itself is cached
 * in memory via getSponsorBySlug('use cache'), which is not an ISR write.
 */
/** Deliberately blocking: we want the full page (for SEO), not an instant placeholder shell. */
export const instant = false;

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
  await connection(); // render at request time; never stored as an ISR page
  const { slug } = await params;
  const data = await getSponsorBySlug(slug);
  if (!data) notFound();
  const { sponsor, events, trackingSince, sameName, profile, homeCare } = data;
  const cqc = homeCare.find((h) => h.regulator === 'cqc');
  // Website, careers, jobs and job-board links are for signed-in users only, and aren't sent to anyone else.
  const signedIn = Boolean(await getCurrentUser());
  const active = sponsor.status === 'active';
  const downgraded = sponsor.rating.startsWith('B');

  // Councils, NHS bodies, universities…: not companies, so no Companies House link.
  const publicBody = Boolean(publicBodyKind(sponsor.normalizedName)) && !profile?.companyNumber;
  const companiesHouse = profile?.companyNumber
    ? `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(profile.companyNumber)}`
    : `https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(sponsor.name)}`;
  const webSearch = `https://www.google.com/search?q=${encodeURIComponent(`"${sponsor.name}" ${sponsor.town}`)}`;
  const routes = sponsor.routes.length ? sponsor.routes : ['Skilled Worker'];
  const researched = profile && profile.status !== 'queued';
  // Opening the page looks the company up straight away (or re-tries a "not found" over an hour old).
  const lookUp = active && profileNeedsLookup(profile);
  // Job-board searches (display only; nothing stored, re-checks unchanged): full when we found no careers page
  // or jobs, a one-line "also search on…" under the roles / careers link when we did.
  const showJobBoards = active && Boolean(researched);
  const foundJobsOrCareers = Boolean(profile?.careersUrl || profile?.jobsCount);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: sponsor.name,
    url: `${SITE_URL}/sponsors/${sponsor.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: sponsor.town, addressRegion: sponsor.county ?? undefined, addressCountry: 'GB' },
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
          {homeCare.length > 0 && (
            <div>
              <dt className="text-slate-500">Home care</dt>
              <dd className="font-medium text-slate-900">
                <Link href="/industries/home-care-domiciliary" prefetch={false} className="hover:text-indigo-700 hover:underline">
                  Registered home care provider
                </Link>{' '}
                <span className="font-normal text-slate-500">
                  ({homeCare.map((h) => (h.regulator === 'cqc' ? 'CQC, England' : 'Care Inspectorate, Scotland')).join('; ')})
                </span>
              </dd>
            </div>
          )}
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
          {lookUp && <ProfileRequest sponsorId={sponsor.id} />}
          {signedIn ? (
            <>
            {profile?.website || profile?.careersUrl ? (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
                {profile.website && (
                  <div className="flex flex-wrap gap-3">
                    <a href={profile.website} rel="noopener nofollow" target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                      Visit {new URL(profile.website).hostname.replace(/^www\./, '')} ↗
                    </a>
                  </div>
                )}
                <JobsPanel
                  sponsorId={sponsor.id}
                  slug={sponsor.slug}
                  jobsCount={profile.jobsCount}
                  ukJobsCount={profile.ukJobsCount}
                  hasCareersPage={Boolean(profile.careersUrl)}
                />
                {showJobBoards && <JobBoardLinks name={sponsor.name} town={sponsor.town} compact={foundJobsOrCareers} />}
                <p className="text-xs text-slate-500">
                  {!profile.website
                    ? 'Careers page suggested by a visitor. We haven’t found a main website we can confirm.'
                    : profile.websiteVerifiedBy === 'admin'
                    ? 'Website suggested by a visitor and checked by us.'
                    : profile.websiteVerifiedBy === 'company_number' || profile.websiteVerifiedBy === 'wikidata'
                    ? 'Website confirmed using the company’s registration number.'
                    : profile.websiteVerifiedBy === 'govuk'
                      ? 'Official council website, from GOV.UK’s list of local councils.'
                      : profile.websiteVerifiedBy === 'nhs_ods'
                        ? 'Official website, from the NHS organisation directory.'
                        : profile.websiteVerifiedBy === 'public_domain'
                          ? 'Official public-sector website (a protected address such as .gov.uk, .nhs.uk or .ac.uk) naming this organisation.'
                          : 'Website confirmed by the company’s registered name appearing on it.'}
                </p>
                <SuggestLink sponsorId={sponsor.id} hasWebsite={Boolean(profile.website)} hasCareers={Boolean(profile.careersUrl || profile.vacanciesUrl)} />
              </div>
            ) : researched ? (
              <div className="space-y-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
                <p className="text-sm text-slate-600">
                  We couldn&apos;t find a website we could confirm belongs to this organisation.{' '}
                  <a href={webSearch} rel="noopener nofollow" target="_blank" className="text-indigo-700 hover:underline">Search the web ↗</a>
                </p>
                {showJobBoards && <JobBoardLinks name={sponsor.name} town={sponsor.town} />}
                <SuggestLink sponsorId={sponsor.id} hasWebsite={false} hasCareers={false} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                We&apos;re looking up this organisation&apos;s website and open roles. If nothing appears, check back later, or{' '}
                <a href={webSearch} rel="noopener nofollow" target="_blank" className="text-indigo-700 hover:underline">search the web ↗</a>
              </p>
            )}
            </>
          ) : (
            <SignInForCompanyLinks
              slug={sponsor.slug}
              researched={Boolean(researched)}
              website={Boolean(profile?.website)}
              careers={Boolean(profile?.careersUrl || profile?.vacanciesUrl)}
              jobsCount={profile?.jobsCount ?? 0}
              ukJobsCount={profile?.ukJobsCount ?? 0}
            />
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
              {!publicBody && (
                <li>
                  <a className="text-indigo-700 hover:underline" href={companiesHouse} rel="noopener nofollow" target="_blank">
                    {profile?.companyNumber ? `Companies House record (${profile.companyNumber}) ↗` : 'Look up on Companies House ↗'}
                  </a>
                  {profile?.companyStatus && profile.companyStatus !== 'active' && (
                    <span className="ml-1 font-medium text-red-700">({profile.companyStatus.replace(/-/g, ' ')})</span>
                  )}
                </li>
              )}
              {cqc && (
                <li>
                  <a className="text-indigo-700 hover:underline" href={`https://www.cqc.org.uk/provider/${encodeURIComponent(cqc.providerId)}`} rel="noopener nofollow" target="_blank">
                    CQC inspections and ratings ↗
                  </a>
                </li>
              )}
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

/** What signed-out visitors see instead of the website / careers / jobs / job-board links: what we found, and a sign-in button. */
function SignInForCompanyLinks(props: { slug: string; researched: boolean; website: boolean; careers: boolean; jobsCount: number; ukJobsCount: number }) {
  const { slug, researched, website, careers, jobsCount, ukJobsCount } = props;
  const found: string[] = [];
  if (website) found.push('their website');
  if (careers) found.push('their careers page');
  if (ukJobsCount) found.push(`${ukJobsCount} open role${ukJobsCount === 1 ? '' : 's'} in the UK`);
  else if (jobsCount) found.push(`${jobsCount} open role${jobsCount === 1 ? '' : 's'}`);
  found.push('links to search for their jobs on LinkedIn, Indeed and other job boards');
  const list = found.length > 1 ? `${found.slice(0, -1).join(', ')} and ${found.at(-1)}` : found[0];
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-5">
      <p className="font-medium text-slate-900">
        {researched ? `We found ${list}.` : 'We’re looking up this organisation’s website and open roles.'}
      </p>
      <p className="mt-1 text-sm text-slate-600">Sign in free to see them, and get alerts if this company&apos;s licence changes.</p>
      <Link
        href={`/login?next=${encodeURIComponent(`/sponsors/${slug}`)}`}
        className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Sign in to see website and jobs
      </Link>
    </div>
  );
}
