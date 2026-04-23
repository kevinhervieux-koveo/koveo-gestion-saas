/**
 * @jest-environment node
 *
 * Task #291: Integration coverage for the common-space MCP tools.
 *
 * The MCP layer (server/mcp/server.ts) exposes a family of tools that AI
 * assistants use to read and write common-space data:
 *
 *   - get_common_space
 *   - list_common_space_bookings
 *   - list_my_common_space_bookings
 *   - get_common_space_availability
 *   - create_common_space_booking
 *   - cancel_common_space_booking
 *   - create_common_space / update_common_space / delete_common_space
 *
 * All booking-rule enforcement (opening hours, blocked users, monthly /
 * yearly time limits, conflict detection, tenant building scoping) is
 * delegated to server/api/common-spaces-rules.ts so the MCP tools stay
 * in lock-step with the resident/manager REST API. These tests exercise
 * each tool end-to-end against a real Postgres database to guarantee
 * that a regression in either layer is caught immediately.
 *
 * Gated on `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL` by
 * `jest.polyfills.js`) and skips cleanly when no Postgres is available,
 * matching the pattern used by `tests/integration/mcp-delete-*.test.ts`.
 */

// Stub out the document/object/AI service modules that the MCP server
// imports at the top of `server/mcp/server.ts`. The common-space tools
// under test never use them, but loading the real modules pulls in the
// ESM-only `uuid` package which Jest's ts-jest transformer cannot parse
// without additional config. Stubbing them keeps this test self-contained
// without touching the project-wide Jest config.
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
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task291-mcp-common-spaces';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface ToolResult {
  content?: Array<{ type?: string; text?: string }>;
}

