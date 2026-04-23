/**
 * Anthropic-powered analyzer for the admin "Bulk Document Import" page.
 *
 * Every AI step in the bulk-import pipeline goes through this service so
 * route handlers and MCP tools never call the Anthropic SDK directly.
 *
 * If `ANTHROPIC_API_KEY` is missing the analyzer still works in
 * "fallback" mode — it returns deterministic low-confidence stubs so the
 * UI keeps moving and tests don't need a live key.
 *
 * When a `stagedPath` (or raw `buffer` + `mimeType`) is supplied, the
 * analyzer also forwards the actual document body to Claude:
 *   - PDFs go through as a base64 `document` block.
 *   - Images go through as a base64 `image` block.
 *   - .docx/.xlsx are extracted to plain text via mammoth/xlsx and
 *     prepended to the text prompt.
 *   - Anything else (or oversize bytes / extraction failure) silently
 *     falls back to the filename-only prompt instead of crashing.
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import { logError, logInfo } from '../utils/logger';

export interface AnalyzerConfidence {
  /** Numeric 0..1 confidence as reported by the model. */
  confidence: number;
}

export interface ScreeningResult extends AnalyzerConfidence {
  isComplete: boolean;
  isMultiDocument: boolean;
  pageOrderHint: number[] | null;
  rotationDegrees: 0 | 90 | 180 | 270;
  suggestedFilename: string;
  description: string;
}

export interface MergeOrSplitResult extends AnalyzerConfidence {
  decision: 'keep' | 'merge' | 'split';
  reason: string;
  mergeWithItemId?: string;
  splitAtPage?: number;
}

export interface BranchResult extends AnalyzerConfidence {
  branch:
    | 'building_documents'
    | 'residence_documents'
    | 'demand'
    | 'bill'
    | 'maintenance'
    | 'other';
  residenceHint?: string;
  reason: string;
}

export interface IdentificationResult extends AnalyzerConfidence {
  name: string;
  description: string;
  tags: string[];
  effectiveDate?: string;
  metadata: Record<string, unknown>;
}

export interface LinkSuggestion extends AnalyzerConfidence {
  beforeItemId?: string;
  afterItemId?: string;
  relatedItemIds: string[];
  reason: string;
}

/**
 * Optional file-source hint shared by every analyzer call. When this is
 * present and the bytes are a supported type, the analyzer attaches the
 * real document to the Anthropic request for higher-confidence answers.
 */
export interface AnalyzerFileSource {
  stagedPath?: string | null;
  buffer?: Buffer | null;
  mimeType?: string | null;
}

const MODEL = 'claude-3-5-sonnet-latest';

/** Anthropic accepts ~32MB / call; we cap well below that to be safe. */
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
/** Cap for extracted Office text so prompts stay within the 1024-token budget. */
const MAX_EXTRACTED_TEXT = 20_000;

const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const DOCX_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const XLSX_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const PLAIN_TEXT_MIMES = new Set(['text/plain', 'text/csv']);

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: string; data: string };
    };

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (client) return client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    client = new Anthropic({ apiKey: key });
    return client;
  } catch (err) {
    logError('[bulkImportAnalyzer] failed to construct Anthropic client', err as Error);
    return null;
  }
}

/**
 * Read the staged file (or use the supplied buffer) and turn it into
 * Anthropic content blocks plus an optional text prefix to inject into
 * the prompt. Any failure (missing file, oversize, unsupported type,
 * extractor error) returns empty arrays so the analyzer falls back to
 * the filename-only prompt instead of crashing the run.
 */
