import type { DayPoint } from '@/lib/admin-data';

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const tickFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const d = (s: string) => new Date(`${s}T00:00:00Z`);

/** "Nice" axis maximum: 1, 2, 5 × 10^n at or above the data max. */
function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

/**
 * Daily visitors as a single-series bar chart (CSS only). Hovering/focusing a day shows visitors,
 * page views and sign-ups for it. The tables below the chart carry the same numbers in text.
 */
export function DailyChart({ series }: { series: DayPoint[] }) {
  const max = niceMax(Math.max(0, ...series.map((p) => p.visitors)));
  const ticks = [max, max / 2, 0];
  const labelEvery = series.length > 31 ? 14 : series.length > 14 ? 7 : 1;

  return (
    <figure className="space-y-2">
      <div className="flex gap-2">
        {/* y axis */}
        <div className="flex h-56 flex-col justify-between pb-0 text-right text-[0.7rem] text-slate-500 tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{t.toLocaleString('en-GB')}</span>
          ))}
        </div>
        <div className="relative h-56 flex-1">
          {/* recessive grid */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            <div className="border-t border-dashed border-slate-200" />
            <div className="border-t border-dashed border-slate-200" />
            <div className="border-t border-slate-300" />
          </div>
          <ol className="relative flex h-full items-end gap-[2px]" aria-label="Visitors per day">
            {series.map((p) => {
              const h = max ? (p.visitors / max) * 100 : 0;
              return (
                <li key={p.day} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
                  <span
                    className="block w-full max-w-7 rounded-t-[4px] bg-indigo-500 transition-colors group-hover:bg-indigo-700 group-focus:bg-indigo-700"
                    style={{ height: `${h}%`, minHeight: p.visitors ? 2 : 0 }}
                  />
                  <span className="sr-only">
                    {dayFmt.format(d(p.day))}: {p.visitors} visitors, {p.views} page views, {p.signups} sign-ups
                  </span>
                  <span
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus:block"
                    aria-hidden
                  >
                    <span className="block font-semibold">{dayFmt.format(d(p.day))}</span>
                    <span className="block tabular-nums">{p.visitors.toLocaleString('en-GB')} visitors</span>
                    <span className="block text-white/75 tabular-nums">{p.views.toLocaleString('en-GB')} page views</span>
                    <span className="block text-white/75 tabular-nums">{p.signups.toLocaleString('en-GB')} sign-ups</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {/* x axis */}
      <div className="flex gap-[2px] pl-8 text-[0.7rem] text-slate-500" aria-hidden>
        {series.map((p, i) => (
          <span key={p.day} className="flex-1 text-center whitespace-nowrap">
            {(series.length - 1 - i) % labelEvery === 0 ? tickFmt.format(d(p.day)) : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}
