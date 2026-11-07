CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."sponsor_event_type" AS ENUM('added', 'removed', 'readded', 'rating_changed');--> statement-breakpoint
CREATE TYPE "public"."sponsor_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TABLE "register_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"sha256" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_baseline" boolean DEFAULT false NOT NULL,
	"total_rows" integer NOT NULL,
	"skilled_worker_rows" integer NOT NULL,
	"sponsor_count" integer NOT NULL,
	"added_count" integer DEFAULT 0 NOT NULL,
	"removed_count" integer DEFAULT 0 NOT NULL,
	"readded_count" integer DEFAULT 0 NOT NULL,
	"rating_changed_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "register_snapshots_source_url_unique" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "sponsor_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sponsor_id" integer NOT NULL,
	"snapshot_id" integer NOT NULL,
	"type" "sponsor_event_type" NOT NULL,
	"old_value" text,
	"new_value" text,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"town" text NOT NULL,
	"normalized_town" text NOT NULL,
	"county" text,
	"rating" text NOT NULL,
	"rating_raw" text NOT NULL,
	"entry_count" integer DEFAULT 1 NOT NULL,
	"status" "sponsor_status" DEFAULT 'active' NOT NULL,
	"in_baseline" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	"company_number" text,
	"website" text,
	"careers_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsors_key_unique" UNIQUE("key"),
	CONSTRAINT "sponsors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "sponsor_events" ADD CONSTRAINT "sponsor_events_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_events" ADD CONSTRAINT "sponsor_events_snapshot_id_register_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."register_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsor_events_occurred_idx" ON "sponsor_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "sponsor_events_type_occurred_idx" ON "sponsor_events" USING btree ("type","occurred_at");--> statement-breakpoint
CREATE INDEX "sponsor_events_sponsor_idx" ON "sponsor_events" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "sponsors_name_trgm_idx" ON "sponsors" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "sponsors_status_town_idx" ON "sponsors" USING btree ("status","normalized_town");--> statement-breakpoint
CREATE INDEX "sponsors_status_name_idx" ON "sponsors" USING btree ("status","normalized_name");