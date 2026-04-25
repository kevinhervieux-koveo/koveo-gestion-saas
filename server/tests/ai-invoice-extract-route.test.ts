// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Route-level tests for `POST /api/invoices/extract-data`.
 *
 * Mirrors the singleton-mocking pattern in `ai-document-analyze.test.ts`:
 *   - the `aiService` singleton is replaced so the route never hits Gemini
 *   - the real `ConsolidatedAIService` class export stays intact (Task #497
 *     covers the service-level behavior)
 *
 * Covers:
 *   - happy path: AI service returns extracted data → 200 + envelope shape
 *   - AI service throws → 500 with the appropriate error code
 *   - GEMINI_API_KEY-style errors → 500 CONFIG_ERROR
 *   - "Unsupported file type" thrown by the service → 400
 *   - missing file in the request body → 400
 *   - unsupported MIME rejected at the multer layer → 400
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// --- Make requireAuth a no-op for route tests ---
// The invoice route imports `'../auth/index'` (an explicit `/index` suffix
// that bypasses the global jest moduleNameMapper rewrite for `'../auth'`).
// We mock the same specifier so the resolved absolute path matches.
const fakeUser = { id: 'test-user', role: 'admin' };
jest.mock('../auth/index', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = fakeUser;
    next();
  },
}));

// --- Mock the AI service singleton used by the route ---
jest.mock('../services/consolidated-ai-service', () => {
  const actual = jest.requireActual<typeof import('../services/consolidated-ai-service')>(
    '../services/consolidated-ai-service'
  );
  return {
    __esModule: true,
    ...actual,
    aiService: {
      extractInvoiceData: jest.fn(),
      calculateConfidenceScore: jest.fn(() => 0.91),
      validateApiKey: jest.fn(),
    },
  };
});

// Ensure the route's GEMINI_API_KEY guard passes by default.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

// Imports after mocks
import { aiService } from '../services/consolidated-ai-service';
import { registerInvoiceRoutes } from '../api/invoices';

const extractInvoiceMock = aiService.extractInvoiceData as jest.Mock;
const confidenceMock = aiService.calculateConfidenceScore as jest.Mock;

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerInvoiceRoutes(app);
  return app;
}

const PDF_BUFFER = Buffer.from('%PDF-1.4 fake invoice content for extract-data test\n');

const sampleExtraction = {
  vendorName: 'Hydro-Québec',
  invoiceNumber: 'INV-001',
  totalAmount: 142.5,
  dueDate: '2025-04-15',
  paymentType: 'one-time' as const,
  frequency: null,
  startDate: null,
  customPaymentDates: null,
};

describe('POST /api/invoices/extract-data', () => {
  let app: express.Express;

  beforeEach(() => {
    extractInvoiceMock.mockReset();
    confidenceMock.mockReset().mockReturnValue(0.91);
    process.env.GEMINI_API_KEY = 'test-key';
    app = buildApp();
  });

  it('returns the extracted invoice data on success', async () => {
    extractInvoiceMock.mockResolvedValue(sampleExtraction);

    const res = await request(app)
      .post('/api/invoices/extract-data')
      .attach('invoiceFile', PDF_BUFFER, {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: sampleExtraction,
    });
    expect(res.body.metadata).toMatchObject({
      confidence: 0.91,
      filename: 'invoice.pdf',
    });
    expect(typeof res.body.metadata.processingTime).toBe('number');
    expect(extractInvoiceMock).toHaveBeenCalledTimes(1);
    expect(extractInvoiceMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      'application/pdf'
    );
  });

  it('returns 500 EXTRACTION_ERROR when the AI service throws a generic error', async () => {
    extractInvoiceMock.mockRejectedValue(new Error('Gemini exploded'));

    const res = await request(app)
      .post('/api/invoices/extract-data')
      .attach('invoiceFile', PDF_BUFFER, {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: 'Extraction failed',
      code: 'EXTRACTION_ERROR',
    });
  });

  it('returns 500 CONFIG_ERROR when the AI service complains about GEMINI_API_KEY', async () => {
    extractInvoiceMock.mockRejectedValue(
      new Error('GEMINI_API_KEY is missing or invalid')
    );

    const res = await request(app)
      .post('/api/invoices/extract-data')
      .attach('invoiceFile', PDF_BUFFER, {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: 'AI service configuration error',
      code: 'CONFIG_ERROR',
    });
  });

  it('returns 400 when the AI service rejects the file MIME type', async () => {
    extractInvoiceMock.mockRejectedValue(
      new Error('Unsupported file type: text/plain')
    );

    const res = await request(app)
      .post('/api/invoices/extract-data')
      .attach('invoiceFile', PDF_BUFFER, {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'Unsupported file type',
      code: 'UNSUPPORTED_FILE_TYPE',
    });
  });

  it('returns 500 SERVICE_UNAVAILABLE when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await request(app)
      .post('/api/invoices/extract-data')
      .attach('invoiceFile', PDF_BUFFER, {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: 'AI service not configured',
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(extractInvoiceMock).not.toHaveBeenCalled();
  });

  it('returns 400 NO_FILE when no invoice file is uploaded', async () => {
    const res = await request(app).post('/api/invoices/extract-data');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'No file uploaded',
      code: 'NO_FILE',
    });
    expect(extractInvoiceMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types at the multer layer', async () => {
    const res = await request(app)
      .post('/api/invoices/extract-data')
      .attach('invoiceFile', Buffer.from('zzz'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    // multer's fileFilter passes the error to handleUploadError middleware,
    // which translates "Unsupported file type" into a 400 response.
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
    });
    expect(extractInvoiceMock).not.toHaveBeenCalled();
  });
});