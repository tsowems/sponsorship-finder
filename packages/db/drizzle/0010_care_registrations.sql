CREATE TABLE "care_registrations" (
	"sponsor_id" integer NOT NULL,
	"regulator" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"home_care" boolean NOT NULL,
	"services" integer NOT NULL,
	"home_care_services" integer NOT NULL,
	"matched_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_registrations_sponsor_id_regulator_pk" PRIMARY KEY("sponsor_id","regulator")
);
--> statement-breakpoint
ALTER TABLE "care_registrations" ADD CONSTRAINT "care_registrations_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_registrations_home_care_idx" ON "care_registrations" USING btree ("home_care","sponsor_id");