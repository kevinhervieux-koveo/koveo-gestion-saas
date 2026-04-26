-- 0015_fix_last_inspection_date.sql
--
-- Repair building_elements.last_inspection_date rows that were corrupted by the
-- unconditional-overwrite bug fixed in task #971.  Sets each element's
-- last_inspection_date to MAX(event_date) over its inspection-type
-- element_history rows (event_type IN ('repair','minor_rehab')), or NULL when
-- no such rows exist.
--
-- Idempotent: re-running leaves data in the same correct state.

-- Entire migration is conditional on building_elements existing in this DB state.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'building_elements'
  ) THEN
    RETURN;
  END IF;

  -- Advance (or correct) last_inspection_date to the true maximum.
  UPDATE building_elements AS be
  SET    last_inspection_date = subq.max_event_date
  FROM   (
      SELECT element_id, MAX(event_date) AS max_event_date
      FROM   element_history
      WHERE  event_type IN ('repair', 'minor_rehab')
      GROUP  BY element_id
  ) AS subq
  WHERE  be.id = subq.element_id
    AND  be.last_inspection_date IS DISTINCT FROM subq.max_event_date;

  -- NULL out last_inspection_date for elements whose inspection history rows
  -- were deleted after the date was originally set.
  UPDATE building_elements AS be
  SET    last_inspection_date = NULL
  WHERE  be.last_inspection_date IS NOT NULL
    AND  NOT EXISTS (
          SELECT 1
          FROM   element_history eh
          WHERE  eh.element_id = be.id
            AND  eh.event_type IN ('repair', 'minor_rehab')
         );
END $$;
