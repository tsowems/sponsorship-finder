/**
 * Match licensed sponsors to the care regulators' registers (CQC in England, Care Inspectorate in Scotland).
 * Runs monthly from .github/workflows/care-registers.yml.
 *
 *   npm run care -w worker                 # download, match, save, refresh pages
 *   npm run care -w worker -- --dry-run    # download and match only, print the numbers
 *   npm run care -w worker -- --cqc-file dir/directory.csv --ci-file dir/scotland.csv --cqc-ratings-file dir/ratings.ods   # local copies
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { closeDb } from '@sponsors/db';
import { runCareRegisters } from '../care/run';
import { parseCareInspectorate, parseCqcDirectory, type RegisterFile } from '../care/sources';

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'cqc-file': { type: 'string' },
    'ci-file': { type: 'string' },
    /** The CQC ratings .ods, already downloaded. */
    'cqc-ratings-file': { type: 'string' },
  },
});

async function main() {
  const files: RegisterFile[] = [];
  if (values['cqc-file']) files.push({ regulator: 'cqc', url: values['cqc-file'], services: parseCqcDirectory(readFileSync(values['cqc-file'], 'utf8')) });
  if (values['ci-file']) {
    const text = new TextDecoder('windows-1252').decode(readFileSync(values['ci-file']));
    files.push({ regulator: 'care_inspectorate', url: values['ci-file'], services: parseCareInspectorate(text) });
  }
  let ratingsXml: AsyncIterable<string> | undefined;
  if (values['cqc-ratings-file']) {
    const unzip = spawn('unzip', ['-p', values['cqc-ratings-file'], 'content.xml'], { stdio: ['ignore', 'pipe', 'inherit'] });
    unzip.stdout.setEncoding('utf8');
    ratingsXml = unzip.stdout;
  }
  const summary = await runCareRegisters({ dryRun: values['dry-run'], files: files.length ? files : undefined, ratingsXml });
  console.log(JSON.stringify(summary));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
