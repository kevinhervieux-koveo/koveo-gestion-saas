-- Migration: 0034_rollback_onboarding_tables.sql
-- Rollback for 0034_onboarding_tables.sql (Task #1572)
--
-- Drops all three onboarding tables and their indexes/triggers.
-- Safe to run multiple times (IF EXISTS guards).
--
-- IMPORTANT: Running this will permanently delete all onboarding tour progress
-- for every user. Back up onboarding_progress before executing in production.

-- Drop in dependency order (progress references nothing external; versions and
-- manifest are standalone).
DROP TABLE IF EXISTS onboarding_progress CASCADE;
DROP TABLE IF EXISTS onboarding_versions CASCADE;
DROP TABLE IF EXISTS onboarding_feature_manifest CASCADE;

-- Drop the enum type created by the forward migration.
-- CASCADE removes any lingering casts/usages defensively (tables are already gone).
DROP TYPE IF EXISTS onboarding_status CASCADE;
