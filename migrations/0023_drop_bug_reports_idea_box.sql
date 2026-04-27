-- Drop legacy bug_reports and idea_box tables that are no longer part of the
-- application schema.  These tables were created during an earlier iteration of
-- the product and have not been referenced by any application code for several
-- releases.  Using DROP TABLE IF EXISTS keeps the migration idempotent: it is
-- safe to apply even if the tables never existed in a given environment.

DROP TABLE IF EXISTS "bug_reports";
DROP TABLE IF EXISTS "idea_box";
