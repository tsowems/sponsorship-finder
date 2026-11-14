import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb, sponsors } from '@sponsors/db';
import { isAdminUser } from '@/lib/admin';
import { auth } from '@/lib/auth';

/**
 * Runs before the page renders, so these answers keep their real status code (a streamed page is always 200):
 *  - Crawlers on the big page sets (company, industry, city, council pages) get "503 try again later" while
 *    CRAWLERS=pause (the default): rendering ~125k pages for search engines used up Vercel's free CPU allowance.
 *    Set CRAWLERS=allow in Vercel to let them in again. People are never affected.
 *  - /admin: non-admins get the site's normal 404 (no "Admin" title), so the admin area is indistinguishable from a
 *    page that doesn't exist. Pages check again.
 *  - /sponsors/<slug>: a company that isn't (and never was) on the register gets a real 404, not a "soft 404".
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/admin') && crawlersPaused() && isCrawler(request.headers.get('user-agent'))) return tryLater();
  if (pathname.startsWith('/sponsors/')) return sponsorExists(pathname.slice('/sponsors/'.length)).then((ok) => (ok ? NextResponse.next() : notFound(request)));
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (isAdminUser(session?.user)) return NextResponse.next();
  return notFound(request);
}

const crawlersPaused = () => (process.env.CRAWLERS ?? 'pause') !== 'allow';

/** Search engines, SEO tools, AI crawlers and scripts (anything that isn't a person's browser). */
const CRAWLER = /bot\b|bot\/|crawl|spider|slurp|bingpreview|mediapartners|adsbot|feedfetcher|facebookexternalhit|embedly|headless|python|curl|wget|httpclient|okhttp|java\/|go-http|scrapy|axios|node-fetch|undici|libwww|ahrefs|semrush|petalsearch|yandex|baidu|sogou|duckduck|applebot|amazonbot|bytespider|gptbot|claude|perplexity|ccbot|diffbot|dataforseo/i;
const isCrawler = (ua: string | null) => !ua || CRAWLER.test(ua);

/** "Temporarily unavailable": search engines slow down and come back later, without dropping pages straight away. */
const tryLater = () =>
  new NextResponse('Temporarily unavailable for automated access. Please try again later.', {
    status: 503,
    headers: { 'Retry-After': '86400', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const notFound = (request: NextRequest) => NextResponse.rewrite(new URL('/_not-found-page', request.url), { status: 404 });

/** Slugs seen to exist (companies are never deleted, so this can't go stale). Bounded so memory stays small. */
const known = new Set<string>();
const KNOWN_MAX = 20_000;

async function sponsorExists(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return false;
  if (known.has(slug)) return true;
  try {
    const [row] = await getDb().select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.slug, slug)).limit(1);
    if (!row) return false;
    if (known.size >= KNOWN_MAX) known.clear();
    known.add(slug);
    return true;
  } catch {
    return true; // database hiccup: let the page decide rather than wrongly answering 404
  }
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/sponsors/:slug', '/industries/:path*', '/browse/:path*', '/councils/:path*', '/changes'],
};
