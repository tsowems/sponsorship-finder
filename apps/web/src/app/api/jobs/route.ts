import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb, jobs, sponsorProfiles } from '@sponsors/db';
import { ownSiteJobs } from '@sponsors/enrich';
import { getCurrentUser, json } from '@/lib/session';

/**
 * GET /api/jobs?sponsorId=123  (signed-in users only)
 * Open roles and the careers page for one sponsor. Kept out of the public page HTML so
 * job details are only shown to registered users.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);
  const sponsorId = Number(new URL(request.url).searchParams.get('sponsorId'));
  if (!Number.isInteger(sponsorId) || sponsorId <= 0) return json({ error: 'sponsorId required' }, 400);

  const db = getDb();
  const [profile] = await db
    .select({ careersUrl: sponsorProfiles.careersUrl, vacanciesUrl: sponsorProfiles.vacanciesUrl, jobsCheckedAt: sponsorProfiles.jobsCheckedAt, atsProvider: sponsorProfiles.atsProvider })
    .from(sponsorProfiles)
    .where(eq(sponsorProfiles.sponsorId, sponsorId));
  const rows = await db
    .select({ id: jobs.id, title: jobs.title, location: jobs.location, department: jobs.department, url: jobs.url, isUk: jobs.isUk, remote: jobs.remote, postedAt: jobs.postedAt })
    .from(jobs)
    .where(and(eq(jobs.sponsorId, sponsorId), ownSiteJobs()))
    .orderBy(desc(jobs.isUk), sql`${jobs.postedAt} desc nulls last`, asc(jobs.title))
    .limit(50);
  return json({ careersUrl: profile?.careersUrl ?? null, vacanciesUrl: profile?.vacanciesUrl ?? null, checkedAt: profile?.jobsCheckedAt ?? null, source: profile?.atsProvider ?? null, jobs: rows });
}
