/**
 * Long-running worker: checks gov.uk for a new register file every hour
 * (cheap - one small API call; it only downloads when the file changes), then emails alerts.
 */
import { Cron } from 'croner';
import { closeDb } from '@sponsors/db';
import { sendPendingAlerts } from './alerts/send';
import { runImport } from './register/import';

async function checkRegister() {
  const started = Date.now();
  try {
    const result = await runImport();
    console.log(`[register] ${result.status}`, 'reason' in result ? result.reason : result.counts, `${Date.now() - started}ms`);
  } catch (err) {
    console.error('[register] import failed:', err);
  }
  // Also retries alerts left over from an earlier run that crashed mid-way.
  try {
    const alerts = await sendPendingAlerts();
    if (alerts.snapshots) console.log('[alerts]', alerts);
  } catch (err) {
    console.error('[alerts] failed:', err);
  }
}

const job = new Cron('10 * * * *', { timezone: 'Europe/London', protect: true, name: 'register-import' }, checkRegister);
console.log(`Worker started. Next register check: ${job.nextRun()?.toISOString()}`);
void checkRegister();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    job.stop();
    await closeDb();
    process.exit(0);
  });
}
