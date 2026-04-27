/**
 * Task #1428 — Protect Koveo system tags and link families from MCP deletion.
 *
 * This file covers:
 *   - `delete_document_tag` rejects a Koveo system tag (isSystem = true) for
 *     every caller role: `super_admin`, `admin`, `manager`. Returns the
 *     standard "System tags cannot be deleted" refusal message and leaves the
 *     row in the database.
 *   - `delete_document_tag` returns "Access denied" for the `tenant` role
 *     (before even reaching the system-tag check).
 *   - `delete_document_tag` succeeds for a custom (non-system) tag that
 *     belongs to an organization in the caller's MCP scope.
 *   - Regression: the MCP server does not register a `delete_document_link_family`
 *     tool. The guard `refuseIfKoveoSystemLinkFamily` is verified independently.
 *
 * The guard functions themselves are tested directly to confirm they are
 * role-agnostic (super_admin included) and are the single source of truth.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { z } from 'zod';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));

// ---------------------------------------------------------------------------
// In-memory tag store
// ---------------------------------------------------------------------------

type Tag = {
  id: string;
  isSystem: boolean;
  organizationId: string | null;
  name: string;
};

const tagStore = new Map<string, Tag>();
const deletedTagIds: string[] = [];

function seedTag(id: string, isSystem: boolean, organizationId: string | null = null): Tag {
  const tag: Tag = { id, isSystem, organizationId, name: `Tag ${id}` };
  tagStore.set(id, tag);
  return tag;
}

function condEqValue(cond: any): unknown {
  if (!cond) return undefined;
  if (cond.type === 'condition' && cond.operator === 'eq') return cond.value;
  if ('value' in (cond ?? {})) return cond.value;
  return undefined;
}

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn((_table: any) => ({
      where: jest.fn((cond: any) => {
        const id = condEqValue(cond) as string | undefined;
        const row = id ? tagStore.get(id) : undefined;
        return Promise.resolve(row ? [row] : []);
      }),
    })),
  })),

  delete: jest.fn((_table: any) => ({
    where: jest.fn((cond: any) => {
      const id = condEqValue(cond) as string | undefined;
      if (id && tagStore.has(id)) {
        deletedTagIds.push(id);
        tagStore.delete(id);
      }
      return Promise.resolve();
    }),
  })),

  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([])),
    })),
  })),

  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([])),
      })),
    })),
  })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

// ---------------------------------------------------------------------------
// Mock @shared/schema — minimal shape for document tag operations
// ---------------------------------------------------------------------------

const makeTable = (tableName: string, cols: Record<string, unknown> = {}) => ({
  _: { name: tableName },
  ...cols,
});

jest.mock('@shared/schema', () => ({
  documentTags: makeTable('document_tags', {
    id: { name: 'id', sqlName: 'id' },
    isSystem: { name: 'isSystem', sqlName: 'is_system' },
    organizationId: { name: 'organizationId', sqlName: 'organization_id' },
  }),
  documentTagAssignments: makeTable('document_tag_assignments', {
    documentId: { name: 'documentId', sqlName: 'document_id' },
    tagId: { name: 'tagId', sqlName: 'tag_id' },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers — mock MCP server
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

function makeMockServer() {
  const tools = new Map<string, ToolHandler>();
  const server: any = {
    tool: (
      name: string,
      _description: string,
      _schema: unknown,
      handler: ToolHandler,
    ) => {
      tools.set(name, handler);
    },
  };
  return { server, tools };
}

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import { registerDocumentTagMcpTools } from '../../../server/mcp/document-tag-mcp-tools';
import {
  refuseIfKoveoSystemTag,
  refuseIfKoveoSystemTagUpdate,
  refuseIfKoveoSystemLinkFamily,
} from '../../../server/mcp/system-entity-guards';

const MCP_ORG_ID = 'org-mcp-1';
const roleParam = z.enum(['super_admin', 'admin', 'manager', 'tenant']);

let getHandler: (name: string) => ToolHandler;

beforeEach(() => {
  tagStore.clear();
  deletedTagIds.length = 0;
  jest.clearAllMocks();

  const { server, tools } = makeMockServer();
  registerDocumentTagMcpTools(server, {
    roleParam,
    getMcpOrgIds: async () => [MCP_ORG_ID],
  });

  getHandler = (name: string) => {
    const h = tools.get(name);
    if (!h) throw new Error(`Tool not registered: ${name}`);
    return h;
  };
});

// ---------------------------------------------------------------------------
// Guard unit tests
// ---------------------------------------------------------------------------

describe('refuseIfKoveoSystemTag (guard unit — delete path)', () => {
  it('returns a refusal for isSystem = true', () => {
    const result = refuseIfKoveoSystemTag({ isSystem: true });
    expect(result).not.toBeNull();
    expect(result!.content[0].text).toBe('System tags cannot be deleted');
  });

  it('returns null for isSystem = false', () => {
    expect(refuseIfKoveoSystemTag({ isSystem: false })).toBeNull();
  });
});

describe('refuseIfKoveoSystemTagUpdate (guard unit — update/modify path)', () => {
  it('returns a refusal for isSystem = true', () => {
    const result = refuseIfKoveoSystemTagUpdate({ isSystem: true });
    expect(result).not.toBeNull();
    expect(result!.content[0].text).toBe('System tags cannot be modified');
  });

  it('returns null for isSystem = false', () => {
    expect(refuseIfKoveoSystemTagUpdate({ isSystem: false })).toBeNull();
  });
});

describe('refuseIfKoveoSystemLinkFamily (guard unit)', () => {
  it('returns a refusal for isSystem = true', () => {
    const result = refuseIfKoveoSystemLinkFamily({ isSystem: true });
    expect(result).not.toBeNull();
    expect(result!.content[0].text).toBe(
      'System document link families cannot be deleted',
    );
  });

  it('returns null for isSystem = false', () => {
    expect(refuseIfKoveoSystemLinkFamily({ isSystem: false })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// delete_document_tag — system tag refusal for every role
// ---------------------------------------------------------------------------

describe('delete_document_tag — Koveo system tag refusal', () => {
  const SYSTEM_TAG_ID = 'sys-tag-1';

  beforeEach(() => {
    seedTag(SYSTEM_TAG_ID, true, null);
  });

  for (const role of ['super_admin', 'admin', 'manager'] as const) {
    it(`returns "System tags cannot be deleted" for role=${role}`, async () => {
      const handler = getHandler('delete_document_tag');
      const result = await handler({ role, tagId: SYSTEM_TAG_ID });

      expect(result.content[0].text).toBe('System tags cannot be deleted');
      expect(tagStore.has(SYSTEM_TAG_ID)).toBe(true);
      expect(deletedTagIds).not.toContain(SYSTEM_TAG_ID);
    });
  }

  it('returns "Access denied" for role=tenant (before the system-tag check)', async () => {
    const handler = getHandler('delete_document_tag');
    const result = await handler({ role: 'tenant', tagId: SYSTEM_TAG_ID });

    expect(result.content[0].text).toBe('Access denied');
    expect(tagStore.has(SYSTEM_TAG_ID)).toBe(true);
    expect(deletedTagIds).not.toContain(SYSTEM_TAG_ID);
  });

  it('row is still in the database after every refused call', async () => {
    const handler = getHandler('delete_document_tag');
    for (const role of ['super_admin', 'admin', 'manager', 'tenant'] as const) {
      await handler({ role, tagId: SYSTEM_TAG_ID });
    }
    expect(tagStore.has(SYSTEM_TAG_ID)).toBe(true);
    expect(deletedTagIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// delete_document_tag — successful deletion of a custom tag
// ---------------------------------------------------------------------------

describe('delete_document_tag — custom (non-system) tag happy path', () => {
  it('deletes a custom tag in the caller\'s MCP org scope and returns "Deleted"', async () => {
    const CUSTOM_TAG_ID = 'custom-tag-1';
    seedTag(CUSTOM_TAG_ID, false, MCP_ORG_ID);

    const handler = getHandler('delete_document_tag');
    const result = await handler({ role: 'admin', tagId: CUSTOM_TAG_ID });

    expect(result.content[0].text).toBe('Deleted');
    expect(tagStore.has(CUSTOM_TAG_ID)).toBe(false);
    expect(deletedTagIds).toContain(CUSTOM_TAG_ID);
  });

  it('returns "Tag not in MCP scope" for a custom tag in a different org', async () => {
    const OUT_OF_SCOPE_TAG_ID = 'custom-tag-other-org';
    seedTag(OUT_OF_SCOPE_TAG_ID, false, 'org-other');

    const handler = getHandler('delete_document_tag');
    const result = await handler({ role: 'admin', tagId: OUT_OF_SCOPE_TAG_ID });

    expect(result.content[0].text).toBe('Tag not in MCP scope');
    expect(tagStore.has(OUT_OF_SCOPE_TAG_ID)).toBe(true);
  });

  it('returns "Tag not found" when the tagId does not exist', async () => {
    const handler = getHandler('delete_document_tag');
    const result = await handler({ role: 'admin', tagId: 'ghost-tag-id' });

    expect(result.content[0].text).toBe('Tag not found');
  });
});

// ---------------------------------------------------------------------------
// update_document_tag — system tags must never be modified via MCP
// ---------------------------------------------------------------------------

describe('update_document_tag — system tag update refusal (all roles)', () => {
  const SYSTEM_TAG_ID = 'system-tag-for-update';

  beforeEach(() => {
    seedTag(SYSTEM_TAG_ID, true, null);
  });

  for (const role of ['super_admin', 'admin', 'manager'] as const) {
    it(`returns "System tags cannot be modified" for role=${role}`, async () => {
      const handler = getHandler('update_document_tag');
      const result = await handler({ role, tagId: SYSTEM_TAG_ID, label: 'hacked' });

      expect(result.content[0].text).toBe('System tags cannot be modified');
    });
  }

  it('returns "Access denied" for role=tenant (before the system-tag check)', async () => {
    const handler = getHandler('update_document_tag');
    const result = await handler({ role: 'tenant', tagId: SYSTEM_TAG_ID, label: 'hacked' });

    expect(result.content[0].text).toBe('Access denied');
  });
});

// ---------------------------------------------------------------------------
// Regression: no delete_document_link_family MCP tool is registered
// (covers the full MCP server catalog, not just the document-tag module)
// ---------------------------------------------------------------------------

describe('delete_document_link_family — regression guard', () => {
  it('no tool named "delete_document_link_family" is registered by registerDocumentTagMcpTools', () => {
    const { server, tools } = makeMockServer();
    registerDocumentTagMcpTools(server, {
      roleParam,
      getMcpOrgIds: async () => [MCP_ORG_ID],
    });
    expect(tools.has('delete_document_link_family')).toBe(false);
  });

  it('the full MCP server source files do not register a "delete_document_link_family" tool', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../..');

    const mcpSourceFiles = [
      'server/mcp/server.ts',
      'server/mcp/document-tag-mcp-tools.ts',
      'server/mcp/bulk-import-tools.ts',
      'server/mcp/budget-tools.ts',
    ];

    for (const relPath of mcpSourceFiles) {
      const fullPath = path.join(root, relPath);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasDeleteLinkFamilyTool =
        content.includes('"delete_document_link_family"') ||
        content.includes("'delete_document_link_family'");
      expect({ file: relPath, hasDeleteLinkFamilyTool }).toEqual({
        file: relPath,
        hasDeleteLinkFamilyTool: false,
      });
    }
  });
});
