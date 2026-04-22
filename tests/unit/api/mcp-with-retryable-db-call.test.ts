/**
 * Task #256 — `withRetryableDbCall` retries on the SQLSTATEs flagged
 * `retryable: true` by `buildWriteErrorResponse` and short-circuits on
 * everything else, so transient blips never reach the LLM caller.
 *
 * Each test calls the helper directly with a stub `fn` that throws a
 * pg-style `{ code }` error N times before resolving (or never). We pin
 * `maxAttempts`, `baseDelayMs`, `sleep`, and `random` so the helper is
 * deterministic and never touches a real timer.
 */
import { describe, it, expect, jest } from '@jest/globals';

// `server/mcp/server.ts` transitively imports `server/db.ts`, the full
// Drizzle schema, the document service, the AI service, the email
// service, and the invitation soft-replace helper. We're only exercising
// the pure `withRetryableDbCall` helper here, so stub them all out so
// importing the module is side-effect free.
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
  InvitationAlreadyPendingError: class {},
}));

import {
  withRetryableDbCall,
  RETRYABLE_PG_CODES,
  PG_EXTENDED_ERROR_CATALOG,
} from '../../../server/mcp/server';

function pgError(code: string, message = 'driver error'): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function makeStubFn(failures: Array<unknown>, finalValue: unknown = { ok: true }) {
  const queue = [...failures];
  return jest.fn(async () => {
    if (queue.length > 0) {
      throw queue.shift();
    }
    return finalValue;
  });
}

describe('withRetryableDbCall — retry/no-retry per SQLSTATE (task #256)', () => {
  const RETRYABLE = ['40001', '40P01', '57014', '08006', '08001', '08003', '08004'];
  const NON_RETRYABLE = ['23505', '23503', '23514', '23502', '42P01', '42703'];

  it('exposes the retryable SQLSTATE set in lockstep with PG_EXTENDED_ERROR_CATALOG', () => {
    expect([...RETRYABLE_PG_CODES].sort()).toEqual([...RETRYABLE].sort());
  });

  it('RETRYABLE_PG_CODES matches every catalog entry flagged retryable: true', () => {
    const fromCatalog = Object.entries(PG_EXTENDED_ERROR_CATALOG)
      .filter(([, entry]) => entry.retryable === true)
      .map(([code]) => code)
      .sort();
    expect([...RETRYABLE_PG_CODES].sort()).toEqual(fromCatalog);
    for (const code of fromCatalog) {
      expect(RETRYABLE_PG_CODES.has(code)).toBe(true);
    }
    for (const [code, entry] of Object.entries(PG_EXTENDED_ERROR_CATALOG)) {
      if (!entry.retryable) {
        expect(RETRYABLE_PG_CODES.has(code)).toBe(false);
      }
    }
  });

  for (const code of RETRYABLE) {
    it(`retries transient SQLSTATE ${code} and resolves on the next attempt`, async () => {
      const sleep = jest.fn(async () => undefined);
      const fn = makeStubFn([pgError(code)], { id: 'row-1' });
      const result = await withRetryableDbCall(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        sleep: sleep as unknown as (ms: number) => Promise<void>,
        random: () => 0.5,
      });
      expect(result).toEqual({ id: 'row-1' });
      expect(fn).toHaveBeenCalledTimes(2);
      // One backoff sleep between the two attempts.
      expect(sleep).toHaveBeenCalledTimes(1);
      // attempt 1 backoff = 10 * 2^0 + 0.5 * 10 = 15
      expect(sleep).toHaveBeenCalledWith(15);
    });
  }

  for (const code of NON_RETRYABLE) {
    it(`short-circuits non-retryable SQLSTATE ${code} on the first failure`, async () => {
      const sleep = jest.fn(async () => undefined);
      const err = pgError(code);
      const fn = makeStubFn([err], { id: 'row-1' });
      await expect(
        withRetryableDbCall(fn, {
          maxAttempts: 3,
          baseDelayMs: 10,
          sleep: sleep as unknown as (ms: number) => Promise<void>,
          random: () => 0.5,
        }),
      ).rejects.toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });
  }

  it('also short-circuits errors with no `code` field (e.g. plain JS errors)', async () => {
    const sleep = jest.fn(async () => undefined);
    const err = new Error('boom');
    const fn = makeStubFn([err]);
    await expect(
      withRetryableDbCall(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        sleep: sleep as unknown as (ms: number) => Promise<void>,
        random: () => 0,
      }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('caps retries at maxAttempts and rethrows the final retryable error', async () => {
    const sleep = jest.fn(async () => undefined);
    const finalErr = pgError('40001');
    const fn = jest.fn(async () => {
      throw finalErr;
    });
    await expect(
      withRetryableDbCall(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        sleep: sleep as unknown as (ms: number) => Promise<void>,
        random: () => 0,
      }),
    ).rejects.toBe(finalErr);
    expect(fn).toHaveBeenCalledTimes(3);
    // Two backoff waits between the three attempts (no sleep after the
    // final failure).
    expect(sleep).toHaveBeenCalledTimes(2);
    // attempt 1 -> 10 * 2^0 + 0 = 10; attempt 2 -> 10 * 2^1 + 0 = 20.
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });

  it('uses exponential backoff with jitter between retries', async () => {
    const sleep = jest.fn(async () => undefined);
    const fn = jest.fn(async () => {
      throw pgError('40P01');
    });
    await expect(
      withRetryableDbCall(fn, {
        maxAttempts: 4,
        baseDelayMs: 100,
        sleep: sleep as unknown as (ms: number) => Promise<void>,
        random: () => 0.25,
      }),
    ).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
    // jitter = 0.25 * 100 = 25
    // attempt 1 -> 100 * 1 + 25 = 125
    // attempt 2 -> 100 * 2 + 25 = 225
    // attempt 3 -> 100 * 4 + 25 = 425
    expect(sleep).toHaveBeenNthCalledWith(1, 125);
    expect(sleep).toHaveBeenNthCalledWith(2, 225);
    expect(sleep).toHaveBeenNthCalledWith(3, 425);
  });

  it('does not call sleep when fn succeeds on the first attempt', async () => {
    const sleep = jest.fn(async () => undefined);
    const fn = makeStubFn([], { ok: true });
    const result = await withRetryableDbCall(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      sleep: sleep as unknown as (ms: number) => Promise<void>,
      random: () => 0.5,
    });
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('with maxAttempts=1 never retries, even on a retryable code', async () => {
    const sleep = jest.fn(async () => undefined);
    const err = pgError('40001');
    const fn = makeStubFn([err]);
    await expect(
      withRetryableDbCall(fn, {
        maxAttempts: 1,
        baseDelayMs: 10,
        sleep: sleep as unknown as (ms: number) => Promise<void>,
        random: () => 0,
      }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('switches from retryable to non-retryable mid-flight and rethrows immediately', async () => {
    const sleep = jest.fn(async () => undefined);
    const fatal = pgError('23505');
    const fn = makeStubFn([pgError('40001'), fatal]);
    await expect(
      withRetryableDbCall(fn, {
        maxAttempts: 5,
        baseDelayMs: 10,
        sleep: sleep as unknown as (ms: number) => Promise<void>,
        random: () => 0,
      }),
    ).rejects.toBe(fatal);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
