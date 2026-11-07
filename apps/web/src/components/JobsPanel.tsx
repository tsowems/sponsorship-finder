'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

interface Job {
  id: number;
  title: string;
  location: string | null;
  department: string | null;
  url: string;
  isUk: boolean;
  postedAt: string | null;
}

const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });

/**
 * Open roles + careers link for a sponsor. Signed-out visitors see how many roles there are and
 * a prompt to sign in; the roles themselves are fetched from /api/jobs only for signed-in users.
 */
export function JobsPanel(props: { sponsorId: number; slug: string; jobsCount: number; ukJobsCount: number; hasCareersPage: boolean }) {
  const { sponsorId, slug, jobsCount, ukJobsCount, hasCareersPage } = props;
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const [data, setData] = useState<{ careersUrl: string | null; checkedAt: string | null; jobs: Job[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signedIn || (!jobsCount && !hasCareersPage)) return;
    let cancelled = false;
    fetch(`/api/jobs?sponsorId=${sponsorId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [signedIn, sponsorId, jobsCount, hasCareersPage]);

  const headline =
    ukJobsCount > 0
      ? `${ukJobsCount} open role${ukJobsCount === 1 ? '' : 's'} in the UK`
      : jobsCount > 0
        ? `${jobsCount} open role${jobsCount === 1 ? '' : 's'} (none listed in the UK)`
        : null;

  if (!jobsCount && !hasCareersPage) {
    return (
      <p className="text-sm text-slate-600">
        We couldn&apos;t find a careers page on their website. Try their site&apos;s &ldquo;Careers&rdquo; or &ldquo;Jobs&rdquo; section, or ask
        them directly.
      </p>
    );
  }

  // Server render / before we know if they're signed in: show the public part (the count).
  if (isPending) {
    return (
      <div className="rounded-md border border-slate-100 p-4">
        <p className="font-medium text-slate-900">{headline ?? 'This company has a careers page'}</p>
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-100" aria-hidden />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="rounded-md border border-indigo-100 bg-indigo-50 p-4">
        <p className="font-medium text-slate-900">{headline ?? 'This company has a careers page'}</p>
        <p className="mt-1 text-sm text-slate-600">
          Sign in free to see {jobsCount ? 'the roles' : 'their careers page'} and get alerts if this company&apos;s licence changes.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/sponsors/${slug}`)}`}
          className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Sign in to see {jobsCount ? 'open roles' : 'careers page'}
        </Link>
      </div>
    );
  }

  if (failed) return <p className="text-sm text-red-700">Couldn&apos;t load open roles. Please refresh the page.</p>;
  if (!data) return <div className="h-20 animate-pulse rounded-md bg-slate-100" aria-hidden />;

  return (
    <div className="space-y-2">
      {data.careersUrl && (
        <a href={data.careersUrl} rel="noopener nofollow" target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Careers page ↗
        </a>
      )}
      {data.jobs.length > 0 && (
        <>
          <h3 className="pt-2 text-sm font-semibold text-slate-700">
            {headline}
            {jobsCount > ukJobsCount && ukJobsCount > 0 && <span className="font-normal text-slate-500"> · {jobsCount} worldwide</span>}
          </h3>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
            {data.jobs.map((j) => (
              <li key={j.id}>
                <a href={j.url} rel="noopener nofollow" target="_blank" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2.5 hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{j.title}</span>
                  <span className="text-sm text-slate-500">
                    {[j.location, j.department].filter(Boolean).join(' · ')}
                    {j.postedAt ? ` · posted ${fmt.format(new Date(j.postedAt))}` : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {jobsCount > data.jobs.length && data.careersUrl && (
            <a href={data.careersUrl} rel="noopener nofollow" target="_blank" className="inline-block text-sm text-indigo-700 hover:underline">
              See all {jobsCount} roles on their careers site ↗
            </a>
          )}
          <p className="text-xs text-slate-500">
            Listed on the company&apos;s own hiring page{data.checkedAt ? `, checked ${fmt.format(new Date(data.checkedAt))}` : ''}. Not every role is
            eligible for sponsorship: check the job advert or ask the employer.
          </p>
        </>
      )}
    </div>
  );
}
