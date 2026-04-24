/**
 * @jest-environment node
 *
 * Route-level tests for the bill routes that call
 * `aiService.analyzeBillDocument`:
 *
 *   - `POST /api/bills/analyze-document`         (server/api/bills.ts:2649)
 *   - `POST /api/bills/:id/upload-document`      (server/api/bills.ts:1791)
 *
 * Mirrors the singleton-mocking pattern in `ai-document-analyze.test.ts`:
 *   - the `aiService` singleton is replaced so the route never hits Gemini
 *   - the real `ConsolidatedAIService` class export stays intact (Task #497
 *     covers the service-level behavior)
 *
 * The upload-document route does massive amounts of orchestration
 * (object storage, ACL, document creation, db.update, etc.) and wraps the
 * AI call in a try/catch that swallows analyzer failures. Its full happy
 * path is covered by the integration-style tests in
 * `upload-filename-normalization-integration.test.ts`. Here we verify only
 * the handful of validation-layer guarantees that don't require booting
 * the database: demo-user gating, missing file, multer MIME rejection.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// --- Mock the singleton AI service so the route never touches Gemini ---
jest.mock('../services/consolidated-ai-service', () => {
  const actual = jest.requireActual<typeof import('../services/consolidated-ai-service')>(
    '../services/consolidated-ai-service'
  );
  return {
    __esModule: true,
    ...actual,
    aiService: {
      analyzeBillDocument: jest.fn(),
      // Suggested payment schedule is exercised by the sibling test file but
      // bills.ts imports the same singleton, so include the method to keep
      // the shape compatible with anything else that probes it.
      suggestPaymentSchedule: jest.fn(),
      extractBillData: jest.fn(),
    },
  };
});

// --- requireAuth: dynamic per-test user via mutable holder ---
const userHolder: { user: any } = {
  user: { id: 'test-user', role: 'admin' },
};
jest.mock('../auth', () => ({
  __esModule: true,
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = userHolder.user;
    next();
  },
}));

// Imports after mocks
import { aiService } from '../services/consolidated-ai-service';
import { registerBillRoutes } from '../api/bills';

const analyzeMock = aiService.analyzeBillDocument as jest.Mock;

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerBillRoutes(app);
  return app;
}

const PDF_BUFFER = Buffer.from('%PDF-1.4 fake bill content for analyze-document test\n');

const sampleAnalysis = {
  title: 'Hydro-Québec Bill',
  vendor: 'Hydro-Québec',
  totalAmount: '142.50',
  category: 'utilities',
  description: 'Monthly electricity bill',
  dueDate: '2025-04-15',
  issueDate: '2025-03-15',
  billNumber: 'INV-001',
  confidence: 0.91,
};

describe('POST /api/bills/analyze-document', () => {
  let app: express.Express;

  beforeEach(() => {
    analyzeMock.mockReset();
    userHolder.user = { id: 'test-user', role: 'admin' };
    app = buildApp();
  });

  it('returns the AI analysis on the happy path', async () => {
    analyzeMock.mockResolvedValue(sampleAnalysis);

    const res = await request(app)
      .post('/api/bills/analyze-document')
      .attach('document', PDF_BUFFER, {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(sampleAnalysis);
    expect(analyzeMock).toHaveBeenCalledTimes(1);
    // Bills route always passes 'application/pdf' (see bills.ts:2657).
    expect(analyzeMock).toHaveBeenCalledWith(
      expect.any(String),
      'application/pdf'
    );
  });

  it('returns 500 when the AI service throws', async () => {
    analyzeMock.mockRejectedValue(new Error('Gemini exploded'));

    const res = await request(app)
      .post('/api/bills/analyze-document')
      .attach('document', PDF_BUFFER, {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      message: 'Failed to analyze document',
    });
    expect(res.body._error).toMatch(/Gemini exploded/);
  });

  it('returns 400 when no document is uploaded', async () => {
    const res = await request(app).post('/api/bills/analyze-document');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      message: 'No document file provided',
    });
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types at the multer layer', async () => {
    const res = await request(app)
      .post('/api/bills/analyze-document')
      .attach('document', Buffer.from('zzz'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    // bills.ts multer.fileFilter rejects with an Error → Express default
    // error handler returns 5xx. Either way the AI must not be called.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(analyzeMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/bills/:id/upload-document (validation layer)', () => {
  let app: express.Express;

  beforeEach(() => {
    analyzeMock.mockReset();
    userHolder.user = { id: 'test-user', role: 'admin' };
    app = buildApp();
  });

  it('blocks demo users with a 403 before doing any work', async () => {
    userHolder.user = { id: 'demo-user', role: 'demo_resident' };

    const res = await request(app)
      .post('/api/bills/some-bill-id/upload-document')
      .attach('document', PDF_BUFFER, {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'DEMO_USER_RESTRICTED',
    });
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('returns 400 when no file is attached to the upload', async () => {
    const res = await request(app).post(
      '/api/bills/some-bill-id/upload-document'
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: 'No file uploaded' });
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types at the multer layer', async () => {
    const res = await request(app)
      .post('/api/bills/some-bill-id/upload-document')
      .attach('document', Buffer.from('zzz'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    // bills.ts multer.fileFilter blocks anything outside
    // ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(analyzeMock).not.toHaveBeenCalled();
  });
});
