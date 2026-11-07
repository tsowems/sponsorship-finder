import 'server-only';
import { headers } from 'next/headers';
import { auth } from './auth';
import { SITE_URL } from './site';

/** Current user in a Server Component or Route Handler (null when signed out). */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** Same-origin check for our JSON mutation endpoints (defence in depth on top of SameSite cookies). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(SITE_URL).host || new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

/** Only allow redirects back into this site ("/account", not "//evil.com" or "https://..."). */
export function safeNext(next: string | null | undefined, fallback = '/account'): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
}
