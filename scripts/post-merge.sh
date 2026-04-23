#!/bin/bash
set -e
npm install

# drizzle-kit push shows an interactive arrow-key prompt when adding a
# unique constraint to a table that already has rows (e.g. the new
# organizations.code constraint from Task #255). It only honours stdin
# when there is a real TTY, so piping newlines does not work.
#
# Strategy: pre-create the new column AND its unique constraint via psql
# (idempotently) BEFORE db:push runs, so drizzle-kit sees them already
# in place and proceeds non-interactively.

PGURL="${DATABASE_URL_KOVEO:-${DATABASE_URL:-}}"
if [ -n "$PGURL" ]; then
  psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS code varchar(8);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_code_unique'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_code_unique UNIQUE (code);
  END IF;
END $$;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS source varchar(8);

-- Shared, database-backed cache for AI-generated suggestions (Task #355).
-- Created idempotently here so the table exists even if drizzle-kit push
-- bails out on an unrelated pre-existing constraint issue.
CREATE TABLE IF NOT EXISTS ai_suggestion_cache (
  cache_key text PRIMARY KEY,
  value json NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_suggestion_cache_expires_idx
  ON ai_suggestion_cache(expires_at);
CREATE INDEX IF NOT EXISTS ai_suggestion_cache_created_idx
  ON ai_suggestion_cache(created_at);
SQL
fi

npm run db:push
