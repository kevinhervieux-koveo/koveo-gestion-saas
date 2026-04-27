/**
 * MCP tools for document tags and document tag assignments.
 *
 * Koveo system tags (isSystem = true, organizationId = null) are read-only
 * through MCP: they can be listed and assigned to documents, but they cannot
 * be created, modified, or deleted via any MCP tool regardless of the caller's
 * role — including `super_admin`. The `refuseIfKoveoSystemTag` guard enforces
 * this invariant in one place so it is impossible for a future tool to bypass
 * it by accident.
 *
 * There is intentionally no `delete_document_link_family` MCP tool. If one is
 * ever added it must use `refuseIfKoveoSystemLinkFamily` from
 * `./system-entity-guards` before deleting any row.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';
import { refuseIfKoveoSystemTag, refuseIfKoveoSystemTagUpdate } from './system-entity-guards';

type McpRole = 'super_admin' | 'admin' | 'manager' | 'tenant';

interface DocumentTagMcpToolDeps {
  roleParam: z.ZodTypeAny;
  getMcpOrgIds: () => Promise<string[]>;
}

const textContent = (text: string) => ({
  content: [{ type: 'text' as const, text }],
});

export function registerDocumentTagMcpTools(
  server: McpServer,
  deps: DocumentTagMcpToolDeps,
): void {
  const { roleParam, getMcpOrgIds } = deps;

  server.tool(
    'list_document_tags',
    'List document tags available to the caller (system Koveo tags + tags from caller\'s organizations). Koveo system tags (isSystem = true) are read-only and cannot be deleted or modified via MCP.',
    { role: roleParam },
    async () => {
      const orgIds = await getMcpOrgIds();
      const rows = await db
        .select()
        .from(schema.documentTags)
        .where(
          or(
            eq(schema.documentTags.isSystem, true),
            orgIds.length > 0
              ? inArray(schema.documentTags.organizationId, orgIds)
              : sql`false`,
          ),
        );
      return textContent(JSON.stringify(rows, null, 2));
    },
  );

  server.tool(
    'create_document_tag',
    'Create a custom document tag for an organization (manager/admin). Koveo system tags cannot be created via MCP.',
    {
      role: roleParam,
      organizationId: z.string().describe('Organization ID owning the tag'),
      name: z.string().min(1).describe('Tag name'),
      description: z.string().optional().describe('Description'),
      scope: z.enum(['building', 'residence', 'any']).default('any'),
      importance: z
        .enum(['obligatoire', 'nice_to_have', 'extra'])
        .default('nice_to_have'),
      suggestedProfessionals: z.array(z.string()).default([]),
    },
    async ({
      role,
      organizationId,
      name,
      description,
      scope,
      importance,
      suggestedProfessionals,
    }) => {
      if (role === 'tenant') {
        return textContent('Access denied');
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return textContent('Organization not in MCP scope');
      }
      const [created] = await db
        .insert(schema.documentTags)
        .values({
          organizationId,
          name,
          description: description ?? null,
          scope,
          importance,
          suggestedProfessionals,
          isSystem: false,
          source: organizationId,
        })
        .returning();
      return textContent(JSON.stringify(created, null, 2));
    },
  );

  server.tool(
    'update_document_tag',
    'Update a custom document tag (cannot modify Koveo system tags — isSystem = true — regardless of caller role)',
    {
      role: roleParam,
      tagId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      scope: z.enum(['building', 'residence', 'any']).optional(),
      importance: z
        .enum(['obligatoire', 'nice_to_have', 'extra'])
        .optional(),
      suggestedProfessionals: z.array(z.string()).optional(),
    },
    async ({ role, tagId, ...updates }) => {
      if (role === 'tenant') {
        return textContent('Access denied');
      }
      const [tag] = await db
        .select()
        .from(schema.documentTags)
        .where(eq(schema.documentTags.id, tagId));
      if (!tag) return textContent('Tag not found');

      const updateRefusal = refuseIfKoveoSystemTagUpdate(tag);
      if (updateRefusal) return updateRefusal;

      const orgIds = await getMcpOrgIds();
      if (!tag.organizationId || !orgIds.includes(tag.organizationId)) {
        return textContent('Tag not in MCP scope');
      }
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(updates)) if (v !== undefined) set[k] = v;
      const [updated] = await db
        .update(schema.documentTags)
        .set(set)
        .where(eq(schema.documentTags.id, tagId))
        .returning();
      return textContent(JSON.stringify(updated, null, 2));
    },
  );

  server.tool(
    'delete_document_tag',
    'Delete a custom document tag. Koveo system tags (isSystem = true) cannot be deleted via MCP regardless of caller role, including super_admin. Only custom tags that belong to an organization within the caller\'s MCP scope can be deleted.',
    { role: roleParam, tagId: z.string() },
    async ({ role, tagId }) => {
      if (role === 'tenant') {
        return textContent('Access denied');
      }
      const [tag] = await db
        .select()
        .from(schema.documentTags)
        .where(eq(schema.documentTags.id, tagId));
      if (!tag) return textContent('Tag not found');

      const systemRefusal = refuseIfKoveoSystemTag(tag);
      if (systemRefusal) return systemRefusal;

      const orgIds = await getMcpOrgIds();
      if (!tag.organizationId || !orgIds.includes(tag.organizationId)) {
        return textContent('Tag not in MCP scope');
      }
      await db.delete(schema.documentTags).where(eq(schema.documentTags.id, tagId));
      return textContent('Deleted');
    },
  );

  server.tool(
    'assign_document_tag',
    'Assign a tag to a document',
    { role: roleParam, documentId: z.string(), tagId: z.string() },
    async ({ documentId, tagId }) => {
      try {
        const [created] = await db
          .insert(schema.documentTagAssignments)
          .values({ documentId, tagId })
          .returning();
        return textContent(JSON.stringify(created, null, 2));
      } catch {
        return textContent('Already assigned');
      }
    },
  );

  server.tool(
    'unassign_document_tag',
    'Remove a tag from a document',
    { role: roleParam, documentId: z.string(), tagId: z.string() },
    async ({ documentId, tagId }) => {
      await db
        .delete(schema.documentTagAssignments)
        .where(
          and(
            eq(schema.documentTagAssignments.documentId, documentId),
            eq(schema.documentTagAssignments.tagId, tagId),
          ),
        );
      return textContent('Unassigned');
    },
  );
}
