import { eq } from 'drizzle-orm';
import { careRegistrations, getDb, sponsors } from '@sponsors/db';
import { revalidateSite } from '../revalidate';
import { indexProviders, matchSponsor, type CareMatch, type Regulator } from './match';
import { downloadRegister, MIN_HOME_CARE_SERVICES, type RegisterFile } from './sources';

const REGULATORS: Regulator[] = ['cqc', 'care_inspectorate'];
const INSERT_BATCH = 500;

export interface CareRunOptions {
  dryRun?: boolean;
  /** Use already-downloaded files instead of fetching (local testing). */
  files?: RegisterFile[];
  log?: (m: string) => void;
}

/**
 * Download the care registers, match them to licensed sponsors and replace each regulator's rows.
 * A regulator whose download fails or looks incomplete is skipped, so last month's matches stay in place.
 */
export async function runCareRegisters({ dryRun = false, files, log = console.log }: CareRunOptions = {}) {
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
    const matches: (CareMatch & { sponsorId: number })[] = [];
    for (const s of all) {
      const m = matchSponsor(s, index).find((x) => x.regulator === regulator);
      if (m) matches.push({ ...m, sponsorId: s.id });
    }
    const homeCare = matches.filter((m) => m.homeCare).length;
    summary[regulator] = { matched: matches.length, homeCare };
    log(`[care] ${regulator}: ${matches.length} sponsors matched, ${homeCare} run home care (${matches.filter((m) => m.matchedBy === 'name_and_town').length} by name and town)`);
    if (dryRun) continue;

    const before = await db
      .select({ sponsorId: careRegistrations.sponsorId, homeCare: careRegistrations.homeCare, providerId: careRegistrations.providerId })
      .from(careRegistrations)
      .where(eq(careRegistrations.regulator, regulator));
    const prev = new Map(before.map((r) => [r.sponsorId, r]));
    const next = new Map(matches.map((m) => [m.sponsorId, m]));
    // Company pages only show home-care registrations, so only those changes need a page refresh.
    const shown = (r?: { homeCare: boolean; providerId: string }) => (r?.homeCare ? r.providerId : null);
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

