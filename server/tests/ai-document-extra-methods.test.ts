/**
 * @jest-environment node
 *
 * Tests for the remaining `ConsolidatedAIService` Gemini-powered methods that
 * did not have unit coverage after tasks #344 (tag suggestion) and #358 (bill
 * data extraction):
 *
 *   - extractInvoiceData     (invoice import flow)
 *   - analyzeBillDocument    (file-path bill analyzer)
 *   - suggestPaymentSchedule (payment cadence recommender)
 *
 * The Gemini SDK is mocked the same way as in
 * `server/tests/ai-document-analyze.test.ts` and
 * `server/tests/ai-document-tag-suggestion.test.ts` so we can drive the JSON
 * parse / validation / error paths without a real API key.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

// --- Mock the Gemini client used by ConsolidatedAIService ---
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: (...args: any[]) => mockGenerateContent(...args) },
  })),
}));

// Ensure the service thinks the API key is configured before instantiation.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

// Imports after mocks
import { ConsolidatedAIService } from '../services/consolidated-ai-service';

/**
 * Shape returned by `extractInvoiceData` (which reads
 * `result.candidates[0].content.parts[0].text`).
 */
function geminiCandidateResponse(text: string) {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
  };
}

/**
 * Shape used by `analyzeBillDocument` and `suggestPaymentSchedule`, which both
 * read `response.text` directly.
 */
function geminiTextProperty(text: string | undefined) {
  return { text };
}

const PDF_BUFFER = Buffer.from('%PDF-1.4 fake invoice content for extra-methods test\n');

