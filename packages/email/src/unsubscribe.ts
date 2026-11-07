import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error('BETTER_AUTH_SECRET is not set');
  return s;
}

/** Signed token so unsubscribe links work without signing in and can't be forged for other users. */
export function unsubscribeToken(userId: string): string {
  return createHmac('sha256', secret()).update(`unsubscribe:${userId}`).digest('base64url');
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, userId: string): string {
  const qs = new URLSearchParams({ u: userId, t: unsubscribeToken(userId) });
  return `${siteUrl}/unsubscribe?${qs}`;
}
