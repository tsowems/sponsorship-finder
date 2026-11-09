import { cacheLife, cacheTag } from 'next/cache';
import { and, asc, eq, sql } from 'drizzle-orm';
import { councilNation, getDb, NATIONS, sponsors, type Nation } from '@sponsors/db';

export { findNation, NATIONS, type Nation } from '@sponsors/db';

/** Local councils on the register by nation (see @sponsors/db councils.ts for how a council is recognised). */

const listColumns = {
  id: sponsors.id,
  slug: sponsors.slug,
  name: sponsors.name,
  normalizedName: sponsors.normalizedName,
  town: sponsors.town,
  county: sponsors.county,
  rating: sponsors.rating,
  status: sponsors.status,
  firstSeenAt: sponsors.firstSeenAt,
  removedAt: sponsors.removedAt,
  inBaseline: sponsors.inBaseline,
};

export type CouncilRow = Awaited<ReturnType<typeof getCouncils>>[Nation][number];

/** Every licensed council, A–Z, by nation. A few hundred rows at most, so one cached entry serves every council page. */
export async function getCouncils() {
  'use cache';
  cacheLife('days');
  cacheTag('sponsors');
  const rows = await getDb()
    .select(listColumns)
    .from(sponsors)
    .where(and(eq(sponsors.status, 'active'), sql`${sponsors.normalizedName} ~ '(council|borough of|comhairle|corporation)'`))
    .orderBy(asc(sponsors.normalizedName), asc(sponsors.id));
  const out = Object.fromEntries(NATIONS.map((n) => [n.slug, [] as typeof rows])) as Record<Nation, typeof rows>;
  for (const r of rows) {
    const nation = councilNation(r.normalizedName);
    if (nation) out[nation].push(r);
  }
  return out;
}
