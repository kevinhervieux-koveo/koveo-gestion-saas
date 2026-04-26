/**
 * Task #1040 — short-lived per-process cache wrapped around
 * `getFiscalYearStartMonthForBuilding`.
 *
 * The bulk-import flow calls the helper from three places (run-all loop,
 * per-item retry endpoint, commit endpoint) and the per-item paths used
 * to re-query `buildings` on every request. The cache keeps the second
 * (and subsequent) calls within a request burst from hitting Postgres,
 * while a short TTL keeps the value correct against the (rare) admin
 * edits to `financialYearStart`.
 *
 * These tests pin the cache contract directly:
 *   - first call hits the DB; immediate repeat is served from cache
 *   - different building ids are cached independently
 *   - undefined / missing rows are cached too (so retries don't re-query
 *     a building that simply has no fiscal-year-start)
 *   - manual reset (`__resetFiscalYearStartMonthCacheForTests`) forces a
 *     fresh DB lookup, mirroring the TTL-expiry behaviour
 *   - a TTL-expired entry triggers another DB read
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

type BuildingRow = { financialYearStart: string | null };

const buildingStore = new Map<string, BuildingRow>();
const selectSpy = jest.fn();

function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn((cond: any) => {
        const id = condValue(cond) as string | undefined;
        selectSpy(id);
        const row = id ? buildingStore.get(id) : undefined;
        return Promise.resolve(row ? [row] : []);
      }),
    })),
  })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    suggestBranch: jest.fn(),
    screen: jest.fn(),
    suggestMergeOrSplit: jest.fn(),
    identify: jest.fn(),
    suggestLinks: jest.fn(),
  },
  isBulkImportAiAvailable: () => true,
  BRANCH_SUB_CATEGORIES: {
    building_documents: ['other'],
    residence_documents: ['lease', 'other'],
    bill: ['other'],
    demand: ['other'],
    maintenance: ['other'],
    other: ['other'],
  },
}));

jest.mock('../../../server/services/bulk-import-rotation', () => ({
  rotateAndRewriteStagedFile: jest.fn(),
}));

jest.mock('../../../server/services/document-service', () => ({
  documentService: {},
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

import {
  getFiscalYearStartMonthForBuilding,
  __resetFiscalYearStartMonthCacheForTests,
  FISCAL_YEAR_START_MONTH_CACHE_TTL_MS,
} from '../../../server/api/bulk-import';

beforeEach(() => {
  buildingStore.clear();
  selectSpy.mockClear();
  __resetFiscalYearStartMonthCacheForTests();
});

describe('getFiscalYearStartMonthForBuilding cache (Task #1040)', () => {
  it('returns undefined and does not query the DB for a falsy building id', async () => {
    expect(await getFiscalYearStartMonthForBuilding(null)).toBeUndefined();
    expect(await getFiscalYearStartMonthForBuilding(undefined)).toBeUndefined();
    expect(await getFiscalYearStartMonthForBuilding('')).toBeUndefined();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('hits the DB on first call and serves repeats from cache', async () => {
    buildingStore.set('b-april', { financialYearStart: '2024-04-01' });

    const first = await getFiscalYearStartMonthForBuilding('b-april');
    const second = await getFiscalYearStartMonthForBuilding('b-april');
    const third = await getFiscalYearStartMonthForBuilding('b-april');

    expect(first).toBe(4);
    expect(second).toBe(4);
    expect(third).toBe(4);
    // Only the first call should have reached the DB.
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledWith('b-april');
  });

  it('caches each building id independently', async () => {
    buildingStore.set('b-april', { financialYearStart: '2024-04-01' });
    buildingStore.set('b-july', { financialYearStart: '2024-07-01' });

    expect(await getFiscalYearStartMonthForBuilding('b-april')).toBe(4);
    expect(await getFiscalYearStartMonthForBuilding('b-july')).toBe(7);
    expect(await getFiscalYearStartMonthForBuilding('b-april')).toBe(4);
    expect(await getFiscalYearStartMonthForBuilding('b-july')).toBe(7);

    // One query per distinct building id, repeats reuse the cache.
    expect(selectSpy).toHaveBeenCalledTimes(2);
  });

  it('caches undefined results so retries on a building without a fiscal-year-start do not re-query', async () => {
    // Building exists but has no parseable financialYearStart — the
    // helper returns undefined and the parser falls back to Jan.
    buildingStore.set('b-empty', { financialYearStart: null });

    const first = await getFiscalYearStartMonthForBuilding('b-empty');
    const second = await getFiscalYearStartMonthForBuilding('b-empty');

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it('caches undefined results when the building row is missing entirely', async () => {
    // No row in buildingStore for "b-missing".
    const first = await getFiscalYearStartMonthForBuilding('b-missing');
    const second = await getFiscalYearStartMonthForBuilding('b-missing');

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it('manual reset forces the next call back to the DB', async () => {
    buildingStore.set('b-april', { financialYearStart: '2024-04-01' });

    expect(await getFiscalYearStartMonthForBuilding('b-april')).toBe(4);
    expect(selectSpy).toHaveBeenCalledTimes(1);

    __resetFiscalYearStartMonthCacheForTests();

    // Update the underlying row to verify the next call truly re-reads.
    buildingStore.set('b-april', { financialYearStart: '2024-09-01' });
    expect(await getFiscalYearStartMonthForBuilding('b-april')).toBe(9);
    expect(selectSpy).toHaveBeenCalledTimes(2);
  });

  it('expires entries after the TTL and re-queries the DB', async () => {
    buildingStore.set('b-april', { financialYearStart: '2024-04-01' });

    const realNow = Date.now;
    let fakeNow = 1_700_000_000_000;
    Date.now = () => fakeNow;
    try {
      expect(await getFiscalYearStartMonthForBuilding('b-april')).toBe(4);
      expect(selectSpy).toHaveBeenCalledTimes(1);

      // Still within the TTL window — second call hits cache.
      fakeNow += FISCAL_YEAR_START_MONTH_CACHE_TTL_MS - 1;
      expect(await getFiscalYearStartMonthForBuilding('b-april')).toBe(4);
      expect(selectSpy).toHaveBeenCalledTimes(1);

      // Past the TTL — third call must re-query.
      fakeNow += 2;
      buildingStore.set('b-april', { financialYearStart: '2024-09-01' });
      expect(await getFiscalYearStartMonthForBuilding('b-april')).toBe(9);
      expect(selectSpy).toHaveBeenCalledTimes(2);
    } finally {
      Date.now = realNow;
    }
  });
});
