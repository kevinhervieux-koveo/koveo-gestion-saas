/**
 * Unit tests for the bulk-import Anthropic analyzer (Task #451).
 * Verifies the deterministic fallback path (no ANTHROPIC_API_KEY required)
 * and the confidence-band helper used by the UI badges.
 */
import { bulkImportAnalyzer } from '../../../server/services/bulk-import-analyzer';
import { bandForConfidence } from '../../../shared/schemas/bulk-import';

describe('bulkImportAnalyzer fallback mode', () => {
  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
    bulkImportAnalyzer.__setClientForTests(null);
  });

  it('returns a deterministic low-confidence screening when client is missing', async () => {
    const r = await bulkImportAnalyzer.screen({
      originalName: 'lease.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
    });
    expect(r.suggestedFilename).toBe('lease.pdf');
    expect(r.confidence).toBeLessThan(0.5);
    expect([0, 90, 180, 270]).toContain(r.rotationDegrees);
  });

  it('returns a keep decision with low confidence in fallback', async () => {
    const r = await bulkImportAnalyzer.suggestMergeOrSplit({
      originalName: 'a.pdf',
      siblingNames: ['b.pdf'],
    });
    expect(r.decision).toBe('keep');
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('defaults branch to building_documents in fallback', async () => {
    const r = await bulkImportAnalyzer.suggestBranch({
      originalName: 'random.png',
    });
    expect(r.branch).toBe('building_documents');
  });

  it('echoes the filename when identifying without a client', async () => {
    const r = await bulkImportAnalyzer.identify({ originalName: 'invoice.pdf' });
    expect(r.name).toBe('invoice.pdf');
    expect(r.tags).toEqual([]);
  });

  it('returns no related items in fallback link suggestions', async () => {
    const r = await bulkImportAnalyzer.suggestLinks({
      originalName: 'a.pdf',
      candidates: [{ id: '1', name: 'b.pdf' }],
    });
    expect(r.relatedItemIds).toEqual([]);
  });
});

describe('bandForConfidence helper', () => {
  it('maps numeric confidence into low/medium/high bands', () => {
    expect(bandForConfidence(0.95)).toBe('high');
    expect(bandForConfidence(0.6)).toBe('medium');
    expect(bandForConfidence(0.2)).toBe('low');
    expect(bandForConfidence(null)).toBe('low');
    expect(bandForConfidence(undefined)).toBe('low');
    expect(bandForConfidence(Number.NaN)).toBe('low');
  });
});
