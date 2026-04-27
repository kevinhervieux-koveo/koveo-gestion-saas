/**
 * Shared guards for Koveo system entities that must never be deleted (or
 * mutated in a destructive way) via MCP, regardless of the caller's role —
 * including `super_admin`.
 *
 * Rows where `isSystem = true` (and typically `organizationId = null`) are
 * seeded by Koveo and are part of the product's core data model. Deleting
 * them would silently break every organization that relies on them.
 *
 * Usage: call the guard after fetching the entity row and before performing
 * any destructive operation. If the guard returns a non-null value, return
 * that value immediately — do not proceed with the deletion.
 *
 *   const refusal = refuseIfKoveoSystemTag(tag);
 *   if (refusal) return refusal;
 *   // … safe to delete …
 */

type McpTextContent = { type: 'text'; text: string };
export type McpRefusalResponse = { content: [McpTextContent] };

/**
 * Single source of truth for the user-facing refusal message returned when a
 * caller tries to delete a Koveo system tag. Shared between the MCP guard and
 * the REST `DELETE /api/document-tags/:id` handler so both surfaces speak with
 * one voice (Task #1431).
 */
export const SYSTEM_TAG_DELETE_REFUSAL_MESSAGE = 'System tags cannot be deleted';

/**
 * Single source of truth for the refusal message returned when a caller tries
 * to mutate a Koveo system tag.
 */
export const SYSTEM_TAG_UPDATE_REFUSAL_MESSAGE = 'System tags cannot be modified';

/**
 * Role-agnostic predicate: returns true if `tag` is a Koveo-seeded system tag
 * that must never be deleted or mutated, regardless of the caller's role
 * (including `super_admin` and `admin`). Use this from any surface — MCP,
 * REST, internal scripts — to keep the invariant consistent.
 */
export function isKoveoSystemTag(tag: { isSystem: boolean }): boolean {
  return tag.isSystem === true;
}

/**
 * Returns a standard MCP refusal when `tag.isSystem === true` (delete path).
 * Role-agnostic: `super_admin` is treated the same as every other role.
 */
export function refuseIfKoveoSystemTag(tag: {
  isSystem: boolean;
}): McpRefusalResponse | null {
  if (isKoveoSystemTag(tag)) {
    return {
      content: [{ type: 'text' as const, text: SYSTEM_TAG_DELETE_REFUSAL_MESSAGE }],
    };
  }
  return null;
}

/**
 * Returns a standard MCP refusal when `tag.isSystem === true` (update/modify path).
 * Role-agnostic: `super_admin` is treated the same as every other role.
 */
export function refuseIfKoveoSystemTagUpdate(tag: {
  isSystem: boolean;
}): McpRefusalResponse | null {
  if (isKoveoSystemTag(tag)) {
    return {
      content: [{ type: 'text' as const, text: SYSTEM_TAG_UPDATE_REFUSAL_MESSAGE }],
    };
  }
  return null;
}

/**
 * Returns a standard MCP refusal when `family.isSystem === true`.
 * Role-agnostic: `super_admin` is treated the same as every other role.
 */
export function refuseIfKoveoSystemLinkFamily(family: {
  isSystem: boolean;
}): McpRefusalResponse | null {
  if (family.isSystem) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'System document link families cannot be deleted',
        },
      ],
    };
  }
  return null;
}
