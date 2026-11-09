# Deployment

```
you push ──► staging ──(pull request, CI green, you merge)──► main
               │                                                │
     Vercel staging site                              Vercel production site
     Neon "staging" database branch                   Neon main database
     (no scheduled import)                            scheduled import + alert emails
```

| Piece | Service | Cost |
|---|---|---|
| Website (`apps/web`) | Vercel (Hobby) | Free (non-commercial use) |
| Database | Neon | Free tier |
| Register import + alert emails (`apps/worker`) | GitHub Actions schedule | Free (private repo: ~250–350 of 2,000 min/month) |
| Email | Resend | Free tier (3,000/month) |
| Domain | Any registrar | ~£8–12/year |

---

## 1. Neon: create a staging database

1. Neon console → your project → **Branches** → **New branch**.
2. Name `staging`, parent `main`, **current data**. Create.
3. Open the branch → **Connect** → copy the **pooled** connection string. This is `STAGING_DATABASE_URL`.
4. The existing `main` branch's pooled string is `PROD_DATABASE_URL`.

The staging branch starts as a copy of production data. Reset it any time from the Branches page ("Reset from parent").

**Point your local `.env` at the staging database too.** Right now it points at `main`, which becomes production,
so local test sign-ups and imports would land in live data.

## 2. Generate auth secrets

Run this twice, once for production and once for staging:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Each environment's `BETTER_AUTH_SECRET` **must be identical in Vercel and GitHub**: it also signs the unsubscribe links the worker puts in emails.

## 3. GitHub: secrets, variables, staging branch

Repo → **Settings → Secrets and variables → Actions**.

**Secrets** tab → New repository secret:

| Name | Value |
|---|---|
| `PROD_DATABASE_URL` | Neon `main` pooled URL (used by the scheduled import and enrichment) |
| `PROD_BETTER_AUTH_SECRET` | production secret from step 2 |
| `STAGING_DATABASE_URL` | Neon `staging` pooled URL |
| `STAGING_BETTER_AUTH_SECRET` | staging secret from step 2 |
| `RESEND_API_KEY` | from Resend (optional until you have it; emails are skipped/printed without it) |
| `COMPANIES_HOUSE_API_KEY` | optional, recommended: free REST key from developer.company-information.service.gov.uk; improves website matching |

**Variables** tab → New repository variable:

| Name | Value |
|---|---|
| `PROD_SITE_URL` | `https://sponsorshiphunter.com` (or the `*.vercel.app` URL until you have a domain) |
| `STAGING_SITE_URL` | your staging URL (step 4.5) |
| `EMAIL_FROM` | `Sponsorship Hunter <alerts@sponsorshiphunter.com>` (or `Sponsorship Hunter <onboarding@resend.dev>` for testing) |
| `SITE_NAME` | brand name used in alert emails (optional; default "Sponsorship Hunter") |

Keep **`main` as the default branch**. Scheduled workflows always run from the default branch, and pull requests default to targeting it.

### Protecting `main`

GitHub only *enforces* branch protection on private repos with **GitHub Pro** ($4/month) or by making the repo public. With Pro: Settings → **Rules → Rulesets → New branch ruleset**:

