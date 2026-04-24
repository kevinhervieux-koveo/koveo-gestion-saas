/**
 * @jest-environment node
 *
 * Task #388: Keep residence rows in sync when a building's `totalUnits`
 * is changed through the MCP `update_building` tool.
 *
 * Before this fix the MCP tool wrote `totalUnits` straight into the
 * building row but never touched the `residences` table. The REST
 * `PUT /api/admin/buildings/:id` handler instead routes residence-count
 * changes through `adjustResidenceCount` inside a single transaction
 * (Task #172). The MCP tool now mirrors that behaviour:
 *
 *   - Increasing `totalUnits` auto-creates the missing residence rows
 *     in the same transaction as the building update.
 *   - Decreasing `totalUnits` returns a structured `residencesToSelect`
 *     payload so the assistant can call `delete_residence` for each
 *     unit it actually wants to soft-delete (mirroring REST, which
 *     also requires a follow-up DELETE).
 *   - Changing `totalUnits` requires the admin role — managers, who
 *     can edit other building fields, get `Access denied` (mirrors the
 *     REST handler's `ADMIN_REQUIRED_FOR_RESIDENCE_CHANGES` rule).
 *   - Editing other fields (e.g. `name`) does NOT touch residences.
 *
 * Real-DB integration test, gated on `_INTEGRATION_DB_URL` exactly like
 * `tests/integration/mcp-delete-bill-cascade.test.ts`. Skips cleanly
 * when no Postgres is available.
 */

// The MCP server module imports a handful of heavyweight services at
// the top of `server/mcp/server.ts` that pull in ESM-only dependencies
// the Jest transformer cannot parse. None of those services are
// exercised by `update_building`, so we stub them — same trick used by
// `tests/integration/mcp/common-spaces-tools.test.ts`.
jest.mock('../../../server/services/document-service', () => ({
  DocumentService: class {},
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: class {},
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {
    analyzeDocument: jest.fn(),
    getAnalysisStatus: jest.fn(),
  },
}));

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task388-mcp-update-bldg-sync';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface ToolResult {
  content?: Array<{ text?: string }>;
}