async function loadFileForClaude(
  source: AnalyzerFileSource | undefined,
): Promise<{ blocks: AnthropicContentBlock[]; textPrefix: string }> {
  if (!source) return { blocks: [], textPrefix: '' };
  const mimeType = (source.mimeType ?? '').toLowerCase();
  if (!mimeType) return { blocks: [], textPrefix: '' };

  let buffer: Buffer | null = source.buffer ?? null;
  if (!buffer && source.stagedPath) {
    try {
      const stat = fs.statSync(source.stagedPath);
      if (stat.size > MAX_DOCUMENT_BYTES) {
        logInfo('[bulkImportAnalyzer] skipping oversize staged file', {
          metadata: { stagedPath: source.stagedPath, size: stat.size },
        });
        return { blocks: [], textPrefix: '' };
      }
      buffer = fs.readFileSync(source.stagedPath);
    } catch (err) {
      logError('[bulkImportAnalyzer] failed to read staged file', err as Error);
      return { blocks: [], textPrefix: '' };
    }
  }
  if (!buffer) return { blocks: [], textPrefix: '' };
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    return { blocks: [], textPrefix: '' };
  }

  if (mimeType === PDF_MIME) {
    return {
      blocks: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: PDF_MIME,
            data: buffer.toString('base64'),
          },
        },
      ],
      textPrefix: '',
    };
  }
  if (IMAGE_MIMES.has(mimeType)) {
    return {
      blocks: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
            data: buffer.toString('base64'),
          },
        },
      ],
      textPrefix: '',
    };
  }
  if (PLAIN_TEXT_MIMES.has(mimeType)) {
    const text = buffer.toString('utf8').slice(0, MAX_EXTRACTED_TEXT);
    return { blocks: [], textPrefix: text ? `Document text:\n${text}\n\n` : '' };
  }
  if (DOCX_MIMES.has(mimeType)) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').slice(0, MAX_EXTRACTED_TEXT);
      return { blocks: [], textPrefix: text ? `Document text:\n${text}\n\n` : '' };
    } catch (err) {
      logError('[bulkImportAnalyzer] mammoth extraction failed', err as Error);
      return { blocks: [], textPrefix: '' };
    }
  }
  if (XLSX_MIMES.has(mimeType)) {
    try {
      const xlsx = await import('xlsx');
      const wb = xlsx.read(buffer, { type: 'buffer' });
      const lines: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const csv = xlsx.utils.sheet_to_csv(sheet);
        if (csv.trim()) lines.push(`# ${sheetName}\n${csv}`);
        if (lines.join('\n').length > MAX_EXTRACTED_TEXT) break;
      }
      const text = lines.join('\n').slice(0, MAX_EXTRACTED_TEXT);
      return { blocks: [], textPrefix: text ? `Spreadsheet contents:\n${text}\n\n` : '' };
    } catch (err) {
      logError('[bulkImportAnalyzer] xlsx extraction failed', err as Error);
      return { blocks: [], textPrefix: '' };
    }
  }

  return { blocks: [], textPrefix: '' };
}

/**
 * Send a prompt (optionally with attached document/image blocks) to
 * Claude and parse a single JSON object out of the response. Returns
 * null on transport / parse failure so callers can fall back to a
 * deterministic stub.
 */
async function callClaudeJson<T>(
  prompt: string,
  source?: AnalyzerFileSource,
): Promise<T | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { blocks, textPrefix } = await loadFileForClaude(source);
    const userContent: AnthropicContentBlock[] = [
      ...blocks,
      { type: 'text', text: `${textPrefix}${prompt}` },
    ];
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        'You analyze property-management documents for a bulk-ingest pipeline. Respond with one JSON object only — no prose, no markdown.',
      messages: [
        {
          role: 'user',
          content: userContent as unknown as Anthropic.Messages.MessageParam['content'],
        },
      ],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch (err) {
    logError('[bulkImportAnalyzer] anthropic call failed', err as Error);
    return null;
  }
}

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0.2;
  return Math.max(0, Math.min(1, n));
}

function fallbackScreening(originalName: string): ScreeningResult {
  return {
    isComplete: true,
    isMultiDocument: false,
    pageOrderHint: null,
    rotationDegrees: 0,
    suggestedFilename: originalName,
    description: 'Auto-stub description (Anthropic unavailable).',
    confidence: 0.2,
  };
}

