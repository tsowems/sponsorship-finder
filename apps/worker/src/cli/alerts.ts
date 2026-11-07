/** Send any pending alert emails (normally run automatically after each import). */
import { closeDb } from '@sponsors/db';
import { sendPendingAlerts } from '../alerts/send';

sendPendingAlerts()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
