# Sponsor Finder

Find UK employers licensed to sponsor **Skilled Worker** visas, with a daily history of new sponsors, removals and downgrades.

```
apps/web        Next.js 16 site: search, company pages, changes feed, sign-in, alerts UI
apps/worker     Register import + diff, then alert emails (runs on a schedule)
packages/db     Drizzle schema (incl. Better Auth tables), migrations, name normalisation
packages/email  Resend sender, email templates, signed unsubscribe links
```

## Setup

Requires Node.js 20+ and a Postgres database (we use Neon).

```bash
npm install
cp .env.example .env          # add DATABASE_URL
npm run db:migrate            # create tables
npm run import                # first import = baseline (~1-2 min)
npm run dev                   # http://localhost:3000
```

`apps/web/.env` is a symlink to the root `.env`, so web, worker and drizzle-kit share one file.

## Scripts (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build of the site (needs `DATABASE_URL`) |
| `npm run import` | Fetch the latest register from gov.uk and import it once |
| `npm run import -- --dry-run` | Show what would change, write nothing |
| `npm run import -- --file x.csv --date 2026-11-06` | Import a local CSV |
| `npm run import -- --no-alerts` | Import without sending alert emails |
| `npm run alerts -w worker` | Send any pending alert emails (normally automatic after an import) |
| `npm run worker` | Long-running scheduler: checks gov.uk hourly, imports only when the file changes |
| `npm run db:generate` | Generate a migration after editing `packages/db/src/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm test` | Unit tests (parsing, grouping, diff) |
| `npm run typecheck` | Type-check every workspace |

## How the import works

1. The gov.uk Content API tells us the URL of the latest register CSV.
2. Skip if that URL or file hash was already imported.
3. Keep `Route = Skilled Worker` rows; merge rows with the same normalised name + town.
4. Diff against the database → `added`, `removed`, `readded`, `rating_changed` events.
5. Safety: refuses if more than 5% of active sponsors would disappear (likely a broken file). Override with `--force`.

The first import is the **baseline** and creates no events. The register doesn't record *why* a sponsor
disappears (revoked, surrendered, expired or renamed), so we describe it only as "removed from the register".

## Accounts and alerts

- Sign in with Google or an emailed sign-in link (Better Auth). The Google button only appears once
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set. Redirect URI: `{SITE_URL}/api/auth/callback/google`.
- Users can **watch** a company (alert on removal, re-listing or rating change) and save **new-sponsor searches**
  (name contains X and/or town = Y).
- After each import with changes, the worker sends **one email per user per register update**.
  `alert_deliveries` records each (user, snapshot) before sending, so re-runs never send duplicates.
- Every email has a signed unsubscribe link and RFC 8058 one-click `List-Unsubscribe` headers.
- **Without `RESEND_API_KEY`, emails (including sign-in links) are printed to the terminal**, which is handy in dev.
  With Resend's test sender (`onboarding@resend.dev`) you can only email your own address; verify a domain to email others.

## Data

Contains public sector information licensed under the Open Government Licence v3.0.
