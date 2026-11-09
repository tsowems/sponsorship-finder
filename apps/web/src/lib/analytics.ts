import 'server-only';
import { createHmac } from 'node:crypto';
import { lt, sql } from 'drizzle-orm';
import { getDb, pageViews } from '@sponsors/db';

/**
 * Cookieless visit counting (Plausible-style). Nothing is stored on the visitor's device.
 * Visitor id = HMAC(secret, London date + IP + user agent): stable for a day, then rotates, so
 * we can count unique visitors per day without being able to follow anyone across days.
 */

const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|java\/|facebookexternalhit|embedly|whatsapp|telegram|discord/i;

/** Raw page views are kept this long, then deleted. */
const RETENTION_DAYS = 400;

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

export function deviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** "https://www.google.co.uk/search?q=x" -> "google.co.uk". Our own host and junk -> null. */
export function referrerHost(referrer: string | undefined, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!host || host === ownHost.replace(/^www\./, '').toLowerCase()) return null;
    if (host === 'android-app' || host.endsWith('.vercel.app') || host === 'localhost') return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/** Keep paths tidy: no query/hash, bounded length, only our own pages. */
export function cleanPath(path: string | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  const p = path.split(/[?#]/)[0].slice(0, 200);
  if (p.startsWith('/admin') || p.startsWith('/api/') || p.startsWith('/_next')) return null;
  return p;
}

export function visitorId(ip: string, ua: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? 'dev';
  return createHmac('sha256', secret).update(`visitor:${londonDay()}:${ip}:${ua}`).digest('base64url').slice(0, 22);
}

export async function recordPageView(v: { path: string; referrer: string | null; ip: string; ua: string; country: string | null; signedIn: boolean }) {
  const db = getDb();
  await db.insert(pageViews).values({
    path: v.path,
    referrer: v.referrer,
    visitorId: visitorId(v.ip, v.ua),
    country: v.country && /^[A-Z]{2}$/.test(v.country) ? v.country : null,
    device: deviceType(v.ua),
    signedIn: v.signedIn,
  });
  // Occasional clean-up, so the table never grows without bound (no extra cron needed).
  if (Math.random() < 0.002) {
    await db.delete(pageViews).where(lt(pageViews.createdAt, sql`now() - make_interval(days => ${RETENTION_DAYS})`));
  }
}
