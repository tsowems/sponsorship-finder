# 7. How-to recipes

Step-by-step guides for common changes. Each assumes you're on the `staging` branch with `npm run dev` running.

## Ship a change (the normal loop)

```bash
git switch staging && git pull
# ...edit...
npm run typecheck && npm run lint -w web && npm test   # same checks CI runs
git add -A && git commit -m "Short description of why"
git push                    # CI runs; Vercel deploys staging
```

Check the staging site → GitHub **Pull requests → New** (base `main` ← `staging`) → wait for green CI →
**Merge** → production deploys. Then bring staging level: `git pull origin main && git push`.

## Change the site name or tagline

- Name: set `SITE_NAME` in `.env` and in Vercel (both environments) and as a GitHub repo variable if you want it
  in alert emails, or change the default in `apps/web/src/lib/site.ts`.
- Tagline: `SITE_TAGLINE` in `apps/web/src/lib/site.ts`. Home page headline: `apps/web/src/app/page.tsx`.

## Add a new page

1. Create `apps/web/src/app/<route>/page.tsx`:

   ```tsx
   import type { Metadata } from 'next';

   export const metadata: Metadata = {
     title: 'Visa sponsorship guide',
     description: 'One sentence for Google.',
     alternates: { canonical: '/guide' },
   };

   export default function GuidePage() {
     return <article className="max-w-2xl space-y-4">…</article>;
   }
   ```

2. If it reads the database, put the query in `src/lib/data.ts` with `'use cache'` + `cacheLife('hours')`.
3. If it reads `searchParams`/cookies, wrap that part in `<Suspense>` (see `app/changes/page.tsx`).
4. Link it from the header in `app/layout.tsx` and add it to `app/sitemap.ts` if it should be indexed.

## Add a column to sponsors

Example: store SIC (industry) codes from Companies House.

1. Edit `packages/db/src/schema.ts`:
   ```ts
   sicCodes: text('sic_codes').array(),
   ```
2. `npm run db:generate -- --name add_sic_codes` → read the new file in `packages/db/drizzle/`.
3. `npm run db:migrate` (applies to your `.env` database, i.e. staging).
4. Use it: TypeScript now knows `sponsors.sicCodes`.
5. Commit the schema change **and** the migration files (`drizzle/*.sql` and `drizzle/meta/*`).

## Add a new kind of change event

Example: detect when a sponsor's county changes.

1. `packages/db/src/schema.ts`: add `'county_changed'` to `sponsorEventType` → generate + migrate
   (Postgres enums gain values via `ALTER TYPE ... ADD VALUE`; drizzle-kit writes that).
2. `apps/worker/src/register/diff.ts`: add a bucket and the condition.
3. `apps/worker/src/register/register.test.ts`: add a test case **first**, watch it fail, then make it pass.
4. `apps/worker/src/register/import.ts`: write the event and update the sponsor in the transaction.
5. Website: `describeEvent()` in `components/ChangeList.tsx` (label + colour), optionally a tab in `app/changes/page.tsx`.
6. Alerts: `describeChange()` in `apps/worker/src/alerts/build.ts`.

## Add an API endpoint

```ts
// apps/web/src/app/api/thing/route.ts
import { getCurrentUser, isSameOrigin, json } from '@/lib/session';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Bad origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in required' }, 401);
  const body = (await request.json().catch(() => ({}))) as { value?: unknown };
  // validate every field; never trust ids from the client without filtering by user.id
  return json({ ok: true });
}
```

Call it from a client component with `fetch('/api/thing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(...) })`.

## Change an email

Edit `packages/email/src/templates.ts`. To preview, run a local import of a test file (see
[Local development → Trying features locally](02-local-development.md#trying-features-locally)); the email
prints to the terminal. For HTML, temporarily `console.log(msg.html)` and open it in a browser.

## Write a test

Tests use Node's built-in runner. Put `*.test.ts` files next to the code in `apps/worker/src/`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeName } from '@sponsors/db/normalize';

test('treats Ltd and Limited the same', () => {
  assert.equal(normalizeName('Acme Ltd'), normalizeName('ACME LIMITED'));
});
```

`npm test` picks it up. Prefer testing **pure functions** (no DB, no network). That's why parsing, grouping,
diffing and alert-building are separate from the code that does I/O.

## Run an import by hand

| Where | How |
|---|---|
| Production | GitHub → Actions → **Register import** → Run workflow → target `production` |
| Staging | same, target `staging` |
| Local (staging DB) | `npm run import` |

## Investigate a failed scheduled import

1. GitHub → Actions → **Register import** → the red run → expand the failing step.
2. Common causes:
   - `X is not set` → a repo secret/variable is missing (Settings → Secrets and variables → Actions).
   - `Refusing to import: N of M ... removed` → the 5% safety guard. Download the CSV and check it. If UKVI
     really did remove that many, run `npm run import -- --force` **locally** with `DATABASE_URL` temporarily set to
     production. (The workflow deliberately has no force option, so this always needs a human decision.)
   - `missing expected columns` → UKVI changed the CSV format. Update `parse.ts` + tests.
   - `gov.uk content API responded 5xx` → their outage; the next scheduled run retries.
3. GitHub emails you when a scheduled workflow fails (Settings → Notifications → Actions).

## Reset the staging database

Neon → Branches → `staging` → **Reset from parent**. Gives staging a fresh copy of production (and deletes
staging-only test users/watches).

## Roll back a bad release

- **Website:** Vercel → Deployments → pick the last good production deployment → **Promote to Production**
  (instant). Then fix forward on staging.
- **Code:** on GitHub, open the merged PR → **Revert** → merge the revert PR.
- **Database:** Neon keeps history: Branches → `main` → **Restore** to a point in time (free tier: limited
  window). Prefer fixing forward with a new migration.

## Upgrade dependencies

```bash
npm outdated                         # see what's behind
npm install -w web next@latest eslint-config-next@latest
npm run typecheck && npm run lint -w web && npm test && npm run build
```

Upgrade one thing at a time; read the release notes for **Next.js**, **Better Auth** (may change auth tables) and
**drizzle-orm/drizzle-kit** (keep the two in step). `postgres` is pinned to v3 on purpose (drizzle 0.45 is tested
with v3; v4 changed parameter typing).
