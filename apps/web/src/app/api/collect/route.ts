import { headers } from 'next/headers';
import { cleanPath, isBot, recordPageView, referrerHost } from '@/lib/analytics';
import { isSameOrigin } from '@/lib/session';
import { SITE_URL } from '@/lib/site';

/**
 * POST /api/collect  {path, referrer}  (sent by <PageViewTracker /> via sendBeacon)
 * Always answers 204 so it never shows errors to visitors.
 */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  if (!isSameOrigin(request)) return done;
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  if (isBot(ua)) return done;

  let body: { path?: string; referrer?: string; signedIn?: boolean };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return done;
  }
  const path = cleanPath(body.path);
  if (!path) return done;

  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  try {
    await recordPageView({
      path,
      referrer: referrerHost(body.referrer, new URL(SITE_URL).hostname),
      ip,
      ua,
      country: h.get('x-vercel-ip-country'),
      signedIn: body.signedIn === true,
    });
  } catch (e) {
    console.error('[collect]', e);
  }
  return done;
}
