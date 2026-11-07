/** Tiny, dependency-free HTML helpers. Good enough for scanning pages, not for rendering. */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '£', copy: '©' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Visible-ish text: drops scripts/styles/tags, decodes entities, collapses whitespace. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function pageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

export interface Link {
  href: string; // absolute
  text: string;
}

/** All <a href> links (absolute URLs), plus iframe/script src so embedded job boards are found too. */
export function extractLinks(html: string, baseUrl: string): Link[] {
  const out: Link[] = [];
  const add = (href: string, text: string) => {
    try {
      const abs = new URL(decodeEntities(href.trim()), baseUrl);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') out.push({ href: abs.toString(), text });
    } catch {
      /* ignore malformed */
    }
  };
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    add(m[1], htmlToText(m[2]).slice(0, 120));
  }
  for (const m of html.matchAll(/<(?:iframe|script)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m[1], '');
  return out;
}
