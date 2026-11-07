import { and, eq } from 'drizzle-orm';
import { cleanText, getDb, normalizeName, normalizeTown, savedSearches } from '@sponsors/db';
import { getCurrentUser, isSameOrigin, json } from '@/lib/session';

const MAX_SEARCHES = 20;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);

  const body = (await request.json().catch(() => ({}))) as { q?: unknown; town?: unknown };
  const query = cleanText(typeof body.q === 'string' ? body.q : '').slice(0, 100);
  const town = cleanText(typeof body.town === 'string' ? body.town : '').slice(0, 60);
  const normalizedQuery = query ? normalizeName(query) : '';
  const normalizedTown = town ? normalizeTown(town) : '';
  if (!normalizedQuery && !normalizedTown) return json({ error: 'Enter a company name or a town' }, 400);
  if (normalizedQuery && normalizedQuery.length < 2) return json({ error: 'Search term is too short' }, 400);

  const db = getDb();
  const count = await db.$count(savedSearches, eq(savedSearches.userId, user.id));
  if (count >= MAX_SEARCHES) return json({ error: `You can save up to ${MAX_SEARCHES} searches` }, 400);

  await db
    .insert(savedSearches)
    .values({ userId: user.id, query: query || null, normalizedQuery, town: town || null, normalizedTown })
    .onConflictDoNothing();
  return json({ saved: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = Number(body.id);
  if (!Number.isInteger(id)) return json({ error: 'id required' }, 400);
  await getDb().delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  return json({ deleted: true });
}
