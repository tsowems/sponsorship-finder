import { eq } from 'drizzle-orm';
import { getDb, PROFILE_PRIORITY, requestProfiles, sponsors } from '@sponsors/db';
import { isSameOrigin, json } from '@/lib/session';

/**
 * POST /api/profile-request { sponsorId }
 * Called by company pages that don't have a website/jobs profile yet, so the enrichment
 * worker looks up the companies people actually visit first. Cheap: one upsert.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const body = (await request.json().catch(() => ({}))) as { sponsorId?: unknown };
  const sponsorId = Number(body.sponsorId);
  if (!Number.isInteger(sponsorId) || sponsorId <= 0) return json({ error: 'sponsorId required' }, 400);
  const db = getDb();
  const [exists] = await db.select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.id, sponsorId));
  if (!exists) return json({ error: 'Unknown sponsor' }, 404);
  await requestProfiles(db, [sponsorId], PROFILE_PRIORITY.viewed);
  return json({ queued: true });
}
