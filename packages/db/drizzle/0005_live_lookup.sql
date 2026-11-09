ALTER TABLE "sponsor_profiles" ADD COLUMN "lookup_started_at" timestamp with time zone;--> statement-breakpoint
-- Smarter website guessing shipped with this release (brand-only domains such as rhaelm.com):
-- re-check earlier "not found" results on the next enrichment runs instead of waiting 30 days.
UPDATE "sponsor_profiles" SET "next_check_at" = now() WHERE "status" = 'not_found';
