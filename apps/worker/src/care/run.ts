import { eq } from 'drizzle-orm';
import { careRegistrations, getDb, sponsors } from '@sponsors/db';
import { revalidateSite } from '../revalidate';
import { indexProviders, matchSponsor, type CareMatch, type Regulator } from './match';
import { downloadCqcRatings, ratingsFromSheetXml, summariseRatings, type RatingsResult } from './ratings';
import { CARE_USER_AGENT, cqcRatingsUrl, downloadRegister, MIN_HOME_CARE_SERVICES, type RegisterFile } from './sources';

const REGULATORS: Regulator[] = ['cqc', 'care_inspectorate'];
const INSERT_BATCH = 500;

export interface CareRunOptions {
  dryRun?: boolean;
  /** Use already-downloaded files instead of fetching (local testing). */
  files?: RegisterFile[];
  /** CQC ratings spreadsheet XML already extracted (local testing), instead of downloading the .ods. */
  ratingsXml?: AsyncIterable<string>;
  log?: (m: string) => void;
}

/** CQC ratings for the given home-care locations; null if the file can't be read (last month's ratings are kept). */
async function loadCqcRatings(file: RegisterFile, ratingsXml: AsyncIterable<string> | undefined, log: (m: string) => void): Promise<RatingsResult | null> {
  const ids = new Set(file.services.filter((s) => s.homeCare && s.locationId).map((s) => s.locationId!));
  try {
    const t0 = Date.now();
    const res = ratingsXml ? await ratingsFromSheetXml(ratingsXml, ids) : await downloadCqcRatings(await cqcRatingsUrl(), ids, CARE_USER_AGENT);
    log(`[care] cqc ratings: ${res.byProvider.size} providers with rated home-care services (${res.rows} rows, ${Math.round((Date.now() - t0) / 1000)}s)`);
    return res.byProvider.size > 1000 ? res : (log('[care] cqc ratings: too few, keeping last month\'s ratings'), null);
  } catch (err) {
    log(`[care] cqc ratings: failed, keeping last month's ratings (${err instanceof Error ? err.message : err})`);
    return null;
  }
}

/**
 * Download the care registers, match them to licensed sponsors and replace each regulator's rows.
 * A regulator whose download fails or looks incomplete is skipped, so last month's matches stay in place.
 */
export async function runCareRegisters({ dryRun = false, files, ratingsXml, log = console.log }: CareRunOptions = {}) {
  const db = getDb();
  const all = await db
    .select({ id: sponsors.id, slug: sponsors.slug, name: sponsors.name, normalizedName: sponsors.normalizedName, town: sponsors.town })
    .from(sponsors)
    .where(eq(sponsors.status, 'active'));
  const slugOf = new Map(all.map((s) => [s.id, s.slug]));
  const changed = new Set<string>();
  const summary: Record<string, { matched: number; homeCare: number }> = {};

  for (const regulator of REGULATORS) {
    let file: RegisterFile;
    try {
      file = files?.find((f) => f.regulator === regulator) ?? (await downloadRegister(regulator));
    } catch (err) {
      log(`[care] ${regulator}: download failed, keeping last month's matches (${err instanceof Error ? err.message : err})`);
      continue;
    }
    const homeServices = file.services.filter((s) => s.homeCare).length;
    log(`[care] ${regulator}: ${file.services.length} services (${homeServices} home care) from ${file.url}`);
    if (homeServices < MIN_HOME_CARE_SERVICES[regulator]) {
      log(`[care] ${regulator}: fewer than ${MIN_HOME_CARE_SERVICES[regulator]} home-care services, file looks incomplete; keeping last month's matches`);
      continue;
    }

    const index = indexProviders(file.services);
    const matches: (CareMatch & { sponsorId: number; rating?: string | null })[] = [];
    for (const s of all) {
      const m = matchSponsor(s, index).find((x) => x.regulator === regulator);
      if (m) matches.push({ ...m, sponsorId: s.id });
    }
    const homeCare = matches.filter((m) => m.homeCare).length;
    summary[regulator] = { matched: matches.length, homeCare };
    log(`[care] ${regulator}: ${matches.length} sponsors matched, ${homeCare} run home care (${matches.filter((m) => m.matchedBy === 'name_and_town').length} by name and town)`);

    const before = dryRun
      ? []
      : await db
          .select({ sponsorId: careRegistrations.sponsorId, homeCare: careRegistrations.homeCare, providerId: careRegistrations.providerId, rating: careRegistrations.rating })
          .from(careRegistrations)
          .where(eq(careRegistrations.regulator, regulator));
    const prev = new Map(before.map((r) => [r.sponsorId, r]));

    // Ratings (England only): this month's file, or last month's rating for the same provider if the file couldn't be read.
    if (regulator === 'cqc') {
      const ratings = await loadCqcRatings(file, ratingsXml, log);
      for (const m of matches) {
        if (!m.homeCare) continue;
        const counts = ratings?.byProvider.get(m.providerId);
        const old = prev.get(m.sponsorId);
        m.rating = ratings ? (counts ? summariseRatings(counts) : 'Not yet rated') : old?.providerId === m.providerId ? old.rating : null;
      }
      const rated = matches.filter((m) => m.rating && m.rating !== 'Not yet rated').length;
      log(`[care] cqc: ${rated} home-care sponsors have a CQC rating`);
    }
    if (dryRun) continue;

    const next = new Map(matches.map((m) => [m.sponsorId, m]));
    // Company pages only show home-care registrations (and their rating), so only those changes need a page refresh.
    const shown = (r?: { homeCare: boolean; providerId: string; rating?: string | null }) => (r?.homeCare ? `${r.providerId}|${r.rating ?? ''}` : null);
    for (const id of new Set([...prev.keys(), ...next.keys()])) {
      if (shown(prev.get(id)) !== shown(next.get(id))) changed.add(slugOf.get(id) ?? '');
    }

    await db.transaction(async (tx) => {
      await tx.delete(careRegistrations).where(eq(careRegistrations.regulator, regulator));
      const now = new Date();
      for (let i = 0; i < matches.length; i += INSERT_BATCH) {
        await tx.insert(careRegistrations).values(
          matches.slice(i, i + INSERT_BATCH).map((m) => ({
            sponsorId: m.sponsorId,
            regulator,
            providerId: m.providerId,
            providerName: m.providerName,
            homeCare: m.homeCare,
            services: m.services,
            homeCareServices: m.homeCareServices,
            matchedBy: m.matchedBy,
            rating: m.rating ?? null,
            updatedAt: now,
          })),
        );
      }
    });
  }

  if (!dryRun) {
    // Rows for sponsors that have since left the register are removed by the delete above (only active sponsors are matched).
    const slugs = [...changed].filter(Boolean);
    log(`[care] ${slugs.length} company pages changed`);
    await revalidateSite({ slugs, all: true }, log);
  }
  return summary;
}

