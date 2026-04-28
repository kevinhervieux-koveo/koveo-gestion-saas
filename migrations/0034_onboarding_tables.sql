-- Onboarding base layer (Task #1572)
-- Forward migration: create onboarding_progress, onboarding_versions, onboarding_feature_manifest

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

CREATE TYPE IF NOT EXISTS "onboarding_status" AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'skipped'
);

CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tour_id"       TEXT NOT NULL,
  "status"        "onboarding_status" NOT NULL DEFAULT 'not_started',
  "current_step"  INTEGER NOT NULL DEFAULT 0,
  "seen_version"  INTEGER NOT NULL DEFAULT 0,
  "completed_at"  TIMESTAMP,
  "started_at"    TIMESTAMP,
  "updated_at"    TIMESTAMP DEFAULT NOW(),
  "created_at"    TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_user_tour_uniq"
  ON "onboarding_progress" ("user_id", "tour_id");

CREATE INDEX IF NOT EXISTS "onboarding_progress_user_tour_idx"
  ON "onboarding_progress" ("user_id", "tour_id");

CREATE INDEX IF NOT EXISTS "onboarding_progress_user_idx"
  ON "onboarding_progress" ("user_id");

CREATE TABLE IF NOT EXISTS "onboarding_versions" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tour_id"       TEXT NOT NULL UNIQUE,
  "version"       INTEGER NOT NULL DEFAULT 1,
  "content_hash"  TEXT,
  "description"   TEXT,
  "published_at"  TIMESTAMP DEFAULT NOW(),
  "created_at"    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "onboarding_versions_tour_id_idx"
  ON "onboarding_versions" ("tour_id");

CREATE TABLE IF NOT EXISTS "onboarding_feature_manifest" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "feature_id"       TEXT NOT NULL UNIQUE,
  "feature_name"     TEXT NOT NULL,
  "section"          TEXT,
  "covered_by_tour"  TEXT,
  "covered_by_step"  INTEGER,
  "anchor_selector"  TEXT,
  "is_required"      BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"       TIMESTAMP DEFAULT NOW(),
  "updated_at"       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "onboarding_feature_manifest_feature_id_idx"
  ON "onboarding_feature_manifest" ("feature_id");

-- Seed the smoke tour version row (idempotent)
INSERT INTO "onboarding_versions" ("tour_id", "version", "description")
VALUES ('onboarding.smoke', 1, 'Smoke tour: dashboard header orientation + help entry')
ON CONFLICT ("tour_id") DO NOTHING;

-- Backfill: users created before this deploy default to 'skipped'
-- so they don't see the tour on next login.
-- New users (created after this migration) will get 'not_started' via API default.
-- We mark the smoke tour as 'skipped' for all pre-existing users.
INSERT INTO "onboarding_progress" ("user_id", "tour_id", "status", "seen_version")
SELECT "id", 'onboarding.smoke', 'skipped', 1
FROM "users"
ON CONFLICT DO NOTHING;

-- ============================================================
-- ROLLBACK (run manually if needed, not executed automatically)
-- ============================================================
-- DROP TABLE IF EXISTS "onboarding_feature_manifest";
-- DROP TABLE IF EXISTS "onboarding_versions";
-- DROP TABLE IF EXISTS "onboarding_progress";
-- DROP TYPE IF EXISTS "onboarding_status";
