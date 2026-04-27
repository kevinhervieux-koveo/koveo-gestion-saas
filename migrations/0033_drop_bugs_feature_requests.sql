-- Drop legacy bugs, feature_requests, and feature_request_upvotes tables.
-- These tables were part of an internal feedback system that has been
-- superseded by external tooling and are no longer referenced by any
-- application code.  feature_request_upvotes must be dropped first because
-- it holds a FK pointing at feature_requests.

DROP TABLE IF EXISTS "feature_request_upvotes";
DROP TABLE IF EXISTS "feature_requests";
DROP TABLE IF EXISTS "bugs";

-- Drop the enum types that were exclusively used by the removed tables.
DROP TYPE IF EXISTS "bug_category";
DROP TYPE IF EXISTS "bug_priority";
DROP TYPE IF EXISTS "bug_status";
DROP TYPE IF EXISTS "feature_request_category";
DROP TYPE IF EXISTS "feature_request_status";
