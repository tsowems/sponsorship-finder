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
    { label: 'Indeed', mark: 'i', color: '#2557a7', url: `https://uk.indeed.com/jobs?q=${e(q)}&l=${e(town)}` },
    { label: 'LinkedIn', mark: 'in', color: '#0a66c2', url: `https://www.linkedin.com/jobs/search/?keywords=${e(q)}&location=${e(`${town}, United Kingdom`)}` },
    { label: 'Glassdoor', mark: 'G', color: '#0a8a35', url: `https://www.glassdoor.co.uk/Job/jobs.htm?sc.keyword=${e(q)}&locKeyword=${e(town)}` },
    { label: 'Reed', mark: 'R', color: '#c8005a', url: `https://www.reed.co.uk/jobs?keywords=${e(q)}&location=${e(town)}` },
    { label: 'Totaljobs', mark: 'T', color: '#5b2d90', url: `https://www.totaljobs.com/jobs/${slug(q)}/in-${slug(town)}` },
  ];
}

/** One button per job board: a small badge in the board's colour (letters, not their logos) and its name. */
function BoardButtons({ name, town, small = false }: { name: string; town: string; small?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {jobBoardSearches(name, town).map((b) => (
        <li key={b.label}>
          <a
            href={b.url}
            target="_blank"
            rel="noopener nofollow"
            aria-label={`Search ${b.label} for this employer's jobs (opens in a new tab)`}
            className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 shadow-sm transition hover:-translate-y-px hover:border-slate-300 hover:shadow ${small ? 'py-1 pr-3 pl-1 text-xs' : 'py-1.5 pr-3.5 pl-1.5 text-sm'}`}
          >
            <span
              aria-hidden
              style={{ backgroundColor: b.color }}
              className={`grid place-items-center rounded-lg font-bold text-white ${small ? 'h-5 min-w-5 px-1 text-[0.65rem]' : 'h-6 min-w-6 px-1 text-xs'}`}
            >
              {b.mark}
            </span>
            {b.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function JobBoardLinks({ name, town, compact = false }: { name: string; town: string; compact?: boolean }) {
  const q = advertisingName(name);
  if (compact) {
    return (
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-600">Also search for their jobs on job boards. Some employers post roles there that aren&apos;t on their own site.</p>
        <BoardButtons name={name} town={town} small />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">
        Some employers only advertise on job boards. Search for <span className="font-medium">{q}</span> jobs on:
      </p>
      <BoardButtons name={name} town={town} />
      <p className="text-xs text-slate-500">
        Results are the job board&apos;s own search and may include other employers with similar names. A sponsor licence doesn&apos;t mean every
        role offers sponsorship, so check the advert or ask the employer.
      </p>
    </div>
  );
}
