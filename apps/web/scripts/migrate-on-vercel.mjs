/**
 * Runs before `next build`. On Vercel only, applies pending database migrations to the
 * environment's own DATABASE_URL (Production → production DB, Preview → staging DB), so the
 * schema is always ready before the new code is built and served.
 *
 * Locally and in CI this does nothing (CI migrates staging in its own step).
 * Migrations must stay additive: the previous deployment keeps serving until this build finishes.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.VERCEL) {
  console.log('[migrate] Not a Vercel build; skipping database migrations.');
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set for this Vercel environment.');
  process.exit(1);
}

const host = process.env.DATABASE_URL.match(/@([^/?]+)/)?.[1] ?? 'unknown host';
console.log(`[migrate] ${process.env.VERCEL_ENV ?? 'vercel'} build: applying migrations to ${host}`);

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const result = spawnSync('npm', ['run', 'migrate', '-w', '@sponsors/db'], { cwd: repoRoot, stdio: 'inherit', env: process.env });
if (result.status !== 0) {
  console.error('[migrate] Migration failed; stopping the build so the old version keeps serving.');
  process.exit(result.status ?? 1);
}
