const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
const longDateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
const numberFmt = new Intl.NumberFormat('en-GB');

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatLongDate = (d: Date | string) => longDateFmt.format(new Date(d));
export const formatNumber = (n: number) => numberFmt.format(n);
/** Bucket key for grouping events by UK calendar day. */
export const dayKey = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

export function firstParam(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

export function pageParam(v: string | string[] | undefined, max = 200): number {
  const n = Number.parseInt(firstParam(v) ?? '1', 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : 1;
}
