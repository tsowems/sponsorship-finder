import { and, eq } from 'drizzle-orm';
import { getDb, PROFILE_PRIORITY, requestProfiles, sponsors, watches } from '@sponsors/db';
import { getCurrentUser, isSameOrigin, json } from '@/lib/session';

const MAX_WATCHES = 500;

/** GET /api/watch?sponsorId=123 → { signedIn, watching } */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const sponsorId = Number(new URL(request.url).searchParams.get('sponsorId'));
  if (!user) return json({ signedIn: false, watching: false });
  if (!Number.isInteger(sponsorId)) return json({ error: 'sponsorId required' }, 400);
  const [row] = await getDb()
    .select({ sponsorId: watches.sponsorId })
    .from(watches)
    .where(and(eq(watches.userId, user.id), eq(watches.sponsorId, sponsorId)));
  return json({ signedIn: true, watching: Boolean(row) });
}

async function readSponsorId(request: Request): Promise<number | null> {
  const body = (await request.json().catch(() => ({}))) as { sponsorId?: unknown };
  const id = Number(body.sponsorId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);
  const sponsorId = await readSponsorId(request);
  if (!sponsorId) return json({ error: 'sponsorId required' }, 400);

  const db = getDb();
  const [exists] = await db.select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.id, sponsorId));
  if (!exists) return json({ error: 'Unknown sponsor' }, 404);
  const count = await db.$count(watches, eq(watches.userId, user.id));
  if (count >= MAX_WATCHES) return json({ error: `You can watch up to ${MAX_WATCHES} companies` }, 400);

  await db.insert(watches).values({ userId: user.id, sponsorId }).onConflictDoNothing();
  // Watched companies jump the queue for website + jobs lookup.
  await requestProfiles(db, [sponsorId], PROFILE_PRIORITY.watched);
  return json({ watching: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);
  const sponsorId = await readSponsorId(request);
  if (!sponsorId) return json({ error: 'sponsorId required' }, 400);
  await getDb().delete(watches).where(and(eq(watches.userId, user.id), eq(watches.sponsorId, sponsorId)));
  return json({ watching: false });
}
