# 10. Data API (`/api/v1`)

Read-only JSON access to the sponsor register, for our own other apps (e.g. the planned jobs module) or scripts.
Code: `apps/web/src/lib/public-api.ts` and `apps/web/src/app/api/v1/`.

## Access

Every request needs a key:

```
Authorization: Bearer <key>        (or)   X-API-Key: <key>
```

Keys live in the `API_KEYS` environment variable on Vercel: comma-separated, at least 16 characters each.
Create one with `openssl rand -base64 32`. With no keys set the API answers `503`, so it's off by default.
Give each app its own key so you can revoke one by removing it from the list and redeploying.

Call it **from a server** (another backend, a worker or a script). If a browser page must call it directly, add that
site's origin to `API_CORS_ORIGINS` (comma-separated), but anyone can read a key that's shipped to a browser.

## Endpoints

### `GET /api/v1/sponsors`

| Parameter | Meaning |
|---|---|
| `q` | name contains (ignores case, punctuation, "Ltd"/"Limited") |
| `town` | exact town |
| `rating` | `A` or `B` |
| `status` | `active` (default), `removed`, `all` |
| `route` | visa route held, e.g. `Skilled Worker` |
| `has_website` | `true` / `false` |
| `has_jobs` | `true`: at least one open role found |
| `updated_since` | ISO date/time: register data changed since then (rating, town, routes, removal…) |
| `limit` | 1–1000, default 100 |
| `cursor` | `next_cursor` from the previous response |

```json
{
  "data": [{
    "id": 71295, "slug": "monzo-bank-ltd-london", "name": "Monzo Bank Ltd", "town": "London", "county": null,
    "rating": "A", "routes": ["Skilled Worker"], "status": "active",
    "firstSeenAt": "…", "lastSeenAt": "…", "removedAt": null, "inBaseline": true, "updatedAt": "…",
    "companyNumber": "09446231", "website": "https://monzo.com", "careersUrl": "…", "atsProvider": "greenhouse",
    "jobsCount": 120, "ukJobsCount": 95, "pageUrl": "https://www.sponsorshiphunter.com/sponsors/monzo-bank-ltd-london"
  }],
  "next_cursor": "71295"
}
```

Results are ordered by `id`. Keep requesting with `cursor=<next_cursor>` until `next_cursor` is `null`.

### `GET /api/v1/sponsors/{slug or id}`

Everything above plus Companies House details (`companyName`, `companyStatus`, `incorporatedOn`, `sicCodes`),
the full change history (`events`) and the open roles (`jobs`, up to 500). `404` if not found.

### `GET /api/v1/changes`

The change feed, newest first: `type` (one or more of `added,removed,readded,rating_changed,location_changed,routes_changed`),
`since`, `until`, `limit`, `cursor`. Each row includes a short `sponsor` object.

## Keeping a copy in sync

1. First time: page through `/api/v1/sponsors?status=all&limit=1000` (≈123 requests for 122k sponsors).
2. After each daily import: `/api/v1/sponsors?status=all&updated_since=<time of your last sync>`.

`updated_since` covers register changes only. Website/job updates from enrichment don't change `updatedAt`.

## Errors

`400` bad parameter (message says which), `401` missing/wrong key, `404` not found, `503` API not configured.
All responses are `Cache-Control: private, no-store`.

## Costs

Each request is one Vercel function call plus one or two database queries (no ISR writes). Pull pages of 1000
rather than one sponsor at a time, and cache on your side.
