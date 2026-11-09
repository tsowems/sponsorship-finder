# 11. Admin area and visitor stats

`/admin` is a private dashboard: daily visitors, traffic sources, and registered users.
Code: `apps/web/src/app/admin/`, `src/lib/admin.ts`, `src/lib/admin-data.ts`, `src/proxy.ts`.

## Who can open it

1. Add `ADMIN_EMAILS` in Vercel (Production; Preview too if you want it on staging):
   your email, or several separated by commas.
2. Redeploy, sign in on the site with that email (Google or email link), then open `/admin`.
   Signed-in admins also see an **Admin** button on **My alerts**.

Everyone else (signed out, or signed in with another email) gets the normal **404 page**, with a real 404 status.
Nothing links to it and `robots.txt` disallows it. Access is checked three times: in `src/proxy.ts` (before any admin
code runs), in the admin layout, and in each page before it loads data. Keep doing the per-page check in new pages
(`await requireAdmin()`).

## Pages

| Page | Shows |
|---|---|
| `/admin` (Overview) | Visitors today / in the range (7, 30, 90 days), page views, new sign-ups, total users; daily visitors chart (hover a bar for views and sign-ups); top pages, referrers, countries, devices; latest sign-ups |
| `/admin/users` | Every user: email, joined, sign-in method, watches, saved searches, alerts on/off, last active; search by email/name |

To add a section: create `src/app/admin/<name>/page.tsx` (start it with `await requireAdmin()`) and add it to
`ITEMS` in `src/components/admin/AdminNav.tsx`.

## How visitors are counted

- `<PageViewTracker />` (in the root layout) sends `{path, referrer, signedIn}` to `POST /api/collect` on every page
  shown, including in-app navigation.
- No cookies or browser storage, so the cookie banner doesn't need to change. The privacy page describes it.
- A **visitor** = HMAC(`BETTER_AUTH_SECRET`, London date + IP + user agent): the same person counts once per day, then
  the code changes. "Visitors" over a range is the sum of daily visitors.
- Not counted: bots (by user agent), requests from other sites, `/admin` and `/api` pages, and browsers with Do Not
  Track / Global Privacy Control on.
- Query strings are never stored (`/sponsors?q=...` is recorded as `/sponsors`); referrers are reduced to the host.
- Country comes from Vercel's `x-vercel-ip-country` header (blank locally).
- Stored in the `page_views` table. Rows older than 400 days are deleted automatically.

## Cost

One small insert per page view. Each row is roughly 150 bytes, so 100,000 views ≈ 15 MB of the 0.5 GB Neon free
storage. Note that visits now wake the database (previously cached pages didn't), which uses a little more Neon compute.
