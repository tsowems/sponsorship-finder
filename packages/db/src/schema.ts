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

    // Enrichment (filled in by later phases)
    companyNumber: text('company_number'),
    website: text('website'),
    careersUrl: text('careers_url'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sponsors_name_trgm_idx').using('gin', sql`${t.normalizedName} gin_trgm_ops`),
    // Prefix search ("de%") for 1-2 character type-ahead, where the trigram index can't help.
    index('sponsors_name_prefix_idx').using('btree', t.normalizedName.op('text_pattern_ops')),
    index('sponsors_status_town_idx').on(t.status, t.normalizedTown),
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

export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;
export type SponsorEvent = typeof sponsorEvents.$inferSelect;
export type RegisterSnapshot = typeof registerSnapshots.$inferSelect;
export type SponsorEventType = (typeof sponsorEventType.enumValues)[number];
export type SavedSearch = typeof savedSearches.$inferSelect;
