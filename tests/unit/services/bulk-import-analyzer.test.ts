/**
 * Unit tests for the bulk-import Anthropic analyzer (Task #451).
 * Verifies the deterministic fallback path (no ANTHROPIC_API_KEY required),
 * the confidence-band helper used by the UI badges, and the file-attachment
 * path added in Task #455 (Send real document files to Anthropic).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
      siblingNames: [],
      mimeType: 'application/zip',
      stagedPath: binPath,
    });

    const sent = create.mock.calls[0][0];
    const blocks = sent.messages[0].content as Array<{ type: string }>;
    expect(blocks.every((b) => b.type === 'text')).toBe(true);
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
