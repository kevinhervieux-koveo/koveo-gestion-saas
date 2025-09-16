-- =====================================================================
-- PRODUCTION UPDATE SCRIPT 1/4: Extensions Setup
-- =====================================================================
-- Purpose: Install required PostgreSQL extensions
-- Run order: 1st (before all other scripts)
-- Safety: Idempotent - safe to run multiple times
-- =====================================================================

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify extension installation
SELECT 'EXTENSIONS INSTALLED:' as status;
SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto') ORDER BY extname;

SELECT 'Extensions setup completed successfully!' as result;