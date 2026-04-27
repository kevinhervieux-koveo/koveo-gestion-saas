/**
 * Task #1320 — Server-side max-length guard for AI assistant comments.
 *
 * The create_demand_comment MCP tool must reject oversized bodies before they
 * reach the database. Two layers enforce this:
 *
 *   1. The Zod schema registered on the tool (MCP boundary).
 *   2. The inner insertDemandCommentSchema safeParse (defence in depth).
 *
 * Both layers must emit a clear, user-readable error message that references
 * the character limit so callers can surface it without additional decoding.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DEMAND_COMMENT_TEXT_MAX } from '../../../shared/schemas/operations';

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }> }>;

type SchemaField = {
  safeParse: (v: unknown) => {
    success: boolean;
    error?: { issues: Array<{ message: string }> };
  };
};

const registeredTools = new Map<string, ToolHandler>();
const registeredSchemas = new Map<string, Record<string, SchemaField>>();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: (
      name: string,
      _desc: string,
      schema: Record<string, unknown>,
      handler: ToolHandler,
    ) => {
      registeredTools.set(name, handler);
      registeredSchemas.set(name, schema as Record<string, SchemaField>);
    },
  })),
}));

const selectQueue: unknown[][] = [];
const insertCalls: Array<Record<string, unknown>> = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> => Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.leftJoin = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then = (cb) =>
    result().then(cb);
  return chain;
}

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => makeSelectChain()),
    insert: jest.fn(() => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () => {
          insertCalls.push(vals);
          return Promise.resolve([{ id: 'cmt-1', ...vals }]);
        },
      }),
    })),
    update: jest.fn(() => ({
      set: (_vals: Record<string, unknown>) => ({
        where: () => ({ returning: () => Promise.resolve([]) }),
      }),
    })),
  },
}));

jest.mock('../../../server/services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({
    getExistingObjectAcl: jest.fn().mockResolvedValue(null),
    trySetObjectEntityAclPolicy: jest.fn().mockResolvedValue('/objects/test'),
  })),
}));
jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  isBulkImportAiAvailable: () => false,
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {},
}));
jest.mock('../../../server/services/email-service', () => ({
  emailService: { sendInvitationEmail: jest.fn() },
}));
jest.mock('../../../server/services/demand-notification-service', () => ({
  demandNotificationService: {
    notifyDemandEdited: jest.fn().mockResolvedValue(undefined),
    notifyDemandCommented: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = 'aaaaaaaa-0001-4000-8000-000000000001';
const BUILDING_ID = 'bbbbbbbb-0001-4000-8000-000000000002';
const DEMAND_ID = 'cccccccc-0001-4000-8000-000000000003';
const MANAGER_ID = 'dddddddd-0001-4000-8000-000000000004';

function seedForComment() {
  selectQueue.push([{ id: ORG_ID }]);
  selectQueue.push([{ id: DEMAND_ID, buildingId: BUILDING_ID, submitterId: null }]);
  selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
  selectQueue.push([{ id: MANAGER_ID, role: 'manager' }]);
}

beforeEach(() => {
  registeredTools.clear();
  registeredSchemas.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  createMcpServer(undefined);
});

describe('create_demand_comment — oversized comment guard (Task #1320)', () => {
  describe('MCP schema layer (boundary validation)', () => {
    it('the registered schema accepts exactly DEMAND_COMMENT_TEXT_MAX characters', () => {
      const schema = registeredSchemas.get('create_demand_comment');
      expect(schema).toBeDefined();

      const result = schema!.commentText.safeParse('x'.repeat(DEMAND_COMMENT_TEXT_MAX));
      expect(result.success).toBe(true);
    });

    it('the registered schema rejects DEMAND_COMMENT_TEXT_MAX + 1 characters', () => {
      const schema = registeredSchemas.get('create_demand_comment');
      expect(schema).toBeDefined();

      const result = schema!.commentText.safeParse('x'.repeat(DEMAND_COMMENT_TEXT_MAX + 1));
      expect(result.success).toBe(false);
    });

    it('the rejection error message references the character limit clearly', () => {
      const schema = registeredSchemas.get('create_demand_comment');
      expect(schema).toBeDefined();

      const result = schema!.commentText.safeParse('x'.repeat(DEMAND_COMMENT_TEXT_MAX + 1));
      expect(result.error?.issues[0]?.message).toMatch(
        new RegExp(String(DEMAND_COMMENT_TEXT_MAX)),
      );
    });
  });

  describe('handler layer (inner safeParse defence)', () => {
    it('the handler rejects an oversized comment and returns a clear error without inserting', async () => {
      seedForComment();

      const handler = registeredTools.get('create_demand_comment');
      expect(handler).toBeDefined();

      const oversized = 'x'.repeat(DEMAND_COMMENT_TEXT_MAX + 1);
      const result = await handler!({
        role: 'manager',
        demandId: DEMAND_ID,
        commentText: oversized,
      });

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('Invalid comment data');
      expect(text).toMatch(new RegExp(String(DEMAND_COMMENT_TEXT_MAX)));
      expect(insertCalls).toHaveLength(0);
    });

    it('the handler accepts a comment of exactly DEMAND_COMMENT_TEXT_MAX characters', async () => {
      seedForComment();

      const handler = registeredTools.get('create_demand_comment');
      expect(handler).toBeDefined();

      const exactMax = 'x'.repeat(DEMAND_COMMENT_TEXT_MAX);
      const result = await handler!({
        role: 'manager',
        demandId: DEMAND_ID,
        commentText: exactMax,
      });

      expect(result.content[0]?.text).not.toContain('Invalid comment data');
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0].commentText).toBe(exactMax);
    });
  });
});
