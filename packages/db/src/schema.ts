import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  primaryKey,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export * from './auth-schema';

export const sponsorStatus = pgEnum('sponsor_status', ['active', 'removed']);

export const sponsorEventType = pgEnum('sponsor_event_type', [
  'added', // appeared on the register for the first time
  'removed', // no longer on the register (revoked, surrendered, expired or renamed - we can't tell which)
  'readded', // was removed earlier, now back
  'rating_changed', // e.g. A -> B (downgrade) or B -> A
  'location_changed', // town and/or county changed (old_value/new_value: "Town, County")
  'routes_changed', // visa routes held changed (old_value/new_value: routes joined with " | ")
]);

/** One row per register CSV we have processed. */
export const registerSnapshots = pgTable('register_snapshots', {
  id: serial('id').primaryKey(),
  sourceUrl: text('source_url').notNull().unique(),
  sha256: text('sha256').notNull(),
  /** When gov.uk says the register was published/updated. */
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  /** First ever import: establishes the baseline, so it creates no "added" events. */
  isBaseline: boolean('is_baseline').notNull().default(false),
  /** False when the file had no differences: logged so we don't re-download it, but nothing was written. */
  hasChanges: boolean('has_changes').notNull().default(true),
  totalRows: integer('total_rows').notNull(),
  skilledWorkerRows: integer('skilled_worker_rows').notNull(),
  sponsorCount: integer('sponsor_count').notNull(),
  addedCount: integer('added_count').notNull().default(0),
  removedCount: integer('removed_count').notNull().default(0),
  readdedCount: integer('readded_count').notNull().default(0),
  ratingChangedCount: integer('rating_changed_count').notNull().default(0),
  locationChangedCount: integer('location_changed_count').notNull().default(0),
  routesChangedCount: integer('routes_changed_count').notNull().default(0),
  /** Set once alert emails for this snapshot's changes have been sent. */
  alertsProcessedAt: timestamp('alerts_processed_at', { withTimezone: true }),
});

/**
 * One row per sponsoring organisation (Skilled Worker route only).
 * Identity = normalised name + normalised town (the register has no IDs).
 */
export const sponsors = pgTable(
  'sponsors',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull().unique(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    town: text('town').notNull(),
    normalizedTown: text('normalized_town').notNull(),
    county: text('county'),
    /** 'A' | 'B' | 'A (Premium)' | 'A (SME+)' - or the raw value if UKVI adds a new one. */
    rating: text('rating').notNull(),
    ratingRaw: text('rating_raw').notNull(),
    /** How many register rows were merged into this sponsor (usually 1). */
    entryCount: integer('entry_count').notNull().default(1),
    status: sponsorStatus('status').notNull().default('active'),
    /** True if it was already on the register when we started tracking. */
    inBaseline: boolean('in_baseline').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }),

    /** @deprecated Unused; superseded by sponsor_profiles. Dropped in a later migration once no deployed code reads it. */
    companyNumber: text('company_number'),
    /** @deprecated see companyNumber */
    website: text('website'),
    /** @deprecated see companyNumber */
    careersUrl: text('careers_url'),
    /** Every visa route this organisation is licensed for (the register has one row per route). Empty = not yet known. */
    routes: text('routes').array().notNull().default(sql`'{}'::text[]`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sponsors_name_trgm_idx').using('gin', sql`${t.normalizedName} gin_trgm_ops`),
    // Prefix search ("de%") for 1-2 character type-ahead, where the trigram index can't help.
    index('sponsors_name_prefix_idx').using('btree', t.normalizedName.op('text_pattern_ops')),
    index('sponsors_status_town_idx').on(t.status, t.normalizedTown),
    // Browse by town, A–Z with keyset paging (/browse/towns/[town]).
    index('sponsors_status_town_name_idx').on(t.status, t.normalizedTown, t.normalizedName, t.id),
    index('sponsors_status_name_idx').on(t.status, t.normalizedName),
  ],
);

/** Every change we detect between register snapshots. */
export const sponsorEvents = pgTable(
  'sponsor_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sponsorId: integer('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => registerSnapshots.id, { onDelete: 'cascade' }),
    type: sponsorEventType('type').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('sponsor_events_occurred_idx').on(t.occurredAt),
    index('sponsor_events_type_occurred_idx').on(t.type, t.occurredAt),
    index('sponsor_events_sponsor_idx').on(t.sponsorId),
  ],
);

