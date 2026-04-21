/**
 * Task #227 — MCP `confirm_document_upload` and `analyze_document` must NOT
 * leak driver-level / third-party error details. When the underlying object
 * storage or AI-service call throws a raw error whose message includes SQL
 * fragments, object keys, or secret query-string params, the tool must catch
 * it and return a short, friendly text instead — while still logging the
 * full error server-side.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
const registeredTools = new Map<string, ToolHandler>();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: (name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      registeredTools.set(name, handler);
    },
  })),
}));

const selectQueue: unknown[][] = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> => Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (onF: any, onR: any) => Promise<unknown> }).then = (onF, onR) =>
    result().then(onF, onR);
  return chain;
}

jest.mock('../../../server/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const { db } = jest.requireMock('../../../server/db') as { db: unknown };
      return cb(db);
    }),
    select: jest.fn(() => makeSelectChain()),
    insert: jest.fn(() => ({
      values: () => ({ returning: () => Promise.resolve([{ id: 'doc-1' }]) }),
    })),
    update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    delete: jest.fn(() => ({ where: () => Promise.resolve() })),
  },
}));

const getObjectEntityFileMock = jest.fn();
const downloadObjectMock = jest.fn();
const setDocumentAclMock = jest.fn();
jest.mock('../../../server/services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({
    normalizePath: (p: string) => p,
    setDocumentAcl: setDocumentAclMock,
  })),
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({
    getObjectEntityFile: getObjectEntityFileMock,
    downloadObject: downloadObjectMock,
  })),
}));

const analyzeDocumentMock = jest.fn();
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {
    analyzeDocument: analyzeDocumentMock,
  },
}));

jest.mock('../../../server/services/email-service', () => ({
  emailService: { sendInvitationEmail: jest.fn().mockResolvedValue(true as never) },
}));

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = 'mcp-org-1';
const BUILDING_ID = 'mcp-building-1';
const SEED_MANAGER_ID = 'seed-mcp-manager-id';

let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  getObjectEntityFileMock.mockReset();
  downloadObjectMock.mockReset();
  setDocumentAclMock.mockReset();
  analyzeDocumentMock.mockReset();
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  createMcpServer(undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('MCP confirm_document_upload — sanitizes error responses (task #227)', () => {
  it('returns generic friendly text and hides SQL/secret substrings when object storage throws a raw driver error', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]); // select building

    const driverError = new Error(
      'GET https://storage.googleapis.com/koveo-secret-bucket/.private/top-secret-object?X-Goog-Signature=leaked-signature-abc123 - 500 Internal Error: pg_query "select * from documents where id = $1" user=koveo_secret_user password=top-secret-password',
    );
    (driverError as Error & { name?: string }).name = 'StorageDriverError';
    getObjectEntityFileMock.mockRejectedValueOnce(driverError);

    const handler = registeredTools.get('confirm_document_upload');
    expect(handler).toBeDefined();
    const result = await handler!({
      role: 'manager',
      storagePath: `/objects/buildings/${BUILDING_ID}/file.pdf`,
      buildingId: BUILDING_ID,
      name: 'Invoice.pdf',
      documentType: 'bills',
    });

    const text = result.content[0].text;
    expect(text).toBe('Failed to verify uploaded file — please retry');

    const SQL_SUBSTRINGS = [
      'koveo-secret-bucket',
      'top-secret-object',
      'X-Goog-Signature',
      'leaked-signature-abc123',
      'pg_query',
      'select * from documents',
      '$1',
      'koveo_secret_user',
      'top-secret-password',
    ];
    for (const leak of SQL_SUBSTRINGS) {
      expect(text).not.toContain(leak);
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedArgs = consoleErrorSpy.mock.calls[0];
    expect(loggedArgs[0]).toContain('[mcp:confirm_document_upload]');
    expect(loggedArgs[loggedArgs.length - 1]).toBe(driverError);
  });

  it('returns generic friendly text when the DB insert throws a pg-style driver error', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]); // select building
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // getMcpUser

    getObjectEntityFileMock.mockResolvedValueOnce({});

    const driverError = new Error(
      'insert into "documents" ("name","building_id","file_path") values ($1,$2,$3) - duplicate key value violates unique constraint "documents_pkey": file=leaked-secret-file.pdf',
    );
    (driverError as Error & { code?: string }).code = '23505';

    const dbModule = jest.requireMock('../../../server/db') as { db: { insert: jest.Mock } };
    dbModule.db.insert.mockImplementationOnce(() => ({
      values: () => ({ returning: () => Promise.reject(driverError) }),
    }));

    const handler = registeredTools.get('confirm_document_upload');
    const result = await handler!({
      role: 'manager',
      storagePath: `/objects/buildings/${BUILDING_ID}/file.pdf`,
      buildingId: BUILDING_ID,
      name: 'Invoice.pdf',
      documentType: 'bills',
    });

    const text = result.content[0].text;
    // Task #243 — write errors now route through buildWriteErrorResponse,
    // which returns a structured JSON envelope for known PostgreSQL
    // error codes (23505 unique_violation here) so the LLM can branch
    // on `status`/`code` rather than string-match a generic fallback.
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.status).toBe('unique_violation');
    expect(parsed.code).toBe('UNIQUE_VIOLATION');
    expect(typeof parsed.message).toBe('string');

    for (const leak of [
      'insert into "documents"',
      'building_id',
      '$1',
      '$2',
      'duplicate key',
      'documents_pkey',
      'leaked-secret-file.pdf',
    ]) {
      expect(text).not.toContain(leak);
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe('MCP analyze_document — sanitizes error responses (task #227)', () => {
  it('returns generic friendly text and hides secrets when the AI/storage pipeline throws a raw driver error', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    // The tool looks up the document — return one so it proceeds into the analyze try-block.
    selectQueue.push([
      {
        id: 'doc-1',
        buildingId: BUILDING_ID,
        organizationId: ORG_ID,
        filePath: `/objects/buildings/${BUILDING_ID}/file.pdf`,
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      },
    ]);
    // Building scope check — return building inside MCP org.
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);

    const driverError = new Error(
      'GEMINI_API call failed: https://generativelanguage.googleapis.com/v1beta/models?key=leaked-gemini-api-key-xyz - 403 pg_query "select * from documents where id = $1" user=koveo_secret_user',
    );
    downloadObjectMock.mockRejectedValueOnce(driverError);
    getObjectEntityFileMock.mockRejectedValueOnce(driverError);
    analyzeDocumentMock.mockRejectedValueOnce(driverError);

    const handler = registeredTools.get('analyze_document');
    expect(handler).toBeDefined();
    const result = await handler!({
      role: 'manager',
      storagePath: `/objects/buildings/${BUILDING_ID}/file.pdf`,
      documentTypeHint: 'bills',
    });

    const text = result.content[0].text;
    expect(text).toBe('Analysis failed — please retry');

    for (const leak of [
      'leaked-gemini-api-key-xyz',
      'GEMINI_API',
      'generativelanguage.googleapis.com',
      'pg_query',
      'select * from documents',
      '$1',
      'koveo_secret_user',
    ]) {
      expect(text).not.toContain(leak);
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedArgs = consoleErrorSpy.mock.calls[0];
    expect(loggedArgs[0]).toContain('[mcp:analyze_document]');
  });
});
