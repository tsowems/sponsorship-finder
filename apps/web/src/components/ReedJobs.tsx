'use client';

import { useEffect, useState } from 'react';

interface BoardJob {
  id: number;
  title: string;
  location: string | null;
  salary: string | null;
  url: string;
  postedAt: string | null;
}

interface BoardData {
  enabled: boolean;
  checkedAt: string | null;
  jobs: BoardJob[];
}

const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });

/** The company's own adverts on Reed (signed-in users only; the page only renders this for them). */
export function ReedJobs({ sponsorId }: { sponsorId: number }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/board-jobs?sponsorId=${sponsorId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: BoardData) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [sponsorId]);

  if (failed || (data && !data.enabled)) return null;
  if (!data) {
    return (
      <div className="space-y-2" aria-busy>
        <p className="text-sm text-slate-500">Checking Reed for their job adverts…</p>
        <div className="h-12 animate-pulse rounded-md bg-slate-100" aria-hidden />
      </div>
    );
  }
  if (!data.jobs.length) {
    return data.checkedAt ? (
      <p className="text-sm text-slate-500">No adverts from them on Reed right now (checked {fmt.format(new Date(data.checkedAt))}).</p>
    ) : null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">
        On Reed: {data.jobs.length} advert{data.jobs.length === 1 ? '' : 's'} posted by them
      </h3>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
        {data.jobs.map((j) => (
          <li key={j.id}>
            <a href={j.url} rel="noopener nofollow" target="_blank" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2.5 hover:bg-slate-50">
              <span className="font-medium text-slate-900">{j.title}</span>
              <span className="text-sm text-slate-500">
                {[j.location, j.salary].filter(Boolean).join(' · ')}
                {j.postedAt ? ` · posted ${fmt.format(new Date(j.postedAt))}` : ''}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Jobs by{' '}
        <a href="https://www.reed.co.uk/" rel="noopener nofollow" target="_blank" className="underline hover:text-slate-700">
          reed.co.uk
        </a>
        , posted by the employer itself (agency adverts aren&apos;t included)
        {data.checkedAt ? `, checked ${fmt.format(new Date(data.checkedAt))}` : ''}. Not every role is eligible for sponsorship: check the advert or
        ask the employer.
      </p>
    </div>
  );
}
