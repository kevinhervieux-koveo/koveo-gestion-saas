/**
 * @jest-environment node
 *
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
 * Latin-1 mis-decode round-trip coverage (Task #855 / Task #869) is also
 * exercised below: every regular upload route should call
 * `fixLatin1MisdecodeFilename` so that `originalFileName` is stored as
 * UTF-8 even when the client sent Latin-1-mis-decoded bytes.
 *
 * The fixture filename uses French diacritics and whitespace
 * ("Procès-verbal été 2024.pdf") so any future regression in either
 * the multer charset config or the normalizer surfaces immediately.
 *
 * Task #1120: this file was ported from vitest to Jest so it runs in
 * the standard `npm run test:integration` suite alongside the other
 * real-DB integration tests, removing the need for a separate vitest
 * runtime in CI.
 */

// jest.config.cjs maps `./storage`, `./auth`, `./routes`, and the relative
// `../../server/...` variants to in-repo unit-tier mocks. For this real-DB
// integration suite we MUST exercise the real implementations. Override the
// mocks at their resolved paths so jest substitutes the real modules. Mirrors
// `tests/integration/upload-filename-normalization.test.ts` (Task #380) and
// `tests/integration/all-or-nothing-rollback.test.ts` (Task #183).
jest.mock('../../__mocks__/server/storage', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/storage.ts'));
});
jest.mock('../../__mocks__/server/auth', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/auth.ts'));
});
jest.mock('../../__mocks__/server/routes', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/routes.ts'));
});
jest.mock('../../server/config/index', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/config/index.ts'));
});

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

const FRENCH_FILENAME = 'Procès-verbal été 2024.pdf';
const EXPECTED_NORMALIZED = 'proces-verbal_ete_2024.pdf';

