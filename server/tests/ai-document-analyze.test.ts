// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Tests for AI bill data extraction:
 *   - ConsolidatedAIService.extractBillData (Gemini client mocked)
 *   - POST /api/ai/analyze-document route handler (validation, upload,
 *     AI failure handling, MIME gating)
 *
 * Mirrors the pattern in `ai-document-tag-suggestion.test.ts` so the
 * older `extractBillData` path that powers the bill upload analyzer has
 * the same kind of automated coverage.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// --- Mock the Gemini client used by ConsolidatedAIService ---
// Used by the service-level unit tests, which instantiate the *real*
// ConsolidatedAIService via requireActual below.
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: (...args: any[]) => mockGenerateContent(...args) },
  })),
}));

// --- Make requireAuth a no-op for route tests ---
jest.mock('../auth', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

// --- Mock the AI service singleton used by the route ---
// Keep the real `ConsolidatedAIService` class export (used by the
// service-level unit tests below) but replace the singleton `aiService`
// so route tests can drive `extractBillData` without hitting Gemini.
jest.mock('../services/consolidated-ai-service', () => {
  const actual = jest.requireActual<typeof import('../services/consolidated-ai-service')>(
    '../services/consolidated-ai-service'
  );
  return {
    __esModule: true,
    ...actual,
    aiService: {
      extractBillData: jest.fn(),
      // Tag suggestion is exercised by the sibling test file but the route
      // module imports the singleton once, so include the method to keep the
      // shape compatible with anything that probes it.
      suggestDocumentTags: jest.fn(),
    },
  };
});

jest.mock('../services/secure-file-storage', () => ({
  __esModule: true,
  secureFileStorage: {
    storeFile: jest.fn(),
    retrieveFile: jest.fn(),
  },
}));

// Ensure the service thinks the API key is configured before instantiation.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

// Imports after mocks
import { ConsolidatedAIService, aiService } from '../services/consolidated-ai-service';
import { registerAiAnalysisRoutes } from '../api/ai-document-analysis';

const extractMock = aiService.extractBillData as jest.Mock;

function geminiTextResponse(text: string) {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
  };
}

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerAiAnalysisRoutes(app);
  return app;
}

const PDF_BUFFER = Buffer.from('%PDF-1.4 fake bill content for analyze-document test\n');

const sampleAiResponse = {
  vendorName: 'Hydro-Québec',
  description: 'Monthly electricity bill',
  totalAmount: 142.5,
  dueDate: '2025-04-15',
  issueDate: '2025-03-15',
  billNumber: 'INV-001',
  paymentType: 'recurring',
  frequency: 'monthly',
  startDate: '2025-03-15',
  endDate: null,
  customPaymentDates: null,
  customPayments: null,
  hasInitialPayment: false,
  initialPaymentAmount: null,
  recurringPaymentAmount: 142.5,
  recurringPaymentsEqual: true,
  yearInterval: 1,
  category: 'utilities',
  fieldConfidence: {
    vendorName: 0.95,
    totalAmount: 0.92,
    dueDate: 0.9,
    category: 0.88,
    paymentType: 0.85,
    frequency: 0.85,
  },
  extractionNotes: ['Document scanned cleanly'],
};

