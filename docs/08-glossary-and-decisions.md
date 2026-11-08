# 8. Domain glossary and design decisions

## Glossary: UK visa sponsorship

| Term | Meaning |
|---|---|
| **UKVI** | UK Visas and Immigration, the part of the Home Office that runs the visa system and publishes the register |
| **Sponsor licence** | Permission for an employer to employ people on certain work visas. Without one, an employer can't sponsor you |
| **Register of licensed sponsors** | The public CSV of every licensed organisation. Our data source |
| **Route** | A visa category. The register lists one row per route an organisation is licensed for. We only use **Skilled Worker** |
| **Skilled Worker** | The main long-term work visa. Job must be at an eligible skill level (occupation code) and meet a salary threshold |
| **Temporary Worker routes** | Creative Worker, Charity Worker, Religious Worker, Seasonal Worker, etc. In the file, but not shown on our site |
| **Global Business Mobility** | Routes for intra-company moves (Senior or Specialist Worker, Graduate Trainee, …). Not shown |
| **A rating** | Normal licence status: sponsor can issue certificates of sponsorship |
| **B rating** | Downgraded: the Home Office found the sponsor isn't meeting its duties and put it on an action plan. Generally can't assign new certificates until restored. Rare (~109 of 122k) |
| **A (Premium) / A (SME+)** | Paid priority-service tiers, not compliance grades |
| **CoS (Certificate of Sponsorship)** | Electronic record the employer assigns to a worker; needed to apply for the visa |
| **Revoked** | Home Office cancels the licence (usually compliance failure). Sponsored workers' visas are typically curtailed |
| **Surrendered** | Employer gives up its licence voluntarily |
| **Curtailment** | Shortening of an individual worker's visa. A worker-level action, **never visible in the register** |
| **SOC code** | Standard Occupational Classification: the job code that decides eligibility and salary rules |
| **Companies House** | UK registry of companies. Gives company numbers, status, SIC (industry) codes. Not yet used |
| **OGL** | Open Government Licence v3.0, which lets us reuse the register with attribution |

## Design decisions

Short records of *why* things are the way they are. Add to this when you make a significant choice.

### Next.js for the website (not a Vite SPA)
Search traffic is the main growth channel; Google needs complete HTML. A React SPA renders in the browser.
Next.js prerenders company pages on the server and caches them.

### No Express server
Next.js route handlers cover the small API, and the worker covers scheduled jobs. A separate Express service
would add deployment and auth-sharing complexity for no gain.

### Worker separate from the website, sharing only the database
Imports take 1–2 minutes and run on a timer, which doesn't fit serverless request limits. Keeping them apart means
either can be moved or rehosted independently.

### GitHub Actions as the scheduler
Free, no server to maintain, logs + failure emails built in. The worker also has a self-hosted mode
(`npm run worker`) if we ever move to a VPS/Railway/Render.

### Identity = normalised name + town
The register has no IDs. Name alone collides (~1,000 names appear in several towns, often genuinely different
licences). Name + town is the most stable key available. Companies House numbers would be better (future).

### First import creates no events
Otherwise day one would show 122k "new sponsors". Pre-existing sponsors are marked `in_baseline`.

### "Removed from the register", never "revoked"
The register doesn't say why an entry disappears. Claiming "revoked" could be wrong and defamatory.

### 5% removal safety guard
A truncated or corrupt download would otherwise mark thousands of sponsors removed and email false alerts.

