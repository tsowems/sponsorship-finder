import { and, count, eq, gt, inArray } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { getDb, linkSuggestions, sponsorProfiles, sponsors } from '@sponsors/db';
import { checkSuggestion, enrichSponsor, knownLinks, normalizeSuggestedUrl, saveDiscovery, sponsorInputColumns } from '@sponsors/enrich';
import { getCurrentUser, isSameOrigin, json } from '@/lib/session';

/** Checking a website can take ~5–30 s (fetching the site and its legal pages). */
export const maxDuration = 60;

const PER_USER_PER_DAY = 10;
const DAY = 24 * 60 * 60 * 1000;

/**
 * POST /api/suggestions { sponsorId, kind: 'website' | 'careers', url }   (signed-in users only)
 * Checks the link with the same rules as our own search:
 *   { status: 'accepted' }  → it passed; the company page now shows it
 *   { status: 'pending' }   → couldn't confirm it automatically; an admin will review it
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Please sign in to suggest a link.' }, 401);

  const body = (await request.json().catch(() => ({}))) as { sponsorId?: unknown; kind?: unknown; url?: unknown };
  const sponsorId = Number(body.sponsorId);
  const kind = body.kind === 'website' || body.kind === 'careers' ? body.kind : null;
  if (!Number.isInteger(sponsorId) || sponsorId <= 0 || !kind || typeof body.url !== 'string') return json({ error: 'Missing details.' }, 400);
  const url = normalizeSuggestedUrl(body.url);
  if (!url) {
    return json({ error: 'Please enter the organisation’s own web address, like www.example.co.uk. Job boards and social media pages can’t be used.' }, 400);
  }

  const db = getDb();
  const [sponsor] = await db.select({ ...sponsorInputColumns, status: sponsors.status }).from(sponsors).where(eq(sponsors.id, sponsorId));
  if (!sponsor) return json({ error: 'Unknown company.' }, 404);

  const [{ n }] = await db
    .select({ n: count() })
    .from(linkSuggestions)
    .where(and(eq(linkSuggestions.userId, user.id), gt(linkSuggestions.createdAt, new Date(Date.now() - DAY))));
  if (n >= PER_USER_PER_DAY) return json({ error: 'Thanks for all your suggestions! Please try again tomorrow.' }, 429);

  const [existing] = await db
    .select({ status: linkSuggestions.status })
    .from(linkSuggestions)
    .where(and(eq(linkSuggestions.sponsorId, sponsorId), eq(linkSuggestions.kind, kind), eq(linkSuggestions.url, url), inArray(linkSuggestions.status, ['pending', 'accepted'])))
    .limit(1);
  if (existing) return json({ status: existing.status });

  const [profile] = await db
    .select({ website: sponsorProfiles.website, companyNumber: sponsorProfiles.companyNumber, companyName: sponsorProfiles.companyName })
    .from(sponsorProfiles)
    .where(eq(sponsorProfiles.sponsorId, sponsorId));
  const check = await checkSuggestion(kind, url, {
    sponsor,
    known: await knownLinks(sponsorId),
    website: profile?.website ?? null,
    companyNumber: profile?.companyNumber ?? null,
    companyName: profile?.companyName ?? null,
  }).catch((err) => ({ accepted: false, note: `Check failed: ${err instanceof Error ? err.message : err}`, discovery: undefined }));

  await db.insert(linkSuggestions).values({
    sponsorId,
    userId: user.id,
    kind,
    url,
    status: check.accepted ? 'accepted' : 'pending',
    acceptedBy: check.accepted ? 'auto' : null,
    note: check.note.slice(0, 500),
    reviewedAt: check.accepted ? new Date() : null,
  });

  if (check.accepted) {
    // Save straight away so the company page shows it (a website check already has the full result).
    if (check.discovery) await saveDiscovery(sponsorId, check.discovery);
    else await enrichSponsor(sponsorId).catch(() => null);
    revalidateTag(`sponsor:${sponsor.slug}`, { expire: 0 });
  }
  return json({ status: check.accepted ? 'accepted' : 'pending' });
}
