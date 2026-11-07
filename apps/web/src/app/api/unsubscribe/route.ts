import { eq } from 'drizzle-orm';
import { getDb, user } from '@sponsors/db';
import { verifyUnsubscribeToken } from '@sponsors/email';
import { SITE_URL } from '@/lib/site';

/**
 * POST /api/unsubscribe?u=<userId>&t=<token>
 * Used by the confirm button on /unsubscribe and by mail clients' one-click
 * unsubscribe (RFC 8058 List-Unsubscribe-Post). No sign-in needed: the token is an HMAC.
 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const u = params.get('u') ?? '';
  const t = params.get('t') ?? '';
  if (!u || !t || !verifyUnsubscribeToken(u, t)) {
    return new Response('Invalid unsubscribe link', { status: 400 });
  }
  await getDb().update(user).set({ alertsEnabled: false }).where(eq(user.id, u));

  // Browser form posts get a page; mail-client one-click posts just need a 2xx.
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) return Response.redirect(`${SITE_URL}/unsubscribe?done=1`, 303);
  return new Response('Unsubscribed', { status: 200 });
}