function getToolHandler(
  server: unknown,
  toolName: string,
): (args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult> {
  const tools = (server as { _registeredTools?: Record<string, { handler?: unknown; callback?: unknown }> })
    ._registeredTools;
  if (!tools || !tools[toolName]) throw new Error(`Tool "${toolName}" not registered`);
  const fn = (tools[toolName].handler ?? tools[toolName].callback) as
    | ((a: Record<string, unknown>, ...rest: unknown[]) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function textOf(result: ToolResult): string {
  return result?.content?.[0]?.text ?? '';
}

function parseJson<T = unknown>(result: ToolResult): T {
  return JSON.parse(textOf(result)) as T;
}

/**
 * Compute the UTC `Date` corresponding to the given wall-clock time in
 * America/Montreal. DST-safe — works year-round.
 */
function montrealDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(probe);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const projected = Date.UTC(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')) % 24,
    parseInt(get('minute')),
    parseInt(get('second')),
  );
  const offsetMs = projected - probe.getTime();
  return new Date(probe.getTime() - offsetMs);
}

function montrealWeekday(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Montreal' }).toLowerCase();
}

/**
 * Pick a future date that's at least `minDaysAhead` days from now AND
 * lands on the requested Montreal weekday. Returns the Y/M/D in Montreal.
 */
function nextMontrealDateOnWeekday(weekday: string, minDaysAhead: number): { year: number; month: number; day: number } {
  for (let offset = minDaysAhead; offset < minDaysAhead + 14; offset++) {
    const candidate = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    if (montrealWeekday(candidate) === weekday) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Montreal',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(candidate);
      const get = (t: string) => parts.find((p) => p.type === t)!.value;
      return { year: parseInt(get('year')), month: parseInt(get('month')), day: parseInt(get('day')) };
    }
  }
  throw new Error(`Could not find ${weekday} within window`);
}

describeIfDb('MCP common-space tools — real Postgres (Task #291)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../../server/mcp/server').createMcpServer;

  // Track every row we insert so afterAll can clean up in dependency
  // order, even if a single test bailed before its own cleanup.
  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    buildingIds: new Set<string>(),
    residenceIds: new Set<string>(),
    userIds: new Set<string>(),
    userOrgIds: new Set<string>(),
    userResidenceIds: new Set<string>(),
    spaceIds: new Set<string>(),
    bookingIds: new Set<string>(),
    restrictionIds: new Set<string>(),
    timeLimitIds: new Set<string>(),
  };

  // Common fixture handles populated in beforeAll.
  let orgId: string;
  let buildingInScopeId: string;
  let buildingOtherTenantId: string;
  let residenceInScopeId: string;
  let tenantUserId: string;
  let tenantNoLinkUserId: string;
  let managerUserId: string;
  let adminUserId: string;
  let reservableSpaceId: string;
  let openHoursSpaceId: string;
  let limitedSpaceId: string;
  let blockedSpaceId: string;
  let otherBuildingSpaceId: string;
  let testWeekday: string;
  let testYear: number;
  let testMonth: number;
  let testDay: number;

  function serverFor(role: 'admin' | 'manager' | 'tenant', userId: string) {
    return createMcpServer({ userId, role });
  }

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ createMcpServer } = require('../../../server/mcp/server'));

    // 1. MCP-scoped organization (reuse seed if it already exists).
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

    // 2. Two buildings inside the MCP-scoped org. The "in-scope" building
    //    is what the tenant user has a userResidences link to. The "other"
    //    building exists in the same org but the tenant has no link, so
    //    we can verify tenant scoping (denial when accessing it).
    buildingInScopeId = crypto.randomUUID();
    buildingOtherTenantId = crypto.randomUUID();
    await db.insert(schema.buildings).values([
      {
        id: buildingInScopeId,
        organizationId: orgId,
        name: `${TEST_TAG} in-scope`,
        address: '1 Common',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        totalFloors: 1,
        isActive: true,
      },
      {
        id: buildingOtherTenantId,
        organizationId: orgId,
        name: `${TEST_TAG} other`,
        address: '2 Common',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
        buildingType: 'condo',
        totalUnits: 1,
        totalFloors: 1,
        isActive: true,
      },
    ]);
    created.buildingIds.add(buildingInScopeId);
    created.buildingIds.add(buildingOtherTenantId);

    // 3. Residence inside the in-scope building.
    residenceInScopeId = crypto.randomUUID();
    await db.insert(schema.residences).values({
      id: residenceInScopeId,
      buildingId: buildingInScopeId,
      unitNumber: '101',
      floor: 1,
      isActive: true,
    });
    created.residenceIds.add(residenceInScopeId);

    // 4. Three users: tenant with active residence, tenant without any
    //    residence link (to prove the deny path), manager linked to MCP-1
    //    via userOrganizations, and an admin (tested via global access).
    const mkUser = async (role: 'tenant' | 'manager' | 'admin', suffix: string) => {
      const id = crypto.randomUUID();
      await db.insert(schema.users).values({
        id,
        username: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}`,
        email: `${TEST_TAG}-${suffix}-${id.slice(0, 8)}@example.test`,
        password: 'x'.repeat(60),
        firstName: 'CS',
        lastName: suffix,
        role,
        language: 'en',
      });
      created.userIds.add(id);
      return id;
    };
    tenantUserId = await mkUser('tenant', 'tenant');
    tenantNoLinkUserId = await mkUser('tenant', 'noLink');
    managerUserId = await mkUser('manager', 'mgr');
    adminUserId = await mkUser('admin', 'adm');

    // userResidences link only for the "linked" tenant.
    const userResId = crypto.randomUUID();
    await db.insert(schema.userResidences).values({
      id: userResId,
      userId: tenantUserId,
      residenceId: residenceInScopeId,
      relationshipType: 'tenant',
      startDate: '2024-01-01',
      isActive: true,
    });
    created.userResidenceIds.add(userResId);

    // userOrganizations link for the manager (so getMcpAccessibleBuildingIds
    // returns every building in MCP-1).
    const userOrgId = crypto.randomUUID();
    await db.insert(schema.userOrganizations).values({
      id: userOrgId,
      userId: managerUserId,
      organizationId: orgId,
      organizationRole: 'manager',
      isActive: true,
    });
    created.userOrgIds.add(userOrgId);

    // 5. Common spaces. Pick a target weekday at least 14 days out so
    //    "future booking" tests stay in the future even if the suite
    //    runs near month-end.
    const date = nextMontrealDateOnWeekday('saturday', 14);
    testYear = date.year;
    testMonth = date.month;
    testDay = date.day;
    testWeekday = 'saturday';

    // Open all 7 days 09:00–17:00 (Montreal). Lets us test in-hours
    // success and out-of-hours rejection consistently.
    const allDayHours = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => ({
      day: d,
      open: '09:00',
      close: '17:00',
    }));

    const mkSpace = async (
      name: string,
      buildingId: string,
      opts: Partial<{ isReservable: boolean; openingHours: unknown; capacity: number }> = {},
    ) => {
      const id = crypto.randomUUID();
      await db.insert(schema.commonSpaces).values({
        id,
        buildingId,
        name: `${TEST_TAG}-${name}`,
        description: `${TEST_TAG} ${name}`,
        isReservable: opts.isReservable ?? true,
        capacity: opts.capacity ?? 10,
        openingHours: opts.openingHours ?? null,
      });
      created.spaceIds.add(id);
      return id;
    };
    reservableSpaceId = await mkSpace('reservable', buildingInScopeId);
    openHoursSpaceId = await mkSpace('hours', buildingInScopeId, { openingHours: allDayHours });
    limitedSpaceId = await mkSpace('limited', buildingInScopeId, { openingHours: allDayHours });
    blockedSpaceId = await mkSpace('blocked', buildingInScopeId);
    otherBuildingSpaceId = await mkSpace('other', buildingOtherTenantId);

    // Block the linked tenant from `blockedSpaceId` to prove
    // commonSpaceRules.isUserBlocked is enforced through MCP.
    const restrictionId = crypto.randomUUID();
    await db.insert(schema.userBookingRestrictions).values({
      id: restrictionId,
      userId: tenantUserId,
      commonSpaceId: blockedSpaceId,
      isBlocked: true,
      reason: `${TEST_TAG} blocked`,
    });
    created.restrictionIds.add(restrictionId);

    // 1-hour monthly cap on the limited space, used to trigger the
    // time-limit failure path.
    const timeLimitId = crypto.randomUUID();
    await db.insert(schema.userTimeLimits).values({
      id: timeLimitId,
      userId: tenantUserId,
      commonSpaceId: limitedSpaceId,
      limitType: 'monthly',
      limitHours: 1,
    });
    created.timeLimitIds.add(timeLimitId);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.bookingIds.size) {
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, [...created.bookingIds]));
    }
    if (created.restrictionIds.size) {
      await db
        .delete(schema.userBookingRestrictions)
        .where(inArray(schema.userBookingRestrictions.id, [...created.restrictionIds]));
    }
    if (created.timeLimitIds.size) {
      await db
        .delete(schema.userTimeLimits)
        .where(inArray(schema.userTimeLimits.id, [...created.timeLimitIds]));
    }
    if (created.spaceIds.size) {
      await db.delete(schema.commonSpaces).where(inArray(schema.commonSpaces.id, [...created.spaceIds]));
    }
    if (created.userResidenceIds.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidenceIds]));
    }
    if (created.userOrgIds.size) {
      await db
        .delete(schema.userOrganizations)
        .where(inArray(schema.userOrganizations.id, [...created.userOrgIds]));
    }
    if (created.residenceIds.size) {
      await db.delete(schema.residences).where(inArray(schema.residences.id, [...created.residenceIds]));
    }
    if (created.buildingIds.size) {
      await db.delete(schema.buildings).where(inArray(schema.buildings.id, [...created.buildingIds]));
    }
    if (created.userIds.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.userIds]));
    }
    if (created.organizationCreatedByUs && created.organizationId) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  // ---------------------------------------------------------------
  // get_common_space
  // ---------------------------------------------------------------
  it('get_common_space returns details for a tenant inside their building', async () => {
    const handler = getToolHandler(serverFor('tenant', tenantUserId), 'get_common_space');
    const result = await handler({ role: 'tenant', spaceId: reservableSpaceId });
    const json = parseJson<{ id: string; name: string }>(result);
    expect(json.id).toBe(reservableSpaceId);
    expect(json.name).toContain(TEST_TAG);
  }, 30000);

  it('get_common_space denies a tenant for a building they have no residence link to', async () => {
    const handler = getToolHandler(serverFor('tenant', tenantUserId), 'get_common_space');
    const result = await handler({ role: 'tenant', spaceId: otherBuildingSpaceId });
    expect(textOf(result)).toMatch(/Access denied/i);
  }, 30000);

  it('get_common_space denies a tenant with no active userResidences link anywhere', async () => {
    const handler = getToolHandler(serverFor('tenant', tenantNoLinkUserId), 'get_common_space');
    const result = await handler({ role: 'tenant', spaceId: reservableSpaceId });
    expect(textOf(result)).toMatch(/Access denied/i);
  }, 30000);

  // ---------------------------------------------------------------
  // create_common_space_booking — happy path + every failure mode.
  // We thread bookings through this one big it-block so a single
  // arrange step covers all conflict / opening-hours / blocked /
  // limit assertions and so cleanup is straightforward.
  // ---------------------------------------------------------------
  it('create_common_space_booking enforces every booking rule', async () => {
    const tenantSrv = serverFor('tenant', tenantUserId);
    const create = getToolHandler(tenantSrv, 'create_common_space_booking');

    // (a) blocked-user denial (commonSpaceRules.isUserBlocked).
    const blockedStart = montrealDate(testYear, testMonth, testDay, 10);
    const blockedEnd = montrealDate(testYear, testMonth, testDay, 11);
    const blockedRes = await create({
      role: 'tenant',
      spaceId: blockedSpaceId,
      startTime: blockedStart.toISOString(),
      endTime: blockedEnd.toISOString(),
    });
    expect(textOf(blockedRes)).toMatch(/blocked/i);

    // (b) opening-hours denial (commonSpaceRules.isWithinOpeningHours):
    //     space opens 09:00–17:00, attempt 06:00–07:00.
    const earlyStart = montrealDate(testYear, testMonth, testDay, 6);
    const earlyEnd = montrealDate(testYear, testMonth, testDay, 7);
    const earlyRes = await create({
      role: 'tenant',
      spaceId: openHoursSpaceId,
      startTime: earlyStart.toISOString(),
      endTime: earlyEnd.toISOString(),
    });
    expect(textOf(earlyRes)).toMatch(/opening hours/i);

    // (c) Happy path — within hours, no blocks, no overlap.
    const okStart = montrealDate(testYear, testMonth, testDay, 10);
    const okEnd = montrealDate(testYear, testMonth, testDay, 11);
    const okRes = await create({
      role: 'tenant',
      spaceId: openHoursSpaceId,
      startTime: okStart.toISOString(),
      endTime: okEnd.toISOString(),
    });
    const booking = parseJson<{ id: string; status: string; commonSpaceId: string; userId: string }>(okRes);
    expect(booking.id).toBeTruthy();
    expect(booking.status).toBe('confirmed');
    expect(booking.commonSpaceId).toBe(openHoursSpaceId);
    expect(booking.userId).toBe(tenantUserId);
    created.bookingIds.add(booking.id);

    // (d) Overlap denial (commonSpaceRules.hasOverlappingBookings):
    //     reuses the slot we just booked, intersecting at 10:30–11:30.
    const overlapStart = montrealDate(testYear, testMonth, testDay, 10, 30);
    const overlapEnd = montrealDate(testYear, testMonth, testDay, 11, 30);
    const overlapRes = await create({
      role: 'tenant',
      spaceId: openHoursSpaceId,
      startTime: overlapStart.toISOString(),
      endTime: overlapEnd.toISOString(),
    });
    expect(textOf(overlapRes)).toMatch(/already booked/i);

    // (e) Time-limit denial (commonSpaceRules.checkUserTimeLimit):
    //     1-hour monthly cap on `limitedSpaceId`, attempt 2 hours.
    const limitStart = montrealDate(testYear, testMonth, testDay, 12);
    const limitEnd = montrealDate(testYear, testMonth, testDay, 14);
    const limitRes = await create({
      role: 'tenant',
      spaceId: limitedSpaceId,
      startTime: limitStart.toISOString(),
      endTime: limitEnd.toISOString(),
    });
    expect(textOf(limitRes)).toMatch(/limite|limit/i);

    // (f) Tenant without any active userResidences link is denied
    //     even on a building inside the MCP scope — verifies the
    //     tenant building scoping check inside authorizeSpaceAccess.
    const noLinkSrv = serverFor('tenant', tenantNoLinkUserId);
    const noLinkCreate = getToolHandler(noLinkSrv, 'create_common_space_booking');
    const noLinkRes = await noLinkCreate({
      role: 'tenant',
      spaceId: openHoursSpaceId,
      startTime: montrealDate(testYear, testMonth, testDay, 13).toISOString(),
      endTime: montrealDate(testYear, testMonth, testDay, 14).toISOString(),
    });
    expect(textOf(noLinkRes)).toMatch(/Access denied/i);
  }, 60000);

  // ---------------------------------------------------------------
  // list_common_space_bookings — tenant only sees own; manager sees all.
  // ---------------------------------------------------------------
  it('list_common_space_bookings is tenant-scoped but unrestricted for staff', async () => {
    // Seed a manager booking on the same space so we can compare
    // tenant-vs-manager visibility.
    const mgrBookingId = crypto.randomUUID();
    await db.insert(schema.bookings).values({
      id: mgrBookingId,
      commonSpaceId: openHoursSpaceId,
      userId: managerUserId,
      startTime: montrealDate(testYear, testMonth, testDay, 14),
      endTime: montrealDate(testYear, testMonth, testDay, 15),
      status: 'confirmed',
    });
    created.bookingIds.add(mgrBookingId);

    const tenantHandler = getToolHandler(serverFor('tenant', tenantUserId), 'list_common_space_bookings');
    const tenantRes = await tenantHandler({ role: 'tenant', spaceId: openHoursSpaceId });
    const tenantRows = parseJson<Array<{ id: string; userId: string }>>(tenantRes);
    // Tenant must only see their own bookings — manager booking filtered out.
    expect(tenantRows.every((r) => r.userId === tenantUserId)).toBe(true);
    expect(tenantRows.find((r) => r.id === mgrBookingId)).toBeUndefined();

    const mgrHandler = getToolHandler(serverFor('manager', managerUserId), 'list_common_space_bookings');
    const mgrRes = await mgrHandler({ role: 'manager', spaceId: openHoursSpaceId });
    const mgrRows = parseJson<Array<{ id: string; userId: string }>>(mgrRes);
    const userIds = new Set(mgrRows.map((r) => r.userId));
    // Manager sees BOTH the tenant's bookings and their own.
    expect(userIds.has(tenantUserId)).toBe(true);
    expect(userIds.has(managerUserId)).toBe(true);
  }, 30000);

  // ---------------------------------------------------------------
  // list_my_common_space_bookings
  // ---------------------------------------------------------------
  it('list_my_common_space_bookings is clamped to the caller and accessible buildings', async () => {
    const tenantHandler = getToolHandler(serverFor('tenant', tenantUserId), 'list_my_common_space_bookings');
    const tenantRows = parseJson<Array<{ userId?: string; commonSpaceId: string; buildingId: string }>>(
      await tenantHandler({ role: 'tenant' }),
    );
    // Every row belongs to an in-scope building (tenant has no link to
    // `buildingOtherTenantId`, so the join on accessibleBuildingIds drops it).
    expect(tenantRows.length).toBeGreaterThan(0);
    expect(tenantRows.every((r) => r.buildingId === buildingInScopeId)).toBe(true);

    // The unlinked tenant gets back an empty list — no accessible buildings.
    const noLinkHandler = getToolHandler(
      serverFor('tenant', tenantNoLinkUserId),
      'list_my_common_space_bookings',
    );
    const noLinkRows = parseJson<unknown[]>(await noLinkHandler({ role: 'tenant' }));
    expect(noLinkRows).toEqual([]);
  }, 30000);

  // ---------------------------------------------------------------
  // get_common_space_availability
  // ---------------------------------------------------------------
  it('get_common_space_availability returns opening hours and free slots around bookings', async () => {
    const handler = getToolHandler(serverFor('manager', managerUserId), 'get_common_space_availability');
    const dateStr = `${testYear}-${String(testMonth).padStart(2, '0')}-${String(testDay).padStart(2, '0')}`;
    const result = parseJson<{
      isReservable: boolean;
      openingHours: { day: string; open: string; close: string } | null;
      bookings: Array<{ id: string }>;
      freeSlots: Array<{ start: string; end: string }>;
    }>(await handler({ role: 'manager', spaceId: openHoursSpaceId, date: dateStr }));

    expect(result.isReservable).toBe(true);
    expect(result.openingHours).toEqual({ day: testWeekday, open: '09:00', close: '17:00' });
    // Two confirmed bookings should be reported (tenant 10–11, manager 14–15)
    // and the free slots should bracket them.
    expect(result.bookings.length).toBeGreaterThanOrEqual(2);
    const slots = result.freeSlots.map((s) => `${s.start}-${s.end}`);
    expect(slots).toContain('09:00-10:00');
    expect(slots).toContain('11:00-14:00');
    expect(slots).toContain('15:00-17:00');
  }, 30000);

  // ---------------------------------------------------------------
  // cancel_common_space_booking — owner vs staff vs other-tenant.
  // ---------------------------------------------------------------
  it('cancel_common_space_booking enforces owner-or-staff', async () => {
    // Create a fresh booking by the tenant to cancel.
    const ownerBookingId = crypto.randomUUID();
    await db.insert(schema.bookings).values({
      id: ownerBookingId,
      commonSpaceId: reservableSpaceId,
      userId: tenantUserId,
      startTime: montrealDate(testYear, testMonth, testDay, 16),
      endTime: montrealDate(testYear, testMonth, testDay, 17),
      status: 'confirmed',
    });
    created.bookingIds.add(ownerBookingId);

    // Another tenant's attempt: the unlinked tenant fails (denied at
    // building-access stage, since they have no userResidences).
    const otherTenantSrv = serverFor('tenant', tenantNoLinkUserId);
    const otherCancel = getToolHandler(otherTenantSrv, 'cancel_common_space_booking');
    const otherRes = await otherCancel({ role: 'tenant', bookingId: ownerBookingId });
    expect(textOf(otherRes)).toMatch(/Access denied/i);

    // The owning tenant successfully cancels their own booking.
    const ownerSrv = serverFor('tenant', tenantUserId);
    const ownerCancel = getToolHandler(ownerSrv, 'cancel_common_space_booking');
    const ownerRes = await ownerCancel({ role: 'tenant', bookingId: ownerBookingId });
    const ownerJson = parseJson<{ id: string; status: string }>(ownerRes);
    expect(ownerJson.status).toBe('cancelled');

    // A second booking owned by the tenant — manager should be able to
    // cancel it on their behalf (staff bypass of the owner check).
    const staffBookingId = crypto.randomUUID();
    await db.insert(schema.bookings).values({
      id: staffBookingId,
      commonSpaceId: reservableSpaceId,
      userId: tenantUserId,
      startTime: montrealDate(testYear, testMonth, testDay, 15),
      endTime: montrealDate(testYear, testMonth, testDay, 16),
      status: 'confirmed',
    });
    created.bookingIds.add(staffBookingId);
    const mgrCancel = getToolHandler(
      serverFor('manager', managerUserId),
      'cancel_common_space_booking',
    );
    const mgrRes = await mgrCancel({ role: 'manager', bookingId: staffBookingId });
    expect(parseJson<{ status: string }>(mgrRes).status).toBe('cancelled');
  }, 30000);

  // ---------------------------------------------------------------
  // create / update / delete_common_space — admin/manager only,
  // delete refuses with future bookings.
  // ---------------------------------------------------------------
  it('create_common_space rejects tenants and accepts managers', async () => {
    const tenantSrv = serverFor('tenant', tenantUserId);
    const tenantCreate = getToolHandler(tenantSrv, 'create_common_space');
    const tenantRes = await tenantCreate({
      role: 'tenant',
      buildingId: buildingInScopeId,
      name: `${TEST_TAG}-tenant-attempt`,
    });
    expect(textOf(tenantRes)).toMatch(/Access denied/i);

    const mgrSrv = serverFor('manager', managerUserId);
    const mgrCreate = getToolHandler(mgrSrv, 'create_common_space');
    const ok = await mgrCreate({
      role: 'manager',
      buildingId: buildingInScopeId,
      name: `${TEST_TAG}-mgr-created`,
      isReservable: true,
      capacity: 5,
    });
    const okJson = parseJson<{ id: string; name: string }>(ok);
    expect(okJson.id).toBeTruthy();
    expect(okJson.name).toBe(`${TEST_TAG}-mgr-created`);
    created.spaceIds.add(okJson.id);

    // Duplicate name in the same building should be rejected.
    const dup = await mgrCreate({
      role: 'manager',
      buildingId: buildingInScopeId,
      name: `${TEST_TAG}-mgr-created`,
      isReservable: true,
    });
    expect(textOf(dup)).toMatch(/already exists/i);
  }, 30000);

  it('update_common_space patches only provided fields', async () => {
    const targetId = crypto.randomUUID();
    await db.insert(schema.commonSpaces).values({
      id: targetId,
      buildingId: buildingInScopeId,
      name: `${TEST_TAG}-update-target`,
      isReservable: true,
      capacity: 3,
    });
    created.spaceIds.add(targetId);

    const mgrUpdate = getToolHandler(serverFor('manager', managerUserId), 'update_common_space');
    const updated = parseJson<{ id: string; capacity: number; description: string | null }>(
      await mgrUpdate({
        role: 'manager',
        spaceId: targetId,
        capacity: 99,
        description: `${TEST_TAG}-patched`,
      }),
    );
    expect(updated.id).toBe(targetId);
    expect(updated.capacity).toBe(99);
    expect(updated.description).toBe(`${TEST_TAG}-patched`);

    // Tenants can never patch a space.
    const tenantUpdate = getToolHandler(serverFor('tenant', tenantUserId), 'update_common_space');
    const tenantRes = await tenantUpdate({ role: 'tenant', spaceId: targetId, capacity: 1 });
    expect(textOf(tenantRes)).toMatch(/Access denied/i);
  }, 30000);

  it('delete_common_space refuses to drop a space with confirmed future bookings', async () => {
    const targetId = crypto.randomUUID();
    await db.insert(schema.commonSpaces).values({
      id: targetId,
      buildingId: buildingInScopeId,
      name: `${TEST_TAG}-delete-target`,
      isReservable: true,
    });
    created.spaceIds.add(targetId);

    // Future confirmed booking — delete must refuse.
    const futureBookingId = crypto.randomUUID();
    await db.insert(schema.bookings).values({
      id: futureBookingId,
      commonSpaceId: targetId,
      userId: tenantUserId,
      startTime: montrealDate(testYear, testMonth, testDay, 10),
      endTime: montrealDate(testYear, testMonth, testDay, 11),
      status: 'confirmed',
    });
    created.bookingIds.add(futureBookingId);

    const mgrDelete = getToolHandler(serverFor('manager', managerUserId), 'delete_common_space');
    const refused = await mgrDelete({ role: 'manager', spaceId: targetId });
    expect(textOf(refused)).toMatch(/future bookings/i);

    // Tenants are denied even when no bookings exist.
    const tenantDelete = getToolHandler(serverFor('tenant', tenantUserId), 'delete_common_space');
    const tenantRes = await tenantDelete({ role: 'tenant', spaceId: targetId });
    expect(textOf(tenantRes)).toMatch(/Access denied/i);

    // Cancel the booking, then the manager delete should succeed.
    await db
      .update(schema.bookings)
      .set({ status: 'cancelled' })
      .where(eq(schema.bookings.id, futureBookingId));

    const ok = await mgrDelete({ role: 'manager', spaceId: targetId });
    const okJson = parseJson<{ deleted: { id: string; name: string }; message: string }>(ok);
    expect(okJson.deleted.id).toBe(targetId);
    expect(okJson.message).toMatch(/deleted/i);
    // Track bookings already deleted by FK cascade so afterAll doesn't
    // try to re-delete missing rows.
    created.spaceIds.delete(targetId);
    created.bookingIds.delete(futureBookingId);
  }, 30000);

  // ---------------------------------------------------------------
  // Admin role gets blanket access (no userOrganizations link needed).
  // ---------------------------------------------------------------
  it('admin can read common spaces in any MCP-scoped building', async () => {
    const handler = getToolHandler(serverFor('admin', adminUserId), 'get_common_space');
    const json = parseJson<{ id: string }>(
      await handler({ role: 'admin', spaceId: otherBuildingSpaceId }),
    );
    expect(json.id).toBe(otherBuildingSpaceId);
  }, 30000);
});
