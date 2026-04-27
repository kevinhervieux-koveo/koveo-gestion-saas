/**
 * @file Numeric guards on the shared `insertBuildingSchema` /
 *       `insertResidenceSchema` (Task #1342).
 *
 * The MCP server already rejects impossible numeric values
 * (negative unit counts, zero square footage, etc.) at the schema
 * level for `create_building` / `update_building` / `create_residence`
 * / `update_residence` (Task #1308). The matching guards must also
 * exist on the shared Drizzle insert schemas so that REST routes and
 * any other caller that runs `insertBuildingSchema.safeParse(...)` /
 * `insertResidenceSchema.safeParse(...)` rejects the same values.
 *
 * These tests intentionally exercise the *shared* schemas (not the
 * MCP tool input shapes, which are covered separately in
 * `server/tests/mcp-tools.test.ts`) so that drift between the two is
 * caught immediately.
 */

import { describe, it, expect } from '@jest/globals';

import {
  insertBuildingSchema,
  insertResidenceSchema,
} from '@shared/schemas/property';

const buildingBase = {
  organizationId: '00000000-0000-0000-0000-000000000001',
  name: 'Test Building',
  address: '123 Main St',
  city: 'Montreal',
  postalCode: 'H2X1Y4',
  buildingType: 'apartment',
};

const residenceBase = {
  buildingId: '00000000-0000-0000-0000-000000000002',
  unitNumber: '101',
};

describe('insertBuildingSchema numeric guards (Task #1342)', () => {
  it('rejects totalUnits = 0', () => {
    const parsed = insertBuildingSchema.safeParse({ ...buildingBase, totalUnits: 0 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'totalUnits')).toBe(true);
    }
  });

  it('rejects totalUnits < 0', () => {
    const parsed = insertBuildingSchema.safeParse({ ...buildingBase, totalUnits: -5 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'totalUnits')).toBe(true);
    }
  });

  it('accepts totalUnits >= 1', () => {
    const parsed = insertBuildingSchema.safeParse({ ...buildingBase, totalUnits: 1 });
    expect(parsed.success).toBe(true);
  });

  it('rejects totalFloors = 0', () => {
    const parsed = insertBuildingSchema.safeParse({
      ...buildingBase,
      totalUnits: 4,
      totalFloors: 0,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'totalFloors')).toBe(true);
    }
  });

  it('rejects parkingSpaces < 0', () => {
    const parsed = insertBuildingSchema.safeParse({
      ...buildingBase,
      totalUnits: 4,
      parkingSpaces: -1,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'parkingSpaces')).toBe(true);
    }
  });

  it('accepts parkingSpaces = 0', () => {
    const parsed = insertBuildingSchema.safeParse({
      ...buildingBase,
      totalUnits: 4,
      parkingSpaces: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects storageSpaces < 0', () => {
    const parsed = insertBuildingSchema.safeParse({
      ...buildingBase,
      totalUnits: 4,
      storageSpaces: -2,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'storageSpaces')).toBe(true);
    }
  });

  it('accepts storageSpaces = 0', () => {
    const parsed = insertBuildingSchema.safeParse({
      ...buildingBase,
      totalUnits: 4,
      storageSpaces: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it('treats numeric fields as optional when omitted', () => {
    const parsed = insertBuildingSchema.safeParse(buildingBase);
    expect(parsed.success).toBe(true);
  });
});

describe('insertResidenceSchema numeric guards (Task #1342)', () => {
  it('rejects bedrooms < 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, bedrooms: -1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'bedrooms')).toBe(true);
    }
  });

  it('accepts bedrooms = 0 (studio)', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, bedrooms: 0 });
    expect(parsed.success).toBe(true);
  });

  it('rejects bathrooms < 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, bathrooms: -0.5 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'bathrooms')).toBe(true);
    }
  });

  it('accepts bathrooms = 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, bathrooms: 0 });
    expect(parsed.success).toBe(true);
  });

  it('rejects monthlyFees < 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, monthlyFees: -100 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'monthlyFees')).toBe(true);
    }
  });

  it('accepts monthlyFees = 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, monthlyFees: 0 });
    expect(parsed.success).toBe(true);
  });

  it('rejects squareFootage = 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, squareFootage: 0 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'squareFootage')).toBe(true);
    }
  });

  it('rejects squareFootage < 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, squareFootage: -50 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'squareFootage')).toBe(true);
    }
  });

  it('accepts squareFootage > 0', () => {
    const parsed = insertResidenceSchema.safeParse({ ...residenceBase, squareFootage: 75.5 });
    expect(parsed.success).toBe(true);
  });

  it('treats numeric fields as optional when omitted', () => {
    const parsed = insertResidenceSchema.safeParse(residenceBase);
    expect(parsed.success).toBe(true);
  });
});
