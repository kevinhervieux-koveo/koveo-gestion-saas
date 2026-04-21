/**
 * Task #245 — `buildWriteErrorResponse` must classify a wider range of
 * PostgreSQL SQLSTATEs (check/not-null violations, deadlocks, serialization
 * failures, statement timeouts, connection drops) into a stable structured
 * envelope so MCP callers can branch on `code` / `retryable` without parsing
 * free-form English.
 *
 * Each test asserts:
 *   (a) the envelope `status`, `code`, `retryable`, and `pgCode` fields,
 *   (b) the friendly message contains the action verb and entity label,
 *   (c) NONE of the raw driver fields (`message`, `detail`, `stack`) leak.
 */
import { describe, it, expect, jest } from '@jest/globals';

// `server/mcp/server.ts` transitively imports `server/db.ts` and the full
// Drizzle schema. We're only exercising a pure function here, so stub out
// the heavy modules to keep the test suite fast and side-effect-free.
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({ tool: jest.fn() })),
}));
jest.mock('../../../server/db', () => ({ db: {} }));
jest.mock('@shared/schema', () => ({}));
jest.mock('../../../server/services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({ aiService: {} }));
jest.mock('../../../server/services/email-service', () => ({ emailService: {} }));
jest.mock('../../../server/services/invitation-soft-replace', () => ({
  createInvitationWithSoftReplace: jest.fn(),
  InvitationSoftReplaceRaceLostError: class {},
}));

import { buildWriteErrorResponse } from '../../../server/mcp/server';

interface PgLikeError {
  code: string;
  message: string;
  detail?: string;
  stack?: string;
}

const SECRET_DETAIL =
  'duplicate key value violates unique constraint "users_email_key" for email leak@secret.test password=top-secret api_key=leaked-abc-123';
const SECRET_STACK = 'Error: db blew up\n    at server/db.ts:42 (token=leaked-token-xyz)';

function pg(code: string, message = 'driver error'): PgLikeError {
  return { code, message, detail: SECRET_DETAIL, stack: SECRET_STACK };
}

const SENSITIVE_FRAGMENTS = [
  'leak@secret.test',
  'top-secret',
  'leaked-abc-123',
  'leaked-token-xyz',
  'users_email_key',
  'duplicate key value',
  'server/db.ts:42',
  'driver error',
];

function parseEnvelope(result: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function assertNoLeak(text: string) {
  for (const fragment of SENSITIVE_FRAGMENTS) {
    expect(text.toLowerCase()).not.toContain(fragment.toLowerCase());
  }
}

describe('buildWriteErrorResponse — extended PostgreSQL SQLSTATE catalog', () => {
  describe('permanent (retryable: false) errors', () => {
    it('classifies 23514 check_violation', () => {
      const result = buildWriteErrorResponse(pg('23514'), 'invitation', 'create');
      const env = parseEnvelope(result);
      expect(env).toMatchObject({
        status: 'check_violation',
        code: 'CHECK_VIOLATION',
        retryable: false,
        pgCode: '23514',
      });
      expect(String(env.message)).toContain('create');
      expect(String(env.message)).toContain('invitation');
      assertNoLeak(result.content[0].text);
    });

    it('classifies 23502 not_null_violation', () => {
      const result = buildWriteErrorResponse(pg('23502'), 'document', 'update');
      const env = parseEnvelope(result);
      expect(env).toMatchObject({
        status: 'not_null_violation',
        code: 'NOT_NULL_VIOLATION',
        retryable: false,
        pgCode: '23502',
      });
      expect(String(env.message)).toContain('update');
      expect(String(env.message)).toContain('document');
      assertNoLeak(result.content[0].text);
    });
  });

  describe('retryable (retryable: true) errors', () => {
    it.each([
      ['40001', 'serialization_failure', 'SERIALIZATION_FAILURE'],
      ['40P01', 'deadlock_detected', 'DEADLOCK_DETECTED'],
      ['57014', 'statement_timeout', 'STATEMENT_TIMEOUT'],
      ['08006', 'connection_failure', 'CONNECTION_FAILURE'],
      ['08001', 'connection_failure', 'CONNECTION_FAILURE'],
      ['08003', 'connection_failure', 'CONNECTION_FAILURE'],
      ['08004', 'connection_failure', 'CONNECTION_FAILURE'],
    ])('classifies %s as %s (retryable)', (pgCode, status, envelopeCode) => {
      const result = buildWriteErrorResponse(pg(pgCode), 'bill', 'create');
      const env = parseEnvelope(result);
      expect(env).toMatchObject({
        status,
        code: envelopeCode,
        retryable: true,
        pgCode,
      });
      expect(String(env.message)).toContain('bill');
      assertNoLeak(result.content[0].text);
    });
  });

  describe('action-aware messages', () => {
    it.each(['create', 'update', 'delete'] as const)(
      'mentions the %s action verb in the message',
      (action) => {
        const result = buildWriteErrorResponse(pg('40P01'), 'residence', action);
        const env = parseEnvelope(result);
        expect(String(env.message).toLowerCase()).toContain(action);
        assertNoLeak(result.content[0].text);
      },
    );
  });

  describe('regression — existing 23503 / 23505 envelopes still carry retryable: false', () => {
    it('23503 envelope sets retryable: false', () => {
      const result = buildWriteErrorResponse(
        { code: '23503', detail: 'Key (org_id)=(x) is not present in table "organizations".' },
        'building',
        'create',
      );
      const env = parseEnvelope(result);
      expect(env.code).toBe('FK_VIOLATION');
      expect(env.retryable).toBe(false);
    });

    it('23505 envelope sets retryable: false', () => {
      const result = buildWriteErrorResponse({ code: '23505', detail: SECRET_DETAIL }, 'invitation', 'create');
      const env = parseEnvelope(result);
      expect(env.code).toBe('UNIQUE_VIOLATION');
      expect(env.retryable).toBe(false);
      assertNoLeak(result.content[0].text);
    });
  });

  describe('unknown / unmapped errors', () => {
    it('returns the plain-string fallback for unrecognised SQLSTATEs', () => {
      const result = buildWriteErrorResponse(pg('99999'), 'document', 'delete');
      expect(result.content[0].text).toBe('Failed to delete document — please retry');
      assertNoLeak(result.content[0].text);
    });

    it('returns the plain-string fallback for non-pg errors', () => {
      const result = buildWriteErrorResponse(
        new Error('boom: top-secret leaked-token-xyz'),
        'document',
        'create',
      );
      expect(result.content[0].text).toBe('Failed to create document — please retry');
      assertNoLeak(result.content[0].text);
    });

    it('returns the plain-string fallback for null / undefined errors', () => {
      for (const e of [null, undefined]) {
        const result = buildWriteErrorResponse(e, 'bill', 'update');
        expect(result.content[0].text).toBe('Failed to update bill — please retry');
      }
    });
  });
});
