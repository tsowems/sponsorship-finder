import { getDb, closeDb } from '@sponsors/db';
import { sql } from 'drizzle-orm';
const q = process.argv[2];
console.log(JSON.stringify(await getDb().execute(sql.raw(q)), null, 0));
await closeDb();
