/**
 * Unit tests for the bulk-import Anthropic analyzer (Task #451).
 * Verifies the deterministic fallback path (no ANTHROPIC_API_KEY required),
 * the confidence-band helper used by the UI badges, and the file-attachment
 * path added in Task #455 (Send real document files to Anthropic).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock the shared AI suggestion cache so we can assert that the analyzer
// consults it before calling Anthropic and writes the result back. The
// mock keeps an in-memory Map so a "set" followed by a "get" round-trips,
// mirroring the real DB-backed behaviour without requiring a database.
const cacheMockStore = new Map<string, unknown>();
const getCachedMock = jest.fn(async (key: string) => {
  return cacheMockStore.has(key) ? cacheMockStore.get(key) : null;
});
const setCachedMock = jest.fn(async (key: string, value: unknown) => {
  cacheMockStore.set(key, value);
});
jest.mock('../../../server/services/ai-suggestion-cache', () => ({
  getCachedSuggestion: (key: string) => getCachedMock(key),
  setCachedSuggestion: (key: string, value: unknown, ttl: number) =>
    setCachedMock(key, value, ttl),
  clearAiSuggestionCache: jest.fn(),
}));

// Force mammoth's text extractor to throw so we can exercise the
// 'extraction_failed' branch of loadFileForClaude without authoring a
// genuinely corrupt .docx fixture. Only the docx-extraction tests below
// rely on this; nothing else in this file extracts .docx.
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockRejectedValue(new Error('forced mammoth failure')),
}));

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
      siblings: [{ id: 'b1', name: 'b.pdf' }],
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

  // Regression: when Anthropic isn't configured every analyzer entry
  // point must tag the stub result with `no_api_key` so the bulk
  // import UI can render the page-level "AI unavailable" banner and
  // per-item badge instead of a generic 20% confidence pill (Task #710).
  it("tags every fallback stub with 'no_api_key' when the client is missing", async () => {
    const screen = await bulkImportAnalyzer.screen({
      originalName: 'a.pdf',
      mimeType: 'application/pdf',
    });
    const merge = await bulkImportAnalyzer.suggestMergeOrSplit({
      originalName: 'a.pdf',
      siblings: [],
    });
    const branch = await bulkImportAnalyzer.suggestBranch({
      originalName: 'a.pdf',
    });
    const identify = await bulkImportAnalyzer.identify({
      originalName: 'a.pdf',
    });
    const links = await bulkImportAnalyzer.suggestLinks({
      originalName: 'a.pdf',
      candidates: [],
    });
    expect(screen.fallbackReason).toBe('no_api_key');
    expect(merge.fallbackReason).toBe('no_api_key');
    expect(branch.fallbackReason).toBe('no_api_key');
    expect(identify.fallbackReason).toBe('no_api_key');
    expect(links.fallbackReason).toBe('no_api_key');
  });
});

describe('isBulkImportAiAvailable health probe (Task #710)', () => {
  // Used by the admin Bulk Document Import page to drive the
  // page-level "AI unavailable" banner. Reflects whether the Anthropic
  // client can currently be constructed.
  beforeEach(() => {
    bulkImportAnalyzer.__setClientForTests(null);
  });
  afterAll(() => {
    bulkImportAnalyzer.__setClientForTests(null);
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns false when ANTHROPIC_API_KEY is missing', async () => {
    const { isBulkImportAiAvailable } = await import(
      '../../../server/services/bulk-import-analyzer'
    );
    delete process.env.ANTHROPIC_API_KEY;
    expect(isBulkImportAiAvailable()).toBe(false);
  });

  it('returns true once a client has been initialised', async () => {
    const { isBulkImportAiAvailable } = await import(
      '../../../server/services/bulk-import-analyzer'
    );
    bulkImportAnalyzer.__setClientForTests({
      messages: { create: jest.fn() },
    } as unknown as Parameters<typeof bulkImportAnalyzer.__setClientForTests>[0]);
    expect(isBulkImportAiAvailable()).toBe(true);
  });
});

describe('bulkImportAnalyzer file attachments (Task #455)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulk-import-analyzer-test-'));
  });
  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    bulkImportAnalyzer.__setClientForTests(null);
  });

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

  it('attaches a PDF as a base64 document block', async () => {
    const pdfPath = path.join(tmpDir, 'lease.pdf');
    fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 fake pdf body'));
    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'lease.pdf',
      description: 'Lease agreement',
      confidence: 0.92,
    });

    const r = await bulkImportAnalyzer.screen({
      originalName: 'lease.pdf',
      mimeType: 'application/pdf',
      fileSize: 22,
      stagedPath: pdfPath,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const sent = create.mock.calls[0][0];
    expect(Array.isArray(sent.messages[0].content)).toBe(true);
    const docBlock = sent.messages[0].content.find((b: { type: string }) => b.type === 'document');
    expect(docBlock).toBeDefined();
    expect(docBlock.source.media_type).toBe('application/pdf');
    expect(docBlock.source.data).toBe(
      Buffer.from('%PDF-1.4 fake pdf body').toString('base64'),
    );
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('attaches a PNG image as a base64 image block', async () => {
    const imgPath = path.join(tmpDir, 'photo.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fs.writeFileSync(imgPath, bytes);
    const create = makeFakeClient({
      branch: 'maintenance',
      reason: 'photo of broken pipe',
      confidence: 0.8,
    });

    await bulkImportAnalyzer.suggestBranch({
      originalName: 'photo.png',
      mimeType: 'image/png',
      stagedPath: imgPath,
    });

    const sent = create.mock.calls[0][0];
    const imgBlock = sent.messages[0].content.find((b: { type: string }) => b.type === 'image');
    expect(imgBlock).toBeDefined();
    expect(imgBlock.source.media_type).toBe('image/png');
    expect(imgBlock.source.data).toBe(bytes.toString('base64'));
  });

  it('extracts plain text from a .txt file and prepends it to the prompt', async () => {
    const txtPath = path.join(tmpDir, 'note.txt');
    fs.writeFileSync(txtPath, 'Quarterly maintenance report contents.');
    const create = makeFakeClient({
      name: 'Q3 maintenance report',
      description: 'maintenance summary',
      tags: ['maintenance'],
      metadata: {},
      confidence: 0.85,
    });

    await bulkImportAnalyzer.identify({
      originalName: 'note.txt',
      mimeType: 'text/plain',
      stagedPath: txtPath,
    });

    const sent = create.mock.calls[0][0];
    const textBlock = sent.messages[0].content.find((b: { type: string }) => b.type === 'text');
    expect(textBlock.text).toContain('Quarterly maintenance report contents.');
  });

  it('falls back gracefully when the staged file is missing', async () => {
    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'gone.pdf',
      description: '',
      confidence: 0.5,
    });

    const r = await bulkImportAnalyzer.screen({
      originalName: 'gone.pdf',
      mimeType: 'application/pdf',
      stagedPath: path.join(tmpDir, 'does-not-exist.pdf'),
    });

    expect(r).toBeDefined();
    const sent = create.mock.calls[0][0];
    const blocks = sent.messages[0].content as Array<{ type: string }>;
    // Only the text prompt — no document block when file is missing.
    expect(blocks.every((b) => b.type === 'text')).toBe(true);
  });

  it('skips attachment for unsupported MIME types', async () => {
    const binPath = path.join(tmpDir, 'archive.zip');
    fs.writeFileSync(binPath, Buffer.from('PK\u0003\u0004 fake zip'));
    const create = makeFakeClient({
      decision: 'keep',
      reason: 'unknown',
      confidence: 0.3,
    });

    await bulkImportAnalyzer.suggestMergeOrSplit({
      originalName: 'archive.zip',
      siblings: [],
      mimeType: 'application/zip',
      stagedPath: binPath,
    });

    const sent = create.mock.calls[0][0];
    const blocks = sent.messages[0].content as Array<{ type: string }>;
    expect(blocks.every((b) => b.type === 'text')).toBe(true);
  });
});

describe('bulkImportAnalyzer per-step cache (Task #462)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulk-import-cache-test-'));
  });
  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    bulkImportAnalyzer.__setClientForTests(null);
  });
  beforeEach(() => {
    cacheMockStore.clear();
    getCachedMock.mockClear();
    setCachedMock.mockClear();
  });

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

  it('skips the Anthropic round-trip on a repeat call with the same file + step', async () => {
    const pdfPath = path.join(tmpDir, 'cached.pdf');
    fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 cached pdf body'));
    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'cached.pdf',
      description: 'Cached',
      confidence: 0.9,
    });

    const args = {
      originalName: 'cached.pdf',
      mimeType: 'application/pdf',
      fileSize: 24,
      stagedPath: pdfPath,
    };

    const first = await bulkImportAnalyzer.screen(args);
    const second = await bulkImportAnalyzer.screen(args);

    expect(create).toHaveBeenCalledTimes(1);
    expect(setCachedMock).toHaveBeenCalledTimes(1);
    expect(getCachedMock).toHaveBeenCalledTimes(2);
    expect(second).toEqual(first);
  });

  it('uses different cache slots for each analyzer step', async () => {
    const pdfPath = path.join(tmpDir, 'multi.pdf');
    fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 multi step body'));

    makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'multi.pdf',
      description: '',
      confidence: 0.7,
    });
    await bulkImportAnalyzer.screen({
      originalName: 'multi.pdf',
      mimeType: 'application/pdf',
      stagedPath: pdfPath,
    });

    makeFakeClient({
      branch: 'building_documents',
      reason: 'cover page',
      confidence: 0.8,
    });
    await bulkImportAnalyzer.suggestBranch({
      originalName: 'multi.pdf',
      mimeType: 'application/pdf',
      stagedPath: pdfPath,
    });

    // Same file content but two different steps → two distinct cache
    // keys, so the writes don't clobber each other.
    expect(setCachedMock).toHaveBeenCalledTimes(2);
    const writtenKeys = setCachedMock.mock.calls.map((c) => c[0]);
    expect(new Set(writtenKeys).size).toBe(2);
    expect(writtenKeys[0]).toContain(':screen:');
    expect(writtenKeys[1]).toContain(':branch:');
  });

  it('invalidates naturally when the prompt-bearing input changes', async () => {
    const pdfPath = path.join(tmpDir, 'links.pdf');
    fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 link prompt body'));
    const create = makeFakeClient({
      relatedItemIds: ['x'],
      reason: '',
      confidence: 0.7,
    });

    await bulkImportAnalyzer.suggestLinks({
      originalName: 'links.pdf',
      mimeType: 'application/pdf',
      stagedPath: pdfPath,
      candidates: [{ id: '1', name: 'a.pdf' }],
    });
    // Different candidate set means a different prompt → cache miss,
    // second Anthropic call. This is what "prompt changes invalidate
    // naturally" looks like in practice.
    await bulkImportAnalyzer.suggestLinks({
      originalName: 'links.pdf',
      mimeType: 'application/pdf',
      stagedPath: pdfPath,
      candidates: [{ id: '2', name: 'b.pdf' }],
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(setCachedMock).toHaveBeenCalledTimes(2);
  });
});

describe('bulkImportAnalyzer fallbackReason propagation (Task #493)', () => {
  // Regression coverage: every analyzer entry point must surface the
  // fallbackReason emitted by callClaudeJson so the UI badge can explain
  // *why* a result fell back to a filename-only prompt instead of
  // sending the real bytes. Without these assertions a future refactor
  // could silently drop the field again.
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulk-import-fallback-test-'));
  });
  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    bulkImportAnalyzer.__setClientForTests(null);
  });
  beforeEach(() => {
    cacheMockStore.clear();
    getCachedMock.mockClear();
    setCachedMock.mockClear();
  });

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

  const screenPayload = {
    isComplete: true,
    isMultiDocument: false,
    pageOrderHint: null,
    rotationDegrees: 0,
    suggestedFilename: 'doc.pdf',
    description: 'desc',
    confidence: 0.7,
  };
  const identifyPayload = {
    name: 'Doc',
    description: 'desc',
    tags: [],
    metadata: {},
    confidence: 0.7,
  };

  // 25MB cap inside the analyzer; one byte over forces the oversize branch.
  const OVERSIZE_BYTES = 25 * 1024 * 1024 + 1;

  describe('screen()', () => {
    it("emits fallbackReason 'oversize' for a >25MB buffer", async () => {
      makeFakeClient(screenPayload);
      const r = await bulkImportAnalyzer.screen({
        originalName: 'huge.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(OVERSIZE_BYTES, 0),
      });
      expect(r.fallbackReason).toBe('oversize');
    });

    it("emits fallbackReason 'unsupported_mime' for application/zip", async () => {
      makeFakeClient(screenPayload);
      const zipPath = path.join(tmpDir, 'screen.zip');
      fs.writeFileSync(zipPath, Buffer.from('PK\u0003\u0004 fake'));
      const r = await bulkImportAnalyzer.screen({
        originalName: 'archive.zip',
        mimeType: 'application/zip',
        stagedPath: zipPath,
      });
      expect(r.fallbackReason).toBe('unsupported_mime');
    });

    it("emits fallbackReason 'missing_file' for a non-existent staged path", async () => {
      makeFakeClient(screenPayload);
      const r = await bulkImportAnalyzer.screen({
        originalName: 'gone.pdf',
        mimeType: 'application/pdf',
        stagedPath: path.join(tmpDir, 'does-not-exist-screen.pdf'),
      });
      expect(r.fallbackReason).toBe('missing_file');
    });

    it('emits fallbackReason null for a normal PDF', async () => {
      makeFakeClient(screenPayload);
      const pdfPath = path.join(tmpDir, 'ok-screen.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 normal pdf body'));
      const r = await bulkImportAnalyzer.screen({
        originalName: 'ok.pdf',
        mimeType: 'application/pdf',
        stagedPath: pdfPath,
      });
      expect(r.fallbackReason).toBeNull();
    });
  });

  describe('identify()', () => {
    it("emits fallbackReason 'oversize' for a >25MB buffer", async () => {
      makeFakeClient(identifyPayload);
      const r = await bulkImportAnalyzer.identify({
        originalName: 'huge.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(OVERSIZE_BYTES, 0),
      });
      expect(r.fallbackReason).toBe('oversize');
    });

    it("emits fallbackReason 'unsupported_mime' for application/zip", async () => {
      makeFakeClient(identifyPayload);
      const zipPath = path.join(tmpDir, 'identify.zip');
      fs.writeFileSync(zipPath, Buffer.from('PK\u0003\u0004 fake'));
      const r = await bulkImportAnalyzer.identify({
        originalName: 'archive.zip',
        mimeType: 'application/zip',
        stagedPath: zipPath,
      });
      expect(r.fallbackReason).toBe('unsupported_mime');
    });

    it("emits fallbackReason 'missing_file' for a non-existent staged path", async () => {
      makeFakeClient(identifyPayload);
      const r = await bulkImportAnalyzer.identify({
        originalName: 'gone.pdf',
        mimeType: 'application/pdf',
        stagedPath: path.join(tmpDir, 'does-not-exist-identify.pdf'),
      });
      expect(r.fallbackReason).toBe('missing_file');
    });

    it('emits fallbackReason null for a normal PDF', async () => {
      makeFakeClient(identifyPayload);
      const pdfPath = path.join(tmpDir, 'ok-identify.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 normal pdf body'));
      const r = await bulkImportAnalyzer.identify({
        originalName: 'ok.pdf',
        mimeType: 'application/pdf',
        stagedPath: pdfPath,
      });
      expect(r.fallbackReason).toBeNull();
    });
  });

  const mergeOrSplitPayload = {
    decision: 'keep',
    reason: 'fine',
    confidence: 0.6,
  };
  const branchPayload = {
    branch: 'building_documents',
    reason: 'cover page',
    confidence: 0.7,
  };
  const linksPayload = {
    relatedItemIds: [],
    reason: 'no related',
    confidence: 0.6,
  };

  describe('suggestMergeOrSplit()', () => {
    it("emits fallbackReason 'oversize' for a >25MB buffer", async () => {
      makeFakeClient(mergeOrSplitPayload);
      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'huge.pdf',
        siblings: [],
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(OVERSIZE_BYTES, 0),
      });
      expect(r.fallbackReason).toBe('oversize');
    });

    it("emits fallbackReason 'unsupported_mime' for application/zip", async () => {
      makeFakeClient(mergeOrSplitPayload);
      const zipPath = path.join(tmpDir, 'merge.zip');
      fs.writeFileSync(zipPath, Buffer.from('PK\u0003\u0004 fake'));
      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'archive.zip',
        siblings: [],
        mimeType: 'application/zip',
        stagedPath: zipPath,
      });
      expect(r.fallbackReason).toBe('unsupported_mime');
    });

    it("emits fallbackReason 'missing_file' for a non-existent staged path", async () => {
      makeFakeClient(mergeOrSplitPayload);
      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'gone.pdf',
        siblings: [],
        mimeType: 'application/pdf',
        stagedPath: path.join(tmpDir, 'does-not-exist-merge.pdf'),
      });
      expect(r.fallbackReason).toBe('missing_file');
    });

    it('emits fallbackReason null for a normal PDF', async () => {
      makeFakeClient(mergeOrSplitPayload);
      const pdfPath = path.join(tmpDir, 'ok-merge.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 normal pdf body'));
      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'ok.pdf',
        siblings: [],
        mimeType: 'application/pdf',
        stagedPath: pdfPath,
      });
      expect(r.fallbackReason).toBeNull();
    });
  });

  describe('suggestBranch()', () => {
    it("emits fallbackReason 'oversize' for a >25MB buffer", async () => {
      makeFakeClient(branchPayload);
      const r = await bulkImportAnalyzer.suggestBranch({
        originalName: 'huge.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(OVERSIZE_BYTES, 0),
      });
      expect(r.fallbackReason).toBe('oversize');
    });

    it("emits fallbackReason 'unsupported_mime' for application/zip", async () => {
      makeFakeClient(branchPayload);
      const zipPath = path.join(tmpDir, 'branch.zip');
      fs.writeFileSync(zipPath, Buffer.from('PK\u0003\u0004 fake'));
      const r = await bulkImportAnalyzer.suggestBranch({
        originalName: 'archive.zip',
        mimeType: 'application/zip',
        stagedPath: zipPath,
      });
      expect(r.fallbackReason).toBe('unsupported_mime');
    });

    it("emits fallbackReason 'missing_file' for a non-existent staged path", async () => {
      makeFakeClient(branchPayload);
      const r = await bulkImportAnalyzer.suggestBranch({
        originalName: 'gone.pdf',
        mimeType: 'application/pdf',
        stagedPath: path.join(tmpDir, 'does-not-exist-branch.pdf'),
      });
      expect(r.fallbackReason).toBe('missing_file');
    });

    it('emits fallbackReason null for a normal PDF', async () => {
      makeFakeClient(branchPayload);
      const pdfPath = path.join(tmpDir, 'ok-branch.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 normal pdf body'));
      const r = await bulkImportAnalyzer.suggestBranch({
        originalName: 'ok.pdf',
        mimeType: 'application/pdf',
        stagedPath: pdfPath,
      });
      expect(r.fallbackReason).toBeNull();
    });

    it("emits fallbackReason 'extraction_failed' when the .docx extractor throws", async () => {
      // The top-level jest.mock of 'mammoth' forces extractRawText to
      // reject, so any docx mime routed through loadFileForClaude must
      // surface fallbackReason='extraction_failed'. This is the one
      // entry-point covering the extractor-failure branch as required
      // by the task acceptance criteria.
      makeFakeClient(branchPayload);
      const docxPath = path.join(tmpDir, 'broken.docx');
      fs.writeFileSync(docxPath, Buffer.from('PK\u0003\u0004 not really a docx'));
      const r = await bulkImportAnalyzer.suggestBranch({
        originalName: 'broken.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        stagedPath: docxPath,
      });
      expect(r.fallbackReason).toBe('extraction_failed');
    });
  });

  describe('suggestLinks()', () => {
    it("emits fallbackReason 'oversize' for a >25MB buffer", async () => {
      makeFakeClient(linksPayload);
      const r = await bulkImportAnalyzer.suggestLinks({
        originalName: 'huge.pdf',
        candidates: [{ id: '1', name: 'a.pdf' }],
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(OVERSIZE_BYTES, 0),
      });
      expect(r.fallbackReason).toBe('oversize');
    });

    it("emits fallbackReason 'unsupported_mime' for application/zip", async () => {
      makeFakeClient(linksPayload);
      const zipPath = path.join(tmpDir, 'links.zip');
      fs.writeFileSync(zipPath, Buffer.from('PK\u0003\u0004 fake'));
      const r = await bulkImportAnalyzer.suggestLinks({
        originalName: 'archive.zip',
        candidates: [{ id: '1', name: 'a.pdf' }],
        mimeType: 'application/zip',
        stagedPath: zipPath,
      });
      expect(r.fallbackReason).toBe('unsupported_mime');
    });

    it("emits fallbackReason 'missing_file' for a non-existent staged path", async () => {
      makeFakeClient(linksPayload);
      const r = await bulkImportAnalyzer.suggestLinks({
        originalName: 'gone.pdf',
        candidates: [{ id: '1', name: 'a.pdf' }],
        mimeType: 'application/pdf',
        stagedPath: path.join(tmpDir, 'does-not-exist-links.pdf'),
      });
      expect(r.fallbackReason).toBe('missing_file');
    });

    it('emits fallbackReason null for a normal PDF', async () => {
      makeFakeClient(linksPayload);
      const pdfPath = path.join(tmpDir, 'ok-links.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 normal pdf body'));
      const r = await bulkImportAnalyzer.suggestLinks({
        originalName: 'ok.pdf',
        candidates: [{ id: '1', name: 'a.pdf' }],
        mimeType: 'application/pdf',
        stagedPath: pdfPath,
      });
      expect(r.fallbackReason).toBeNull();
    });
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

// ── Task #767 ─────────────────────────────────────────────────────────────────
describe('Task #767 — quickAnalysis in Screening + Branching prompt', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulk-import-767-test-'));
  });
  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    bulkImportAnalyzer.__setClientForTests(null);
    cacheMockStore.clear();
  });
  beforeEach(() => {
    cacheMockStore.clear();
    getCachedMock.mockClear();
    setCachedMock.mockClear();
  });

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

  describe('screen() quickAnalysis parsing', () => {
    it('parses quickAnalysis from a real-shape Anthropic response', async () => {
      makeFakeClient({
        isComplete: true,
        isMultiDocument: false,
        pageOrderHint: null,
        rotationDegrees: 0,
        suggestedFilename: 'invoice-2024.pdf',
        description: 'Monthly invoice',
        confidence: 0.88,
        quickAnalysis: {
          typeGuess: 'invoice',
          bucketGuess: 'bill',
          reason: 'Layout and totals column suggest this is an invoice.',
          confidence: 0.85,
        },
      });

      const r = await bulkImportAnalyzer.screen({
        originalName: 'invoice-2024.pdf',
        mimeType: 'application/pdf',
      });

      expect(r.quickAnalysis).toBeDefined();
      expect(r.quickAnalysis.typeGuess).toBe('invoice');
      expect(r.quickAnalysis.bucketGuess).toBe('bill');
      expect(r.quickAnalysis.reason).toBe('Layout and totals column suggest this is an invoice.');
      expect(r.quickAnalysis.confidence).toBeCloseTo(0.85);
    });

    it('falls back to unknown when quickAnalysis is missing from the response', async () => {
      const pdfPath = path.join(tmpDir, 'no-qa.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 no-quickanalysis test'));
      makeFakeClient({
        isComplete: true,
        isMultiDocument: false,
        pageOrderHint: null,
        rotationDegrees: 0,
        suggestedFilename: 'doc.pdf',
        description: '',
        confidence: 0.5,
        // no quickAnalysis field
      });

      const r = await bulkImportAnalyzer.screen({
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        stagedPath: pdfPath,
      });

      expect(r.quickAnalysis.typeGuess).toBe('unknown');
      expect(r.quickAnalysis.bucketGuess).toBe('unknown');
    });

    it('clamps an out-of-vocabulary typeGuess to unknown', async () => {
      const pdfPath = path.join(tmpDir, 'clamped.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 clamped type guess test'));
      makeFakeClient({
        isComplete: true,
        isMultiDocument: false,
        pageOrderHint: null,
        rotationDegrees: 0,
        suggestedFilename: 'doc.pdf',
        description: '',
        confidence: 0.7,
        quickAnalysis: {
          typeGuess: 'spreadsheet', // not in vocabulary
          bucketGuess: 'bill',
          reason: 'Test',
          confidence: 0.6,
        },
      });

      const r = await bulkImportAnalyzer.screen({
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        stagedPath: pdfPath,
      });

      expect(r.quickAnalysis.typeGuess).toBe('unknown');
      expect(r.quickAnalysis.bucketGuess).toBe('bill');
    });
  });

  describe('screen() deterministic stub includes quickAnalysis', () => {
    beforeAll(() => {
      delete process.env.ANTHROPIC_API_KEY;
      bulkImportAnalyzer.__setClientForTests(null);
    });
    afterAll(() => {
      // reset to fake client for subsequent suites
    });

    it('fallback stub has quickAnalysis with typeGuess=unknown and bucketGuess=building_documents', async () => {
      const r = await bulkImportAnalyzer.screen({
        originalName: 'stub.pdf',
        mimeType: 'application/pdf',
      });
      expect(r.quickAnalysis).toBeDefined();
      expect(r.quickAnalysis.typeGuess).toBe('unknown');
      expect(r.quickAnalysis.bucketGuess).toBe('building_documents');
      expect(r.quickAnalysis.confidence).toBe(0.2);
      expect(r.quickAnalysis.fallbackReason).toBe('no_api_key');
    });
  });

  describe('suggestMergeOrSplit() prompt includes quickAnalysis context', () => {
    it('includes the current item quickAnalysis in the prompt text', async () => {
      const create = makeFakeClient({
        decision: 'keep',
        reason: 'no match',
        confidence: 0.7,
      });

      await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'invoice.pdf',
        siblings: [{ id: 's1', name: 'contract.pdf', quickAnalysis: null }],
        quickAnalysis: {
          typeGuess: 'invoice',
          bucketGuess: 'bill',
          reason: 'Has a totals section',
          confidence: 0.8,
        },
      });

      const sentPrompt: string = create.mock.calls[0][0].messages[0].content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');

      expect(sentPrompt).toContain('invoice');
      expect(sentPrompt).toContain('bill');
      expect(sentPrompt).toContain('Has a totals section');
    });

    it('includes sibling quickAnalysis ids and type/bucket guesses in prompt', async () => {
      const create = makeFakeClient({
        decision: 'merge',
        reason: 'same type and bucket',
        mergeWithItemId: 'sib-42',
        confidence: 0.9,
      });

      await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'invoice-a.pdf',
        siblings: [
          {
            id: 'sib-42',
            name: 'invoice-b.pdf',
            quickAnalysis: {
              typeGuess: 'invoice',
              bucketGuess: 'bill',
              reason: 'Looks like an invoice',
              confidence: 0.82,
            },
          },
        ],
        quickAnalysis: {
          typeGuess: 'invoice',
          bucketGuess: 'bill',
          reason: 'Invoice header present',
          confidence: 0.85,
        },
      });

      const sentPrompt: string = create.mock.calls[0][0].messages[0].content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');

      expect(sentPrompt).toContain('sib-42');
      expect(sentPrompt).toContain('invoice-b.pdf');
      expect(sentPrompt).toContain('typeGuess=invoice');
      expect(sentPrompt).toContain('bucketGuess=bill');
    });

    it('still accepts siblings with no quickAnalysis (old sessions)', async () => {
      const create = makeFakeClient({
        decision: 'keep',
        reason: 'fallback names only',
        confidence: 0.5,
      });

      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'old-doc.pdf',
        siblings: [{ id: 'old-sib', name: 'old-sibling.pdf' }], // no quickAnalysis
      });

      expect(r.decision).toBe('keep');
      const sentPrompt: string = create.mock.calls[0][0].messages[0].content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');
      // Sibling name appears even without quickAnalysis
      expect(sentPrompt).toContain('old-sibling.pdf');
    });

    it('returns mergeWithItemId from the model when same typeGuess+bucketGuess → merge', async () => {
      makeFakeClient({
        decision: 'merge',
        reason: 'Same invoice/bill type and bucket as sibling',
        mergeWithItemId: 'sibling-id-99',
        confidence: 0.92,
      });

      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'invoice-jan.pdf',
        siblings: [
          {
            id: 'sibling-id-99',
            name: 'invoice-feb.pdf',
            quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'bill', reason: 'Feb invoice', confidence: 0.8 },
          },
        ],
        quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'bill', reason: 'Jan invoice', confidence: 0.85 },
      });

      expect(r.decision).toBe('merge');
      expect(r.mergeWithItemId).toBe('sibling-id-99');
      expect(r.fallbackReason).toBeNull();
    });

    it('includes isMultiDocument=true signal in the prompt', async () => {
      const create = makeFakeClient({
        decision: 'split',
        reason: 'multi-document file',
        splitAtPage: 3,
        confidence: 0.88,
      });

      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'combined.pdf',
        siblings: [],
        isMultiDocument: true,
        quickAnalysis: { typeGuess: 'contract', bucketGuess: 'building_documents', reason: 'Multi', confidence: 0.7 },
      });

      expect(r.decision).toBe('split');
      const sentPrompt: string = create.mock.calls[0][0].messages[0].content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');
      expect(sentPrompt).toContain('isMultiDocument=true');
      expect(r.splitAtPage).toBe(3);
    });

    it('omits isMultiDocument signal from prompt when not provided (backwards compat)', async () => {
      const create = makeFakeClient({
        decision: 'keep',
        reason: 'no split needed',
        confidence: 0.7,
      });

      await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'normal.pdf',
        siblings: [],
        // no isMultiDocument field — old-session callers do not pass it
      });

      const sentPrompt: string = create.mock.calls[0][0].messages[0].content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');
      // The DYNAMIC per-item multi-doc contextual line must not appear when isMultiDocument is absent.
      // (The static decision-rule text is always included and is not the signal we're checking.)
      expect(sentPrompt).not.toContain('it appears to contain multiple separate documents');
    });

    it('works when current item screening blob has no quickAnalysis (old session item)', async () => {
      const create = makeFakeClient({
        decision: 'keep',
        reason: 'no context from screening',
        confidence: 0.4,
      });

      // Simulates an old item whose screening blob predates Task #767
      const r = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: 'legacy.pdf',
        siblings: [],
        quickAnalysis: null,   // no quickAnalysis — old session
        isMultiDocument: null, // no isMultiDocument — old session
      });

      expect(r.decision).toBe('keep');
      // Neither quickAnalysis nor isMultiDocument lines should crash the prompt
      const sentPrompt: string = create.mock.calls[0][0].messages[0].content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');
      expect(sentPrompt).toContain('legacy.pdf');
    });
  });
});
