# Sponsorship Hunter: developer documentation

Everything you need to understand, run, change and deploy this codebase.

## Study path

If you're new to the repo, read these in order. Each one builds on the last.

| # | Document | You'll learn |
|---|---|---|
| 1 | [Architecture](01-architecture.md) | The big picture: the three moving parts, how data flows, why the repo is split the way it is |
| 2 | [Local development](02-local-development.md) | Setting up your machine, environment variables, every script, troubleshooting |
| 3 | [The data pipeline](03-data-pipeline.md) | How the UKVI register becomes rows in our database: fetch, parse, group, diff, import |
| 4 | [Database](04-database.md) | Every table and column, indexes, migrations, Drizzle basics, useful SQL |
| 5 | [The website](05-web-app.md) | Next.js 16 + Cache Components, every route, the data layer, caching, SEO |
| 6 | [Accounts and alerts](06-auth-and-alerts.md) | Sign-in (Better Auth), watches, saved searches, alert emails, unsubscribe, security |
| 7 | [Deployment](../DEPLOYMENT.md) | Vercel, Neon branches, GitHub Actions, staging → main workflow |
| 8 | [How-to recipes](07-how-to.md) | Step-by-step guides for common changes |
| 9 | [Websites, careers pages and jobs](09-enrichment.md) | How we find and verify company websites, careers pages and open roles |
| 10 | [Domain glossary and decisions](08-glossary-and-decisions.md) | Visa/sponsor terms, why things are built this way, known limitations, ideas for later |

## Quick reference

```bash
npm install                 # install everything (run at the repo root)
npm run dev                 # website at http://localhost:3000
npm run import              # fetch + import the latest register once
npm test                    # unit tests
npm run typecheck           # TypeScript across all packages
npm run lint -w web         # ESLint for the website
npm run db:generate         # create a migration after editing the schema
npm run db:migrate          # apply migrations to DATABASE_URL
npm run db:studio           # browse the database in your browser
```

## Where things live

```
apps/web/src/app/          pages and API routes (Next.js App Router)
apps/web/src/components/   React components
apps/web/src/lib/          data queries, auth, helpers
apps/worker/src/register/  register download, parse, group, diff, import
apps/worker/src/alerts/    alert email building + sending
apps/worker/src/enrich/    website, careers page and jobs discovery
packages/db/src/           database schema, connection, name normalisation
packages/db/drizzle/       SQL migrations (generated; never edit by hand once applied)
packages/email/src/        email sending, templates, unsubscribe tokens
.github/workflows/         CI, scheduled import, production migrations
```

## Conventions

- **TypeScript everywhere**, strict mode. No build step for packages: `apps/web` compiles them via
  `transpilePackages`; the worker runs TypeScript directly with `tsx`.
- **One `.env` at the repo root.** `apps/web/.env` is a symlink to it.
- **Pure logic is separated from I/O** so it can be unit-tested: `diff.ts`, `group.ts`, `parse.ts`,
  `alerts/build.ts` have no database access.
- **Comments explain *why*, not *what*.** If you find yourself wondering why something is done a certain way,
  check the comment above it, then [the decisions log](08-glossary-and-decisions.md#design-decisions).
