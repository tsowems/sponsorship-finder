import { internalApiToken } from '@sponsors/db';

const BATCH = 200;

/**
 * Tell the website to refresh cached pages now, instead of waiting for the cache to expire.
 * Never throws: if the site can't be reached the pages simply refresh on their normal schedule.
 */
export async function revalidateSite(opts: { slugs?: string[]; all?: boolean }, log: (m: string) => void = console.log): Promise<void> {
  const site = process.env.SITE_URL?.replace(/\/$/, '');
  const token = internalApiToken();
  if (!site || !token) {
    log('[revalidate] skipped: SITE_URL or BETTER_AUTH_SECRET not set');
    return;
  }
  const slugs = [...new Set(opts.slugs ?? [])];
  const batches: { slugs: string[]; all?: boolean }[] = [];
  for (let i = 0; i < slugs.length; i += BATCH) batches.push({ slugs: slugs.slice(i, i + BATCH) });
  if (opts.all) batches.push({ slugs: [], all: true });
  if (!batches.length) return;

  let done = 0;
  for (const b of batches) {
    try {
      const res = await fetch(`${site}/api/revalidate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        log(`[revalidate] ${site} answered ${res.status}; pages will refresh on their normal schedule`);
        return;
      }
      done += b.slugs.length;
    } catch (err) {
      log(`[revalidate] could not reach ${site}: ${err instanceof Error ? err.message : err}`);
      return;
    }
  }
  log(`[revalidate] refreshed ${done} company page${done === 1 ? '' : 's'}${opts.all ? ' + all lists' : ''} on ${site}`);
}
