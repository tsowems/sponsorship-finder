import { eq } from 'drizzle-orm';
import { getDb, user as userTable } from '@sponsors/db';
import { getCurrentUser, isSameOrigin, json } from '@/lib/session';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);
  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== 'boolean') return json({ error: 'enabled must be true or false' }, 400);
  await getDb().update(userTable).set({ alertsEnabled: body.enabled }).where(eq(userTable.id, user.id));
  return json({ alertsEnabled: body.enabled });
}
