import { createHash } from 'node:crypto';

const CONTENT_API =
  'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers';
const USER_AGENT = 'SponsorshipHunter/0.1 (register importer)';

export interface RegisterSource {
  url: string;
  publishedAt: Date;
}

/** Ask the gov.uk Content API where the latest register CSV lives. */
export async function getLatestRegisterSource(): Promise<RegisterSource> {
  const res = await fetch(CONTENT_API, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`gov.uk content API responded ${res.status}`);
  const body = (await res.json()) as {
    public_updated_at?: string;
    details?: { attachments?: { url?: string; content_type?: string; title?: string }[] };
  };
  const attachments = body.details?.attachments ?? [];
  const csv =
    attachments.find((a) => a.content_type === 'text/csv' && /worker/i.test(`${a.title} ${a.url}`)) ??
    attachments.find((a) => a.content_type === 'text/csv');
  if (!csv?.url) throw new Error('No CSV attachment found on the register publication page');

  // The filename carries the register date (e.g. ..._-_2026-11-06.csv); fall back to the page update time.
  const fileDate = csv.url.match(/(\d{4}-\d{2}-\d{2})\.csv$/)?.[1];
  const publishedAt = fileDate
    ? new Date(`${fileDate}T00:00:00Z`)
    : new Date(body.public_updated_at ?? Date.now());
  return { url: csv.url, publishedAt };
}

export async function downloadRegister(url: string): Promise<{ text: string; sha256: string }> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Register download failed: ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { text: buf.toString('utf8'), sha256: createHash('sha256').update(buf).digest('hex') };
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