export const bulkImportAnalyzer = {
  async screen(input: {
    originalName: string;
    mimeType?: string | null;
    fileSize?: number | null;
    stagedPath?: string | null;
    buffer?: Buffer | null;
  }): Promise<ScreeningResult> {
    const prompt = `Analyze this uploaded document for a property-management bulk import.
Filename: ${input.originalName}
MIME: ${input.mimeType ?? 'unknown'}
Size: ${input.fileSize ?? 'unknown'} bytes
Return JSON with keys: isComplete (bool), isMultiDocument (bool), pageOrderHint (number[] or null),
rotationDegrees (0|90|180|270), suggestedFilename (string), description (short string),
confidence (0..1).`;
    const raw = await callClaudeJson<Partial<ScreeningResult>>(prompt, {
      stagedPath: input.stagedPath,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    if (!raw) return fallbackScreening(input.originalName);
    return {
      isComplete: !!raw.isComplete,
      isMultiDocument: !!raw.isMultiDocument,
      pageOrderHint: Array.isArray(raw.pageOrderHint) ? (raw.pageOrderHint as number[]) : null,
      rotationDegrees: ([0, 90, 180, 270].includes(raw.rotationDegrees as number)
        ? raw.rotationDegrees
        : 0) as 0 | 90 | 180 | 270,
      suggestedFilename: typeof raw.suggestedFilename === 'string' && raw.suggestedFilename
        ? raw.suggestedFilename
        : input.originalName,
      description: typeof raw.description === 'string' ? raw.description : '',
      confidence: clampConfidence(raw.confidence),
    };
  },

  async suggestMergeOrSplit(input: {
    originalName: string;
    siblingNames: string[];
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
  }): Promise<MergeOrSplitResult> {
    const prompt = `You are sorting scanned documents. The current document is "${input.originalName}".
Other staged docs in this session: ${JSON.stringify(input.siblingNames)}.
Decide whether to keep, merge, or split. Return JSON: { decision: 'keep'|'merge'|'split',
reason: string, mergeWithItemId?: string, splitAtPage?: number, confidence: number }.`;
    const raw = await callClaudeJson<Partial<MergeOrSplitResult>>(prompt, {
      stagedPath: input.stagedPath,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    if (!raw) {
      return { decision: 'keep', reason: 'fallback', confidence: 0.2 };
    }
    return {
      decision:
        raw.decision === 'merge' || raw.decision === 'split' ? raw.decision : 'keep',
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      mergeWithItemId:
        typeof raw.mergeWithItemId === 'string' ? raw.mergeWithItemId : undefined,
      splitAtPage:
        typeof raw.splitAtPage === 'number' ? raw.splitAtPage : undefined,
      confidence: clampConfidence(raw.confidence),
    };
  },

  async suggestBranch(input: {
    originalName: string;
    description?: string;
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
  }): Promise<BranchResult> {
    const prompt = `Choose the best destination for this document inside a property-management app.
Filename: ${input.originalName}
Description: ${input.description ?? ''}
Return JSON: { branch: 'building_documents'|'residence_documents'|'demand'|'bill'|'maintenance'|'other',
residenceHint?: string, reason: string, confidence: number }.`;
    const raw = await callClaudeJson<Partial<BranchResult>>(prompt, {
      stagedPath: input.stagedPath,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    const allowed: BranchResult['branch'][] = [
      'building_documents',
      'residence_documents',
      'demand',
      'bill',
      'maintenance',
      'other',
    ];
    if (!raw) {
      return { branch: 'building_documents', reason: 'fallback', confidence: 0.2 };
    }
    return {
      branch: allowed.includes(raw.branch as BranchResult['branch'])
        ? (raw.branch as BranchResult['branch'])
        : 'building_documents',
      residenceHint:
        typeof raw.residenceHint === 'string' ? raw.residenceHint : undefined,
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      confidence: clampConfidence(raw.confidence),
    };
  },

  async identify(input: {
    originalName: string;
    description?: string;
    branch?: string;
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
  }): Promise<IdentificationResult> {
    const prompt = `Extract metadata for a document being filed under "${input.branch ?? 'building_documents'}".
Filename: ${input.originalName}
Description: ${input.description ?? ''}
Return JSON: { name: string, description: string, tags: string[],
effectiveDate?: 'YYYY-MM-DD', metadata: object, confidence: number }.`;
    const raw = await callClaudeJson<Partial<IdentificationResult>>(prompt, {
      stagedPath: input.stagedPath,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    if (!raw) {
      return {
        name: input.originalName,
        description: '',
        tags: [],
        metadata: {},
        confidence: 0.2,
      };
    }
    return {
      name: typeof raw.name === 'string' && raw.name ? raw.name : input.originalName,
      description: typeof raw.description === 'string' ? raw.description : '',
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]).filter((t) => typeof t === 'string') : [],
      effectiveDate:
        typeof raw.effectiveDate === 'string' ? raw.effectiveDate : undefined,
      metadata:
        raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
          ? (raw.metadata as Record<string, unknown>)
          : {},
      confidence: clampConfidence(raw.confidence),
    };
  },

  async suggestLinks(input: {
    originalName: string;
    candidates: { id: string; name: string }[];
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
  }): Promise<LinkSuggestion> {
    const prompt = `Find related documents for "${input.originalName}" from the candidates: ${JSON.stringify(
      input.candidates,
    )}. Return JSON: { beforeItemId?: string, afterItemId?: string,
relatedItemIds: string[], reason: string, confidence: number }.`;
    const raw = await callClaudeJson<Partial<LinkSuggestion>>(prompt, {
      stagedPath: input.stagedPath,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    if (!raw) {
      return { relatedItemIds: [], reason: 'fallback', confidence: 0.2 };
    }
    return {
      beforeItemId: typeof raw.beforeItemId === 'string' ? raw.beforeItemId : undefined,
      afterItemId: typeof raw.afterItemId === 'string' ? raw.afterItemId : undefined,
      relatedItemIds: Array.isArray(raw.relatedItemIds)
        ? (raw.relatedItemIds as string[]).filter((s) => typeof s === 'string')
        : [],
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      confidence: clampConfidence(raw.confidence),
    };
  },

  /**
   * Exposed so tests can swap the Anthropic call out without touching the
   * environment. Pass `null` to revert to the lazy real-client path.
   */
  __setClientForTests(c: Anthropic | null) {
    client = c;
    logInfo('[bulkImportAnalyzer] test client override applied', { metadata: { hasClient: !!c } });
  },
};

export type BulkImportAnalyzer = typeof bulkImportAnalyzer;
