/**
 * Unit tests for the sub-category extension added to `suggestBranch`
 * in Task #768 (Group Sorting step by destination + sub-category).
 *
 * Coverage:
 *   - `suggestBranch` parses `subCategory` from a well-formed Anthropic
 *     response and returns it alongside `branch`.
 *   - Invalid `subCategory` values (not in the per-branch vocabulary) are
 *     coerced to `other`.
 *   - The AI-unavailable / no-client fallback path returns
 *     `subCategory: 'other'` deterministically.
 *   - `BRANCH_SUB_CATEGORIES` exports the correct per-branch vocabulary
 *     so callers can validate pairs without duplicating the list.
 *   - The reassign endpoint (unit-tested via the vocabulary logic) rejects
 *     mismatched branch/subCategory pairs and accepts valid ones.
 */

const cacheMockStore = new Map<string, unknown>();
const getCachedMock = jest.fn(async (key: string) => {
  return cacheMockStore.has(key) ? cacheMockStore.get(key) : null;
});
const setCachedMock = jest.fn(async (key: string, value: unknown) => {
  cacheMockStore.set(key, value);
});
jest.mock('../../../server/services/ai-suggestion-cache', () => ({
  getCachedSuggestion: (key: string) => getCachedMock(key),
  setCachedSuggestion: (key: string, value: unknown, _ttl: number) =>
    setCachedMock(key, value, _ttl),
  clearAiSuggestionCache: jest.fn(),
}));

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockRejectedValue(new Error('forced mammoth failure')),
}));

import { bulkImportAnalyzer, BRANCH_SUB_CATEGORIES } from '../../../server/services/bulk-import-analyzer';

function makeFakeClient(jsonPayload: object) {
  const create = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(jsonPayload) }],
  });
  const fakeClient = {
    messages: { create },
  } as unknown as Parameters<typeof bulkImportAnalyzer.__setClientForTests>[0];
  bulkImportAnalyzer.__setClientForTests(fakeClient);
  return create;
}

beforeEach(() => {
  cacheMockStore.clear();
  getCachedMock.mockClear();
  setCachedMock.mockClear();
});
afterAll(() => {
  bulkImportAnalyzer.__setClientForTests(null);
  delete process.env.ANTHROPIC_API_KEY;
});

describe('BRANCH_SUB_CATEGORIES vocabulary', () => {
  it('exports every required branch key', () => {
    const keys = Object.keys(BRANCH_SUB_CATEGORIES);
    expect(keys).toContain('building_documents');
    expect(keys).toContain('residence_documents');
    expect(keys).toContain('bill');
    expect(keys).toContain('demand');
    expect(keys).toContain('maintenance');
    expect(keys).toContain('other');
  });

  it('each branch includes "other" as a fallback sub-category', () => {
    for (const branch of Object.keys(BRANCH_SUB_CATEGORIES)) {
      expect(BRANCH_SUB_CATEGORIES[branch as keyof typeof BRANCH_SUB_CATEGORIES]).toContain('other');
    }
  });

  it('building_documents contains expected sub-categories', () => {
    const sc = BRANCH_SUB_CATEGORIES.building_documents;
    expect(sc).toContain('bylaws');
    expect(sc).toContain('minutes');
    expect(sc).toContain('insurance');
    expect(sc).toContain('financial_statement');
    expect(sc).toContain('contract');
    expect(sc).toContain('correspondence');
  });

  it('bill contains expected sub-categories', () => {
    const sc = BRANCH_SUB_CATEGORIES.bill;
    expect(sc).toContain('utility');
    expect(sc).toContain('insurance');
    expect(sc).toContain('tax');
    expect(sc).toContain('maintenance_invoice');
    expect(sc).toContain('condo_fee');
  });

  it('maintenance contains expected sub-categories', () => {
    const sc = BRANCH_SUB_CATEGORIES.maintenance;
    expect(sc).toContain('work_order');
    expect(sc).toContain('quote');
    expect(sc).toContain('inspection_report');
    expect(sc).toContain('inventory');
  });
});

