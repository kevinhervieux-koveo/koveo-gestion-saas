
-- Safe quarantine of orphaned document records
-- Generated: 2025-09-16T13:03:06.160Z

-- First, let's see what we're dealing with
SELECT 
  COUNT(*) as total_orphaned_records,
  array_agg(DISTINCT document_type) as document_types
FROM documents 
WHERE file_path NOT LIKE 'uploads/%'
  AND is_quarantined = false;

-- Mark orphaned records as quarantined instead of deleting
UPDATE documents 
SET 
  is_quarantined = true,
  updated_at = CURRENT_TIMESTAMP
WHERE file_path NOT LIKE 'uploads/%'
  AND is_quarantined = false;

-- Verify the update
SELECT 
  COUNT(*) as quarantined_records,
  array_agg(DISTINCT document_type) as quarantined_types
FROM documents 
WHERE is_quarantined = true;
