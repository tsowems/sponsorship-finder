import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { claimLiveLookup, getDb, PROFILE_PRIORITY, requestProfiles, sponsors } from '@sponsors/db';
import { enrichSponsor } from '@sponsors/enrich';
import { isSameOrigin, json } from '@/lib/session';

/** A lookup takes ~5–30 s (Companies House, Wikidata, the company's site and careers page). */
export const maxDuration = 60;

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|monitor/i;

/**
 * POST /api/profile-request { sponsorId }
 * Called by company pages we haven't researched yet (or where the last search found nothing over an hour ago).
 * Looks the company up there and then, so the visitor sees its website and jobs within seconds:
 *   { status: 'done', found: true|false }  → reload the page to show the result
 *   { status: 'queued' }                    → left for the background worker (busy, a bot, or already being looked up)
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const body = (await request.json().catch(() => ({}))) as { sponsorId?: unknown };
  const sponsorId = Number(body.sponsorId);
  if (!Number.isInteger(sponsorId) || sponsorId <= 0) return json({ error: 'sponsorId required' }, 400);
  const db = getDb();
  const [sponsor] = await db.select({ id: sponsors.id, slug: sponsors.slug, status: sponsors.status }).from(sponsors).where(eq(sponsors.id, sponsorId));
  if (!sponsor) return json({ error: 'Unknown sponsor' }, 404);

  await requestProfiles(db, [sponsorId], PROFILE_PRIORITY.viewed);
  const human = !BOT.test(request.headers.get('user-agent') ?? '');
  if (!human || sponsor.status !== 'active' || !(await claimLiveLookup(db, sponsorId))) return json({ status: 'queued' });

  try {
    const d = await enrichSponsor(sponsorId);
    revalidateTag(`sponsor:${sponsor.slug}`, { expire: 0 });
    return json({ status: 'done', found: Boolean(d?.website) });
  } catch {
    revalidateTag(`sponsor:${sponsor.slug}`, { expire: 0 });
    return json({ status: 'queued' });
  }
}
