-- 0018_fix_mcp_last_inspection_date.sql
--
-- Recompute building_elements.last_inspection_date for any rows that were
-- regressed by the MCP create_element_history_event bug fixed in task #1130.
-- Before #1130, the MCP path set last_inspection_date = eventDate
-- unconditionally, so a backdated repair/minor_rehab event from chat would
-- silently clobber a newer inspection date.
--
-- Sets each element's last_inspection_date to MAX(event_date) over its
-- inspection-type element_history rows (event_type IN ('repair','minor_rehab')),
-- or NULL when no such rows exist.
--
-- Inspection-type list must stay in lockstep with:
--   server/mcp/server.ts  — create_element_history_event (task #1130)
--   server/api/maintenance.ts — POST /api/maintenance/elements/:id/history
--   migrations/0015_fix_last_inspection_date.sql
--
-- Idempotent: re-running leaves data in the same correct state.

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
