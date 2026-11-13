import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { boardChecks, getDb, jobs, sponsors } from '@sponsors/db';
import { refreshReedJobs, REED_SOURCE, reedEnabled } from '@sponsors/enrich';
import { getCurrentUser, json } from '@/lib/session';

/**
 * GET /api/board-jobs?sponsorId=123  (signed-in users only)
 * The company's own adverts on Reed. Searches Reed first when the last check is over 3 days old (and today's free
 * allowance isn't used up), so only companies people actually open are searched.
 *   { enabled, checkedAt, jobs: [...] }
 */
export async function GET(request: Request) {
  // Only our own pages may trigger a search (stops other sites spending the Reed allowance via a signed-in visitor).
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);
  const sponsorId = Number(new URL(request.url).searchParams.get('sponsorId'));
  if (!Number.isInteger(sponsorId) || sponsorId <= 0) return json({ error: 'sponsorId required' }, 400);
  if (!reedEnabled()) return json({ enabled: false, checkedAt: null, jobs: [] });

  const db = getDb();
  const [sponsor] = await db.select({ id: sponsors.id, name: sponsors.name, status: sponsors.status }).from(sponsors).where(eq(sponsors.id, sponsorId));
  if (!sponsor) return json({ error: 'Unknown company' }, 404);
  if (sponsor.status === 'active') await refreshReedJobs(sponsor).catch(() => null);

  const [[check], rows] = await Promise.all([
    db.select({ checkedAt: boardChecks.checkedAt, found: boardChecks.found }).from(boardChecks).where(and(eq(boardChecks.sponsorId, sponsorId), eq(boardChecks.board, REED_SOURCE))),
    db
      .select({ id: jobs.id, title: jobs.title, location: jobs.location, salary: jobs.department, url: jobs.url, postedAt: jobs.postedAt })
      .from(jobs)
      .where(and(eq(jobs.sponsorId, sponsorId), eq(jobs.source, REED_SOURCE)))
      .orderBy(sql`${jobs.postedAt} desc nulls last`, asc(jobs.title), desc(jobs.id))
      .limit(50),
  ]);
  // `found` is null while the first check runs or if it failed: report "not checked yet" rather than "none".
  return json({ enabled: true, checkedAt: check?.found === null ? null : (check?.checkedAt ?? null), jobs: rows });
}
