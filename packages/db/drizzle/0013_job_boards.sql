CREATE TABLE "api_usage" (
	"day" text NOT NULL,
	"service" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_day_service_pk" PRIMARY KEY("day","service")
);
--> statement-breakpoint
CREATE TABLE "board_checks" (
	"sponsor_id" integer NOT NULL,
	"board" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"found" integer,
	CONSTRAINT "board_checks_sponsor_id_board_pk" PRIMARY KEY("sponsor_id","board")
);
--> statement-breakpoint
ALTER TABLE "board_checks" ADD CONSTRAINT "board_checks_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;