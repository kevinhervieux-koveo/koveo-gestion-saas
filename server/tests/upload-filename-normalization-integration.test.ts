/**
 * End-to-end verification that uploads through every public upload site
 * persist a database `fileName` matching `normalizeFilename(originalName)`
 * and a `filePath` whose final segment ends with that same normalized
 * name (after the `${uuid}_` prefix that hierarchical paths use).
 *
 * Covers the three call sites that share the canonical normalizer
 * unified in Task #393:
 *   - server/api/documents.ts  (POST /api/documents)
 *   - server/api/bills.ts      (POST /api/bills/:id/upload-document)
 *   - server/api/maintenance.ts (POST /api/maintenance/elements/:id/documents)
 *
 * The fixture filename uses French diacritics and whitespace
 * ("Procès-verbal été 2024.pdf") so any future regression in the
 * normalizer (e.g. losing diacritic stripping or whitespace collapsing)
 * surfaces immediately.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { testApp as app } from './test-app';
import { db } from '../db';
import {
  documents,
  users,
  organizations,
  buildings,
  userOrganizations,
  bills,
  userBuildings,
} from '@shared/schema';
import {
  buildingElements,
  elementDocuments,
  uniformatCodes,
} from '@shared/schemas/maintenance';
import { eq } from 'drizzle-orm';
import { normalizeFilename } from '../utils/filenameNormalization';

const FRENCH_FILENAME = 'Procès-verbal été 2024.pdf';
const EXPECTED_NORMALIZED = 'proces-verbal_ete_2024.pdf';

describe('Upload filename normalization (end-to-end)', () => {
  const FIXTURES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
  const TEST_PDF_PATH = path.join(FIXTURES_DIR, 'french-upload.pdf');

  let testOrg: any;
  let testBuilding: any;
  let testUser: any;
  let testBillId: string;
  let testElementId: string;
  let createdUniformatCode: string | null = null;

  // Track ids we create so we can clean them up regardless of which
  // assertion fails.
  const createdDocumentIds = new Set<string>();
  const createdElementDocumentIds = new Set<string>();

  beforeAll(async () => {
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    // Minimal valid PDF (matches the magic-number check used by every
    // upload site).
    const pdfContent =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n204\n%%EOF';
    fs.writeFileSync(TEST_PDF_PATH, pdfContent);

    const orgRows = await db
      .insert(organizations)
      .values({
        name: 'French Upload Test Org',
        type: 'management_company',
        address: '1 Test',
        city: 'Montreal',
        postalCode: 'H1H 1H1',
        email: `french-upload-${Date.now()}@example.com`,
      })
      .returning();
    testOrg = orgRows[0];

    const buildingRows = await db
      .insert(buildings)
      .values({
        name: 'French Upload Test Building',
        address: '1 Test',
        city: 'Montreal',
        postalCode: 'H1H 1H1',
        buildingType: 'apartment',
        totalUnits: 1,
        organizationId: testOrg.id,
      })
      .returning();
    testBuilding = buildingRows[0];

    const userRows = await db
      .insert(users)
      .values({
        username: `french-upload-${Date.now()}`,
        email: `french-upload-user-${Date.now()}@example.com`,
        password: 'dummy-hash',
        firstName: 'French',
        lastName: 'Upload',
        role: 'admin',
      })
      .returning();
    testUser = userRows[0];

    await db.insert(userOrganizations).values({
      userId: testUser.id,
      organizationId: testOrg.id,
      organizationRole: 'admin',
      isActive: true,
    });

    // Maintenance routes additionally check `user_buildings`.
    await db.insert(userBuildings).values({
      userId: testUser.id,
      buildingId: testBuilding.id,
      relationshipType: 'manager',
      isActive: true,
    });

    // Seed a bill so we can hit POST /api/bills/:id/upload-document.
    const billRows = await db
      .insert(bills)
      .values({
        buildingId: testBuilding.id,
        billNumber: `FR-UPLOAD-${Date.now()}`,
        title: 'French upload bill',
        category: 'insurance' as any,
        paymentType: 'unique' as any,
        costs: ['100.00'] as any,
        totalAmount: '100.00' as any,
        startDate: '2024-01-01' as any,
        status: 'draft' as any,
        createdBy: testUser.id,
      } as any)
      .returning();
    testBillId = billRows[0].id;

    // Building element + uniformat code for maintenance upload.
    const existingCode = await db
      .select({ code: uniformatCodes.code })
      .from(uniformatCodes)
      .limit(1);
    let uniformatCode: string;
    if (existingCode.length > 0) {
      uniformatCode = existingCode[0].code;
    } else {
      uniformatCode = `T${Math.floor(Math.random() * 9000) + 1000}`;
      await db.insert(uniformatCodes).values({
        code: uniformatCode,
        level: 1,
        nameFr: 'Test cadre',
        nameEn: 'Test frame',
      });
      createdUniformatCode = uniformatCode;
    }

    const elementId = crypto.randomUUID();
    await db.insert(buildingElements).values({
      id: elementId,
      buildingId: testBuilding.id,
      uniformatCode,
      name: 'French upload element',
    });
    testElementId = elementId;
  });

  afterAll(async () => {
    try {
      for (const id of createdElementDocumentIds) {
        await db.delete(elementDocuments).where(eq(elementDocuments.id, id));
      }
      if (testElementId) {
        await db
          .delete(elementDocuments)
          .where(eq(elementDocuments.elementId, testElementId));
        await db.delete(buildingElements).where(eq(buildingElements.id, testElementId));
      }
      if (createdUniformatCode) {
        await db.delete(uniformatCodes).where(eq(uniformatCodes.code, createdUniformatCode));
      }
      for (const id of createdDocumentIds) {
        await db.delete(documents).where(eq(documents.id, id));
      }
      if (testBillId) {
        // Bill upload also creates a row in `documents` linked by attachedTo
        // — clean up any document rows that point at our bill or building.
        await db.delete(documents).where(eq(documents.buildingId, testBuilding.id));
        await db.delete(bills).where(eq(bills.id, testBillId));
      }
      if (testUser?.id) {
        await db.delete(userBuildings).where(eq(userBuildings.userId, testUser.id));
        await db
          .delete(userOrganizations)
          .where(eq(userOrganizations.userId, testUser.id));
        await db.delete(users).where(eq(users.id, testUser.id));
      }
      if (testBuilding?.id) {
        await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
      }
      if (testOrg?.id) {
        await db.delete(organizations).where(eq(organizations.id, testOrg.id));
      }
    } catch (err) {
      console.error('[upload-filename-normalization] cleanup failed:', err);
    }

    if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
  });

  /**
   * The filePath produced by the upload sites uses one of two shapes:
   *   1. Object Storage / hierarchical path:
   *      `<prefix>/<uuid>_<normalized>` — fileName === normalized.
   *   2. Local fallback (some sites prepend a uuid to fileName too):
   *      `<prefix>/<uuid>_<normalized>` — fileName === `<uuid>_<normalized>`.
   * In both cases `filePath.endsWith(fileName)` should be true and the
   * trailing portion of the filePath should end with the normalized name.
   */
  function assertNormalizedNamePersisted(opts: {
    label: string;
    fileName: string | null | undefined;
    filePath: string | null | undefined;
  }) {
    const { label, fileName, filePath } = opts;
    expect(fileName, `${label}: fileName must be persisted`).toBeTruthy();
    expect(filePath, `${label}: filePath must be persisted`).toBeTruthy();
    expect(fileName, `${label}: fileName must equal normalizeFilename(originalName)`)
      .toBe(EXPECTED_NORMALIZED);
    expect(
      normalizeFilename(FRENCH_FILENAME),
      `${label}: sanity – normalizer output is stable`,
    ).toBe(EXPECTED_NORMALIZED);
    expect(
      filePath!.endsWith(EXPECTED_NORMALIZED),
      `${label}: filePath ("${filePath}") must end with normalized name "${EXPECTED_NORMALIZED}"`,
    ).toBe(true);
  }

  it('POST /api/documents persists normalized fileName and matching filePath', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('x-test-user-id', testUser.id)
      .field('name', 'French Document')
      .field('documentType', 'legal')
      .field('buildingId', testBuilding.id)
      .field('isVisibleToTenants', 'false')
      .attach('file', TEST_PDF_PATH, FRENCH_FILENAME);

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(201);
    const documentId: string = res.body.id;
    expect(documentId).toBeTruthy();
    createdDocumentIds.add(documentId);

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    expect(rows).toHaveLength(1);
    const row = rows[0];

    assertNormalizedNamePersisted({
      label: '/api/documents',
      fileName: row.fileName,
      filePath: row.filePath,
    });
  });

  it('POST /api/bills/:id/upload-document persists normalized fileName and matching filePath', async () => {
    const res = await request(app)
      .post(`/api/bills/${testBillId}/upload-document`)
      .set('x-test-user-id', testUser.id)
      .attach('document', TEST_PDF_PATH, FRENCH_FILENAME);

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(200);

    const rows = await db.select().from(bills).where(eq(bills.id, testBillId));
    expect(rows).toHaveLength(1);
    const bill = rows[0];

    assertNormalizedNamePersisted({
      label: '/api/bills/:id/upload-document',
      fileName: bill.fileName,
      filePath: bill.filePath,
    });
  });

  it('POST /api/maintenance/elements/:id/documents persists normalized fileName and matching filePath', async () => {
    const res = await request(app)
      .post(`/api/maintenance/elements/${testElementId}/documents`)
      .set('x-test-user-id', testUser.id)
      .attach('file', TEST_PDF_PATH, FRENCH_FILENAME);

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(201);
    const elementDocId: string = res.body?.data?.id;
    expect(elementDocId).toBeTruthy();
    createdElementDocumentIds.add(elementDocId);

    const rows = await db
      .select()
      .from(elementDocuments)
      .where(eq(elementDocuments.id, elementDocId));
    expect(rows).toHaveLength(1);
    const row = rows[0];

    assertNormalizedNamePersisted({
      label: '/api/maintenance/elements/:id/documents',
      fileName: row.fileName,
      filePath: row.filePath,
    });
  });
});