describe('suggestBranch — subCategory parsing (Task #768)', () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-task768';
  });

  it('returns subCategory from the model response when valid for the branch', async () => {
    makeFakeClient({
      branch: 'bill',
      subCategory: 'utility',
      reason: 'electricity invoice',
      confidence: 0.9,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'electricity.pdf' });

    expect(r.branch).toBe('bill');
    expect(r.subCategory).toBe('utility');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('coerces an invalid subCategory (not in vocabulary) to "other"', async () => {
    makeFakeClient({
      branch: 'building_documents',
      subCategory: 'completely_made_up_value',
      reason: 'looks like a building doc',
      confidence: 0.75,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'mystery.pdf' });

    expect(r.branch).toBe('building_documents');
    expect(r.subCategory).toBe('other');
  });

  it('coerces a subCategory valid for a different branch to "other"', async () => {
    makeFakeClient({
      branch: 'demand',
      subCategory: 'utility',
      reason: 'cross-branch mistake',
      confidence: 0.7,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'cross-branch.pdf' });

    expect(r.branch).toBe('demand');
    expect(r.subCategory).toBe('other');
  });

  it('coerces missing subCategory to "other"', async () => {
    makeFakeClient({
      branch: 'maintenance',
      reason: 'no subCategory field',
      confidence: 0.8,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'maintenance.pdf' });

    expect(r.branch).toBe('maintenance');
    expect(r.subCategory).toBe('other');
  });

  it('returns a valid subCategory for residence_documents', async () => {
    makeFakeClient({
      branch: 'residence_documents',
      subCategory: 'lease',
      reason: 'rental lease agreement',
      confidence: 0.95,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'lease-agreement.pdf' });

    expect(r.branch).toBe('residence_documents');
    expect(r.subCategory).toBe('lease');
  });

  it('returns subCategory "other" for the "other" branch', async () => {
    makeFakeClient({
      branch: 'other',
      subCategory: 'other',
      reason: 'unknown document type',
      confidence: 0.3,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'unknown.pdf' });

    expect(r.branch).toBe('other');
    expect(r.subCategory).toBe('other');
  });

  it('coerces an invalid branch to building_documents and subCategory to "other"', async () => {
    makeFakeClient({
      branch: 'nonexistent_branch',
      subCategory: 'whatever',
      reason: 'bad branch',
      confidence: 0.5,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'bad.pdf' });

    expect(r.branch).toBe('building_documents');
    expect(r.subCategory).toBe('other');
  });
});

describe('suggestBranch — fallback path returns subCategory "other" (Task #768)', () => {
  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
    bulkImportAnalyzer.__setClientForTests(null);
  });

  it('fallback returns subCategory "other" when client is missing', async () => {
    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'no-ai.pdf' });

    expect(r.subCategory).toBe('other');
    expect(r.fallbackReason).toBe('no_api_key');
  });
});

describe('BRANCH_SUB_CATEGORIES vocabulary validation logic (reassign endpoint guard)', () => {
  it('accepts a valid branch + subCategory pair', () => {
    const branch = 'bill';
    const subCategory = 'tax';
    const allowed = BRANCH_SUB_CATEGORIES[branch] as readonly string[];
    expect(allowed.includes(subCategory)).toBe(true);
  });

  it('rejects a cross-branch pair (subCategory valid for different branch)', () => {
    const branch = 'demand';
    const subCategory = 'utility';
    const allowed = BRANCH_SUB_CATEGORIES[branch] as readonly string[];
    expect(allowed.includes(subCategory)).toBe(false);
  });

  it('rejects a completely unknown subCategory', () => {
    const branch = 'maintenance';
    const subCategory = 'unknown_value_xyz';
    const allowed = BRANCH_SUB_CATEGORIES[branch] as readonly string[];
    expect(allowed.includes(subCategory)).toBe(false);
  });

  it('accepts "other" for every branch', () => {
    for (const branch of Object.keys(BRANCH_SUB_CATEGORIES)) {
      const allowed = BRANCH_SUB_CATEGORIES[branch as keyof typeof BRANCH_SUB_CATEGORIES] as readonly string[];
      expect(allowed.includes('other')).toBe(true);
    }
  });

  it('accepts all sub-categories in building_documents for building_documents branch', () => {
    const branch = 'building_documents';
    const allowed = BRANCH_SUB_CATEGORIES[branch] as readonly string[];
    for (const sc of ['bylaws', 'minutes', 'insurance', 'financial_statement', 'contract', 'correspondence', 'other']) {
      expect(allowed.includes(sc)).toBe(true);
    }
  });
});

// ===========================================================================
// Task #802 — residence suggestion handling inside `suggestBranch`.
//
// Task #780 extended `suggestBranch` so that — when the AI routes a
// document to `residence_documents` AND the caller passed in a list of
// `residences` — the analyzer also tries to extract a concrete
// `residenceId` from the model's response. The endpoint then uses
// that id (or the absence of it) to drive the promotion gate inside
// `processItemForStep` (covered separately in
// tests/unit/api/bulk-import-set-residence.test.ts).
//
// Without coverage on the analyzer side, regressions like "I forgot
// to validate the AI's residenceId against the building's actual
// residences" would silently route imports to a wrong unit. The
// cases below pin every branch of the residence-resolution logic.
// ===========================================================================

