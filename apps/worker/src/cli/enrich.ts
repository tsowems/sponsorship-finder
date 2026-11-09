/**
 * Find websites, careers pages and jobs for sponsors.
 *
 *   npm run enrich                          # check up to 100 sponsors (queued first), refresh due job boards
 *   npm run enrich -- --limit 300 --concurrency 8
 *   npm run enrich -- --sponsor tesco-stores-limited-welwyn-garden-city   # one sponsor, verbose, saved
 *   npm run enrich -- --sponsor <slug> --dry-run                           # one sponsor, verbose, not saved
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { closeDb, getDb, sponsors } from '@sponsors/db';
import { discover, saveDiscovery } from '@sponsors/enrich';
import { refreshJobs, runEnrichment } from '../enrich-run';
import { revalidateSite } from '../revalidate';

const { values } = parseArgs({
  options: {
    limit: { type: 'string', default: '100' },
    concurrency: { type: 'string', default: '6' },
    'jobs-limit': { type: 'string', default: '300' },
    sponsor: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

async function main() {
  if (values.sponsor) {
    const [s] = await getDb()
      .select({ id: sponsors.id, slug: sponsors.slug, name: sponsors.name, normalizedName: sponsors.normalizedName, town: sponsors.town, normalizedTown: sponsors.normalizedTown })
      .from(sponsors)
      .where(eq(sponsors.slug, values.sponsor));
    if (!s) throw new Error(`No sponsor with slug ${values.sponsor}`);
    const d = await discover(s);
    console.log(`${s.name} (${s.town})\n  ${d.log.join('\n  ')}`);
    if (d.jobs) for (const j of d.jobs.slice(0, 8)) console.log(`    · ${j.title}, ${j.location ?? 'location not given'}${j.isUk ? ' (UK)' : ''}`);
    if (!values['dry-run']) {
      await saveDiscovery(s.id, d);
      await revalidateSite({ slugs: [s.slug] });
    }
    return;
  }
  console.log(JSON.stringify(await runEnrichment({ limit: Number(values.limit), concurrency: Number(values.concurrency) })));
  console.log(JSON.stringify(await refreshJobs({ limit: Number(values['jobs-limit']) })));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
