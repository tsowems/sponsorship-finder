/**
 * Links that open the big job boards' own searches for this employer. Display only: nothing is stored,
 * so they never count as a careers page and don't change when the company is re-checked.
 *  - full: shown when we found no careers page or jobs
 *  - compact: one "Also search on…" line under the roles / careers link we did find
 */

/** The name employers usually advertise under: the trading name if given ("X Ltd t/a Y" → "Y"), without "Ltd", "PLC"… */
export function advertisingName(name: string): string {
  const tradingAs = name.split(/\s+(?:t\/a|t\.a\.|trading as)\s+/i);
  const base = (tradingAs[1] ?? tradingAs[0]).replace(/\s*\((?:uk|u\.k\.|gb)\)\s*/gi, ' ');
  const cleaned = base
    .replace(/[\s,.]+(?:limited|ltd\.?|plc|llp|lp|cic|cio|inc\.?|uk\s+limited|uk\s+ltd)\s*$/i, '')
    .replace(/[\s,.]+(?:limited|ltd\.?|plc|llp)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || name;
}

export function jobBoardSearches(name: string, town: string) {
  const q = advertisingName(name);
  const e = encodeURIComponent;
  const slug = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    { label: 'Indeed', url: `https://uk.indeed.com/jobs?q=${e(q)}&l=${e(town)}` },
    { label: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${e(q)}&location=${e(`${town}, United Kingdom`)}` },
    { label: 'Glassdoor', url: `https://www.glassdoor.co.uk/Job/jobs.htm?sc.keyword=${e(q)}&locKeyword=${e(town)}` },
    { label: 'Reed', url: `https://www.reed.co.uk/jobs?keywords=${e(q)}&location=${e(town)}` },
    { label: 'Totaljobs', url: `https://www.totaljobs.com/jobs/${slug(q)}/in-${slug(town)}` },
  ];
}

export function JobBoardLinks({ name, town, compact = false }: { name: string; town: string; compact?: boolean }) {
  const q = advertisingName(name);
  if (compact) {
    return (
      <p className="text-sm text-slate-600">
        Also search for their jobs on{' '}
        {jobBoardSearches(name, town).map((b, i, all) => (
          <span key={b.label}>
            <a href={b.url} target="_blank" rel="noopener nofollow" className="font-medium text-indigo-700 hover:underline">
              {b.label}
            </a>
            {i < all.length - 2 ? ', ' : i === all.length - 2 ? ' or ' : ''}
          </span>
        ))}
        . Some employers post roles there that aren&apos;t on their own site.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">
        Some employers only advertise on job boards. Search for <span className="font-medium">{q}</span> jobs on:
      </p>
      <ul className="flex flex-wrap gap-2">
        {jobBoardSearches(name, town).map((b) => (
          <li key={b.label}>
            <a
              href={b.url}
              target="_blank"
              rel="noopener nofollow"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
            >
              {b.label} ↗
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Results are the job board&apos;s own search and may include other employers with similar names. A sponsor licence doesn&apos;t mean every
        role offers sponsorship, so check the advert or ask the employer.
      </p>
    </div>
  );
}