/** A user following a specific sponsor. */
export const watches = pgTable(
  'watches',
  {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    sponsorId: integer('sponsor_id').notNull().references(() => sponsors.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sponsorId] }), index('watches_sponsor_idx').on(t.sponsorId)],
);

/** "Tell me about new sponsors matching <name> in <town>". At least one of the two is set. */
export const savedSearches = pgTable(
  'saved_searches',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    query: text('query'),
    normalizedQuery: text('normalized_query').notNull().default(''),
    town: text('town'),
    normalizedTown: text('normalized_town').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('saved_searches_user_query_idx').on(t.userId, t.normalizedQuery, t.normalizedTown)],
);

export const alertStatus = pgEnum('alert_status', ['pending', 'sent', 'failed']);

/** One alert email per user per snapshot. The unique index makes sending idempotent. */
export const alertDeliveries = pgTable(
  'alert_deliveries',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id').notNull().references(() => registerSnapshots.id, { onDelete: 'cascade' }),
    status: alertStatus('status').notNull().default('pending'),
    itemCount: integer('item_count').notNull(),
    providerId: text('provider_id'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('alert_deliveries_user_snapshot_idx').on(t.userId, t.snapshotId)],
);

export const profileStatus = pgEnum('profile_status', ['queued', 'done', 'not_found', 'error']);

/**
 * What we've found out about a sponsor beyond the register: Companies House record, website,
 * careers page and hiring platform. Filled in by the worker's enrichment job.
 */
export const sponsorProfiles = pgTable(
  'sponsor_profiles',
  {
    sponsorId: integer('sponsor_id').primaryKey().references(() => sponsors.id, { onDelete: 'cascade' }),
    status: profileStatus('status').notNull().default('queued'),
    /** Higher runs first: 10 = someone watches it, 5 = someone viewed it, 0 = background sweep. */
    priority: integer('priority').notNull().default(0),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),

    companyNumber: text('company_number'),
    companyName: text('company_name'),
    companyStatus: text('company_status'),
    incorporatedOn: text('incorporated_on'), // YYYY-MM-DD
    sicCodes: text('sic_codes').array(),

    website: text('website'),
    /** How we found it: 'wikidata' | 'govuk' | 'nhs_ods' | 'wikidata_search' | 'domain_guess' */
    websiteSource: text('website_source'),
    /** Why we trust it: 'wikidata' | 'govuk' | 'nhs_ods' | 'company_number' | 'company_name' | 'public_domain' | 'domain_and_title' */
    websiteVerifiedBy: text('website_verified_by'),
    careersUrl: text('careers_url'),
    /** The hiring system's vacancy list when it's separate from the careers page (iTrent, Oracle, Teamtailor…). */
    vacanciesUrl: text('vacancies_url'),
    /** 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'recruitee' | 'teamtailor' | 'workday' | ... */
    atsProvider: text('ats_provider'),
    atsSlug: text('ats_slug'),
    jobsCount: integer('jobs_count').notNull().default(0),
    ukJobsCount: integer('uk_jobs_count').notNull().default(0),
    jobsCheckedAt: timestamp('jobs_checked_at', { withTimezone: true }),

    checkedAt: timestamp('checked_at', { withTimezone: true }),
    /** When the website last started an immediate lookup for a visitor (stops duplicate lookups). */
    lookupStartedAt: timestamp('lookup_started_at', { withTimezone: true }),
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    error: text('error'),
  },
  (t) => [
    index('sponsor_profiles_queue_idx').on(t.status, t.priority, t.requestedAt),
    index('sponsor_profiles_next_check_idx').on(t.nextCheckAt),
    index('sponsor_profiles_ats_idx').on(t.atsProvider, t.jobsCheckedAt),
  ],
);

/** Open roles pulled from a sponsor's hiring platform. Rows not seen in the latest fetch are deleted. */
export const jobs = pgTable(
  'jobs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sponsorId: integer('sponsor_id').notNull().references(() => sponsors.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    location: text('location'),
    department: text('department'),
    url: text('url').notNull(),
    isUk: boolean('is_uk').notNull().default(false),
    remote: boolean('remote').notNull().default(false),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('jobs_sponsor_source_external_idx').on(t.sponsorId, t.source, t.externalId),
    index('jobs_sponsor_uk_idx').on(t.sponsorId, t.isUk),
  ],
);

