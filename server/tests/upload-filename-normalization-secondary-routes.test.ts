/**
 * End-to-end verification that the *remaining* multer-backed upload routes
 * (the ones not covered by `upload-filename-normalization-integration.test.ts`)
 * also handle French / diacritic / special-character filenames correctly.
 *
 * Sites covered here:
 *   - server/api/feature-requests.ts  (POST /api/feature-requests)
 *   - server/api/bugs.ts              (POST /api/bugs)
 *   - server/routes.ts                (POST /api/upload — generic upload used
 *                                      by demands, which then hits POST
 *                                      /api/demands and persists fileName)
 *
 * Sites audited but *not* asserted via DB here (no `fileName`/`filePath` is
 * persisted to the database for these routes — they only buffer a file in
 * memory for transient processing):
 *   - server/api/ai-document-analysis.ts (POST /api/ai/analyze-document):
 *     transient AI analysis only; result is returned in the JSON response,
 *     not stored. `defParamCharset: 'utf8'` was added so the analyzer still
 *     receives the correct original name in logs / Gemini prompts.
 *   - server/middleware/fileUpload.ts (uploadInvoiceFile, used by
 *     /api/invoices/extract-data): transient extraction only; nothing
 *     persisted to DB. `defParamCharset: 'utf8'` was added for parity.
 *   - server/api/optimized-documents.ts (POST /api/documents/optimized-upload):
 *     legacy optimized-storage path. The DB row uses the user-supplied
 *     `name` field (not the original filename), and the storage layer's
 *     `generateSecureFilename` already wraps the canonical
 *     `normalizeFilename` (see optimized-file-storage.ts). Adding
 *     `defParamCharset: 'utf8'` keeps the originalname utf8 in case any
 *     future caller starts persisting it.
 *
 * The fixture filename uses French diacritics and whitespace
 * ("Procès-verbal été 2024.pdf") so any future regression in either the
 * multer charset config or the normalizer surfaces immediately.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { testApp as app } from './test-app';
import { db } from '../db';
import {
  users,
  organizations,
  buildings,
  userOrganizations,
  userBuildings,
  userResidences,
  residences,
  demands,
  bugs,
  featureRequests,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { normalizeFilename } from '../utils/filenameNormalization';

const FRENCH_FILENAME = 'Procès-verbal été 2024.pdf';
const EXPECTED_NORMALIZED = 'proces-verbal_ete_2024.pdf';

describe('Upload filename normalization — secondary routes (end-to-end)', () => {
  const FIXTURES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
  const TEST_PDF_PATH = path.join(FIXTURES_DIR, 'french-upload-secondary.pdf');

  let testOrg: any;
  let testBuilding: any;
  let testResidence: any;
  let testUser: any;

  const createdBugIds = new Set<string>();
  const createdFeatureRequestIds = new Set<string>();
  const createdDemandIds = new Set<string>();

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
        name: 'French Upload Test Org (secondary)',
        type: 'management_company',
        address: '1 Test',
        city: 'Montreal',
        postalCode: 'H1H 1H1',
        email: `french-upload-secondary-${Date.now()}@example.com`,
      })
      .returning();
    testOrg = orgRows[0];

    const buildingRows = await db
      .insert(buildings)
      .values({
        name: 'French Upload Test Building (secondary)',
        address: '1 Test',
        city: 'Montreal',
        postalCode: 'H1H 1H1',
        buildingType: 'apartment',
        totalUnits: 1,
        organizationId: testOrg.id,
      })
      .returning();
    testBuilding = buildingRows[0];

    const residenceRows = await db
      .insert(residences)
      .values({
        buildingId: testBuilding.id,
        unitNumber: '101',
        floor: 1,
      } as any)
      .returning();
    testResidence = residenceRows[0];

    const userRows = await db
      .insert(users)
      .values({
        username: `french-upload-sec-${Date.now()}`,
        email: `french-upload-sec-user-${Date.now()}@example.com`,
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

    await db.insert(userBuildings).values({
      userId: testUser.id,
      buildingId: testBuilding.id,
      relationshipType: 'manager',
      isActive: true,
    });

    await db.insert(userResidences).values({
      userId: testUser.id,
      residenceId: testResidence.id,
      relationshipType: 'tenant',
      startDate: '2024-01-01' as any,
      isActive: true,
    } as any);
  });

  afterAll(async () => {
    try {
      for (const id of createdBugIds) {
        await db.delete(bugs).where(eq(bugs.id, id));
      }
      for (const id of createdFeatureRequestIds) {
        await db.delete(featureRequests).where(eq(featureRequests.id, id));
      }
      for (const id of createdDemandIds) {
        await db.delete(demands).where(eq(demands.id, id));
      }
      if (testUser?.id) {
        await db.delete(userResidences).where(eq(userResidences.userId, testUser.id));
        await db.delete(userBuildings).where(eq(userBuildings.userId, testUser.id));
        await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUser.id));
        await db.delete(users).where(eq(users.id, testUser.id));
      }
      if (testResidence?.id) {
        await db.delete(residences).where(eq(residences.id, testResidence.id));
      }
      if (testBuilding?.id) {
        await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
      }
      if (testOrg?.id) {
        await db.delete(organizations).where(eq(organizations.id, testOrg.id));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[upload-filename-normalization-secondary] cleanup failed:', err);
    }

    if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
  });

  /**
   * Sanity guard: if anyone weakens the canonical normalizer, every
   * downstream assertion in this file would silently shift, so we pin the
   * exact expected output once.
   */
  it('normalizer pins the expected output for the French fixture name', () => {
    expect(normalizeFilename(FRENCH_FILENAME)).toBe(EXPECTED_NORMALIZED);
  });

  it('POST /api/bugs persists normalized fileName and matching filePath', async () => {
    const res = await request(app)
      .post('/api/bugs')
      .set('x-test-user-id', testUser.id)
      .field('title', 'French bug')
      .field('description', 'A bug with a French attachment name')
      .field('category', 'functionality')
      .field('page', '/test')
      .field('priority', 'low')
      .attach('attachment', TEST_PDF_PATH, FRENCH_FILENAME);

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(201);
    const bugId: string = res.body.id;
    expect(bugId).toBeTruthy();
    createdBugIds.add(bugId);

    const rows = await db.select().from(bugs).where(eq(bugs.id, bugId));
    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(row.fileName, '/api/bugs: fileName must equal normalizeFilename(originalName)')
      .toBe(EXPECTED_NORMALIZED);
    expect(row.filePath, '/api/bugs: filePath must be persisted').toBeTruthy();
    expect(
      row.filePath!.endsWith(EXPECTED_NORMALIZED),
      `/api/bugs: filePath ("${row.filePath}") must end with "${EXPECTED_NORMALIZED}"`,
    ).toBe(true);
  });

  it('POST /api/feature-requests persists normalized fileName and matching filePath', async () => {
    const res = await request(app)
      .post('/api/feature-requests')
      .set('x-test-user-id', testUser.id)
      .field('title', 'French feature request')
      .field('description', 'A feature request with a French attachment name')
      .field('need', 'Support French filenames everywhere')
      .field('category', 'document_management')
      .field('page', '/test')
      .attach('file', TEST_PDF_PATH, FRENCH_FILENAME);

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(201);
    const featureRequestId: string = res.body.id;
    expect(featureRequestId).toBeTruthy();
    createdFeatureRequestIds.add(featureRequestId);

    const rows = await db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.id, featureRequestId));
    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(
      row.fileName,
      '/api/feature-requests: fileName must equal normalizeFilename(originalName)',
    ).toBe(EXPECTED_NORMALIZED);
    expect(row.filePath, '/api/feature-requests: filePath must be persisted').toBeTruthy();
    expect(
      row.filePath!.endsWith(EXPECTED_NORMALIZED),
      `/api/feature-requests: filePath ("${row.filePath}") must end with "${EXPECTED_NORMALIZED}"`,
    ).toBe(true);
  });

  it('POST /api/upload preserves utf8 originalName for French filenames', async () => {
    // /api/upload (used by demands) renames the file on disk to a
    // server-generated demand-${ts}-${rand}.pdf and returns the original
    // (untouched) filename in `files[0].originalName`. The DB row created
    // later by POST /api/demands stores that value verbatim. The thing we
    // need to guard against is multer mangling the multipart filename when
    // it isn't told to parse it as utf8.
    const res = await request(app)
      .post('/api/upload')
      .set('x-test-user-id', testUser.id)
      .attach('file', TEST_PDF_PATH, FRENCH_FILENAME);

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(200);
    expect(res.body?.files).toHaveLength(1);
    expect(
      res.body.files[0].originalName,
      '/api/upload: originalName must round-trip as utf8',
    ).toBe(FRENCH_FILENAME);
    expect(
      res.body.files[0].url,
      '/api/upload: url should point at /uploads/demands/',
    ).toMatch(/^\/uploads\/demands\/demand-\d+-\d+\.pdf$/);
  });

  it('POST /api/demands persists the utf8 original filename returned by /api/upload', async () => {
    // First upload the file via the generic /api/upload endpoint…
    const uploadRes = await request(app)
      .post('/api/upload')
      .set('x-test-user-id', testUser.id)
      .attach('file', TEST_PDF_PATH, FRENCH_FILENAME);
    expect(uploadRes.status).toBe(200);

    const attachment = uploadRes.body.files[0];
    expect(attachment.originalName).toBe(FRENCH_FILENAME);

    // …then create the demand referencing that attachment, exactly as the
    // SPA does.
    const res = await request(app)
      .post('/api/demands')
      .set('x-test-user-id', testUser.id)
      .send({
        type: 'maintenance',
        description: 'Une demande avec une pièce jointe accentuée — test',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        attachments: [
          {
            url: attachment.url,
            originalName: attachment.originalName,
            size: attachment.size,
          },
        ],
      });

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(201);
    const demandId: string = res.body.id;
    expect(demandId).toBeTruthy();
    createdDemandIds.add(demandId);

    const rows = await db.select().from(demands).where(eq(demands.id, demandId));
    expect(rows).toHaveLength(1);
    const row = rows[0];

    // The demand flow intentionally stores the *original* user-facing
    // filename verbatim (it doesn't run it through the normalizer — the
    // server-generated `filePath` uses a synthetic demand-{ts}-{rand}{ext}
    // name instead). The thing we MUST guarantee is that the utf8 bytes
    // survive the multipart round-trip.
    expect(row.fileName, '/api/demands: fileName must preserve utf8 original').toBe(
      FRENCH_FILENAME,
    );
    expect(row.filePath, '/api/demands: filePath must be persisted').toBe(attachment.url);
  });
});
