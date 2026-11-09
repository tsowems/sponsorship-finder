CREATE TABLE "page_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"visitor_id" text NOT NULL,
	"country" text,
	"device" text,
	"signed_in" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "page_views_created_idx" ON "page_views" USING btree ("created_at");