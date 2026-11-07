# 2. Local development

## Prerequisites

- **Node.js 20 or newer** (CI uses 24; your Mac has 26). Check with `node -v`.
- **git**
- Access to the **Neon** project (for database connection strings)

## First-time setup

```bash
git clone https://github.com/tsowems/sponsorship-finder.git
cd sponsorship-finder
git switch staging                 # day-to-day work happens on staging
npm install                        # installs every workspace
cp .env.example .env               # then fill it in (see below)
ln -s ../../.env apps/web/.env     # Next.js reads env from its own folder; this shares the root file
npm run db:migrate                 # make sure the schema is current
npm run dev                        # http://localhost:3000
```

If the database is empty (a brand new Neon branch), run `npm run import` once to load the baseline
(about 1–2 minutes, ~122k sponsors).

## Environment variables

All variables live in the root `.env` (git-ignored). `.env.example` is the template.

| Variable | Needed by | Required | What it is |
|---|---|---|---|
| `DATABASE_URL` | web, worker, drizzle-kit | **yes** | Neon **pooled** connection string. Locally, use the **staging** branch |
| `SITE_URL` | web, worker | **yes** in deployed envs | Public base URL, no trailing slash. Used for canonical links, sitemaps, email links, auth callbacks |
| `BETTER_AUTH_SECRET` | web, worker | **yes** | 32+ random bytes. Signs sessions *and* unsubscribe links, so it must match between web and worker in each environment |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | web | no | Enables "Continue with Google". Button is hidden when unset |
| `RESEND_API_KEY` | web, worker | no | Without it, emails (sign-in links, alerts) are **printed to the terminal** instead of sent |
| `EMAIL_FROM` | web, worker | no | Sender, e.g. `Sponsorship Hunter <alerts@sponsorshiphunter.com>` |
| `SITE_NAME` | web, worker | no | Brand name on the site and in emails (default "Sponsorship Hunter") |
| `CONTACT_EMAIL` | web | no | Address shown on `/privacy` (default `privacy@sponsorshiphunter.com`) |
| `SITE_ENV` | web | no | Set to `staging` to force `noindex` (Vercel previews do this automatically via `VERCEL_ENV`) |
| `DB_POOL_MAX` | web, worker | no | Max Postgres connections per process (default 5) |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Scripts

Run from the **repo root** unless noted.

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with hot reload on :3000 |
| `npm run build` | Production build of the website (needs `DATABASE_URL`: pages are prerendered from the DB) |
| `npm run start -w web` | Serve the production build (after `npm run build`) |
| `npm run import` | Check gov.uk once; import if the register changed; then send pending alerts |
| `npm run import -- --dry-run` | Show what *would* change; write nothing |
| `npm run import -- --file path.csv --date 2026-11-06` | Import a local CSV (date can come from the filename) |
| `npm run import -- --force` | Skip the "already imported" and "too many removals" safety checks |
| `npm run import -- --no-alerts` | Import without sending alert emails |
| `npm run alerts -w worker` | Send any alert emails that haven't been sent yet |
| `npm run worker` | Long-running scheduler (checks hourly). Only needed if you self-host instead of using GitHub Actions |
| `npm test` | Unit tests (`apps/worker/src/**/*.test.ts`) |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint -w web` | ESLint (Next.js + React hooks rules) |
| `npm run db:generate` | Compare `schema.ts` with the last migration and write a new SQL migration |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:studio` | Drizzle Studio: browse and edit tables in your browser |

`-w <name>` runs a script inside one workspace, e.g. `npm run typecheck -w worker`.

## Trying features locally

**Sign in without email set up.** Leave `RESEND_API_KEY` empty, go to `/login`, enter any email. The sign-in link
is printed in the `npm run dev` terminal. Copy it into the browser.

**See an alert email.** Watch a company, then import a fake "next day" file where it's missing:

```bash
grep -v '^ \?Some Company Ltd,' register.csv > /tmp/test-2026-11-08.csv
npm run import -- --file /tmp/test-2026-11-08.csv
```

The alert prints in the terminal. Afterwards, reset your staging branch in Neon ("Reset from parent")
so fake events don't linger.

**Get a copy of the register.** `npm run import -- --dry-run` downloads it; or open
<https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers> and download the CSV.

## Editor setup

- VS Code: install the **ESLint** and **Tailwind CSS IntelliSense** extensions.
- Use the workspace TypeScript version (VS Code prompt: "Use Workspace Version").
- `apps/web/AGENTS.md` is a note from Next.js for AI coding assistants. Next.js regenerates it, so leave it in place.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `DATABASE_URL is not set` during `npm run build` | `apps/web/.env` symlink is missing. `ln -s ../../.env apps/web/.env` |
| `To connect to Postgres database - please install ... drivers` (drizzle-kit) | Run `npm install` at the root; `postgres` must be hoisted to `node_modules/postgres` |
| `EADDRINUSE :3000` | Another server is running. `lsof -ti tcp:3000 \| xargs kill` |
| Import says `Refusing to import: N of M active sponsors would be removed` | Safety guard: more than 5% would disappear. Check the file is complete; if genuinely so, re-run with `--force` |
| Import says `skipped: already imported` | That file was imported already. Nothing to do. `--force` re-processes it |
| Sign-in link says the token is invalid | Links are single-use and expire after 15 minutes. Request a new one |
| `Error: You are using the default secret` / `BETTER_AUTH_SECRET is missing` | Set `BETTER_AUTH_SECRET` |
| Google sign-in: `redirect_uri_mismatch` | Add `{SITE_URL}/api/auth/callback/google` to the OAuth client's redirect URIs |
| Changes don't show on the site after an import | Pages are cached for up to an hour (`cacheLife('hours')`). Wait, or restart the dev server |
| `npm warn install-scripts ...` | npm 11+ asks you to approve packages' install scripts. Safe to ignore here (esbuild works without it) |
