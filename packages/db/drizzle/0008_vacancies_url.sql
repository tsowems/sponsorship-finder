ALTER TABLE "sponsor_profiles" ADD COLUMN "vacancies_url" text;--> statement-breakpoint
-- Public bodies found earlier without a careers page (official sites that block bots, e.g. fife.gov.uk): re-check now
-- so the new jobs./careers. subdomain check and hiring-system links apply.
UPDATE "sponsor_profiles" SET "next_check_at" = now() WHERE "status" = 'done' AND "careers_url" IS NULL AND "website" ~ '\.(gov|nhs|ac|sch|police)\.uk/?$';
