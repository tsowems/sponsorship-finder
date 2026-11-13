import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * CQC ratings. CQC publishes them monthly only as a spreadsheet (.ods: a zip holding one ~1 GB XML file), next to the
 * care directory on https://www.cqc.org.uk/about-us/transparency/using-cqc-data. Small home-care agencies are rated per
 * location, so we read the "Locations" sheet and keep the overall rating of each home-care location.
 */

/** Display order, best first. */
const ORDER = ['Outstanding', 'Good', 'Requires improvement', 'Inadequate', 'Not yet rated'];

/** CQC wording → ours ("Not Rated" / "Insufficient evidence to rate" → "Not yet rated"); null to ignore. */
function cleanRating(r: string): string | null {
  const v = r.trim();
  if (/^outstanding$/i.test(v)) return 'Outstanding';
  if (/^good$/i.test(v)) return 'Good';
  if (/^requires improvement$/i.test(v)) return 'Requires improvement';
  if (/^inadequate$/i.test(v)) return 'Inadequate';
  if (/not rated|insufficient evidence/i.test(v)) return 'Not yet rated';
  return null;
}

/** {Good: 3, Requires improvement: 1} → "3 Good, 1 Requires improvement"; {Good: 3} → "Good (all 3 services)"; one service → "Good". */
export function summariseRatings(counts: Map<string, number>): string | null {
  const parts = ORDER.filter((r) => counts.get(r)).map((r) => ({ r, n: counts.get(r)! }));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0].n === 1 ? parts[0].r : `${parts[0].r} (all ${parts[0].n} services)`;
  return parts.map((p) => `${p.n} ${p.r}`).join(', ');
}

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');

/** Cell values of one <table:table-row>, honouring repeated columns, up to `maxCols`. Plain string scanning (fast). */
export function rowCells(row: string, maxCols: number): string[] {
  const out: string[] = [];
  let p = 0;
  while (out.length < maxCols) {
    const start = row.indexOf('<table:table-cell', p);
    if (start < 0) break;
    const tagEnd = row.indexOf('>', start);
    const tag = row.slice(start, tagEnd + 1);
    const rep = /number-columns-repeated="(\d+)"/.exec(tag);
    const times = Math.min(rep ? Number(rep[1]) : 1, maxCols - out.length);
    let value = '';
    if (tag.endsWith('/>')) {
      p = tagEnd + 1;
    } else {
      const close = row.indexOf('</table:table-cell>', tagEnd);
      const inner = row.slice(tagEnd + 1, close < 0 ? row.length : close);
      // Text is in one or more <text:p>, possibly with <text:span> etc. inside: drop the tags.
      value = unescapeXml(inner.replace(/<text:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '')).trim();
      p = close < 0 ? row.length : close + 19;
    }
    for (let i = 0; i < times; i++) out.push(value);
  }
  return out;
}

export interface RatingsResult {
  /** CQC provider ID → rating counts across its home-care locations. */
  byProvider: Map<string, Map<string, number>>;
  rows: number;
}

/**
 * Read the "Locations" sheet from the spreadsheet XML, keeping the overall rating of the given locations only.
 * `chunks`: the XML text, in pieces (streamed, so the 1 GB file is never held in memory).
 */
export async function ratingsFromSheetXml(chunks: AsyncIterable<string>, locationIds: Set<string>): Promise<RatingsResult> {
  const byProvider = new Map<string, Map<string, number>>();
  let buf = '';
  let sheet: string | null = null;
  let col: Record<string, number> | null = null;
  let rows = 0;
  const NEED = ['Location ID', 'Service / Population Group', 'Domain', 'Latest Rating', 'Provider ID'];

  for await (const chunk of chunks) {
    buf += chunk;
    let p = 0;
    for (;;) {
      const t = buf.indexOf('<table:table ', p);
      const r = buf.indexOf('<table:table-row', p);
      if (t >= 0 && (r < 0 || t < r)) {
        const end = buf.indexOf('>', t);
        if (end < 0) break;
        sheet = /table:name="([^"]*)"/.exec(buf.slice(t, end))?.[1] ?? null;
        col = null;
        p = end + 1;
        continue;
      }
      if (r < 0) break;
      const e = buf.indexOf('</table:table-row>', r);
      if (e < 0) break;
      if (sheet === 'Locations') {
        const row = buf.slice(r, e);
        if (!col) {
          const head = rowCells(row, 60);
          if (head[0] === 'Location ID') {
            col = Object.fromEntries(NEED.map((n) => [n, head.indexOf(n)]));
            if (NEED.some((n) => col![n] < 0)) throw new Error(`CQC ratings: missing columns (${NEED.filter((n) => col![n] < 0).join(', ')})`);
          }
        } else {
          const cells = rowCells(row, Math.max(...Object.values(col)) + 1);
          rows++;
          if (cells[col['Service / Population Group']] === 'Overall' && cells[col.Domain] === 'Overall' && locationIds.has(cells[col['Location ID']])) {
            const rating = cleanRating(cells[col['Latest Rating']]);
            const provider = cells[col['Provider ID']];
            if (rating && provider) {
              const m = byProvider.get(provider) ?? new Map<string, number>();
              m.set(rating, (m.get(rating) ?? 0) + 1);
              byProvider.set(provider, m);
            }
          }
        }
      }
      p = e + 18;
    }
    // Keep only the unfinished tail.
    buf = buf.slice(p);
  }
  return { byProvider, rows };
}

/** Download the .ods and stream its sheet XML through `unzip -p` (present on GitHub's runners and macOS). */
export async function downloadCqcRatings(url: string, locationIds: Set<string>, userAgent: string): Promise<RatingsResult> {
  const dir = await mkdtemp(join(tmpdir(), 'cqc-ratings-'));
  const file = join(dir, 'ratings.ods');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(300_000) });
    if (!res.ok || !res.body) throw new Error(`${url} answered ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(file));
    const unzip = spawn('unzip', ['-p', file, 'content.xml'], { stdio: ['ignore', 'pipe', 'pipe'] });
    unzip.stdout.setEncoding('utf8');
    const exited = new Promise<number>((resolve, reject) => {
      unzip.on('error', reject);
      unzip.on('close', (code) => resolve(code ?? 1));
    });
    const result = await ratingsFromSheetXml(unzip.stdout, locationIds);
    const code = await exited;
    if (code !== 0) throw new Error(`unzip exited with ${code}`);
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