/**
 * Sponsors matched to the care regulators' public registers (refreshed monthly by the worker's `care` job):
 * CQC in England and the Care Inspectorate in Scotland. One row per sponsor and regulator.
 * `homeCare` = the provider runs at least one home-care service ("Homecare agencies" / "Care at Home").
 */
export const careRegistrations = pgTable(
  'care_registrations',
  {
    sponsorId: integer('sponsor_id').notNull().references(() => sponsors.id, { onDelete: 'cascade' }),
    /** 'cqc' (England) | 'care_inspectorate' (Scotland) */
    regulator: text('regulator').notNull(),
    providerId: text('provider_id').notNull(),
    providerName: text('provider_name').notNull(),
    homeCare: boolean('home_care').notNull(),
    /** Registered services/locations, and how many of them are home care. */
    services: integer('services').notNull(),
    homeCareServices: integer('home_care_services').notNull(),
    /** 'name_and_town' (same name, a service in the sponsor's town) | 'company_name' (same registered company name) */
    matchedBy: text('matched_by').notNull(),
    /**
     * CQC overall ratings of the provider's home-care services, e.g. "Good" or "2 Good, 1 Requires improvement"
     * ("Not yet rated" for services not inspected yet). Null when unknown (Scotland, or the ratings file wasn't read).
     */
    rating: text('rating'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sponsorId, t.regulator] }), index('care_registrations_home_care_idx').on(t.homeCare, t.sponsorId)],
);

export type CareRegistration = typeof careRegistrations.$inferSelect;
/**
 * Website and careers links suggested by signed-in users (company page → "Suggest a link").
 * A suggestion is accepted automatically when it passes the same checks as our own search (company number or full
 * registered name on the site; careers page on the same site), otherwise an admin reviews it.
 * Accepted links are fed into every later re-check of that company, so they aren't lost when we look again.
 */
export const linkSuggestions = pgTable(
  'link_suggestions',
  {
    id: serial('id').primaryKey(),
    sponsorId: integer('sponsor_id').notNull().references(() => sponsors.id, { onDelete: 'cascade' }),
    /** Kept when the account is deleted, so accepted links survive. */
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    /** 'website' | 'careers' */
    kind: text('kind').notNull(),
    url: text('url').notNull(),
    /** 'pending' (waiting for an admin) | 'accepted' | 'rejected' */
    status: text('status').notNull().default('pending'),
    /** Who accepted it: 'auto' (passed our checks) | 'admin' */
    acceptedBy: text('accepted_by'),
    /** Why it was accepted or not, in plain words (shown to admins). */
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [
    index('link_suggestions_sponsor_idx').on(t.sponsorId, t.status),
    index('link_suggestions_status_idx').on(t.status, t.createdAt),
    index('link_suggestions_user_idx').on(t.userId, t.createdAt),
  ],
);

export type LinkSuggestion = typeof linkSuggestions.$inferSelect;
/**
 * Job boards searched for a sponsor's own adverts (Reed for now). One row per sponsor and board; the jobs themselves are
 * in `jobs` with `source` = the board. `checkedAt` is set when a check starts, so two visitors don't trigger two searches.
 */
export const boardChecks = pgTable(
  'board_checks',
  {
    sponsorId: integer('sponsor_id').notNull().references(() => sponsors.id, { onDelete: 'cascade' }),
    /** 'reed' */
    board: text('board').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    /** Adverts found on the last completed check (null while the first check is running or if it failed). */
    found: integer('found'),
  },
  (t) => [primaryKey({ columns: [t.sponsorId, t.board] })],
);

/** Calls made to rate-limited outside services, per London day (e.g. Reed's daily allowance). */
export const apiUsage = pgTable(
  'api_usage',
  {
    day: text('day').notNull(), // YYYY-MM-DD, Europe/London
    service: text('service').notNull(),
    calls: integer('calls').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.service] })],
);

export type SponsorProfile = typeof sponsorProfiles.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;
export type SponsorEvent = typeof sponsorEvents.$inferSelect;
export type RegisterSnapshot = typeof registerSnapshots.$inferSelect;
export type SponsorEventType = (typeof sponsorEventType.enumValues)[number];
export type SavedSearch = typeof savedSearches.$inferSelect;
