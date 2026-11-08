# 5. The website (`apps/web`)

Next.js 16 with the App Router, React 19, Tailwind CSS 4.

## Next.js 16 Cache Components in 10 minutes

This app has `cacheComponents: true` and `partialPrefetching: true` in `next.config.ts`. This is the new
default model, and it's **different from Next.js 13–15 tutorials** (no `export const revalidate`,
no `fetch(..., { next: { revalidate } })`, no `dynamic = 'force-dynamic'`).

**The rule:** by default, a page is prerendered at build time. Anything that can't be known at build time must
either be **cached** or **wrapped in `<Suspense>`**.

| Your component does… | You must… | Result |
|---|---|---|
| Only static JSX / imports | nothing | Part of the static HTML |
| A DB query that's the same for everyone | put it in a function with `'use cache'` + `cacheLife(...)` | Cached result, included in static HTML, refreshed after the lifetime |
| Reads `searchParams`, `cookies()`, `headers()`, or does an uncached query | wrap that component in `<Suspense fallback={…}>` | Static shell + fallback is sent instantly; the real content streams in per request |

```ts
// A cached data function (apps/web/src/lib/data.ts)
export async function getOverview() {
  'use cache';
  cacheLife('hours');      // reuse for up to ~1 hour
  cacheTag('sponsors');    // label, so we could invalidate on demand later
  return db.select()...;
}
```

- **Arguments are part of the cache key**: `searchSponsors({ q: 'tesco', page: 1 })` and `page: 2` are cached
  separately.