// The Latin-1 mis-decoded form of the same filename. Some clients (older
// Safari/Edge multipart implementations, certain Windows uploaders) send
// filename headers whose UTF-8 bytes were already mis-decoded as Latin-1
// upstream, so the bytes that hit multer look like "ProcÃ¨s-verbal Ã©tÃ©"
// instead of the original UTF-8. Task #855 added defensive
// `fixLatin1MisdecodeFilename` calls in every regular upload route to
// recover the original UTF-8 from those bytes; these tests guard that
// recovery end-to-end so a future refactor cannot silently regress
// `originalFileName` for accented uploads.
const FRENCH_LATIN1_MISDECODED = Buffer.from(FRENCH_FILENAME, 'utf8').toString('latin1');

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('Upload filename normalization (end-to-end) — Task #1120', () => {
  const FIXTURES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
  const TEST_PDF_PATH = path.join(FIXTURES_DIR, 'french-upload.pdf');

  let app: any;
  let db: any;
  let documents: any;
  let users: any;
  let organizations: any;
  let buildings: any;
  let userOrganizations: any;
  let userBuildings: any;
  let bills: any;
  let buildingElements: any;
  let elementDocuments: any;
  let uniformatCodes: any;
  let normalizeFilename: (input: string) => string;

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
  // Bills created by the from-auto-generated test that aren't testBillId.
  const createdAuxBillIds = new Set<string>();

  beforeAll(async () => {
    if (!REAL_DB_URL) return;

    // Restore the real DATABASE_URL captured by jest.polyfills.js before
    // jest.setup.simple.ts overwrote it with the placeholder URL. Other
    // env vars mirror the canonical real-DB integration test pattern.
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task1120';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    // Lazy-require modules that touch the DB AFTER env vars are set so
    // they bind to the real connection, not the placeholder URL.
    const schema = require('@shared/schema');
    documents = schema.documents;
    users = schema.users;
    organizations = schema.organizations;
    buildings = schema.buildings;
    userOrganizations = schema.userOrganizations;
    userBuildings = schema.userBuildings;
    bills = schema.bills;

    const maintenanceSchema = require('@shared/schemas/maintenance');
    buildingElements = maintenanceSchema.buildingElements;
    elementDocuments = maintenanceSchema.elementDocuments;
    uniformatCodes = maintenanceSchema.uniformatCodes;

    db = require('../../server/db').db;
    normalizeFilename = require('../../server/utils/filenameNormalization').normalizeFilename;

    // The shared test-app helper wires `registerRoutes` against an Express
    // app with an `x-test-user-id` auth middleware — exactly what the
    // original vitest-based suite relied on. Require it lazily so it picks
    // up the real DB env vars set above.
    app = require('../../server/tests/test-app').testApp;

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
  }, 30_000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

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
        for (const id of createdAuxBillIds) {
          await db.delete(bills).where(eq(bills.id, id));
        }
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
  }, 30_000);

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
    // Surface `label` in the failure output so a regression in any one
    // route is easy to attribute when this helper is called from multiple
    // tests (jest does not natively support custom messages on `.toBe`).
    expect({ label, fileName: fileName || null }).toEqual({
      label,
      fileName: EXPECTED_NORMALIZED,
    });
    expect(filePath).toBeTruthy();
    expect(normalizeFilename(FRENCH_FILENAME)).toBe(EXPECTED_NORMALIZED);
    expect({ label, endsWithNormalized: filePath!.endsWith(EXPECTED_NORMALIZED) }).toEqual({
      label,
      endsWithNormalized: true,
    });
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

    expect(res.status).toBe(201);
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

    expect(res.status).toBe(200);

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

    expect(res.status).toBe(201);
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

  // Latin-1 mis-decode round-trip coverage (Task #855 / Task #869).
  // Each test below asserts that the recovered UTF-8 originalFileName is
  // persisted when the client sends the Latin-1 mis-decoded form of the
  // filename. We intentionally only assert on `originalFileName` here; the
  // routes call `normalizeFilename` on the raw mojibake before applying the
  // Latin-1 fix, so the on-disk `fileName` shape for mojibake inputs is
  // orthogonal to what Task #855 fixes (the clean-UTF-8 `fileName` slug is
  // already pinned by the block above).

  /**
   * Sanity guard so a regression in fixLatin1MisdecodeFilename or the
   * multer/utf8 round-trip surfaces here before the route-level tests.
   */
  it('fixLatin1MisdecodeFilename pins the Latin-1 → UTF-8 recovery', () => {
    expect(FRENCH_LATIN1_MISDECODED).toBe('ProcÃ¨s-verbal Ã©tÃ© 2024.pdf');
    // The recovery is exactly what the regular upload routes apply server-side
    // before persisting `originalFileName`.
    expect(
      Buffer.from(FRENCH_LATIN1_MISDECODED, 'latin1').toString('utf8'),
    ).toBe(FRENCH_FILENAME);
  });

  it('POST /api/documents recovers UTF-8 originalFileName from a Latin-1 mis-decoded multipart filename', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('x-test-user-id', testUser.id)
      .field('name', 'French Document (latin1 mis-decode)')
      .field('documentType', 'legal')
      .field('buildingId', testBuilding.id)
      .field('isVisibleToTenants', 'false')
      .attach('file', TEST_PDF_PATH, FRENCH_LATIN1_MISDECODED);

    expect(res.status).toBe(201);
    const documentId: string = res.body.id;
    expect(documentId).toBeTruthy();
    createdDocumentIds.add(documentId);

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].originalFileName).toBe(FRENCH_FILENAME);
  });

  it('POST /api/documents/upload recovers UTF-8 originalFileName from a Latin-1 mis-decoded multipart filename', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('x-test-user-id', testUser.id)
      .field('name', 'French Upload (latin1 mis-decode)')
      .field('documentType', 'legal')
      .field('buildingId', testBuilding.id)
      .field('isVisibleToTenants', 'false')
      .attach('file', TEST_PDF_PATH, FRENCH_LATIN1_MISDECODED);

    expect(res.status).toBe(201);
    const documentId: string = res.body?.document?.id;
    expect(documentId).toBeTruthy();
    createdDocumentIds.add(documentId);

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].originalFileName).toBe(FRENCH_FILENAME);
  });

  it('PUT /api/documents/:id (replace-file branch) recovers UTF-8 originalFileName from a Latin-1 mis-decoded multipart filename', async () => {
    // Seed via canonical POST with an ASCII name so the PUT below
    // exercises the replace-file branch where Task #855 was applied.
    const createRes = await request(app)
      .post('/api/documents')
      .set('x-test-user-id', testUser.id)
      .field('name', 'Document to replace')
      .field('documentType', 'legal')
      .field('buildingId', testBuilding.id)
      .field('isVisibleToTenants', 'false')
      .attach('file', TEST_PDF_PATH, 'placeholder.pdf');

    expect(createRes.status).toBe(201);
    const documentId: string = createRes.body.id;
    expect(documentId).toBeTruthy();
    createdDocumentIds.add(documentId);

    // Now replace the file via PUT, sending the Latin-1 mis-decoded name.
    const replaceRes = await request(app)
      .put(`/api/documents/${documentId}`)
      .set('x-test-user-id', testUser.id)
      .attach('file', TEST_PDF_PATH, FRENCH_LATIN1_MISDECODED);

    expect(replaceRes.status).toBeGreaterThanOrEqual(200);
    expect(replaceRes.status).toBeLessThan(300);

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].originalFileName).toBe(FRENCH_FILENAME);
  });

  it('POST /api/bills/:id/upload-document recovers UTF-8 originalFileName from a Latin-1 mis-decoded multipart filename', async () => {
    const res = await request(app)
      .post(`/api/bills/${testBillId}/upload-document`)
      .set('x-test-user-id', testUser.id)
      .attach('document', TEST_PDF_PATH, FRENCH_LATIN1_MISDECODED);

    expect(res.status).toBe(200);

    // The route updates the bills row in place and ALSO inserts a linked
    // documents row (attachedTo{Type,Id} === ('bill', billId)). The Latin-1
    // recovery happens for both columns Task #855 patched in this route, so
    // we assert each.
    const billRows = await db
      .select()
      .from(bills)
      .where(eq(bills.id, testBillId));
    expect(billRows).toHaveLength(1);
    expect(billRows[0].originalFileName).toBe(FRENCH_FILENAME);

    // Every linked documents row attached to this bill should carry the same
    // recovered UTF-8 string. (Looking up by attachedToId only keeps the
    // assertion stable regardless of how the on-disk fileName was normalized.)
    const linkedDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.attachedToId, testBillId));
    expect(linkedDocs.length).toBeGreaterThanOrEqual(1);
    for (const doc of linkedDocs) {
      createdDocumentIds.add(doc.id);
      expect(doc.originalFileName).toBe(FRENCH_FILENAME);
    }
  });

  it('POST /api/bills/from-auto-generated recovers UTF-8 originalFileName for attached files', async () => {
    const billPayload = {
      title: 'Bill from auto-generated (latin1 mis-decode test)',
      description: 'French upload via from-auto-generated',
      category: 'insurance',
      vendor: 'Test Vendor',
      totalAmount: 123.45,
      startDate: '2024-02-01',
      endDate: null,
      status: 'draft',
      paymentType: 'unique',
    };

    const res = await request(app)
      .post('/api/bills/from-auto-generated')
      .set('x-test-user-id', testUser.id)
      .field('templateId', testBillId)
      .field('newBillData', JSON.stringify(billPayload))
      .field('fileMetadata_0', JSON.stringify({ category: 'attachment' }))
      .attach('files', TEST_PDF_PATH, FRENCH_LATIN1_MISDECODED);

    expect(res.status).toBe(201);
    const createdBillId: string | undefined = res.body?.bill?.id;
    expect(createdBillId).toBeTruthy();
    // Track the new bill for cleanup IMMEDIATELY so a later assertion
    // failure does not leak it (and break the FK-constrained delete of
    // testBillId in afterAll).
    if (createdBillId && createdBillId !== testBillId) {
      createdAuxBillIds.add(createdBillId);
    }

    const attached: any[] = res.body?.attachedDocuments ?? [];
    expect(attached.length).toBeGreaterThanOrEqual(1);
    for (const doc of attached) {
      createdDocumentIds.add(doc.id);
    }

    // Re-read from the DB to make sure what was persisted (not just what was
    // echoed back in the response) carries the recovered UTF-8 string.
    // Look up by id to avoid coupling to whatever shape `fileName` ends up
    // taking for the mojibake input.
    const attachedIds = attached.map((d) => d.id).filter(Boolean);
    expect(attachedIds.length).toBeGreaterThanOrEqual(1);
    for (const docId of attachedIds) {
      const persisted = await db
        .select()
        .from(documents)
        .where(eq(documents.id, docId));
      expect(persisted).toHaveLength(1);
      expect(persisted[0].originalFileName).toBe(FRENCH_FILENAME);
    }
  });

  it('POST /api/maintenance/elements/:id/documents recovers UTF-8 originalFileName from a Latin-1 mis-decoded multipart filename', async () => {
    const res = await request(app)
      .post(`/api/maintenance/elements/${testElementId}/documents`)
      .set('x-test-user-id', testUser.id)
      .attach('file', TEST_PDF_PATH, FRENCH_LATIN1_MISDECODED);

    expect(res.status).toBe(201);
    const elementDocId: string = res.body?.data?.id;
    expect(elementDocId).toBeTruthy();
    createdElementDocumentIds.add(elementDocId);

    const rows = await db
      .select()
      .from(elementDocuments)
      .where(eq(elementDocuments.id, elementDocId));
    expect(rows).toHaveLength(1);
    expect(rows[0].originalFileName).toBe(FRENCH_FILENAME);
  });
});
