/**
 * @jest-environment node
 *
 * Integration tests for GET /api/maintenance/history/:id/audit (Task #1133).
 *
 * Covers:
 *  (a) Returns rows newest-first with the resolved editor display name
 *  (b) Marks legacy MCP_API_KEY edits (performedBy = null + meta.source) as "System"
 *  (c) Rejects tenants and users without building access (403)
 *  (d) Returns an empty list (not 404) for a history event with no recorded edits
 *
 * Skipped automatically when _INTEGRATION_DB_URL is absent (unit tier).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import supertest from 'supertest';
import express from 'express';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type * as SchemaImport from '@shared/schema';
import type { RouteRegistry } from '../utils/lazy-mount';

type Schema = typeof SchemaImport;
type Db = NeonDatabase<Schema>;

jest.mock('../services/document-service', () => ({
  documentService: {
    getDocuments: jest.fn().mockResolvedValue([]),
    getUploadUrl: jest.fn().mockResolvedValue({ success: true, uploadUrl: '', filePath: '' }),
    confirmUpload: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    normalizePath: jest.fn((p: string) => p),
  },
  DocumentService: jest.fn().mockImplementation(() => ({})),
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

jest.mock('../services/secure-file-storage', () => ({
  secureFileStorage: {
    getSignedDownloadUrl: jest.fn().mockResolvedValue('https://example.com/signed'),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/workflow-service', () => ({
  workflowService: {
    getWorkflowState: jest.fn().mockResolvedValue(null),
    advanceWorkflow: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../jobs/maintenanceJobs', () => ({
  maintenanceJobsScheduler: { start: jest.fn(), stop: jest.fn() },
}));

jest.mock('../services/project-payment-service', () => ({
  projectPaymentService: {
    getProjectPayments: jest.fn().mockResolvedValue([]),
    createPayment: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../services/maintenanceSuggestionService', () => ({
  maintenanceSuggestionService: { getSuggestions: jest.fn().mockResolvedValue([]) },
}));

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('GET /api/maintenance/history/:id/audit — integration', () => {
  const runId = randomUUID().slice(0, 8);
  let db: Db;
  let schema: Schema;
  let request: ReturnType<typeof supertest>;

  let orgId: string;
  let buildingId: string;
  let adminUserId: string;
  let managerUserId: string;
  let tenantUserId: string;
  let outsiderAdminId: string;
  let elementId: string;
  let uniformatCode: string;
  let createdOrgHere = false;
  let createdUniformatHere = false;

  const createdHistoryIds: string[] = [];
  const createdAuditIds: string[] = [];

  beforeAll(async () => {
    if (!REAL_DB_URL) return;

    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.NODE_ENV = 'test';

    jest.resetModules();

    db = (require('../db') as { db: Db }).db;
    schema = require('@shared/schema') as Schema;

    const [existingOrg] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'Open Demo'))
      .limit(1);

    if (existingOrg) {
      orgId = existingOrg.id;
    } else {
      const [created] = await db
        .insert(schema.organizations)
        .values({
          name: `audit-test-org-${runId}`,
          type: 'demo',
          address: '1 Audit St',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A1A1',
          isActive: true,
        })
        .returning({ id: schema.organizations.id });
      orgId = created.id;
      createdOrgHere = true;
    }

    const [bldg] = await db
      .insert(schema.buildings)
      .values({
        organizationId: orgId,
        name: `audit-test-bldg-${runId}`,
        address: '100 Audit Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B2B2',
        buildingType: 'apartment',
        totalUnits: 4,
        totalFloors: 2,
        isActive: true,
      })
      .returning({ id: schema.buildings.id });
    buildingId = bldg.id;

    const [adminRow] = await db
      .insert(schema.users)
      .values({
        email: `audit-admin-${runId}@koveo.test`,
        username: `audit-admin-${runId}`,
        password: 'x',
        firstName: 'Audit',
        lastName: 'Admin',
        role: 'admin',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    adminUserId = adminRow.id;

    const [managerRow] = await db
      .insert(schema.users)
      .values({
        email: `audit-manager-${runId}@koveo.test`,
        username: `audit-manager-${runId}`,
        password: 'x',
        firstName: 'Audit',
        lastName: 'Manager',
        role: 'manager',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    managerUserId = managerRow.id;

    const [tenantRow] = await db
      .insert(schema.users)
      .values({
        email: `audit-tenant-${runId}@koveo.test`,
        username: `audit-tenant-${runId}`,
        password: 'x',
        firstName: 'Audit',
        lastName: 'Tenant',
        role: 'tenant',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    tenantUserId = tenantRow.id;

    const [outsiderRow] = await db
      .insert(schema.users)
      .values({
        email: `audit-outsider-${runId}@koveo.test`,
        username: `audit-outsider-${runId}`,
        password: 'x',
        firstName: 'Audit',
        lastName: 'Outsider',
        role: 'admin',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    outsiderAdminId = outsiderRow.id;

    await db.insert(schema.userBuildings).values([
      { userId: adminUserId, buildingId, relationshipType: 'owner', isActive: true },
      { userId: managerUserId, buildingId, relationshipType: 'manager', isActive: true },
    ]);

    const [existingCode] = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .limit(1);

    if (existingCode) {
      uniformatCode = existingCode.code;
    } else {
      const code = `T1133-${runId.slice(0, 4)}`;
      await db.insert(schema.uniformatCodes).values({
        code,
        level: 1,
        nameFr: 'Test',
        nameEn: 'Test',
      });
      uniformatCode = code;
      createdUniformatHere = true;
    }

    const [elem] = await db
      .insert(schema.buildingElements)
      .values({
        buildingId,
        uniformatCode,
        name: `audit-test-elem-${runId}`,
        currentCondition: 'good',
        isActive: true,
      })
      .returning({ id: schema.buildingElements.id });
    elementId = elem.id;

    const app = express();
    app.use(express.json());
    const { registerMaintenanceRoutes } = require('../api/maintenance') as {
      registerMaintenanceRoutes: (r: RouteRegistry) => void;
    };
    registerMaintenanceRoutes(app as RouteRegistry);
    request = supertest(app);
  });

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    const maintenanceSchema = require('@shared/schemas/maintenance') as typeof import('@shared/schemas/maintenance');

    for (const aid of createdAuditIds) {
      await db
        .delete(maintenanceSchema.elementHistoryAuditLog)
        .where(eq(maintenanceSchema.elementHistoryAuditLog.id, aid));
    }
    for (const hid of createdHistoryIds) {
      await db
        .delete(maintenanceSchema.elementHistory)
        .where(eq(maintenanceSchema.elementHistory.id, hid));
    }
    if (elementId) {
      await db
        .delete(schema.buildingElements)
        .where(eq(schema.buildingElements.id, elementId));
    }
    if (adminUserId) {
      await db.delete(schema.userBuildings).where(eq(schema.userBuildings.userId, adminUserId));
      await db.delete(schema.users).where(eq(schema.users.id, adminUserId));
    }
    if (managerUserId) {
      await db.delete(schema.userBuildings).where(eq(schema.userBuildings.userId, managerUserId));
      await db.delete(schema.users).where(eq(schema.users.id, managerUserId));
    }
    if (tenantUserId) {
      await db.delete(schema.users).where(eq(schema.users.id, tenantUserId));
    }
    if (outsiderAdminId) {
      await db.delete(schema.users).where(eq(schema.users.id, outsiderAdminId));
    }
    if (buildingId) await db.delete(schema.buildings).where(eq(schema.buildings.id, buildingId));
    if (createdOrgHere && orgId) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    }
    if (createdUniformatHere && uniformatCode) {
      await db.delete(schema.uniformatCodes).where(eq(schema.uniformatCodes.code, uniformatCode));
    }
  });

  async function seedHistoryEntry(description: string): Promise<string> {
    const maintenanceSchema = require('@shared/schemas/maintenance') as typeof import('@shared/schemas/maintenance');
    const [hist] = await db
      .insert(maintenanceSchema.elementHistory)
      .values({
        elementId,
        eventType: 'repair',
        eventDate: '2024-01-15',
        workDescription: description,
        createdBy: adminUserId,
      })
      .returning({ id: maintenanceSchema.elementHistory.id });
    createdHistoryIds.push(hist.id);
    return hist.id;
  }

  async function seedAuditRow(
    historyId: string,
    performedBy: string | null,
    changes: Record<string, unknown>,
    createdAt?: Date,
  ): Promise<string> {
    const maintenanceSchema = require('@shared/schemas/maintenance') as typeof import('@shared/schemas/maintenance');
    const [row] = await db
      .insert(maintenanceSchema.elementHistoryAuditLog)
      .values({
        historyId,
        action: 'updated' as const,
        performedBy,
        changes,
        ...(createdAt ? { createdAt } : {}),
      })
      .returning({ id: maintenanceSchema.elementHistoryAuditLog.id });
    createdAuditIds.push(row.id);
    return row.id;
  }

  it('(a) returns audit rows newest-first with resolved editor display name', async () => {
    const historyId = await seedHistoryEntry('Test entry for ordering');

    const older = new Date('2024-03-01T10:00:00Z');
    const newer = new Date('2024-03-02T10:00:00Z');

    await seedAuditRow(historyId, adminUserId, { workDescription: { before: 'old', after: 'new1' } }, older);
    await seedAuditRow(historyId, managerUserId, { workDescription: { before: 'new1', after: 'new2' } }, newer);

    const res = await request
      .get(`/api/maintenance/history/${historyId}/audit`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const entries = res.body.entries as Array<{ editorName: string; createdAt: string }>;
    expect(entries).toHaveLength(2);

    // Newest first
    const [first, second] = entries;
    expect(new Date(first.createdAt).getTime()).toBeGreaterThan(new Date(second.createdAt).getTime());

    // Editor names resolved
    expect(first.editorName).toBe('Audit Manager');
    expect(second.editorName).toBe('Audit Admin');
  }, 30000);

  it('(b) labels legacy MCP_API_KEY edits (null performedBy + meta.source) as "System"', async () => {
    const historyId = await seedHistoryEntry('MCP_API_KEY test entry');

    await seedAuditRow(historyId, null, {
      workDescription: { before: 'before', after: 'after' },
      meta: { system: true, source: 'mcp_api_key' },
    });

    const res = await request
      .get(`/api/maintenance/history/${historyId}/audit`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(200);
    const entries = res.body.entries as Array<{ editorName: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].editorName).toBe('System');
  }, 30000);

  it('(c) rejects tenants with 403', async () => {
    const historyId = await seedHistoryEntry('Tenant rejection test');

    const res = await request
      .get(`/api/maintenance/history/${historyId}/audit`)
      .set('x-test-user-id', tenantUserId);

    expect(res.status).toBe(403);
  }, 30000);

  it('(c) rejects admins without building access with 403', async () => {
    const historyId = await seedHistoryEntry('Outsider rejection test');

    const res = await request
      .get(`/api/maintenance/history/${historyId}/audit`)
      .set('x-test-user-id', outsiderAdminId);

    expect(res.status).toBe(403);
  }, 30000);

  it('(d) returns an empty list (not 404) when there are no audit rows for a history entry', async () => {
    const historyId = await seedHistoryEntry('No edits entry');

    const res = await request
      .get(`/api/maintenance/history/${historyId}/audit`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entries).toEqual([]);
  }, 30000);

  it('returns 404 for a non-existent history entry id', async () => {
    const fakeId = randomUUID();
    const res = await request
      .get(`/api/maintenance/history/${fakeId}/audit`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(404);
  }, 30000);

  // ── W37: source column on element_history ──────────────────────────────────

  it('(W37) element_history rows created via REST API default to source=manual', async () => {
    const maintenanceSchema = require('@shared/schemas/maintenance') as typeof import('@shared/schemas/maintenance');
    const historyId = await seedHistoryEntry('W37 source default test');

    const [row] = await db
      .select({ source: maintenanceSchema.elementHistory.source })
      .from(maintenanceSchema.elementHistory)
      .where(eq(maintenanceSchema.elementHistory.id, historyId));

    expect(row).toBeDefined();
    expect(row!.source).toBe('manual');
  }, 30000);

  // ── W38: action + auditSource + before/after snapshots ────────────────────

  it('(W38) seed audit rows carry action field and it is exposed in GET response', async () => {
    const maintenanceSchema = require('@shared/schemas/maintenance') as typeof import('@shared/schemas/maintenance');
    const historyId = await seedHistoryEntry('W38 action field test');

    // Seed a 'created' audit row directly to verify schema.
    const [createdRow] = await db
      .insert(maintenanceSchema.elementHistoryAuditLog)
      .values({
        historyId,
        action: 'created' as const,
        auditSource: 'rest_api' as const,
        performedBy: adminUserId,
        previousValues: null,
        newValues: { eventType: 'repair' },
      })
      .returning({ id: maintenanceSchema.elementHistoryAuditLog.id });
    createdAuditIds.push(createdRow.id);

    const res = await request
      .get(`/api/maintenance/history/${historyId}/audit`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(200);
    const entries = res.body.entries as Array<{ action?: string; auditSource?: string }>;
    const matched = entries.find((e) => (e as any).id === createdRow.id || (e as any).action === 'created');
    expect(matched).toBeDefined();
    expect(matched!.action).toBe('created');
  }, 30000);

  it('(W38) audit rows with previousValues/newValues survive and are queryable', async () => {
    const maintenanceSchema = require('@shared/schemas/maintenance') as typeof import('@shared/schemas/maintenance');
    const historyId = await seedHistoryEntry('W38 before/after snapshot test');
    const prev = { eventType: 'repair', workDescription: 'old description' };
    const next = { eventType: 'repair', workDescription: 'new description' };

    const [row] = await db
      .insert(maintenanceSchema.elementHistoryAuditLog)
      .values({
        historyId,
        action: 'updated' as const,
        auditSource: 'rest_api' as const,
        performedBy: adminUserId,
        previousValues: prev,
        newValues: next,
        changes: { workDescription: { from: 'old description', to: 'new description' } },
      })
      .returning({ id: maintenanceSchema.elementHistoryAuditLog.id });
    createdAuditIds.push(row.id);

    const [fetched] = await db
      .select({
        previousValues: maintenanceSchema.elementHistoryAuditLog.previousValues,
        newValues: maintenanceSchema.elementHistoryAuditLog.newValues,
      })
      .from(maintenanceSchema.elementHistoryAuditLog)
      .where(eq(maintenanceSchema.elementHistoryAuditLog.id, row.id));

    expect(fetched).toBeDefined();
    expect(fetched!.previousValues).toMatchObject(prev);
    expect(fetched!.newValues).toMatchObject(next);
  }, 30000);

  it('(W38) deleted-action audit row persists after element_history deletion with history_id=NULL', async () => {
    const maintenanceSchema = require('@shared/schemas/maintenance') as typeof import('@shared/schemas/maintenance');
    const historyId = await seedHistoryEntry('W38 deleted tombstone test');
    const prev = { id: historyId, eventType: 'repair' };

    // Insert 'deleted' audit row with a valid FK reference.
    const [auditRow] = await db
      .insert(maintenanceSchema.elementHistoryAuditLog)
      .values({
        historyId,
        action: 'deleted' as const,
        auditSource: 'rest_api' as const,
        performedBy: adminUserId,
        previousValues: prev,
        newValues: null,
      })
      .returning({ id: maintenanceSchema.elementHistoryAuditLog.id });
    // Don't push to createdAuditIds — the row will remain after history deletion.

    // Delete the element_history row. ON DELETE SET NULL should set history_id → NULL.
    await db
      .delete(maintenanceSchema.elementHistory)
      .where(eq(maintenanceSchema.elementHistory.id, historyId));
    // Remove from cleanup list since it's already deleted.
    const idx = createdHistoryIds.indexOf(historyId);
    if (idx !== -1) createdHistoryIds.splice(idx, 1);

    // The audit row should still exist with history_id = NULL.
    const [tombstone] = await db
      .select({
        id: maintenanceSchema.elementHistoryAuditLog.id,
        historyId: maintenanceSchema.elementHistoryAuditLog.historyId,
        action: maintenanceSchema.elementHistoryAuditLog.action,
        previousValues: maintenanceSchema.elementHistoryAuditLog.previousValues,
      })
      .from(maintenanceSchema.elementHistoryAuditLog)
      .where(eq(maintenanceSchema.elementHistoryAuditLog.id, auditRow.id));

    expect(tombstone).toBeDefined();
    expect(tombstone!.historyId).toBeNull();
    expect(tombstone!.action).toBe('deleted');
    expect((tombstone!.previousValues as any)?.id).toBe(historyId);

    // Clean up the tombstone directly.
    await db
      .delete(maintenanceSchema.elementHistoryAuditLog)
      .where(eq(maintenanceSchema.elementHistoryAuditLog.id, auditRow.id));
  }, 30000);
});
