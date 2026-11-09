ALTER TABLE "user" ADD COLUMN "last_sign_in_at" timestamp;--> statement-breakpoint
-- Best guess for existing users: their most recent session (sessions are deleted on sign-out, so this can be blank).
UPDATE "user" u SET "last_sign_in_at" = s.last FROM (SELECT "user_id", max("created_at") AS last FROM "session" GROUP BY "user_id") s WHERE s."user_id" = u."id";
