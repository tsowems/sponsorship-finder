import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token the worker sends to the website's internal endpoints (e.g. /api/revalidate).
 * Derived from BETTER_AUTH_SECRET, which both already share per environment, so there's
 * no extra secret to configure.
 */
export function internalApiToken(secret = process.env.BETTER_AUTH_SECRET): string | null {
  if (!secret) return null;
  return createHmac('sha256', secret).update('internal-api:revalidate').digest('base64url');
}

export function verifyInternalApiToken(token: string | null | undefined): boolean {
  const expected = internalApiToken();
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
