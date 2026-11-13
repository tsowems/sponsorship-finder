CREATE TABLE "link_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sponsor_id" integer NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_by" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "link_suggestions" ADD CONSTRAINT "link_suggestions_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_suggestions" ADD CONSTRAINT "link_suggestions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_suggestions_sponsor_idx" ON "link_suggestions" USING btree ("sponsor_id","status");--> statement-breakpoint
CREATE INDEX "link_suggestions_status_idx" ON "link_suggestions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "link_suggestions_user_idx" ON "link_suggestions" USING btree ("user_id","created_at");