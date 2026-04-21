import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Task #144 — single source of truth for "is this tenancy current?"
 *
 * The `userResidences` table has historically had two overlapping fields
 * that could express the end of a tenancy: the `isActive` boolean and
 * the `endDate` column. The documented rule (see
 * `shared/schemas/property.ts` table-level docstring) is:
 *
 *   - `isActive` is the canonical flag consulted by all read paths.
 *   - `endDate` is informational only and MUST NOT be used as a
 *     filter to decide whether a tenancy is current.
 *   - End-residency writes MUST either hard-delete the row OR set
 *     `isActive: false` AND `endDate: today` together.
 *
 * The pure helpers below encode that rule and are exercised by the
 * matrix tests, so any future regression of the schema-level
 * documentation or write-path consistency surfaces as a failed test.
 */

type UserResidence = {
  isActive: boolean;
  endDate: string | null;
};

/** Reads consult ONLY `isActive` per the documented rule. */
function isCurrentTenancy(link: UserResidence): boolean {
  return link.isActive === true;
}

/**
 * Validates a "soft-end residency" payload against the write contract.
 * Returns a list of contract violations (empty list = compliant).
 */
function validateEndResidencyWrite(
  payload: Partial<UserResidence> & { updatedAt?: Date }
): string[] {
  const violations: string[] = [];
  if (payload.isActive !== false) {
    violations.push('isActive must be set to false when ending a residency');
  }
  if (!payload.endDate) {
    violations.push('endDate must be set when soft-ending a residency');
  }
  if (!payload.updatedAt) {
    violations.push('updatedAt must be bumped when soft-ending a residency');
  }
  return violations;
}

describe('userResidences "current tenancy" rule (Task #144)', () => {
  it('isActive=true, no endDate → current', () => {
    expect(isCurrentTenancy({ isActive: true, endDate: null })).toBe(true);
  });

  it('isActive=true with a past endDate → still current (endDate is informational only)', () => {
    expect(isCurrentTenancy({ isActive: true, endDate: '2020-01-01' })).toBe(true);
  });

  it('isActive=true with a future endDate → still current', () => {
    expect(isCurrentTenancy({ isActive: true, endDate: '2099-12-31' })).toBe(true);
  });

  it('isActive=false, no endDate → ended (regression: legacy rows missing endDate)', () => {
    expect(isCurrentTenancy({ isActive: false, endDate: null })).toBe(false);
  });

  it('isActive=false with endDate → ended', () => {
    expect(isCurrentTenancy({ isActive: false, endDate: '2024-06-30' })).toBe(false);
  });
});

describe('userResidences end-residency write contract (Task #144)', () => {
  it('compliant payload (isActive=false + endDate + updatedAt) passes', () => {
    expect(
      validateEndResidencyWrite({
        isActive: false,
        endDate: '2026-04-19',
        updatedAt: new Date(),
      })
    ).toEqual([]);
  });

  it('missing endDate is a violation', () => {
    const v = validateEndResidencyWrite({ isActive: false, updatedAt: new Date() });
    expect(v).toContain('endDate must be set when soft-ending a residency');
  });

  it('forgetting to flip isActive is a violation', () => {
    const v = validateEndResidencyWrite({
      endDate: '2026-04-19',
      updatedAt: new Date(),
    });
    expect(v).toContain('isActive must be set to false when ending a residency');
  });

  it('missing updatedAt bump is a violation', () => {
    const v = validateEndResidencyWrite({ isActive: false, endDate: '2026-04-19' });
    expect(v).toContain('updatedAt must be bumped when soft-ending a residency');
  });
});

describe('userResidences write-contract source-level audit (Task #144)', () => {
  /**
   * Spot-checks that the three known production write paths that
   * soft-end user-residence links now set `endDate` alongside
   * `isActive: false`. This is a static guard — it reads the source
   * files and asserts the contract is encoded there, so accidentally
   * dropping the `endDate` clause in a future refactor breaks this
   * test.
   */
  const writeSites = [
    {
      file: 'server/api/buildings.ts',
      anchor: '// 3. Soft delete user-residence relationships.',
    },
    {
      file: 'server/api/buildings/operations.ts',
      anchor: '// Soft delete user-residence relationships.',
    },
    {
      file: 'server/api/buildings/operations.ts',
      anchor: '// 3. Soft delete user-residence relationships.',
    },
    {
      file: 'server/api/organizations.ts',
      anchor: '// 2b. Soft-end user-residence links',
    },
  ];

  /**
   * Spot-checks for read-path enforcement. Each entry asserts that a
   * named code window contains the canonical
   * `eq(...userResidences.isActive, true)` filter (or its `schema.`
   * variant), so a future refactor that quietly drops the filter
   * (and re-introduces stale-link access) breaks this test.
   */
  const readSites = [
    {
      file: 'server/api/demands.ts',
      anchor: '// Task #144: only currently-active residency links',
      pattern: /eq\(userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/optimized-db-storage.ts',
      anchor: '// Residents can only access documents from their own residences',
      pattern: /eq\(schema\.userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/optimized-db-storage.ts',
      anchor: '// Tenants can also create/access documents in their own residence',
      pattern: /eq\(schema\.userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/optimized-db-storage.ts',
      anchor: '// Residents can only see documents from their own residences',
      pattern: /eq\(schema\.userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/mcp/server.ts',
      anchor: '// Tenant scope guard: a tenant may only read a residence',
      pattern: /eq\(schema\.userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/mcp/server.ts',
      anchor: '// Tenant scope guard: a tenant may only create maintenance requests',
      pattern: /eq\(schema\.userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/mcp/server.ts',
      anchor: '// Tenant scope guard: when a tenant supplies a residenceId',
      pattern: /eq\(schema\.userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/mcp/server.ts',
      anchor: '// Per the canonical "current tenancy" rule on `userResidences`',
      pattern: /eq\(schema\.userResidences\.isActive,\s*true\)/,
    },
    {
      file: 'server/api/residences.ts',
      anchor: '// Check if user has access to this residence\'s organization.',
      pattern: /eq\(userResidences\.isActive,\s*true\)/,
    },
  ];

  it('schema doc declares the rule has no exceptions', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'shared/schemas/property.ts'),
      'utf8'
    );
    expect(src).toMatch(/There are no exceptions/);
    // Guard against regressing back to the old "MCP exception" wording.
    expect(src).not.toMatch(/deliberately omits this filter/);
  });

  for (const { file, anchor, pattern } of readSites) {
    it(`${file} (${anchor}) filters reads on isActive=true`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const idx = src.indexOf(anchor);
      expect(idx).toBeGreaterThan(-1);
      const window = src.slice(idx, idx + 1200);
      expect(window).toMatch(pattern);
    });
  }

  for (const { file, anchor } of writeSites) {
    it(`${file} (${anchor}) sets isActive:false AND endDate, scoped to currently-active rows`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const idx = src.indexOf(anchor);
      expect(idx).toBeGreaterThan(-1);
      // Examine ~30 lines after the anchor
      const window = src.slice(idx, idx + 1200);
      expect(window).toMatch(/isActive:\s*false/);
      expect(window).toMatch(/endDate:/);
      // Must restrict the UPDATE to currently-active rows so we never
      // overwrite the historical `endDate` of already-ended links.
      expect(window).toMatch(/eq\(userResidences\.isActive,\s*true\)/);
    });
  }
});
