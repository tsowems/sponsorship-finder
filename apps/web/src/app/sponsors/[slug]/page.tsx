import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RatingBadge, StatusBadge } from '@/components/Badges';
import { EventPill } from '@/components/ChangeList';
import { getSponsorBySlug } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

/**
 * Company pages must reach Google as complete HTML (no loading placeholders), so the whole
 * route is required to be static. Unknown slugs render on first request and are then cached.
 */
export const ensureStatic = 'navigation';

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
  const { sponsor, events, trackingSince, sameName } = data;
  const active = sponsor.status === 'active';
  const downgraded = sponsor.rating.startsWith('B');

  const companiesHouse = `https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(sponsor.name)}`;
  const webSearch = `https://www.google.com/search?q=${encodeURIComponent(`"${sponsor.name}" ${sponsor.town} careers`)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: sponsor.name,
    url: `${SITE_URL}/sponsors/${sponsor.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: sponsor.town, addressRegion: sponsor.county ?? undefined, addressCountry: 'GB' },
    ...(sponsor.website ? { sameAs: [sponsor.website] } : {}),
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
            <strong>No longer on the register</strong> since {formatDate(sponsor.removedAt ?? sponsor.lastSeenAt)}. A licence can disappear from the
            register because it was revoked, surrendered by the employer or expired, or because the organisation was renamed. The
            register doesn&apos;t say which.
          </p>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-3">
        <section className="space-y-3 md:col-span-2">
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

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold">Find out more</h2>
            <ul className="space-y-2 text-sm">
              {sponsor.website && (
                <li><a className="text-indigo-700 hover:underline" href={sponsor.website} rel="noopener nofollow">Company website ↗</a></li>
              )}
              {sponsor.careersUrl && (
                <li><a className="text-indigo-700 hover:underline" href={sponsor.careersUrl} rel="noopener nofollow">Careers page ↗</a></li>
              )}
              <li><a className="text-indigo-700 hover:underline" href={companiesHouse} rel="noopener nofollow">Look up on Companies House ↗</a></li>
              <li><a className="text-indigo-700 hover:underline" href={webSearch} rel="noopener nofollow">Search for their careers page ↗</a></li>
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
