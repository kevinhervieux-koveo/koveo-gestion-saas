/**
 * @jest-environment node
 *
 * Integration tests for the lastInspectionDate forward-only guard (Task #971).
 *
 * Exercises the real HTTP route against a live Postgres DB to verify:
 *
 *   1. Inserting inspection-type events in non-chronological order leaves
 *      building_elements.lastInspectionDate equal to MAX(eventDate).
 *   2. A later non-inspection event (replacement, major_rehab, construction)
 *      does NOT change lastInspectionDate.
 *
 * Tests skip automatically when _INTEGRATION_DB_URL is absent (unit tier).
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

// ── Service mocks ─────────────────────────────────────────────────────────────
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

// ── DB availability guard ─────────────────────────────────────────────────────
const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('lastInspectionDate forward-only guard — integration (real Postgres)', () => {
  const runId = randomUUID().slice(0, 8);
  let db: Db;
  let schema: Schema;
  let request: ReturnType<typeof supertest>;

  let orgId: string;
  let buildingId: string;
  let adminUserId: string;
  let uniformatCode: string;
  let createdOrgHere = false;
  let createdUniformatHere = false;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;

    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.NODE_ENV = 'test';

    jest.resetModules();

    db = (require('../db') as { db: Db }).db;
    schema = require('@shared/schema') as Schema;

    // Reuse or create an organisation
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
          name: `lid-integ-org-${runId}`,
          type: 'demo',
          address: '1 Test St',
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
        name: `lid-integ-bldg-${runId}`,
        address: '100 Integration Ave',
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
        email: `lid-integ-admin-${runId}@koveo.test`,
        username: `lid-integ-admin-${runId}`,
        password: 'x',
        firstName: 'Admin',
        lastName: 'IntegTest',
        role: 'admin',
        isActive: true,
      })
      .returning({ id: schema.users.id });
    adminUserId = adminRow.id;

    await db.insert(schema.userBuildings).values([
      { userId: adminUserId, buildingId, relationshipType: 'owner', isActive: true },
    ]);

    const [existingCode] = await db
      .select({ code: schema.uniformatCodes.code })
      .from(schema.uniformatCodes)
      .limit(1);

    if (existingCode) {
      uniformatCode = existingCode.code;
    } else {
      const code = `T971-${runId.slice(0, 4)}`;
      await db.insert(schema.uniformatCodes).values({
        code,
        level: 1,
        nameFr: 'Test',
        nameEn: 'Test',
      });
      uniformatCode = code;
      createdUniformatHere = true;
    }

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
    if (adminUserId) {
      await db.delete(schema.userBuildings).where(eq(schema.userBuildings.userId, adminUserId));
      await db.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, adminUserId));
      await db.delete(schema.users).where(eq(schema.users.id, adminUserId));
    }
    if (buildingId) await db.delete(schema.buildings).where(eq(schema.buildings.id, buildingId));
    if (createdOrgHere && orgId) await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (createdUniformatHere && uniformatCode) {
      await db.delete(schema.uniformatCodes).where(eq(schema.uniformatCodes.code, uniformatCode));
    }
  });

  async function seedElement(label: string): Promise<string> {
    const [elem] = await db
      .insert(schema.buildingElements)
      .values({
        buildingId,
        uniformatCode,
        name: `lid-elem-${runId}-${label}`,
        currentCondition: 'good',
        isActive: true,
      })
      .returning({ id: schema.buildingElements.id });
    return elem.id;
  }

  async function fetchLastInspectionDate(elementId: string): Promise<string | null> {
    const [row] = await db
      .select({ lastInspectionDate: schema.buildingElements.lastInspectionDate })
      .from(schema.buildingElements)
      .where(eq(schema.buildingElements.id, elementId))
      .limit(1);
    return row?.lastInspectionDate ?? null;
  }

  async function postHistory(elementId: string, eventType: string, eventDate: string) {
    return request
      .post(`/api/maintenance/elements/${elementId}/history`)
      .set('x-test-user-id', adminUserId)
      .send({ eventType, eventDate, description: 'Integration test history entry' });
  }

  it('sets lastInspectionDate to MAX(eventDate) after non-chronological inspection events', async () => {
    const elementId = await seedElement('ooo');
    try {
      // Insert repair/minor_rehab events out of chronological order
      const events = [
        { type: 'repair',      date: '2024-06-15' },
        { type: 'minor_rehab', date: '2023-01-10' }, // older — must NOT clobber 2024-06-15
        { type: 'repair',      date: '2025-11-20' }, // newer — must advance to this
        { type: 'minor_rehab', date: '2022-03-05' }, // oldest — must NOT clobber 2025-11-20
      ];

      for (const ev of events) {
        const res = await postHistory(elementId, ev.type, ev.date);
        expect(res.status).toBe(201);
      }

      const lastInspectionDate = await fetchLastInspectionDate(elementId);
      expect(lastInspectionDate).toBe('2025-11-20'); // must equal MAX(eventDate)
    } finally {
      await db.delete(schema.elementHistory).where(eq(schema.elementHistory.elementId, elementId));
      await db.delete(schema.buildingElements).where(eq(schema.buildingElements.id, elementId));
    }
  });

  it('does NOT change lastInspectionDate after a later non-inspection event', async () => {
    const elementId = await seedElement('nonisp');
    try {
      // Establish a known lastInspectionDate via a repair event
      const repairRes = await postHistory(elementId, 'repair', '2024-09-01');
      expect(repairRes.status).toBe(201);
      expect(await fetchLastInspectionDate(elementId)).toBe('2024-09-01');

      // Insert a replacement event with a later date — must NOT change lastInspectionDate
      const replaceRes = await postHistory(elementId, 'replacement', '2025-12-31');
      expect(replaceRes.status).toBe(201);
      expect(await fetchLastInspectionDate(elementId)).toBe('2024-09-01');

      // Same check for major_rehab
      const majorRes = await postHistory(elementId, 'major_rehab', '2026-06-15');
      expect(majorRes.status).toBe(201);
      expect(await fetchLastInspectionDate(elementId)).toBe('2024-09-01');
    } finally {
      await db.delete(schema.elementHistory).where(eq(schema.elementHistory.elementId, elementId));
      await db.delete(schema.buildingElements).where(eq(schema.buildingElements.id, elementId));
    }
  });
});