### Unchanged files write nothing
Daily files are often identical in substance. We record that we saw them (so we don't re-download) but don't
touch sponsors or events.

### Order-independent merging of duplicate rows
A reshuffled file must produce zero changes. See [the data pipeline](03-data-pipeline.md#picking-one-value-from-merged-rows).

### Better Auth (not Auth.js/NextAuth)
Auth.js is now maintained by the Better Auth team, which recommends Better Auth for new projects. It has first-class
Drizzle support, magic links and Google in one library, and stores everything in our Postgres.

### Magic links instead of passwords
No password storage, resets or breach risk; users only need email for alerts anyway.

### Resend via plain `fetch`
One endpoint; an SDK adds a dependency for nothing. Console fallback makes local dev frictionless.

### One email per user per register update
The register changes about once a day, so this behaves like a daily digest without extra scheduling, and
avoids flooding users with one email per change.

### Signed (HMAC) unsubscribe links
Work without signing in (required for one-click unsubscribe) and need no extra DB column.

### Static company pages + client-side personal bits
Keeps company pages fully cacheable for Google and fast for everyone; the Watch button and header state load
in the browser.

### Packages ship TypeScript source (no build step)
Instant feedback while developing; Next.js and tsx compile on the fly.

### postgres.js pinned to v3
drizzle-orm 0.45 is tested against v3; v4 changed how parameter types are decided.

### Migrations run inside the Vercel build
A separate "migrate production" workflow raced the Vercel build: the build could start before the new columns
existed, fail, and leave the old version live. Running migrations as the first build step guarantees the order.

### Repo-level secrets with `PROD_`/`STAGING_` prefixes
GitHub Actions *environments* aren't available for private repos on the Free plan.

### Verify every website before showing it
A wrong website link is worse than none. Sites are only accepted when they show the company number or full
registered name (or Wikidata ties them to the company number). See [Enrichment](09-enrichment.md).

### "Licensed since" = first appearance on the register
The Home Office doesn't publish grant dates (the register has five columns). Other sites show the date *they* first
saw a company; we do the same but say "on the register since at least…" for sponsors listed before we started.

### Cache lifetimes are set by Vercel's ISR write allowance
Every cached page or `'use cache'` result Vercel stores is an "ISR write" (Hobby plan: 200,000 a month). With
122k company pages and crawlers, hourly expiry used the whole allowance in about a day. So:
company pages use `cacheLife('max')` (refreshed by slug when data changes); lists/stats use `'days'`
(refreshed by the import); search, suggestions and towns aren't server-cached at all (CDN headers on the APIs
instead); robots.txt keeps crawlers off query-string URLs and blocks SEO/AI-training bots.
**Check Vercel → Usage → ISR Writes after changing any `cacheLife` or adding `'use cache'` with free-form arguments.**

### Worker refreshes pages instead of short cache lifetimes
Keeping `cacheLife('hours')` keeps pages fast and cheap; the worker revalidates exactly the pages it changed, so
updates are still instant. The internal token is derived from `BETTER_AUTH_SECRET` to avoid another secret.

### Job listings require a free account
The number of open roles is public (and in the HTML for Google); the roles and careers link load from `/api/jobs`
only for signed-in users, so the site builds an email list of job seekers. Job details are never in the cached page HTML.

### Moves keep the original slug
A sponsor that changes town keeps its URL, so links, watchers and search rankings survive.

## Known limitations

- Can't distinguish revoked / surrendered / expired / renamed.
- Renames appear as remove + add (town changes are detected when unambiguous).
- Website coverage for small businesses is low without a Companies House key, and still partial with one.
- Same-name-same-town different companies would merge.
- No acronyms/aliases in search ("PwC" doesn't find "PricewaterhouseCoopers LLP").
- Pages can lag an import by up to ~1 hour (cache lifetime).
- Rate limiting is in-memory per server instance.
- No self-service account deletion or data export (handled by email request, per the privacy policy).
- Only the Skilled Worker route is shown.

## Ideas for later (roadmap from planning)

1. **Companies House enrichment**: company number, status (dissolved/in liquidation), SIC codes → industry
   filters; links renamed sponsors to their history.
2. **Website + careers page discovery**: Wikidata lookup by company number → domain guessing → verify by finding
   the company number on the site → find "Careers"/"Jobs" links.
3. **Jobs**: Adzuna and Reed APIs matched to sponsors; ATS feeds (Greenhouse, Lever, Ashby, Workable, Teamtailor,
   Recruitee, Pinpoint) for companies whose careers page uses them.
4. **"Is this job likely eligible?"**: occupation code + salary threshold checker (store rules as data; they change).
5. **Town/industry landing pages** for SEO ("Visa sponsors in Manchester").
6. **Trends**: new sponsors per week, sector growth, removals.
7. **Aliases** for well-known companies (PwC, EY, KPMG, NHS trusts…).
8. **On-demand cache invalidation** after imports (`revalidateTag('sponsors')` via a secured endpoint the worker calls).
9. **Self-service account deletion + data export.**
