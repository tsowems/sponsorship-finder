-- Website guessing now also tries .org/.org.uk for names with many variants (westhomecare.org):
-- re-check earlier "not found" results on the next enrichment runs.
UPDATE "sponsor_profiles" SET "next_check_at" = now() WHERE "status" = 'not_found';