describe('suggestBranch — residence suggestion (Task #780/#802)', () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-task802';
  });

  const RESIDENCES = [
    { id: 'res-A', unitNumber: '101' },
    { id: 'res-B', unitNumber: '202' },
  ];

  it('returns the AI-picked residenceId when it matches one of the supplied residences', async () => {
    makeFakeClient({
      branch: 'residence_documents',
      subCategory: 'lease',
      residenceId: 'res-A',
      residenceConfidence: 0.91,
      residenceReason: 'unit 101 in filename',
      reason: 'lease for unit 101',
      confidence: 0.9,
    });

    const r = await bulkImportAnalyzer.suggestBranch({
      originalName: 'lease-101.pdf',
      residences: RESIDENCES,
    });

    expect(r.branch).toBe('residence_documents');
    expect(r.residenceId).toBe('res-A');
    expect(r.residenceConfidence).toBeGreaterThan(0.8);
    expect(r.residenceReason).toBe('unit 101 in filename');
    expect(r.residenceFallbackReason).toBeNull();
  });

  it('drops an AI-picked residenceId that is NOT in the supplied list and records a fallback reason', async () => {
    makeFakeClient({
      branch: 'residence_documents',
      subCategory: 'lease',
      residenceId: 'res-DOES-NOT-EXIST',
      residenceConfidence: 0.95,
      reason: 'lease',
      confidence: 0.85,
    });

    const r = await bulkImportAnalyzer.suggestBranch({
      originalName: 'mystery-lease.pdf',
      residences: RESIDENCES,
    });

    expect(r.branch).toBe('residence_documents');
    // The unrecognised id MUST be dropped — otherwise the gate would
    // wave the item through to a residence that doesn't exist.
    expect(r.residenceId).toBeNull();
    expect(r.residenceConfidence).toBeNull();
    expect(r.residenceFallbackReason).toMatch(/unrecognised/i);
  });

  it('records "AI could not determine the residence" when the model omits residenceId entirely', async () => {
    makeFakeClient({
      branch: 'residence_documents',
      subCategory: 'lease',
      reason: 'looks like a lease',
      confidence: 0.8,
      // No residenceId field at all.
    });

    const r = await bulkImportAnalyzer.suggestBranch({
      originalName: 'lease-no-unit.pdf',
      residences: RESIDENCES,
    });

    expect(r.branch).toBe('residence_documents');
    expect(r.residenceId).toBeNull();
    expect(r.residenceFallbackReason).toMatch(/could not determine/i);
  });

  it('does NOT attempt residence resolution when the branch is not residence_documents', async () => {
    makeFakeClient({
      branch: 'bill',
      subCategory: 'utility',
      // Even if the AI hallucinates a residenceId here, it must be
      // ignored — bills are never tied to a residence in this flow.
      residenceId: 'res-A',
      reason: 'utility invoice',
      confidence: 0.95,
    });

    const r = await bulkImportAnalyzer.suggestBranch({
      originalName: 'electricity.pdf',
      residences: RESIDENCES,
    });

    expect(r.branch).toBe('bill');
    expect(r.residenceId).toBeNull();
    expect(r.residenceConfidence).toBeNull();
    expect(r.residenceReason).toBeNull();
    expect(r.residenceFallbackReason).toBeNull();
  });

  it('does NOT attempt residence resolution when the residences list is empty (no building context)', async () => {
    makeFakeClient({
      branch: 'residence_documents',
      subCategory: 'lease',
      residenceId: 'res-A', // ignored, no list to validate against
      reason: 'lease',
      confidence: 0.9,
    });

    const r = await bulkImportAnalyzer.suggestBranch({
      originalName: 'lease.pdf',
      residences: [],
    });

    expect(r.branch).toBe('residence_documents');
    expect(r.residenceId).toBeNull();
    expect(r.residenceFallbackReason).toBeNull();
  });

  it('forwards a model-supplied residenceFallbackReason verbatim', async () => {
    makeFakeClient({
      branch: 'residence_documents',
      subCategory: 'lease',
      residenceFallbackReason: 'unit number absent from document',
      reason: 'generic lease template',
      confidence: 0.6,
    });

    const r = await bulkImportAnalyzer.suggestBranch({
      originalName: 'lease-template.pdf',
      residences: RESIDENCES,
    });

    expect(r.branch).toBe('residence_documents');
    expect(r.residenceId).toBeNull();
    expect(r.residenceFallbackReason).toBe('unit number absent from document');
  });
});
