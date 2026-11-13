# 11. Admin area

`/admin` is a private area for the site owner: registered users, when they joined and when they last signed in.
Code: `apps/web/src/app/admin/`, `src/lib/admin.ts`, `src/lib/admin-data.ts`, `src/proxy.ts`.

## Who can open it

1. Add `ADMIN_EMAILS` in Vercel (Production; Preview too if you want it on staging): your email, or several
   separated by commas.
2. Redeploy, sign in on the site with that email (Google or email link), then open `/admin`.
   Signed-in admins also see an **Admin** button on **My alerts**.

Everyone else (signed out, or signed in with another email) gets the normal **404 page**, with a real 404 status.
Nothing links to it and `robots.txt` disallows it. Access is checked three times: in `src/proxy.ts` (before any admin
code runs), in the admin layout, and in each page before it loads data. Keep doing the per-page check in new pages
(`await requireAdmin()`).

## Pages

| Page | Shows |
|---|---|
| `/admin` (Overview) | Users, joined today / 7 / 30 days, signed in during the last 7 days, alerts on, watchers; latest 10 sign-ups |
| `/admin/users` | Every user: email, name, joined, last signed in (UK time), sign-in method, watches, saved searches, alerts on/off. Search by email or name; sort by newest or last signed in |

"Last signed in" (`user.last_sign_in_at`) is set by a Better Auth hook each time a session is created
(`src/lib/auth.ts`). Users from before this was added were backfilled from their latest session; people who had
signed out show "–" until they next sign in.

To add a section: create `src/app/admin/<name>/page.tsx` (start it with `await requireAdmin()`) and add it to
`ITEMS` in `src/components/admin/AdminNav.tsx`.

## Personal data

These are users' email addresses: use them only for the site (sign-in links and licence alerts). Marketing emails need
separate consent. Don't export or share the list.

## Suggested links (`/admin/suggestions`)

Websites and careers pages users suggested that the automatic checks couldn't confirm. Open the link, check it belongs to the
company, then **Approve** (the company is looked up again straight away and its page updates) or **Reject**. "Recent decisions"
lists the last 30, with **Remove** to take an accepted link off again. The overview page shows how many are waiting.