describe('ConsolidatedAIService.extractBillData', () => {
  let service: ConsolidatedAIService;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = originalApiKey || 'test-key';
    service = new ConsolidatedAIService();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  });

  it('returns validated bill data on the happy path', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse(JSON.stringify(sampleAiResponse))
    );

    const result = await service.extractBillData(PDF_BUFFER, 'application/pdf');

    expect(result.vendorName).toBe('Hydro-Québec');
    expect(result.totalAmount).toBe(142.5);
    expect(result.category).toBe('utilities');
    expect(result.paymentType).toBe('recurring');
    expect(result.frequency).toBe('monthly');
    expect(result.dueDate).toBe('2025-04-15');
    expect(result.issueDate).toBe('2025-03-15');
    expect(result.billNumber).toBe('INV-001');
    expect(result.fieldConfidence.vendorName).toBe(0.95);
    // Overall confidence is a weighted average of the per-field scores and
    // should land in (0, 1].
    expect(result.overallConfidence).toBeGreaterThan(0);
    expect(result.overallConfidence).toBeLessThanOrEqual(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('strips markdown fences before parsing the AI response', async () => {
    const wrapped = '```json\n' + JSON.stringify(sampleAiResponse) + '\n```';
    mockGenerateContent.mockResolvedValue(geminiTextResponse(wrapped));

    const result = await service.extractBillData(PDF_BUFFER, 'application/pdf');

    expect(result.vendorName).toBe('Hydro-Québec');
    expect(result.totalAmount).toBe(142.5);
  });

  it('falls back to category "other" when the AI returns an unknown category', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse(
        JSON.stringify({ ...sampleAiResponse, category: 'definitely-not-a-real-category' })
      )
    );

    const result = await service.extractBillData(PDF_BUFFER, 'application/pdf');

    expect(result.category).toBe('other');
  });

  it('throws (wrapped) when the AI returns malformed, non-JSON output', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse('this is definitely not parseable json at all')
    );

    await expect(
      service.extractBillData(PDF_BUFFER, 'application/pdf')
    ).rejects.toThrow(/Failed to parse AI response as JSON/);
  });

  it('throws (wrapped) when the GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    // Fresh instance so the lazy `apiKeyChecked` flag re-evaluates.
    const freshService = new ConsolidatedAIService();

    await expect(
      freshService.extractBillData(PDF_BUFFER, 'application/pdf')
    ).rejects.toThrow(/GEMINI_API_KEY is configured/);

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('throws when the MIME type is not in the supported list', async () => {
    await expect(
      service.extractBillData(Buffer.from('zzz'), 'application/zip')
    ).rejects.toThrow(/Unsupported file type/);

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

describe('POST /api/ai/analyze-document', () => {
  let app: express.Express;

  beforeEach(() => {
    extractMock.mockReset();
    app = buildApp();
  });

  it('returns the extracted bill data on success', async () => {
    const extractedData: Awaited<ReturnType<ConsolidatedAIService['extractBillData']>> = {
      vendorName: 'Hydro-Québec',
      description: 'Monthly electricity bill',
      totalAmount: 142.5,
      dueDate: '2025-04-15',
      issueDate: '2025-03-15',
      billNumber: 'INV-001',
      paymentType: 'recurring',
      frequency: 'monthly',
      startDate: '2025-03-15',
      endDate: null,
      customPaymentDates: null,
      customPayments: null,
      hasInitialPayment: false,
      initialPaymentAmount: null,
      recurringPaymentAmount: 142.5,
      recurringPaymentsEqual: true,
      yearInterval: 1,
      category: 'utilities',
      fieldConfidence: {
        vendorName: 0.95,
        totalAmount: 0.92,
        dueDate: 0.9,
        category: 0.88,
        paymentType: 0.85,
        frequency: 0.85,
      },
      overallConfidence: 0.91,
      extractionNotes: [],
    };
    extractMock.mockResolvedValue(extractedData);

    const res = await request(app)
      .post('/api/ai/analyze-document')
      .field('formType', 'bills')
      .attach('document', PDF_BUFFER, {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      formType: 'bills',
      analysisResult: extractedData,
      extractedData,
    });
    expect(res.body.metadata).toMatchObject({
      fileName: 'bill.pdf',
      mimeType: 'application/pdf',
      analysisType: 'bills',
    });
    expect(extractMock).toHaveBeenCalledTimes(1);
    expect(extractMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      'application/pdf'
    );
  });

  it('returns 500 when the AI service throws', async () => {
    extractMock.mockRejectedValue(new Error('Gemini exploded'));

    const res = await request(app)
      .post('/api/ai/analyze-document')
      .field('formType', 'bills')
      .attach('document', PDF_BUFFER, {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: 'AI analysis failed. Please try again later.',
    });
    // Raw AI error message must not be forwarded to the client (Task #1307)
    expect(JSON.stringify(res.body)).not.toContain('Gemini exploded');
    expect(res.body.details).toBeUndefined();
  });

  it('returns 400 when no document is uploaded', async () => {
    const res = await request(app)
      .post('/api/ai/analyze-document')
      .field('formType', 'bills');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: 'No document uploaded',
    });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('returns 400 when formType is missing from the request body', async () => {
    const res = await request(app)
      .post('/api/ai/analyze-document')
      .attach('document', PDF_BUFFER, {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('returns 400 when AI analysis is not enabled for the form type', async () => {
    // `buildings` has aiAnalysisEnabled: false in upload-config.
    const res = await request(app)
      .post('/api/ai/analyze-document')
      .field('formType', 'buildings')
      .attach('document', PDF_BUFFER, {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/AI analysis is not enabled/);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types at the multer layer', async () => {
    const res = await request(app)
      .post('/api/ai/analyze-document')
      .field('formType', 'bills')
      .attach('document', Buffer.from('zzz'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    // multer's fileFilter throws -> Express default error handler -> 4xx/5xx
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(extractMock).not.toHaveBeenCalled();
  });
});