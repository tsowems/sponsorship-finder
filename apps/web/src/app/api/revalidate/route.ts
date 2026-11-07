import { revalidateTag } from 'next/cache';
import { verifyInternalApiToken } from '@sponsors/db';
import { json } from '@/lib/session';

const SLUG = /^[a-z0-9-]{1,120}$/;
const MAX_SLUGS = 500;

/**
 * POST /api/revalidate  (called by the worker, not by browsers)
 *   Authorization: Bearer <token derived from BETTER_AUTH_SECRET>
 *   { "slugs": ["monzo-bank-ltd-london", ...] }   → those company pages refresh on their next visit
 *   { "all": true }                               → every sponsor page and list refreshes in the background
 */
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!verifyInternalApiToken(token)) return json({ error: 'Unauthorized' }, 401);

  const body = (await request.json().catch(() => ({}))) as { slugs?: unknown; all?: unknown };
  const slugs = Array.isArray(body.slugs) ? body.slugs.filter((s): s is string => typeof s === 'string' && SLUG.test(s)) : [];
  if (slugs.length > MAX_SLUGS) return json({ error: `At most ${MAX_SLUGS} slugs per request` }, 400);

  // expire: 0 → the very next visit renders fresh data (no stale copy), so researched
  // companies appear immediately.
  for (const slug of slugs) revalidateTag(`sponsor:${slug}`, { expire: 0 });
  // Everything (lists, home page, all company pages): serve the old copy while refreshing in the
  // background, so 122k pages don't all go cold at once after an import.
  if (body.all === true) revalidateTag('sponsors', 'max');

  return json({ revalidated: slugs.length, all: body.all === true });
}
