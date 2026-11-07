/**
 * Import the UKVI register once.
 *
 *   npm run import                         # fetch the latest file from gov.uk
 *   npm run import -- --dry-run            # show what would change, write nothing
 *   npm run import -- --file x.csv --date 2026-11-06   # import a local CSV
 *   npm run import -- --force              # bypass duplicate / safety checks
 *   npm run import -- --no-alerts          # import without emailing alerts
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { closeDb } from '@sponsors/db';
import { sendPendingAlerts } from '../alerts/send';
import { runImport } from '../register/import';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    date: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'no-alerts': { type: 'boolean', default: false },
  },
});

async function main() {
  let file;
  if (values.file) {
    const date = values.date ?? basename(values.file).match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) throw new Error('Pass --date YYYY-MM-DD (or use a filename containing the date)');
    file = {
      text: await readFile(values.file, 'utf8'),
      publishedAt: new Date(`${date}T00:00:00Z`),
      sourceUrl: `file://${basename(values.file)}`,
    };
  }
  const result = await runImport({ file, force: values.force, dryRun: values['dry-run'] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'imported' && !values['no-alerts']) {
    console.log('alerts:', JSON.stringify(await sendPendingAlerts()));
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
