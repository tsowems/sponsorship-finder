CREATE TYPE "public"."profile_status" AS ENUM('queued', 'done', 'not_found', 'error');--> statement-breakpoint
ALTER TYPE "public"."sponsor_event_type" ADD VALUE 'location_changed';--> statement-breakpoint
ALTER TYPE "public"."sponsor_event_type" ADD VALUE 'routes_changed';--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sponsor_id" integer NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"department" text,
	"url" text NOT NULL,
	"is_uk" boolean DEFAULT false NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_profiles" (
	"sponsor_id" integer PRIMARY KEY NOT NULL,
	"status" "profile_status" DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company_number" text,
	"company_name" text,
	"company_status" text,
	"incorporated_on" text,
	"sic_codes" text[],
	"website" text,
	"website_source" text,
	"website_verified_by" text,
	"careers_url" text,
	"ats_provider" text,
	"ats_slug" text,
	"jobs_count" integer DEFAULT 0 NOT NULL,
	"uk_jobs_count" integer DEFAULT 0 NOT NULL,
	"jobs_checked_at" timestamp with time zone,
	"checked_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "register_snapshots" ADD COLUMN "location_changed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "register_snapshots" ADD COLUMN "routes_changed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "routes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_profiles" ADD CONSTRAINT "sponsor_profiles_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_sponsor_source_external_idx" ON "jobs" USING btree ("sponsor_id","source","external_id");--> statement-breakpoint
CREATE INDEX "jobs_sponsor_uk_idx" ON "jobs" USING btree ("sponsor_id","is_uk");--> statement-breakpoint
CREATE INDEX "sponsor_profiles_queue_idx" ON "sponsor_profiles" USING btree ("status","priority","requested_at");--> statement-breakpoint
CREATE INDEX "sponsor_profiles_next_check_idx" ON "sponsor_profiles" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "sponsor_profiles_ats_idx" ON "sponsor_profiles" USING btree ("ats_provider","jobs_checked_at");