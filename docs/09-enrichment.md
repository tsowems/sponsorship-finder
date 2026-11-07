# 9. Websites, careers pages and jobs (enrichment)

The register only gives a name, town, county, rating and routes. Everything else on a company page
(website, careers page, open roles, Companies House details) comes from the **enrichment** job.
Code: `apps/worker/src/enrich/`. Stored in `sponsor_profiles` and `jobs`.

```mermaid
flowchart TD
  Q[Pick sponsors:<br/>queued → due re-checks → never checked] --> CH{COMPANIES_HOUSE_API_KEY?}
  CH -- yes --> CHS[Companies House search<br/>exact name, active, same town]
  CH -- no --> W
  CHS --> WD[Wikidata: website for this<br/>company number]
  WD --> W{Website yet?}
  W -- no --> WN[Wikidata name search<br/>UK organisations]
  WN --> DG[Guess domains<br/>acmerobotics.co.uk, .com, …]
  DG --> V[Fetch homepage +<br/>privacy/terms/contact pages]
  V --> OK{Company number or<br/>registered name on the site?}
  OK -- no --> next[next candidate]
  OK -- yes --> C[Find careers link /<br/>common paths]
  W -- yes --> C
  C --> ATS{Hiring platform?}
  ATS -- Greenhouse, Lever, Ashby,<br/>Workable, Recruitee --> J[Fetch open roles via<br/>their public API]
  ATS -- other / none --> L[Link to careers page]
```

## How a website is accepted

We never show a website we can't tie to the organisation. In order of strength (`website_verified_by`):

| Evidence | Value | Notes |
|---|---|---|
| Wikidata lists the site against the Companies House number | `wikidata` | Needs a Companies House key to know the number |
| The Companies House number appears on the site | `company_number` | UK companies must display it; usually in the footer or privacy policy |
| The full registered name ("Acme Robotics Ltd") appears on the site | `company_name` | Only for names with a legal suffix (Ltd, PLC, LLP, CIC) |
| The domain *is* the name, the title names it, and the page mentions its town | `domain_and_title` | Weakest; only for distinctive names of 6+ letters |

Parked/for-sale domains are rejected. Generic names ("Care Services Ltd") and very short names are never guessed.

## Hiring platforms

| Provider | Jobs listed? | Public endpoint |
|---|---|---|
| Greenhouse | ✓ | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
| Lever | ✓ | `api.lever.co/v0/postings/{slug}?mode=json` |
| Ashby | ✓ | `api.ashbyhq.com/posting-api/job-board/{slug}` |
| Workable | ✓ | `apply.workable.com/api/v1/widget/accounts/{slug}` |
| Recruitee | ✓ | `{slug}.recruitee.com/api/offers/` |
| Teamtailor, Pinpoint, SmartRecruiters, Workday, BambooHR, Personio, Jobvite, iCIMS | link only | detected, careers link shown |

Jobs are refreshed daily (`refreshJobs`) and rows that disappear from the board are deleted. `is_uk` is decided from
country codes when available, otherwise from UK place names (`location.ts`; "New York", "London, Ontario" and US
state codes are excluded).

## Being a good citizen

- Identifies itself: `SponsorshipHunterBot/0.1 (+https://www.sponsorshiphunter.com/about)`.
- Obeys `robots.txt` (our agent's rules, else `*`).
- At most a handful of pages per site; 10 s timeout and 1.5 MB cap per page.
- Refuses private/internal network addresses (protects the runner).
- Companies House: throttled to ~1.6 requests/second (their limit is 600 per 5 minutes).

## Queue and priorities

`sponsor_profiles.status` = `queued` → `done` / `not_found` / `error`.

| Trigger | Priority |
|---|---|
| Someone watches the company (`POST /api/watch`) | 10 |
| Someone opens a company page with no profile yet (`ProfileRequest` → `POST /api/profile-request`) | 5 |
| Background sweep (newest sponsors first) | — (no profile row yet) |

Re-checks: websites found → 60 days; not found → 30 days; errors → 1–7 days (backing off).

After every 25 saved results (and after job refreshes) the worker calls the website's `/api/revalidate`, so
company pages show new websites/jobs on the next visit instead of after the hourly cache expires. This needs
`SITE_URL` and `BETTER_AUTH_SECRET` (the workflow passes `PROD_`/`STAGING_` values). Vercel's preview protection
blocks it on staging, where pages fall back to the hourly refresh.

## Running it

```bash
npm run enrich                                    # up to 100 sponsors + refresh due job boards
npm run enrich -- --limit 300 --concurrency 8
npm run enrich -- --sponsor monzo-bank-ltd-london --dry-run   # one company, verbose, not saved
```

In production: `.github/workflows/enrich.yml`, every 4 hours, 150 sponsors per run (≈900/day). Manual runs can
target staging. At that pace a full sweep of ~122k sponsors takes months; the queue makes sure the companies people
actually look at are done first.

## Expected coverage

From a sample run: well-known companies are found reliably; small businesses much less often (many have no
website, or one whose name differs from the registered name). A **Companies House API key** raises coverage and
confidence: free at <https://developer.company-information.service.gov.uk/>, add as the `COMPANIES_HOUSE_API_KEY`
repo secret.

## Ideas to improve coverage

- A search API (e.g. Brave Search) as another candidate source, verified the same way.
- Let signed-in users suggest a website, accepted only if it passes verification.
- Job boards (Adzuna, Reed) matched to sponsor names, for companies without their own hiring platform.
