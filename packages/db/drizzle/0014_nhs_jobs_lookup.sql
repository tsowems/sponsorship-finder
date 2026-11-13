-- NHS Jobs support: look up NHS bodies, GP practices and hospices soon, instead of waiting their turn in the
-- background sweep (most have been on the register for years, so they were near the back of the queue).
-- NHS trusts/boards first (priority 6), then GP practices and hospices (4). About 1,700 sponsors.
-- Never-checked ones are queued; already-checked ones are made due for a re-check.
INSERT INTO "sponsor_profiles" ("sponsor_id", "status", "priority", "requested_at")
SELECT "id", 'queued',
       CASE WHEN "normalized_name" ~ '\m(nhs|health board|ambulance service)\M' THEN 6 ELSE 4 END,
       now()
FROM "sponsors"
WHERE "status" = 'active'
  AND "normalized_name" ~ '\m(nhs|health board|ambulance service|surgery|medical practice|medical centre|health centre|hospice|primary care network)\M'
ON CONFLICT ("sponsor_id") DO UPDATE
  SET "priority" = greatest("sponsor_profiles"."priority", excluded."priority"),
      "next_check_at" = CASE WHEN "sponsor_profiles"."status" = 'queued' THEN "sponsor_profiles"."next_check_at" ELSE now() END;
