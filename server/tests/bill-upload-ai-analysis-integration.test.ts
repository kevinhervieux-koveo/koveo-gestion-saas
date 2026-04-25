/**
 * End-to-end coverage for the AI-analysis side of
 * `POST /api/bills/:id/upload-document` (server/api/bills.ts:1791).
 *
 * Task #524 covered the validation layer (auth/file/MIME) of this route.
 * Task #554 (this file) locks in the post-upload AI behaviour that the
 * route currently swallows in a try/catch:
 *
 *   1. Happy path — AI returns a result. The response body, the
 *      `bills` row, AND the linked `documents` row must all reflect the
 *      analyzer output (`isAiAnalyzed = true`, `aiAnalysisData = <result>`).
 *
 *   2. Failure path — AI throws. The upload must still succeed
 *      (HTTP 200), the file metadata must persist, and the AI flags must
 *      be cleared (`isAiAnalyzed = false`, `aiAnalysisData = null`).
 *
 * The route uses the `aiService` singleton from
 * `server/services/consolidated-ai-service`. Both this test and
 * `bills.ts` import the same module instance, so we monkey-patch
 * `aiService.analyzeBillDocument` directly via `vi.spyOn` — no
 * module-level mock is required and the rest of the upload pipeline
 * (multer → magic-number check → object storage / local fallback →
 * db.update → storage.createDocument) runs end-to-end against the real
 * Postgres test database.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
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
import { and, eq } from 'drizzle-orm';
import { aiService } from '../services/consolidated-ai-service';

const FIXTURE_FILENAME = 'bill-ai-success.pdf';

const SAMPLE_ANALYSIS = {
  title: 'Hydro-Québec Bill',
  vendor: 'Hydro-Québec',
  totalAmount: '142.50',
  category: 'utilities' as const,
  description: 'Monthly electricity bill',
  dueDate: '2025-04-15',
  issueDate: '2025-03-15',
  billNumber: 'INV-AI-554',
  confidence: 0.91,
};

describe('POST /api/bills/:id/upload-document — AI analysis end-to-end', () => {
  const FIXTURES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
  const TEST_PDF_PATH = path.join(FIXTURES_DIR, 'bill-ai-analysis.pdf');

  let testOrg: any;
  let testBuilding: any;
  let testUser: any;
  const createdBillIds = new Set<string>();

  beforeAll(async () => {
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    // Minimal valid PDF (matches magic-number check used by the route).
    const pdfContent =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n204\n%%EOF';
    fs.writeFileSync(TEST_PDF_PATH, pdfContent);

    const orgRows = await db
      .insert(organizations)
      .values({
        name: 'Bill AI Test Org',
        type: 'management_company',
        address: '1 Test',
        city: 'Montreal',
        postalCode: 'H1H 1H1',
        email: `bill-ai-${Date.now()}@example.com`,
      })
      .returning();
    testOrg = orgRows[0];

    const buildingRows = await db
      .insert(buildings)
      .values({
        name: 'Bill AI Test Building',
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
        username: `bill-ai-${Date.now()}`,
        email: `bill-ai-user-${Date.now()}@example.com`,
        password: 'dummy-hash',
        firstName: 'Bill',
        lastName: 'AI',
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
  });

  beforeEach(() => {
    // Make sure spies from previous tests don't leak into this one.
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    try {
      // Documents created by the route are linked via attachedToType/Id
      // OR by buildingId — wipe both to be safe.
      await db.delete(documents).where(eq(documents.buildingId, testBuilding.id));

      for (const id of createdBillIds) {
        await db.delete(bills).where(eq(bills.id, id));
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
      console.error('[bill-upload-ai-analysis] cleanup failed:', err);
    }

    if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
  });

  /** Create a fresh draft bill so each test gets an untouched record. */
  async function createBill(suffix: string): Promise<string> {
    const billRows = await db
      .insert(bills)
      .values({
        buildingId: testBuilding.id,
        billNumber: `AI-${suffix}-${Date.now()}`,
        title: `AI bill ${suffix}`,
        category: 'utilities' as any,
        paymentType: 'unique' as any,
        costs: ['100.00'] as any,
        totalAmount: '100.00' as any,
        startDate: '2024-01-01' as any,
        status: 'draft' as any,
        createdBy: testUser.id,
      } as any)
      .returning();
    const id = billRows[0].id;
    createdBillIds.add(id);
    return id;
  }

  it('persists the AI analysis on the bill and the linked document on the happy path', async () => {
    const analyzeSpy = vi
      .spyOn(aiService, 'analyzeBillDocument')
      .mockResolvedValue(SAMPLE_ANALYSIS as any);

    const billId = await createBill('success');

    const res = await request(app)
      .post(`/api/bills/${billId}/upload-document`)
      .set('x-test-user-id', testUser.id)
      .attach('document', TEST_PDF_PATH, FIXTURE_FILENAME);

    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(200);
    expect(res.body).toMatchObject({
      message: 'Document uploaded and analyzed successfully',
      analysisResult: SAMPLE_ANALYSIS,
    });
    expect(res.body.bill?.id).toBe(billId);

    // The route must have invoked the analyzer with the request mimetype.
    expect(analyzeSpy).toHaveBeenCalledTimes(1);
    expect(analyzeSpy).toHaveBeenCalledWith(
      expect.any(String),
      'application/pdf'
    );

    // Bill row should reflect the AI result.
    const billRows = await db.select().from(bills).where(eq(bills.id, billId));
    expect(billRows).toHaveLength(1);
    const billRow = billRows[0];
    expect(billRow.isAiAnalyzed).toBe(true);
    expect(billRow.aiAnalysisData).toMatchObject(SAMPLE_ANALYSIS);
    expect(billRow.fileName).toBeTruthy();
    expect(billRow.filePath).toBeTruthy();
    // `originalFileName` is preserved verbatim for download endpoints.
    expect((billRow as any).originalFileName).toBe(FIXTURE_FILENAME);

    // Linked documents row must have been created and point at the bill.
    const linkedDocs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.attachedToType, 'bill'),
          eq(documents.attachedToId, billId)
        )
      );
    expect(linkedDocs).toHaveLength(1);
    const linkedDoc = linkedDocs[0];
    expect(linkedDoc.fileName).toBe(billRow.fileName);
    expect(linkedDoc.filePath).toBe(billRow.filePath);
    expect((linkedDoc as any).originalFileName).toBe(FIXTURE_FILENAME);
  });

  it('still completes the upload (HTTP 200, file persisted) when the AI analyzer throws', async () => {
    const analyzeSpy = vi
      .spyOn(aiService, 'analyzeBillDocument')
      .mockRejectedValue(new Error('Gemini exploded mid-request'));

    const billId = await createBill('failure');

    const res = await request(app)
      .post(`/api/bills/${billId}/upload-document`)
      .set('x-test-user-id', testUser.id)
      .attach('document', TEST_PDF_PATH, FIXTURE_FILENAME);

    // The whole point of the try/catch around aiService.analyzeBillDocument
    // is that AI failure must not break the upload. Verify the contract.
    expect(res.status, `body=${JSON.stringify(res.body)}`).toBe(200);
    expect(res.body).toMatchObject({
      message: 'Document uploaded and analyzed successfully',
      analysisResult: null,
    });
    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    const billRows = await db.select().from(bills).where(eq(bills.id, billId));
    expect(billRows).toHaveLength(1);
    const billRow = billRows[0];
    // File metadata must still have been persisted...
    expect(billRow.fileName).toBeTruthy();
    expect(billRow.filePath).toBeTruthy();
    expect((billRow as any).originalFileName).toBe(FIXTURE_FILENAME);
    // ...but the AI flags must be cleared.
    expect(billRow.isAiAnalyzed).toBe(false);
    expect(billRow.aiAnalysisData).toBeNull();

    // The documents row should still be created (file attachment is
    // independent of AI success).
    const linkedDocs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.attachedToType, 'bill'),
          eq(documents.attachedToId, billId)
        )
      );
    expect(linkedDocs).toHaveLength(1);
    expect(linkedDocs[0].fileName).toBe(billRow.fileName);
  });
});
