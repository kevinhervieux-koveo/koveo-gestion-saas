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
 * Returns a standard MCP refusal when `tag.isSystem === true` (delete path).
 * Role-agnostic: `super_admin` is treated the same as every other role.
 */
export function refuseIfKoveoSystemTag(tag: {
  isSystem: boolean;
}): McpRefusalResponse | null {
  if (tag.isSystem) {
    return {
      content: [{ type: 'text' as const, text: 'System tags cannot be deleted' }],
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
  if (tag.isSystem) {
    return {
      content: [{ type: 'text' as const, text: 'System tags cannot be modified' }],
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
