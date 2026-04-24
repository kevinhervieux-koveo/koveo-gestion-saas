/**
 * @jest-environment node
 *
 * Real-Postgres integration tests for the MCP `update_building` and
 * `update_residence` tools. The matching mocked-Drizzle tests in
 * `mcp-tools.test.ts` confirm the `.set()` argument shape and the access
 * control branches but cannot catch:
 *
 *   - column-name mismatches (e.g. `monthlyFees` vs the underlying
 *     `monthly_fees` column),
 *   - type-coercion bugs (decimal-string round-tripping, ISO datetime →
 *     timestamp coercion, YYYY-MM-DD → date coercion),
 *   - PATCH semantics regressions (a missing arg leaving the column
 *     untouched in the actual `UPDATE` statement),
 *   - org-scope checks against rows actually persisted to disk.
 *
 * The companion task to the budget MCP integration tests
 * (`Cover the new budget MCP tools with real-Postgres integration tests`)
 * established the expectation that every new MCP write tool gets the same
 * coverage. This file fulfils that expectation for the property-update
 * tools introduced alongside the residence/building edit work.
 *
 * Skipped cleanly when `_INTEGRATION_DB_URL` is not set so unit-tier
 * runs stay green. The `_INTEGRATION_DB_URL` env var is captured from
 * the original `DATABASE_URL` in `jest.polyfills.js` before
 * `jest.setup.simple.ts` overwrites it with a placeholder, mirroring
 * `tests/integration/multi-table-write-rollback.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type * as SchemaImport from '@shared/schema';

// File-level mocks for unrelated services that `createMcpServer` instantiates
// during tool registration. Mirrors `mcp-tools.test.ts` so the property-update
// branch under test is exercised against the real DB while document/storage/AI
// dependencies stay inert and offline.
jest.mock('../services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({
    getDocuments: jest.fn().mockResolvedValue([]),
    getUploadUrl: jest.fn().mockResolvedValue({
      success: true,
      uploadUrl: 'https://example.com/upload',
      filePath: '/objects/test.pdf',
    }),
    confirmUpload: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    normalizePath: jest.fn((p: string) => p),
  })),
}));

jest.mock('../objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../services/consolidated-ai-service', () => ({
  aiService: {
    analyzeDocument: jest.fn().mockResolvedValue({ status: 'pending' }),
    getAnalysisStatus: jest.fn().mockResolvedValue({ status: 'complete' }),
  },
}));

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

type Schema = typeof SchemaImport;
type Db = NeonDatabase<Schema>;

/**
 * Pull a registered tool handler off the server. Mirrors the helper used
 * by the mocked tests in `mcp-tools.test.ts` so the two suites stay
 * symmetrical and easy to read together.
 */
