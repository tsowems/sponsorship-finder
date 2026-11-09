import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const USER_AGENT = 'SponsorshipHunterBot/0.1 (+https://www.sponsorshiphunter.com/about)';

export interface FetchedPage {
  url: string; // final URL after redirects
  status: number;
  contentType: string;
  text: string;
}

export class FetchError extends Error {}

/** True for loopback, private, link-local and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

const dnsCache = new Map<string, Promise<boolean>>();
/** Does this hostname resolve to a public address? (Cached per process.) */
export function resolvesPublicly(hostname: string): Promise<boolean> {
  let p = dnsCache.get(hostname);
  if (!p) {
    p = lookup(hostname, { all: true })
      .then((addrs) => addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address)))
      .catch(() => false);
    dnsCache.set(hostname, p);
  }
  return p;
}

/**
 * GET a URL politely and safely: identifies itself, follows up to 5 redirects (re-checking each host),
 * refuses private network addresses, and stops reading after `maxBytes`.
 */
export async function safeFetch(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; accept?: string; headers?: Record<string, string>; method?: 'GET' | 'POST'; body?: string } = {},
): Promise<FetchedPage> {
  const { timeoutMs = 10_000, maxBytes = 1_500_000, accept = 'text/html,application/xhtml+xml', headers = {}, method = 'GET', body } = opts;
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new FetchError(`unsupported protocol ${u.protocol}`);
    if (!(await resolvesPublicly(u.hostname))) throw new FetchError(`host does not resolve publicly: ${u.hostname}`);

    const res = await fetch(current, {
      method,
      body: method === 'POST' ? body : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'en-GB,en;q=0.8', ...headers },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel();
      current = new URL(res.headers.get('location')!, current).toString();
      continue;
    }
    const contentType = res.headers.get('content-type') ?? '';
    let text = '';
    if (res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (size < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.byteLength;
      }
      await reader.cancel().catch(() => {});
      text = Buffer.concat(chunks).toString('utf8');
    }
    return { url: current, status: res.status, contentType, text };
  }
  throw new FetchError('too many redirects');
}

export async function fetchJson<T>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string>; method?: 'GET' | 'POST'; body?: string } = {}): Promise<T | null> {
  const page = await safeFetch(url, { ...opts, accept: 'application/json', maxBytes: 8_000_000 });
  if (page.status !== 200) return null;
  try {
    return JSON.parse(page.text) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- robots.txt

const robotsCache = new Map<string, Promise<string[]>>();

/** Disallow rules that apply to us (our agent or "*"). Simple prefix matching, which covers almost all sites. */
export function parseRobots(text: string): string[] {
  const groups: { agents: string[]; disallow: string[] }[] = [];
  let current: { agents: string[]; disallow: string[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], disallow: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (field === 'disallow' && current && value) current.disallow.push(value);
    }
  }
  const ours = groups.filter((g) => g.agents.some((a) => a.startsWith('sponsorshiphunterbot')));
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.disallow);
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const u = new URL(url);
  let rules = robotsCache.get(u.origin);
  if (!rules) {
    rules = safeFetch(`${u.origin}/robots.txt`, { timeoutMs: 6000, maxBytes: 200_000, accept: 'text/plain' })
      .then((p) => (p.status === 200 ? parseRobots(p.text) : []))
      .catch(() => []);
    robotsCache.set(u.origin, rules);
  }
  const path = u.pathname + u.search;
  return !(await rules).some((rule) => path.startsWith(rule.replace(/\*.*$/, '')));
}

/** Fetch an HTML page only if robots.txt allows it. Returns null when blocked, failing or not HTML. */
export async function fetchPage(url: string): Promise<FetchedPage | null> {
  try {
    if (!(await isAllowedByRobots(url))) return null;
    const page = await safeFetch(url);
    if (page.status !== 200 || !/html/i.test(page.contentType)) return null;
    return page;
  } catch {
    return null;
  }
}
