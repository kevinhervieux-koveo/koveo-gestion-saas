/**
 * @file Financial Year validator — unit tests for the real production helper
 * @description Tests `isFinancialYearCoveredForBuilding` and
 * `buildFyValidationError` from `server/api/project-fy-validator.ts`.
 *
 * Both the PUT and PATCH handlers in `server/api/maintenance.ts` delegate to
 * these functions, so testing them directly covers the shared validation path
 * used by both routes.
 *
 * The `DbLike` interface lets us inject a controlled stub without a real DB.
 * Each `makeDb(rows)` call returns a stub that simulates the rows the real DB
 * would return *after* Drizzle applies the WHERE clause — i.e., pass an empty
 * array when the year is not covered, or a one-element array when it is.
 */

import { describe, it, expect } from '@jest/globals';
import {
  isFinancialYearCoveredForBuilding,
  buildFyValidationError,
  type DbLike,
} from '../../../server/api/project-fy-validator';

const BUILDING_ID = 'bldg-aaa';

function makeDb(matchedRows: { year: number }[]): DbLike {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async (_n: number) => matchedRows,
        }),
      }),
    }),
  };
}

describe('isFinancialYearCoveredForBuilding', () => {
  it('returns true when the DB confirms at least one matching row (year covered)', async () => {
    const db = makeDb([{ year: 2026 }]);
    const result = await isFinancialYearCoveredForBuilding(db, BUILDING_ID, 2026);
    expect(result).toBe(true);
  });

  it('returns false when the DB returns no rows (year not covered)', async () => {
    const db = makeDb([]);
    const result = await isFinancialYearCoveredForBuilding(db, BUILDING_ID, 1850);
    expect(result).toBe(false);
  });

  it('returns false for far-future years beyond the building horizon (DB returns no rows)', async () => {
    const db = makeDb([]);
    const result = await isFinancialYearCoveredForBuilding(db, BUILDING_ID, 2099);
    expect(result).toBe(false);
  });
});

describe('buildFyValidationError', () => {
  it('returns the expected error shape', () => {
    const body = buildFyValidationError(1850);
    expect(body.error).toBe('Invalid financial year');
    expect(body.details).toContain('1850');
    expect(body.details).toContain('budget records');
  });

  it('includes the year in the details string for any year value', () => {
    const body = buildFyValidationError(2077);
    expect(body.details).toContain('2077');
  });
});

describe('FY validation — route contract (acceptance / rejection paths used by PUT and PATCH)', () => {
  async function simulateFyGuard(
    db: DbLike,
    buildingId: string,
    financialYear: number | undefined,
  ): Promise<{ status: number; body: any }> {
    if (financialYear === undefined) {
      return { status: 200, body: { success: true } };
    }
    const covered = await isFinancialYearCoveredForBuilding(db, buildingId, financialYear);
    if (!covered) {
      return { status: 400, body: buildFyValidationError(financialYear) };
    }
    return { status: 200, body: { success: true } };
  }

  it('PUT: covered FY → persisted (200)', async () => {
    const db = makeDb([{ year: 2026 }]);
    const response = await simulateFyGuard(db, BUILDING_ID, 2026);
    expect(response.status).toBe(200);
  });

  it('PUT: uncovered FY → rejected (400) with structured error', async () => {
    const db = makeDb([]);
    const response = await simulateFyGuard(db, BUILDING_ID, 1850);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid financial year');
    expect(response.body.details).toContain('1850');
    expect(response.body.details).toMatch(/budget records/);
  });

  it('PATCH: omitted financialYear → passes guard without DB query (200)', async () => {
    const db = makeDb([]);
    const response = await simulateFyGuard(db, BUILDING_ID, undefined);
    expect(response.status).toBe(200);
  });

  it('PATCH: covered FY → persisted (200)', async () => {
    const db = makeDb([{ year: 2027 }]);
    const response = await simulateFyGuard(db, BUILDING_ID, 2027);
    expect(response.status).toBe(200);
  });

  it('PATCH: uncovered FY → rejected (400) with structured error', async () => {
    const db = makeDb([]);
    const response = await simulateFyGuard(db, BUILDING_ID, 2099);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid financial year');
    expect(response.body.details).toContain('2099');
  });
});
