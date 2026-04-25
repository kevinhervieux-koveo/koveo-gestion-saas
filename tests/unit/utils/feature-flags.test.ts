/**
 * Unit tests for `server/utils/feature-flags.ts` — specifically the
 * production-lock behaviour of `isMcpAssumeUserEnabled()` introduced in
 * Task #980.
 *
 * These tests import the REAL helper (no mock) so they exercise the actual
 * env-var + NODE_ENV logic. They restore both env vars after every test case
 * to avoid cross-test pollution.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const ORIG_NODE_ENV = process.env.NODE_ENV;
const ORIG_ASSUME_FLAG = process.env.MCP_ASSUME_USER;

afterEach(() => {
  if (ORIG_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIG_NODE_ENV;
  }
  if (ORIG_ASSUME_FLAG === undefined) {
    delete process.env.MCP_ASSUME_USER;
  } else {
    process.env.MCP_ASSUME_USER = ORIG_ASSUME_FLAG;
  }
  jest.resetModules();
});

async function getFlag(): Promise<boolean> {
  jest.resetModules();
  const { isMcpAssumeUserEnabled } = await import('../../../server/utils/feature-flags');
  return isMcpAssumeUserEnabled();
}

describe('isMcpAssumeUserEnabled() — Task #980 production lock', () => {
  describe('production lock: always returns false when NODE_ENV=production', () => {
    it('returns false when MCP_ASSUME_USER=1 and NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.MCP_ASSUME_USER = '1';
      expect(await getFlag()).toBe(false);
    });

    it('returns false when MCP_ASSUME_USER=true and NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.MCP_ASSUME_USER = 'true';
      expect(await getFlag()).toBe(false);
    });

    it('returns false when MCP_ASSUME_USER=on and NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.MCP_ASSUME_USER = 'on';
      expect(await getFlag()).toBe(false);
    });

    it('returns false when MCP_ASSUME_USER is unset and NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.MCP_ASSUME_USER;
      expect(await getFlag()).toBe(false);
    });
  });

  describe('staging/dev path: respects the env var when NODE_ENV != production', () => {
    it('returns true when MCP_ASSUME_USER=1 and NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.MCP_ASSUME_USER = '1';
      expect(await getFlag()).toBe(true);
    });

    it('returns true when MCP_ASSUME_USER=true and NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.MCP_ASSUME_USER = 'true';
      expect(await getFlag()).toBe(true);
    });

    it('returns false when MCP_ASSUME_USER is unset and NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.MCP_ASSUME_USER;
      expect(await getFlag()).toBe(false);
    });

    it('returns false when MCP_ASSUME_USER=0 and NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.MCP_ASSUME_USER = '0';
      expect(await getFlag()).toBe(false);
    });

    it('returns true when MCP_ASSUME_USER=1 and NODE_ENV=test (non-production)', async () => {
      process.env.NODE_ENV = 'test';
      process.env.MCP_ASSUME_USER = '1';
      expect(await getFlag()).toBe(true);
    });
  });
});