function getToolHandler(server: unknown, toolName: string) {
  const tools = (server as {
    _registeredTools: Record<
      string,
      {
        handler?: (...args: unknown[]) => unknown;
        callback?: (...args: unknown[]) => unknown;
      }
    >;
  })._registeredTools;
  if (!tools || !tools[toolName]) {
    throw new Error(`Tool "${toolName}" not found in registered tools`);
  }
  const tool = tools[toolName];
  const handler = tool.handler || tool.callback;
  if (typeof handler !== 'function') {
    throw new Error(`Tool "${toolName}" handler is not a function`);
  }
  return handler as (
    args: Record<string, unknown>,
    extra?: unknown,
  ) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

function parseToolText(result: {
  content?: Array<{ text?: string }>;
}): string {
  return result?.content?.[0]?.text ?? JSON.stringify(result);
}

describeIfDb('MCP update_building / update_residence — real Postgres', () => {
  // Each test run gets its own suffix so concurrent runs and leftover seed
  // data from other suites cannot collide on the unique `users.email` /
  // `users.username` constraints.
  const runId = randomUUID().slice(0, 8);
  const mcpOrgName = `MCP-1`; // MUST be one of MCP_ORG_NAMES in server.ts
  const otherOrgName = `mcp-update-it-other-${runId}`;

  let db: Db;
  let schema: Schema;
  let server: unknown;

  let mcpOrgId: string;
  let otherOrgId: string;
  let inScopeBuildingId: string;
  let outOfScopeBuildingId: string;
  let inScopeResidenceId: string;
  let outOfScopeResidenceId: string;
  let createdMcpOrgHere = false;
  let createdAdminUserHere = false;
  let createdManagerUserHere = false;
  let createdTenantUserHere = false;

  // The MCP server resolves the acting user by role via these seed
  // accounts. The two mutating tools under test never look these users
  // up themselves (they reject tenants before any DB read and never
  // attribute writes back to a user), but `createMcpServer` registers
  // every tool, and a few of those resolve users at registration-adjacent
  // boundaries. We ensure a baseline set of seed users exists, but only
  // delete the ones we created ourselves.
  const adminEmail = 'mcp-admin@koveo-mcp.test';
  const managerEmail = 'mcp-manager@koveo-mcp.test';
  const tenantEmail = 'mcp-tenant@koveo-mcp.test';

  async function ensureMcpUser(
    email: string,
    role: 'admin' | 'manager' | 'tenant',
  ) {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    if (existing) return { id: existing.id, created: false };
    const username = email.split('@')[0];
    const [inserted] = await db
      .insert(schema.users)
      .values({
        email,
        username,
        password: 'integration-test-disabled',
        firstName: role,
        lastName: 'mcp-it',
        role,
        isActive: true,
      })
      .returning({ id: schema.users.id });
    return { id: inserted.id, created: true };
  }

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    // Restore the real DB URL captured by jest.polyfills.js before
    // jest.setup.simple.ts overwrote it with the placeholder. Done before
    // requiring the db module so the Drizzle pool talks to the real DB.
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../db').db as Db;
    schema = require('@shared/schema') as Schema;

    // Reuse a pre-existing MCP-1 organization if one is already seeded
    // (dev DB, shared CI DB), otherwise create one for the run. We track
    // `createdMcpOrgHere` so cleanup only deletes what we own.
    const [existingMcpOrg] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, mcpOrgName));
    if (existingMcpOrg) {
      mcpOrgId = existingMcpOrg.id;
    } else {
      const [created] = await db
        .insert(schema.organizations)
        .values({
          name: mcpOrgName,
          type: 'demo',
          address: '1 MCP Way',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A1A1',
          isActive: true,
        })
        .returning({ id: schema.organizations.id });
      mcpOrgId = created.id;
      createdMcpOrgHere = true;
    }

    const [otherOrg] = await db
      .insert(schema.organizations)
      .values({
        name: otherOrgName,
        type: 'demo',
        address: '99 Out Of Scope Rd',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'H9Z9Z9',
        isActive: true,
      })
      .returning({ id: schema.organizations.id });
    otherOrgId = otherOrg.id;

    const adminInfo = await ensureMcpUser(adminEmail, 'admin');
    createdAdminUserHere = adminInfo.created;
    const managerInfo = await ensureMcpUser(managerEmail, 'manager');
    createdManagerUserHere = managerInfo.created;
    const tenantInfo = await ensureMcpUser(tenantEmail, 'tenant');
    createdTenantUserHere = tenantInfo.created;

    // In-scope building seeded with values that exercise every coercion
    // path the update tool performs (decimal strings, dates, JSON
    // strings, arrays, ISO timestamps).
    const [inScopeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: mcpOrgId,
        name: `mcp-it-bldg-${runId}`,
        address: '10 Original St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'apartment',
        totalUnits: 12,
        totalFloors: 4,
        parkingSpaces: 6,
        storageSpaces: 6,
        constructionDate: '2010-05-01',
        amenities: ['gym', 'pool'],
        managementCompany: 'Original Mgmt',
        bankAccountNumber: 'ORIG-001',
        bankAccountStartDate: new Date('2024-01-01T00:00:00.000Z'),
        bankAccountStartAmount: '1000.50',
        unplannedBillsAmount: '250.00',
        unplannedBillsStartDate: '2024-01-01',
        financialYearStart: '2024-01-01',
        generalInflationRate: '2.0',
        revenueInflationRate: '2.0',
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    inScopeBuildingId = inScopeBuilding.id;

    const [outOfScopeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: otherOrgId,
        name: `mcp-it-bldg-out-${runId}`,
        address: '999 OOS Ave',
        city: 'Quebec',
        province: 'QC',
        postalCode: 'H9Z9Z9',
        buildingType: 'condo',
        totalUnits: 4,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    outOfScopeBuildingId = outOfScopeBuilding.id;

    const [inScopeResidence] = await db
      .insert(schema.residences)
      .values({
        buildingId: inScopeBuildingId,
        unitNumber: '101',
        floor: 1,
        bedrooms: 2,
        bathrooms: '1.5',
        monthlyFees: '500.00',
        squareFootage: '850.00',
        balcony: false,
        parkingSpaceNumbers: ['P1'],
        storageSpaceNumbers: ['S1'],
        ownershipPercentage: '10.50',
        isActive: true,
      })
      .returning({ id: schema.residences.id });
    inScopeResidenceId = inScopeResidence.id;

    const [outOfScopeResidence] = await db
      .insert(schema.residences)
      .values({
        buildingId: outOfScopeBuildingId,
        unitNumber: 'OOS-1',
        isActive: true,
      })
      .returning({ id: schema.residences.id });
    outOfScopeResidenceId = outOfScopeResidence.id;

    const { createMcpServer } = require('../mcp/server') as {
      createMcpServer: (auth?: unknown) => unknown;
    };
    server = createMcpServer();
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    // Buildings cascade to residences via `onDelete: 'cascade'`, but we
    // delete residences first defensively in case future schema changes
    // tighten that.
    if (inScopeResidenceId) {
      await db
        .delete(schema.residences)
        .where(eq(schema.residences.id, inScopeResidenceId));
    }
    if (outOfScopeResidenceId) {
      await db
        .delete(schema.residences)
        .where(eq(schema.residences.id, outOfScopeResidenceId));
    }
    if (inScopeBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, inScopeBuildingId));
    }
    if (outOfScopeBuildingId) {
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, outOfScopeBuildingId));
    }
    if (otherOrgId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, otherOrgId));
    }
    if (createdMcpOrgHere && mcpOrgId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, mcpOrgId));
    }
    if (createdAdminUserHere) {
      await db.delete(schema.users).where(eq(schema.users.email, adminEmail));
    }
    if (createdManagerUserHere) {
      await db.delete(schema.users).where(eq(schema.users.email, managerEmail));
    }
    if (createdTenantUserHere) {
      await db.delete(schema.users).where(eq(schema.users.email, tenantEmail));
    }
  }, 60000);

  describe('update_building', () => {
    it('partially updates a building and leaves omitted columns untouched', async () => {
      const handler = getToolHandler(server, 'update_building');
      const result = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          name: 'Renamed Building',
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found/i);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed.name).toBe('Renamed Building');

      const [row] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, inScopeBuildingId));
      expect(row).toBeDefined();
      expect(row!.name).toBe('Renamed Building');
      // Untouched columns must round-trip the original values.
      expect(row!.address).toBe('10 Original St');
      expect(row!.city).toBe('Montreal');
      expect(row!.totalUnits).toBe(12);
      expect(row!.totalFloors).toBe(4);
      expect(row!.parkingSpaces).toBe(6);
      expect(row!.amenities).toEqual(['gym', 'pool']);
      expect(row!.bankAccountNumber).toBe('ORIG-001');
      expect(row!.bankAccountStartAmount).toBe('1000.50');
      expect(row!.unplannedBillsAmount).toBe('250.00');
      // The `organizationId` is immutable per the tool description and
      // is never passed through to the `.set(...)` clause.
      expect(row!.organizationId).toBe(mcpOrgId);
    }, 30000);

    it('round-trips numeric, date, and ISO-datetime coercions correctly', async () => {
      const handler = getToolHandler(server, 'update_building');
      const isoStart = '2025-03-15T12:34:56.000Z';
      const result = await handler(
        {
          role: 'admin',
          buildingId: inScopeBuildingId,
          totalUnits: 24,
          totalFloors: 8,
          constructionDate: '2018-07-04',
          financialYearStart: '2025-01-01',
          unplannedBillsStartDate: '2025-02-01',
          bankAccountStartDate: isoStart,
          bankAccountStartAmount: 12345.67,
          unplannedBillsAmount: 78.9,
          generalInflationRate: 3.25,
          revenueInflationRate: 1.5,
          amenities: ['sauna', 'rooftop'],
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|Failed to update/i);

      const [row] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, inScopeBuildingId));
      expect(row).toBeDefined();
      // Integers persist as numbers.
      expect(row!.totalUnits).toBe(24);
      expect(row!.totalFloors).toBe(8);
      // YYYY-MM-DD strings persist on `date` columns as YYYY-MM-DD.
      expect(row!.constructionDate).toBe('2018-07-04');
      expect(row!.financialYearStart).toBe('2025-01-01');
      expect(row!.unplannedBillsStartDate).toBe('2025-02-01');
      // ISO datetime → `timestamp` column persists as a Date pointing
      // to the same instant.
      expect(row!.bankAccountStartDate).toBeInstanceOf(Date);
      expect(row!.bankAccountStartDate!.toISOString()).toBe(isoStart);
      // numeric/decimal columns round-trip as fixed-precision strings.
      expect(row!.bankAccountStartAmount).toBe('12345.67');
      expect(row!.unplannedBillsAmount).toBe('78.90');
      expect(row!.generalInflationRate).toBe('3.25');
      expect(row!.revenueInflationRate).toBe('1.50');
      // jsonb array column round-trips as an array (not a JSON string).
      expect(row!.amenities).toEqual(['sauna', 'rooftop']);
    }, 30000);

    it('denies tenants from updating buildings', async () => {
      const handler = getToolHandler(server, 'update_building');
      const result = await handler(
        {
          role: 'tenant',
          buildingId: inScopeBuildingId,
          name: 'Tenant Cannot Set This',
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);

      const [row] = await db
        .select({ name: schema.buildings.name })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, inScopeBuildingId));
      // The previous test renamed the building; the tenant attempt must
      // not have overwritten that.
      expect(row!.name).not.toBe('Tenant Cannot Set This');
    }, 30000);

    it('rejects buildings outside the MCP org scope', async () => {
      const handler = getToolHandler(server, 'update_building');
      const result = await handler(
        {
          role: 'admin',
          buildingId: outOfScopeBuildingId,
          name: 'Should Not Apply',
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/not found or access denied/i);

      const [row] = await db
        .select({ name: schema.buildings.name })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, outOfScopeBuildingId));
      expect(row!.name).toBe(`mcp-it-bldg-out-${runId}`);
    }, 30000);
  });

  describe('update_residence', () => {
    it('partially updates a residence and leaves omitted columns untouched', async () => {
      const handler = getToolHandler(server, 'update_residence');
      const result = await handler(
        {
          role: 'manager',
          residenceId: inScopeResidenceId,
          floor: 7,
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found/i);

      const [row] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, inScopeResidenceId));
      expect(row).toBeDefined();
      expect(row!.floor).toBe(7);
      // All other seeded values must remain untouched.
      expect(row!.unitNumber).toBe('101');
      expect(row!.bedrooms).toBe(2);
      expect(row!.bathrooms).toBe('1.5');
      expect(row!.monthlyFees).toBe('500.00');
      expect(row!.squareFootage).toBe('850.00');
      expect(row!.parkingSpaceNumbers).toEqual(['P1']);
      expect(row!.storageSpaceNumbers).toEqual(['S1']);
      expect(row!.ownershipPercentage).toBe('10.50');
      // The `buildingId` is immutable per the tool description.
      expect(row!.buildingId).toBe(inScopeBuildingId);
    }, 30000);

    it('round-trips numeric and array coercions correctly', async () => {
      const handler = getToolHandler(server, 'update_residence');
      const result = await handler(
        {
          role: 'admin',
          residenceId: inScopeResidenceId,
          unitNumber: '202',
          bedrooms: 3,
          bathrooms: 2.5,
          monthlyFees: 999.99,
          squareFootage: 1234.5,
          ownershipPercentage: 15.75,
          balcony: true,
          parkingSpaceNumbers: ['P9', 'P10'],
          storageSpaceNumbers: ['S9'],
        },
        {},
      );
      const text = parseToolText(result);
      expect(text).not.toMatch(/access denied|not found|Failed to update/i);

      const [row] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, inScopeResidenceId));
      expect(row).toBeDefined();
      expect(row!.unitNumber).toBe('202');
      expect(row!.bedrooms).toBe(3);
      // numeric/decimal columns persist as fixed-precision strings.
      expect(row!.bathrooms).toBe('2.5');
      expect(row!.monthlyFees).toBe('999.99');
      expect(row!.squareFootage).toBe('1234.50');
      expect(row!.ownershipPercentage).toBe('15.75');
      expect(row!.balcony).toBe(true);
      // text[] columns round-trip as JS arrays.
      expect(row!.parkingSpaceNumbers).toEqual(['P9', 'P10']);
      expect(row!.storageSpaceNumbers).toEqual(['S9']);
    }, 30000);

    it('denies tenants from updating residences', async () => {
      const handler = getToolHandler(server, 'update_residence');
      const result = await handler(
        {
          role: 'tenant',
          residenceId: inScopeResidenceId,
          floor: 99,
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/access denied/i);

      const [row] = await db
        .select({ floor: schema.residences.floor })
        .from(schema.residences)
        .where(eq(schema.residences.id, inScopeResidenceId));
      // Floor was last set to 7 by the partial-update test, then left
      // alone. The tenant attempt must not have changed it.
      expect(row!.floor).toBe(7);
    }, 30000);

    it('rejects residences outside the MCP org scope', async () => {
      const handler = getToolHandler(server, 'update_residence');
      const result = await handler(
        {
          role: 'admin',
          residenceId: outOfScopeResidenceId,
          floor: 5,
        },
        {},
      );
      expect(parseToolText(result)).toMatch(/not found or access denied/i);

      const [row] = await db
        .select({ floor: schema.residences.floor })
        .from(schema.residences)
        .where(eq(schema.residences.id, outOfScopeResidenceId));
      expect(row!.floor).toBeNull();
    }, 30000);
  });
});