- Target: `main`
- ✅ Restrict deletions, ✅ Block force pushes
- ✅ Require a pull request before merging (required approvals: **0**, because GitHub won't let you approve your own PR)
- ✅ Require status checks to pass → add **"Typecheck, lint, test, build"**

Without Pro, the flow below still works; it just relies on you not pushing to `main` directly.

## 4. Vercel: the website

1. vercel.com → sign in with GitHub → **Add New → Project** → import `sponsorship-finder`.
2. **Root Directory**: `apps/web`. Framework: Next.js (auto-detected). Leave build/install commands as default.
3. **Environment Variables**, scoped as shown:

   | Name | Production | Preview |
   |---|---|---|
   | `DATABASE_URL` | Neon `main` pooled URL | Neon `staging` pooled URL |
   | `SITE_URL` | `https://sponsorshiphunter.com` | staging URL |
   | `BETTER_AUTH_SECRET` | production secret | staging secret |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✓ | ✓ (same client is fine) |
   | `RESEND_API_KEY` | ✓ | ✓ |
   | `EMAIL_FROM` | ✓ | ✓ |
   | `SITE_ENV` | (not set) | `staging` |
   | `API_KEYS` | optional: keys for the data API (`docs/10-data-api.md`) | optional |
   | `ADMIN_EMAILS` | your email: opens `/admin` (`docs/11-admin.md`) | optional |

4. Deploy. **Settings → Git**: Production Branch = `main`.
5. **Settings → Domains**: add `staging.sponsorshiphunter.com` and set its **Git branch** to `staging`.
   Until you own a domain, staging is `https://<project>-git-staging-<your-vercel-name>.vercel.app`.

Staging and other preview deployments send `noindex` and a blocking `robots.txt` automatically, so Google never indexes them.

## 5. Google sign-in

Google Cloud Console → **APIs & Services → Credentials** → your OAuth client → **Authorised redirect URIs**, add all of:

```
http://localhost:3000/api/auth/callback/google
https://sponsorshiphunter.com/api/auth/callback/google
https://staging.sponsorshiphunter.com/api/auth/callback/google
```

## 6. Resend: send to anyone

Resend → **Domains → Add domain** → add the DNS records it shows at your registrar → wait for "Verified".
Then set `EMAIL_FROM` to an address on that domain. Until then Resend only delivers to your own address.

## 7. Domain

Buy the domain → Vercel **Settings → Domains → Add** → add the DNS records Vercel shows at your registrar.
Then update `SITE_URL` (Vercel production) and `PROD_SITE_URL` (GitHub) to the new domain, and redeploy.

## 8. First production run

GitHub → **Actions → Register import → Run workflow** → target `production`.
The production database already holds the baseline, so this just checks for a newer register.
After that it runs on its own schedule.

---

## Day-to-day workflow

```bash
git switch staging          # first time: git switch -c staging --track origin/staging
# ...make changes...
git add -A && git commit -m "Describe the change"
git push                    # → CI runs, Vercel deploys the staging site
```

When staging looks right:

1. GitHub → **Pull requests → New** → base `main` ← compare `staging` → Create.
2. Wait for the **CI** check to go green.
3. **Merge**. Vercel builds production; the build first applies any new database migrations to the
   production database (`apps/web/scripts/migrate-on-vercel.mjs`), then builds the site.
4. Bring staging level with main: `git switch staging && git pull origin main && git push`.

### Database changes

1. Edit `packages/db/src/schema.ts` → `npm run db:generate` → commit the new file in `packages/db/drizzle/`.
2. Push to staging: the Vercel preview build (and CI) apply it to the staging database before building.
3. Merging to main: the Vercel production build applies it to the production database before building.
   If a migration fails, the build stops and the previous version keeps serving.
4. Keep migrations **additive** (add columns/tables; drop old ones in a later release), because the
   old site keeps running for a minute or two while the new one deploys.

## Workflows

| Workflow | Runs when | Does |
|---|---|---|
| `ci.yml` | push to `staging`, PR into `main` | typecheck, lint, tests, migrate staging DB, build |
| `register-import.yml` | weekdays every 2h 06:15–18:15 UTC, weekends 12:15 UTC, or manually | imports a changed register, sends alert emails |
| `enrich.yml` | every 4 hours (:40), or manually | finds websites, careers pages and jobs for 150 sponsors; refreshes job lists |

Approximate Actions usage (private repo, 2,000 free minutes): import ~300, enrichment ~600, CI ~100 minutes/month.

Database migrations are **not** a workflow: Vercel applies them at the start of each build (see "Database changes").
