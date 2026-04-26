import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { buildingElements, elementHistory } from '@shared/schema';

/**
 * Inventory inspection date helpers.
 *
 * `building_elements.last_inspection_date` is a derived column: it stores
 * `MAX(element_history.event_date)` over the rows whose `event_type` is
 * considered an "inspection" (currently `repair` and `minor_rehab`). Several
 * write paths — REST POST/PUT/DELETE under `/api/maintenance/...history` and
 * the matching MCP create / update / delete tools — must keep this column in
 * sync. To avoid drift between those six call sites, the recompute logic and
 * the source-of-truth event-type list live here.
 *
 * Adding a new inspection event type only requires updating
 * `INSPECTION_EVENT_TYPES`; every consumer that imports it (or calls one of
 * the helpers below) picks up the change automatically.
 */

export const INSPECTION_EVENT_TYPES = ['repair', 'minor_rehab'] as const;
export type InspectionEventType = (typeof INSPECTION_EVENT_TYPES)[number];

/** A Drizzle DB handle or a `db.transaction` `tx` handle — they share a query shape. */
type DbOrTx = typeof db;

/** Returns true when the given event type contributes to `lastInspectionDate`. */
export function isInspectionEventType(eventType: string): eventType is InspectionEventType {
  return (INSPECTION_EVENT_TYPES as readonly string[]).includes(eventType);
}

/**
 * Forward-only advance for the create path.
 *
 * Sets `building_elements.last_inspection_date = eventDate` only when the
 * stored value is NULL or strictly older than `eventDate`. Implemented via a
 * WHERE-clause guard so the check happens atomically inside Postgres and a
 * backdated insert cannot clobber a later inspection date already recorded
 * for the element.
 *
 * `eventDate` is a `YYYY-MM-DD` string, matching the storage shape of
 * `element_history.event_date`.
 */
export async function advanceLastInspectionDateForward(
  executor: DbOrTx,
  elementId: string,
  eventDate: string,
): Promise<void> {
  await executor
    .update(buildingElements)
    .set({
      lastInspectionDate: eventDate,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(buildingElements.id, elementId),
        or(
          isNull(buildingElements.lastInspectionDate),
          sql`${buildingElements.lastInspectionDate} < ${eventDate}::date`,
        ),
      ),
    );
}

/**
 * Recompute `lastInspectionDate` from the current state of `element_history`.
 *
 * Uses `MAX(event_date)` over the inspection-type rows for the element. When
 * no inspection events remain the subquery returns NULL, which correctly
 * clears the column. Used by every update / delete path so edits or removals
 * of inspection events stay accurate.
 */
export async function recomputeLastInspectionDate(
  executor: DbOrTx,
  elementId: string,
): Promise<void> {
  // The IN-list is built from `INSPECTION_EVENT_TYPES` via drizzle's
  // `inArray`, so adding a new inspection event type only requires updating
  // that constant — no SQL edit needed here.
  await executor
    .update(buildingElements)
    .set({
      lastInspectionDate: sql`(SELECT MAX(${elementHistory.eventDate}) FROM ${elementHistory} WHERE ${elementHistory.elementId} = ${elementId} AND ${inArray(elementHistory.eventType, [...INSPECTION_EVENT_TYPES])})`,
      updatedAt: new Date(),
    })
    .where(eq(buildingElements.id, elementId));
}