function getToolHandler(
  server: unknown,
  toolName: string,
): (args: unknown, extra?: unknown) => Promise<ToolResult> {
  const tools = (server as {
    _registeredTools?: Record<string, { handler?: unknown; callback?: unknown }>;
  })._registeredTools;
  if (!tools || !tools[toolName]) throw new Error(`Tool "${toolName}" not registered`);
  const fn = (tools[toolName].handler ?? tools[toolName].callback) as
    | ((args: unknown, extra?: unknown) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function textOf(result: ToolResult): string {
  return result?.content?.[0]?.text ?? '';
}

function parseJson<T = Record<string, unknown>>(result: ToolResult): T {
  return JSON.parse(textOf(result)) as T;
}

describeIfDb('MCP update_building keeps residence rows in sync — Task #388', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../../server/mcp/server').createMcpServer;

  // Track every row we insert so afterAll can clean up regardless of
  // which assertion bailed first.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    buildingIds: new Set<string>(),
    residenceIds: new Set<string>(),
    userIds: new Set<string>(),
  };

  let orgId: string;
  let adminUserId: string;
  let managerUserId: string;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ createMcpServer } = require('../../../server/mcp/server'));

    // Reuse the existing MCP-1 sandbox org if the seed already created
    // one, otherwise insert it. The MCP scope check (`getMcpOrgIds`)
    // only allows buildings in orgs named "MCP-1" or "MCP-2".
    const existingMcp = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'MCP-1'))
      .limit(1);
    if (existingMcp.length > 0) {
      orgId = existingMcp[0].id;
    } else {
      orgId = crypto.randomUUID();
      await db.insert(schema.organizations).values({
        id: orgId,
        name: 'MCP-1',
        type: 'syndicate',
        address: `${TEST_TAG} 1`,
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      });
      created.organizationCreatedByUs = true;
    }
    created.organizationId = orgId;

    const mkUser = async (role: 'admin' | 'manager', suffix: string) => {
      const id = crypto.randomUUID();
      await db.insert(schema.users).values({
        id,
        username: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}`,
        email: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}@example.test`,
        password: 'x'.repeat(60),
        firstName: 'Sync',
        lastName: suffix,
        role,
        language: 'en',
      });
      created.userIds.add(id);
      return id;
    };
    adminUserId = await mkUser('admin', 'adm');
    managerUserId = await mkUser('manager', 'mgr');
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.residenceIds.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...created.residenceIds]));
    }
    if (created.buildingIds.size) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, [...created.buildingIds]));
    }
    if (created.userIds.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.userIds]));
    }
    if (created.organizationId && created.organizationCreatedByUs) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  /**
   * Seed a fresh building (with `initialUnits` matching residence rows)
   * inside the MCP-scoped org and track the ids so afterAll can clean
   * them up. Returns the building id and its seeded residence ids.
   */
  async function seedBuilding(initialUnits: number, totalFloors = 1) {
    const buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG} bldg ${buildingId.slice(0, 8)}`,
      address: '1 Sync',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: initialUnits,
      totalFloors,
      isActive: true,
    });
    created.buildingIds.add(buildingId);

    const residenceIds: string[] = [];
    for (let unit = 1; unit <= initialUnits; unit++) {
      const id = crypto.randomUUID();
      await db.insert(schema.residences).values({
        id,
        buildingId,
        unitNumber: `1${unit.toString().padStart(2, '0')}`,
        floor: 1,
        isActive: true,
      });
      created.residenceIds.add(id);
      residenceIds.push(id);
    }
    return { buildingId, residenceIds };
  }

  async function liveResidenceCount(buildingId: string): Promise<number> {
    const rows = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(
        and(eq(schema.residences.buildingId, buildingId), eq(schema.residences.isActive, true)),
      );
    return rows.length;
  }

  async function buildingTotalUnits(buildingId: string): Promise<number> {
    const [row] = await db
      .select({ totalUnits: schema.buildings.totalUnits })
      .from(schema.buildings)
      .where(eq(schema.buildings.id, buildingId));
    return row?.totalUnits ?? 0;
  }

  it('admin increasing totalUnits auto-creates the missing residence rows in the same transaction', async () => {
    const { buildingId } = await seedBuilding(2);
    expect(await liveResidenceCount(buildingId)).toBe(2);

    const server = createMcpServer({ userId: adminUserId, role: 'admin' });
    const handler = getToolHandler(server, 'update_building');

    const result = await handler({ role: 'admin', buildingId, totalUnits: 5 });
    const payload = parseJson<{
      building: { id: string; totalUnits: number };
      residenceAdjustment: { action: string; residencesAdded: number };
    }>(result);

    expect(payload.building.id).toBe(buildingId);
    expect(payload.building.totalUnits).toBe(5);
    expect(payload.residenceAdjustment.action).toBe('increased');
    expect(payload.residenceAdjustment.residencesAdded).toBe(3);

    // Track the brand-new residence ids so cleanup nukes them too.
    const everyResidence = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(eq(schema.residences.buildingId, buildingId));
    for (const row of everyResidence) created.residenceIds.add(row.id);

    expect(await liveResidenceCount(buildingId)).toBe(5);
    expect(await buildingTotalUnits(buildingId)).toBe(5);
  }, 30000);

  it('admin decreasing totalUnits returns a residence selection list (no auto-soft-delete)', async () => {
    const { buildingId } = await seedBuilding(4);
    expect(await liveResidenceCount(buildingId)).toBe(4);

    const server = createMcpServer({ userId: adminUserId, role: 'admin' });
    const handler = getToolHandler(server, 'update_building');

    const result = await handler({ role: 'admin', buildingId, totalUnits: 2 });
    const payload = parseJson<{
      building: { totalUnits: number };
      residenceAdjustment: {
        action: string;
        needsResidenceSelection: boolean;
        residencesToRemove: number;
        residencesToSelect: Array<{ id: string; unitNumber: string }>;
        instruction: string;
      };
    }>(result);

    // The building row IS updated to the lower value (mirrors REST PUT,
    // which also commits the new totalUnits before the residence rows
    // are removed manually).
    expect(payload.building.totalUnits).toBe(2);
    expect(await buildingTotalUnits(buildingId)).toBe(2);

    expect(payload.residenceAdjustment.action).toBe('decreased');
    expect(payload.residenceAdjustment.needsResidenceSelection).toBe(true);
    expect(payload.residenceAdjustment.residencesToRemove).toBe(2);
    // `getResidencesForSelection` returns every active residence so the
    // caller can pick which N to remove — not just the first N.
    expect(payload.residenceAdjustment.residencesToSelect).toHaveLength(4);
    expect(payload.residenceAdjustment.instruction).toMatch(/delete_residence/);

    // Crucially: no residence rows are auto-soft-deleted on the
    // decrease path. The assistant must follow up with delete_residence.
    expect(await liveResidenceCount(buildingId)).toBe(4);
  }, 30000);

  it('manager attempting to change totalUnits is denied (mirrors REST PUT admin-only rule)', async () => {
    const { buildingId } = await seedBuilding(3);

    const server = createMcpServer({ userId: managerUserId, role: 'manager' });
    const handler = getToolHandler(server, 'update_building');

    const result = await handler({ role: 'manager', buildingId, totalUnits: 6 });
    expect(textOf(result)).toMatch(/only admins can change a building's totalUnits/i);

    // Both totalUnits and the residence count must remain untouched.
    expect(await buildingTotalUnits(buildingId)).toBe(3);
    expect(await liveResidenceCount(buildingId)).toBe(3);
  }, 30000);

  it('manager editing a non-residence field (name) succeeds without touching residence rows', async () => {
    const { buildingId } = await seedBuilding(2);
    const newName = `${TEST_TAG} renamed ${buildingId.slice(0, 6)}`;

    const server = createMcpServer({ userId: managerUserId, role: 'manager' });
    const handler = getToolHandler(server, 'update_building');

    const result = await handler({ role: 'manager', buildingId, name: newName });
    // Non-residence updates skip the adjustment helper entirely, so the
    // tool returns the bare building row JSON (no `residenceAdjustment`).
    const payload = parseJson<{ id: string; name: string; totalUnits: number }>(result);
    expect(payload.id).toBe(buildingId);
    expect(payload.name).toBe(newName);
    expect(payload.totalUnits).toBe(2);

    expect(await liveResidenceCount(buildingId)).toBe(2);
  }, 30000);

  it('passing the same totalUnits is a no-op for residences (action !== increased/decreased)', async () => {
    const { buildingId } = await seedBuilding(3);

    const server = createMcpServer({ userId: adminUserId, role: 'admin' });
    const handler = getToolHandler(server, 'update_building');

    const result = await handler({ role: 'admin', buildingId, totalUnits: 3 });
    // No `residenceAdjustment` envelope when nothing changed: the tool
    // falls through to returning the bare updated building row.
    const payload = parseJson<{ id: string; totalUnits: number }>(result);
    expect(payload.id).toBe(buildingId);
    expect(payload.totalUnits).toBe(3);
    expect((payload as Record<string, unknown>).residenceAdjustment).toBeUndefined();

    expect(await liveResidenceCount(buildingId)).toBe(3);
  }, 30000);
});