// =============================================================================
// extractInvoiceData
// =============================================================================
describe('ConsolidatedAIService.extractInvoiceData', () => {
  let service: ConsolidatedAIService;
  let originalApiKey: string | undefined;

  const happyAi = {
    vendorName: 'Énergir',
    invoiceNumber: 'EN-2025-09-001',
    totalAmount: 87.42,
    dueDate: '2025-10-30',
    paymentType: 'recurring',
    frequency: 'monthly',
    startDate: '2025-09-30',
    customPaymentDates: null,
  };

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

  it('returns the validated invoice fields on the happy path', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiCandidateResponse(JSON.stringify(happyAi))
    );

    const result = await service.extractInvoiceData(PDF_BUFFER, 'application/pdf');

    expect(result).toEqual({
      vendorName: 'Énergir',
      invoiceNumber: 'EN-2025-09-001',
      totalAmount: 87.42,
      dueDate: '2025-10-30',
      paymentType: 'recurring',
      frequency: 'monthly',
      startDate: '2025-09-30',
      customPaymentDates: null,
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('strips ```json fenced markdown before parsing', async () => {
    const wrapped = '```json\n' + JSON.stringify(happyAi) + '\n```';
    mockGenerateContent.mockResolvedValue(geminiCandidateResponse(wrapped));

    const result = await service.extractInvoiceData(PDF_BUFFER, 'application/pdf');

    expect(result.vendorName).toBe('Énergir');
    expect(result.totalAmount).toBe(87.42);
  });

  it('extracts the embedded JSON object when the AI adds prose around it', async () => {
    const noisy = `Sure! Here is the JSON:\n${JSON.stringify(happyAi)}\nLet me know if you need anything else.`;
    mockGenerateContent.mockResolvedValue(geminiCandidateResponse(noisy));

    const result = await service.extractInvoiceData(PDF_BUFFER, 'application/pdf');

    expect(result.invoiceNumber).toBe('EN-2025-09-001');
    expect(result.frequency).toBe('monthly');
  });

  it('coerces unknown paymentType / frequency values to null', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiCandidateResponse(
        JSON.stringify({
          ...happyAi,
          paymentType: 'biweekly-ish',
          frequency: 'whenever',
        })
      )
    );

    const result = await service.extractInvoiceData(PDF_BUFFER, 'application/pdf');

    expect(result.paymentType).toBeNull();
    expect(result.frequency).toBeNull();
  });

  it('coerces a non-array customPaymentDates and a non-numeric totalAmount to null', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiCandidateResponse(
        JSON.stringify({
          ...happyAi,
          totalAmount: 'eighty-seven dollars',
          customPaymentDates: 'not-an-array',
        })
      )
    );

    const result = await service.extractInvoiceData(PDF_BUFFER, 'application/pdf');

    expect(result.totalAmount).toBeNull();
    expect(result.customPaymentDates).toBeNull();
  });

  it('throws (wrapped) when the AI returns unparseable, non-JSON output', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiCandidateResponse('absolutely not json and no braces either')
    );

    await expect(
      service.extractInvoiceData(PDF_BUFFER, 'application/pdf')
    ).rejects.toThrow(/Failed to parse AI response as JSON/);
  });

  it('throws (wrapped) when the MIME type is not in the supported list', async () => {
    await expect(
      service.extractInvoiceData(Buffer.from('zzz'), 'application/zip')
    ).rejects.toThrow(/Unsupported file type/);

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('throws (wrapped) when the GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    // Fresh instance so the lazy `apiKeyChecked` flag re-evaluates.
    const freshService = new ConsolidatedAIService();

    await expect(
      freshService.extractInvoiceData(PDF_BUFFER, 'application/pdf')
    ).rejects.toThrow(/GEMINI_API_KEY is configured/);

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

// =============================================================================
// analyzeBillDocument
// =============================================================================
describe('ConsolidatedAIService.analyzeBillDocument', () => {
  let service: ConsolidatedAIService;
  let originalApiKey: string | undefined;
  let tempFile: string;

  const happyAi = {
    title: 'Hydro-Québec Electricity Bill',
    vendor: 'Hydro-Québec',
    totalAmount: '142.50',
    category: 'utilities',
    description: 'Monthly electricity service for unit 101',
    dueDate: '2025-04-15',
    issueDate: '2025-03-15',
    billNumber: 'HQ-INV-001',
    confidence: 0.92,
  };

  beforeEach(() => {
    mockGenerateContent.mockReset();
    originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = originalApiKey || 'test-key';
    service = new ConsolidatedAIService();
    // analyzeBillDocument reads the file from disk via fs.readFileSync, so we
    // need a real (tiny) file to exist for the test.
    tempFile = path.join(
      os.tmpdir(),
      `analyze-bill-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
    );
    fs.writeFileSync(tempFile, PDF_BUFFER);
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
    try {
      fs.unlinkSync(tempFile);
    } catch {
      /* best-effort cleanup */
    }
  });

  it('returns the sanitized analysis on the happy path', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty(JSON.stringify(happyAi))
    );

    const result = await service.analyzeBillDocument(tempFile);

    expect(result.title).toBe('Hydro-Québec Electricity Bill');
    expect(result.vendor).toBe('Hydro-Québec');
    expect(result.totalAmount).toBe('142.50');
    expect(result.category).toBe('utilities');
    expect(result.dueDate).toBe('2025-04-15');
    expect(result.issueDate).toBe('2025-03-15');
    expect(result.billNumber).toBe('HQ-INV-001');
    expect(result.confidence).toBeCloseTo(0.92);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('strips ```json fenced markdown before parsing the AI response', async () => {
    const wrapped = '```json\n' + JSON.stringify(happyAi) + '\n```';
    mockGenerateContent.mockResolvedValue(geminiTextProperty(wrapped));

    const result = await service.analyzeBillDocument(tempFile);

    expect(result.vendor).toBe('Hydro-Québec');
    expect(result.totalAmount).toBe('142.50');
  });

  it('falls back to category "other" when the AI returns an unknown category', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty(JSON.stringify({ ...happyAi, category: 'definitely-not-a-real-category' }))
    );

    const result = await service.analyzeBillDocument(tempFile);

    expect(result.category).toBe('other');
  });

  it('clamps an out-of-range confidence into the [0, 1] interval', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty(JSON.stringify({ ...happyAi, confidence: 5 }))
    );

    const result = await service.analyzeBillDocument(tempFile);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('uses the provided MIME override when one is supplied', async () => {
    mockGenerateContent.mockResolvedValue(geminiTextProperty(JSON.stringify(happyAi)));

    await service.analyzeBillDocument(tempFile, 'image/png');

    const call = mockGenerateContent.mock.calls[0]?.[0] as any;
    const inlineMime = call?.contents?.[0]?.parts?.[1]?.inlineData?.mimeType;
    expect(inlineMime).toBe('image/png');
  });

  it('throws (wrapped) when the AI returns malformed, non-JSON output', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty('this is definitely not parseable JSON at all')
    );

    await expect(service.analyzeBillDocument(tempFile)).rejects.toThrow(
      /Failed to parse AI response as JSON/
    );
  });

  it('throws (wrapped) when the AI response has no text body', async () => {
    mockGenerateContent.mockResolvedValue(geminiTextProperty(undefined));

    await expect(service.analyzeBillDocument(tempFile)).rejects.toThrow(
      /Empty response from Gemini/
    );
  });

  it('throws (wrapped) when the GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const freshService = new ConsolidatedAIService();

    await expect(freshService.analyzeBillDocument(tempFile)).rejects.toThrow(
      /GEMINI_API_KEY is configured/
    );

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('throws (wrapped) when the bill file does not exist on disk', async () => {
    const missing = path.join(os.tmpdir(), `does-not-exist-${Date.now()}.pdf`);

    await expect(service.analyzeBillDocument(missing)).rejects.toThrow(
      /analyzeBillDocument failed/
    );

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

// =============================================================================
// suggestPaymentSchedule
// =============================================================================
describe('ConsolidatedAIService.suggestPaymentSchedule', () => {
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

  it('returns the recurring schedule the AI proposes on the happy path', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty(
        JSON.stringify({
          paymentType: 'recurrent',
          schedulePayment: 'monthly',
          reasoning: 'Utility bills typically arrive every month.',
        })
      )
    );

    const result = await service.suggestPaymentSchedule('utilities', 142.5);

    expect(result).toEqual({
      paymentType: 'recurrent',
      schedulePayment: 'monthly',
      reasoning: 'Utility bills typically arrive every month.',
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    // The category and amount should land in the prompt sent to Gemini.
    const call = mockGenerateContent.mock.calls[0]?.[0] as any;
    expect(typeof call?.contents).toBe('string');
    expect(call.contents).toContain('utilities');
    expect(call.contents).toContain('142.5');
  });

  it('returns a unique-payment recommendation without a schedulePayment field', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty(
        JSON.stringify({
          paymentType: 'unique',
          reasoning: 'Maintenance work is typically a one-off charge.',
        })
      )
    );

    const result = await service.suggestPaymentSchedule('maintenance', 850);

    expect(result.paymentType).toBe('unique');
    expect(result.schedulePayment).toBeUndefined();
    expect(result.reasoning).toMatch(/one-off/);
  });

  it('returns an empty object (without crashing) when the AI returns no text body', async () => {
    // The implementation falls back to `JSON.parse(response.text || '{}')`, so
    // an empty/undefined text body should resolve to {} rather than throw.
    mockGenerateContent.mockResolvedValue(geminiTextProperty(undefined));

    const result = await service.suggestPaymentSchedule('supplies', 25);

    expect(result).toEqual({});
  });

  it('throws (wrapped) when the AI returns malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty('totally not json {{{ broken')
    );

    await expect(
      service.suggestPaymentSchedule('insurance', 1200)
    ).rejects.toThrow(/suggestPaymentSchedule failed/);
  });

  it('passes degenerate inputs (empty category / NaN amount) through without crashing', async () => {
    // The method has no client-side guard rails for category/amount — this is
    // the closest equivalent of the "invalid input" case the sibling tests
    // cover via MIME validation. The test documents that behavior and would
    // catch a future regression if a guard is added without updating callers.
    mockGenerateContent.mockResolvedValue(
      geminiTextProperty(
        JSON.stringify({
          paymentType: 'unique',
          reasoning: 'Insufficient information to recommend a recurrence.',
        })
      )
    );

    const result = await service.suggestPaymentSchedule('', Number.NaN);

    expect(result.paymentType).toBe('unique');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const call = mockGenerateContent.mock.calls[0]?.[0] as any;
    expect(typeof call?.contents).toBe('string');
    // The prompt template embeds the raw values, so NaN/empty land verbatim.
    expect(call.contents).toContain('NaN');
  });

  it('throws (wrapped) when the GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const freshService = new ConsolidatedAIService();

    await expect(
      freshService.suggestPaymentSchedule('utilities', 142.5)
    ).rejects.toThrow(/GEMINI_API_KEY is configured/);

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