- **Results must be serialisable** (plain objects, arrays, Dates are fine; class instances aren't).
- `cacheLife('hours')` = serve cached for a while, revalidate in the background roughly hourly, expire after a day.
  Without help, pages could lag new data by up to ~1 hour, so the worker calls **`/api/revalidate`** after saving:
  researched companies' pages refresh on the very next visit (`revalidateTag('sponsor:<slug>', { expire: 0 })`),
  and after an import every list/page refreshes in the background (`revalidateTag('sponsors', 'max')`).
  The request is signed with a token derived from `BETTER_AUTH_SECRET` (`packages/db/src/internal-token.ts`).
- In dev, the overlay tells you when you forgot a `<Suspense>` or `'use cache'` ("blocking-route" insight).

The installed docs are the authority: `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.

## Routes

| URL | File | Rendering | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` | Static + cached data | Hero search, stats, latest new/removed |
| `/sponsors` | `app/sponsors/page.tsx` | Static shell + streamed results | Reads `searchParams` → results in `<Suspense>`. Filtered views are `noindex` |
| `/sponsors/[slug]` | `app/sponsors/[slug]/page.tsx` | **Fully static per company** (`ensureStatic = 'navigation'`) | The SEO page. Built on first visit, then cached |
| `/changes` | `app/changes/page.tsx` | Static shell + streamed list | Tabs via `?type=added\|removed\|downgraded\|readded` |
| `/about` | `app/about/page.tsx` | Static | Data explanation + licence |
| `/privacy` | `app/privacy/page.tsx` | Static | Privacy policy + cookie list (`#cookies`). Contact address from `CONTACT_EMAIL` |
| `/login` | `app/login/page.tsx` | Static + client form | |
| `/account` | `app/account/page.tsx` | Per request (reads session) | Redirects to `/login` if signed out |
| `/unsubscribe` | `app/unsubscribe/page.tsx` | Per request | Confirm button; doesn't unsubscribe on page load |
| `/robots.txt` | `app/robots.ts` | Cached | Blocks everything on staging |
| `/sitemap.xml` | `app/sitemap.ts` | Static | Static pages only |
| `/sponsors/sitemap/{0,1,2}.xml` | `app/sponsors/sitemap.ts` | Cached | 45k company URLs per file (Google's limit is 50k) |

### API routes (`app/api/`)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/suggest?q=` | GET | — | Company type-ahead, up to 8 matches. Cached in Next + `Cache-Control` for CDNs |
| `/api/towns?q=` | GET | — | Town type-ahead: towns starting with the text, biggest first, one per town (most common spelling) |
| `/api/jobs?sponsorId=` | GET | **required** | Open roles + careers link for a company. Jobs are only shown to signed-in users |
| `/api/auth/*` | GET/POST | — | Everything Better Auth does (sign-in, callback, session, sign-out) |
| `/api/watch?sponsorId=` | GET | optional | `{ signedIn, watching }` |
| `/api/watch` | POST / DELETE | required | Body `{ sponsorId }` |
| `/api/saved-searches` | POST | required | Body `{ q?, town? }` |
| `/api/saved-searches` | DELETE | required | Body `{ id }` |
| `/api/account/alerts` | POST | required | Body `{ enabled: boolean }` |
| `/api/unsubscribe?u=&t=` | POST | signed token | Unsubscribe page button + email one-click |
| `/api/profile-request` | POST | — | Queue a company for website/jobs research (sent by company pages without a profile) |
| `/api/revalidate` | POST | worker token | Refresh cached pages now: `{ slugs: [...] }` (immediately) or `{ all: true }` (in the background) |

Mutation endpoints check the request's `Origin` header matches the site (`isSameOrigin` in `lib/session.ts`).

## The company page in detail

This page is what Google indexes, so it's built to be **complete HTML on the first request**:

```ts
export const ensureStatic = 'navigation';       // whole route must be static: no Suspense placeholders
export async function generateStaticParams() {   // required by ensureStatic; we build pages on demand,
  return [{ slug: '__placeholder__' }];          // so one placeholder (it 404s) satisfies the build
}
```

- First visit to `/sponsors/acme-ltd-london`: Next renders it fully (~0.4s), stores it, serves it.
- Later visits: served from cache (~2–5 ms) until the `cacheLife('hours')` lifetime passes.
- Unknown slug → `notFound()` before any streaming → real **404** status.
- `generateMetadata` gives each page its own `<title>`, description and canonical URL; the page also emits
  **JSON-LD** (`schema.org/Organization`).

Anything user-specific on this page (the **Watch** button) is a **client component** that fetches its state
from `/api/watch` after load. That's how the page stays static for everyone.
The same trick is used for the header's "Sign in / My alerts" (`UserMenu`).

## Data layer (`src/lib/data.ts`)

All database reads for pages go through this file. Functions with a small, fixed set of inputs are `'use cache'`
(company page: `max`; lists and stats: `days`). Free-form inputs (search, suggestions, towns) are not, because each
distinct input would be stored as a separate Vercel ISR write. See [decisions](08-glossary-and-decisions.md).

| Function | Used by |
|---|---|
| `getSponsorBySlug(slug)` | company page + its metadata. Also loads events and same-name sponsors |
| `searchSponsors({ q, town, rating, status, page })` | `/sponsors`. Falls back to fuzzy suggestions when nothing matches. **Not** server-cached |
| `suggestSponsors(q)` | `/api/suggest` |
| `getChanges(filter, page, pageSize)` | `/changes`, home page |
| `getOverview()` | home page stats |
| `getSponsorSitemapCount()`, `getSponsorSitemapChunk(n)` | sitemaps, robots |

User-specific reads (account page, watch status) are **not** cached and live next to the route that uses them.

### How search works

1. The query goes through `normalizeName()`, the same function used at import. So "Smith & Sons Ltd" matches.
2. `normalized_name ILIKE '%query%'`, served by the trigram index.
3. Ordering: names **starting with** the query first, then shorter names, then alphabetical.
4. Zero results and query ≥ 3 chars → **fuzzy fallback** using trigram word similarity (`<%`), with the
   threshold lowered to 0.45 for just that query (`SET LOCAL` inside a transaction) so typos like "delloite"
   still find "Deloitte LLP".

Type-ahead (`suggestSponsors`) is the same idea, limited to 8, with prefix matching for 2-letter queries and
licensed sponsors ranked above removed ones.

## Components (`src/components/`)

| Component | Server/Client | Purpose |
|---|---|---|
| `SearchForm` | server | Name + town form. Plain `GET /sponsors`, so it works without JavaScript |
| `SearchAutocomplete` | **client** | Type-ahead dropdown inside `SearchForm`: 150 ms debounce, aborts stale requests, keyboard navigation, in-memory cache |
| `SponsorList`, `ChangeList`, `Badges`, `Pagination` | server | Presentational |
| `UserMenu` | **client** | Header sign-in state (`authClient.useSession()`) |
| `WatchButton` | **client** | Watch / stop watching on company pages |
| `SaveSearchButton` | **client** | "Email me new sponsors matching…" on search results |
| `LoginForm` | **client** | Google button + magic-link form |
| `JobsPanel` | **client** | On company pages: shows the role count to everyone, and the roles + careers link only after sign-in (from `/api/jobs`) |
| `TownAutocomplete` | **client** | Town box in `SearchForm` with suggestions from `/api/towns` |
| `AccountControls` | **client** | Buttons/forms on `/account`; call the APIs then `router.refresh()` |
| `CookieBanner`, `CookieSettingsButton` | **client** | Consent banner ("Essential only" / "Accept all") and the footer link that reopens it. State lives in `lib/consent.ts` |

"Client" components have `'use client'` at the top, run in the browser and can use state/effects. Everything
else renders on the server and ships no JavaScript.

## SEO checklist (what's already done)

- Unique `<title>`, description, canonical URL on every company page
- Complete HTML on first request (no client-side rendering of content)
- JSON-LD on company pages
- Sitemaps (index of all ~122k companies) + `robots.txt` pointing at them
- `noindex` on search-result variations, login, account, unsubscribe
- `noindex` + `Disallow: /` on staging/preview (`IS_INDEXABLE` in `lib/site.ts`)
- `lang="en-GB"`, Open Graph site name and locale

After launch: add the domain to **Google Search Console** and submit the sitemaps listed in `https://www.sponsorshiphunter.com/robots.txt`.

## Styling

Tailwind CSS 4: utility classes directly in JSX; global styles in `app/globals.css`. The palette is
`slate` (text/borders), `indigo` (actions), `emerald` / `red` / `amber` (licensed / removed / B-rated).
Fonts: Geist via `next/font/google`. They're downloaded at build time and self-hosted, with no runtime calls to Google.

## Cookie consent

The site only sets essential cookies (Better Auth's session cookies, after sign-in), which UK law (PECR) doesn't
require consent for. The banner still asks, so the choice is recorded before any optional tool is added.

- Choice is stored in `localStorage` (`cookie-consent-v1`) by `lib/consent.ts`.
- **Adding analytics later:** load it only when `useConsent() === 'all'`, and add it to the cookie table on `/privacy`.

```tsx
'use client';
import { useConsent } from '@/lib/consent';
export function Analytics() {
  return useConsent() === 'all' ? <script defer src="…" /> : null;
}
```

## Site-wide settings

`src/lib/site.ts`: `SITE_NAME` (env-overridable), `SITE_TAGLINE`, `SITE_URL`, `REGISTER_URL`, `IS_INDEXABLE`, `CONTACT_EMAIL` (env-overridable).
