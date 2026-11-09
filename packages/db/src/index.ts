import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export * from './schema';
export * from './normalize';

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __sponsorsDb?: { db: Database; client: postgres.Sql } };

/**
 * Lazily create one shared connection pool per process.
 * `prepare: false` keeps it compatible with Neon's pooled (PgBouncer) endpoint.
 */
export function getDb(): Database {
  if (!globalForDb.__sponsorsDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.');
    const client = postgres(url, { prepare: false, max: Number(process.env.DB_POOL_MAX) || 5 });
    globalForDb.__sponsorsDb = { db: drizzle(client, { schema }), client };
  }
  return globalForDb.__sponsorsDb.db;
}

export async function closeDb(): Promise<void> {
  if (globalForDb.__sponsorsDb) {
    await globalForDb.__sponsorsDb.client.end({ timeout: 5 });
    globalForDb.__sponsorsDb = undefined;
  }
}
export * from './queue';
export * from './towns';
export * from './internal-token';
