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
import { createHash } from 'crypto';
import * as fs from 'fs';
import { logError, logInfo, logWarn } from '../utils/logger';
import type { BulkImportFallbackReason } from '../../shared/schemas/bulk-import';
import {
  getCachedSuggestion,
  setCachedSuggestion,
} from './ai-suggestion-cache';

/**
 * Per-step Anthropic response cache (Task #462).
 *
 * Re-running screen → sort → branch → identify → link for a 20MB PDF used
 * to upload the bytes to Anthropic 5 times. We now key the response by
 * (step, model, prompt, contentHash) in the shared `ai_suggestion_cache`
 * table so repeat runs are free and fast. Hashing the prompt into the key
 * means prompt changes (and therefore semantic changes) invalidate cached
 * entries naturally without a manual bump.
 */
const ANALYZER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ANALYZER_CACHE_KEY_PREFIX = 'bulk-import-analyzer:v1';

type AnalyzerStep =
  | 'screen'
  | 'merge-or-split'
  | 'branch'
  | 'identify'
  | 'links';

function buildAnalyzerCacheKey(
  step: AnalyzerStep,
  prompt: string,
  contentHash: string | null,
): string {
  const promptHash = createHash('sha256').update(prompt).digest('hex');
  return [
    ANALYZER_CACHE_KEY_PREFIX,
    step,
    MODEL,
    promptHash,
    contentHash || 'no-file',
  ].join(':');
}

export interface AnalyzerConfidence {
  /** Numeric 0..1 confidence as reported by the model. */
  confidence: number;
  /**
   * Set when the analyzer could not attach the real document bytes to
   * the prompt and had to fall back to a filename-only request. `null`
   * means the document body was sent normally (or no source was supplied
   * at all, which isn't a fallback).
   */
  fallbackReason?: BulkImportFallbackReason | null;
}

export type QuickAnalysisTypeGuess =
  | 'invoice'
  | 'contract'
  | 'minutes'
  | 'statement'
  | 'letter'
  | 'report'
  | 'other'
  | 'unknown';

export type QuickAnalysisBucketGuess =
  | 'building_documents'
  | 'residence_documents'
  | 'demand'
  | 'bill'
  | 'maintenance'
  | 'other'
  | 'unknown';

export interface QuickAnalysis {
  typeGuess: QuickAnalysisTypeGuess;
  bucketGuess: QuickAnalysisBucketGuess;
  reason: string;
  confidence: number;
  /** Set when this is a deterministic stub because AI was unavailable. */
  fallbackReason?: BulkImportFallbackReason | null;
}

export interface ScreeningResult extends AnalyzerConfidence {
  isComplete: boolean;
  isMultiDocument: boolean;
  pageOrderHint: number[] | null;
  rotationDegrees: 0 | 90 | 180 | 270;
  suggestedFilename: string;
  description: string;
  quickAnalysis: QuickAnalysis;
  /**
   * Lightweight period/identifier hint extracted from the filename or
   * document content during Screening (Task #955). Used by the merge
   * prompt and the trivially-keep short-circuit to distinguish two
   * files of the same type that cover different time periods (e.g.
   * "2021-10" vs "2022-11") from two files that are genuine parts of
   * the same physical document. Null when the screener could not
   * determine a period.
   */
  periodHint: string | null;
}

export interface MergeOrSplitResult extends AnalyzerConfidence {
  decision: 'keep' | 'merge' | 'split';
  reason: string;
  mergeWithItemId?: string;
  splitAtPage?: number;
}

/** Sibling item context passed to the Branching (suggestMergeOrSplit) analyzer. */
export interface SiblingContext {
  id: string;
  name: string;
  quickAnalysis?: QuickAnalysis | null;
  /** Period/identifier hint from Screening (Task #955). Null when unknown. */
  periodHint?: string | null;
}

export type BranchDestination =
  | 'building_documents'
  | 'residence_documents'
  | 'demand'
  | 'bill'
  | 'maintenance'
  | 'other';

export const BRANCH_SUB_CATEGORIES: Record<BranchDestination, readonly string[]> = {
  building_documents: ['bylaws', 'minutes', 'insurance', 'financial_statement', 'contract', 'correspondence', 'other'],
  residence_documents: ['lease', 'inspection', 'correspondence', 'key_handover', 'other'],
  bill: ['utility', 'insurance', 'tax', 'maintenance_invoice', 'condo_fee', 'other'],
  demand: ['complaint', 'request', 'legal_notice', 'other'],
  maintenance: ['work_order', 'quote', 'inspection_report', 'inventory', 'other'],
  other: ['other'],
} as const;

export interface BranchResult extends AnalyzerConfidence {
  branch: BranchDestination;
  subCategory: string;
  residenceHint?: string;
  reason: string;
  residenceId?: string | null;
  residenceConfidence?: number | null;
  residenceReason?: string | null;
  residenceFallbackReason?: string | null;
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

const MODEL = 'claude-sonnet-4-6';

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
 * Whether the analyzer can currently call Anthropic. Returns false when
 * `ANTHROPIC_API_KEY` is missing or the SDK fails to initialise — in
 * which case every analyzer call falls through to the deterministic
 * 20%-confidence stub path. Exposed so the admin Bulk Document Import
 * page can show a single page-level "AI unavailable" banner instead of
 * relying on per-document fallback badges alone.
 */
export function isBulkImportAiAvailable(): boolean {
  return getClient() !== null;
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
): Promise<{
  blocks: AnthropicContentBlock[];
  textPrefix: string;
  contentHash: string | null;
  fallbackReason: BulkImportFallbackReason | null;
}> {
  if (!source) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: null };
  }
  const mimeType = (source.mimeType ?? '').toLowerCase();
  // No mimeType + no buffer/path → caller never asked us to attach
  // anything, so this isn't a fallback either.
  if (!mimeType && !source.buffer && !source.stagedPath) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: null };
  }
  if (!mimeType) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'unsupported_mime' };
  }

  let buffer: Buffer | null = source.buffer ?? null;
  if (!buffer && source.stagedPath) {
    try {
      const stat = fs.statSync(source.stagedPath);
      if (stat.size > MAX_DOCUMENT_BYTES) {
        logInfo('[bulkImportAnalyzer] skipping oversize staged file', {
          metadata: { stagedPath: source.stagedPath, size: stat.size },
        });
        return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'oversize' };
      }
      buffer = fs.readFileSync(source.stagedPath);
    } catch (err) {
      logError('[bulkImportAnalyzer] failed to read staged file', err as Error);
      return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'missing_file' };
    }
  }
  if (!buffer) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'missing_file' };
  }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'oversize' };
  }

  // Hashing the bytes once here gives downstream callers a stable
  // content fingerprint for the analyzer cache without forcing them to
  // re-read the file. Including the mime in the hash means a file that
  // somehow gets re-uploaded under a different mime type (e.g. PDF
  // saved as image/png) does not collide on cache lookups.
  const contentHash = createHash('sha256')
    .update(mimeType)
    .update('\x1f')
    .update(buffer)
    .digest('hex');

  if (mimeType === PDF_MIME) {
    return {
      contentHash,
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
      fallbackReason: null,
    };
  }
  if (IMAGE_MIMES.has(mimeType)) {
    return {
      contentHash,
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
      fallbackReason: null,
    };
  }
  if (PLAIN_TEXT_MIMES.has(mimeType)) {
    const text = buffer.toString('utf8').slice(0, MAX_EXTRACTED_TEXT);
    return {
      blocks: [],
      textPrefix: text ? `Document text:\n${text}\n\n` : '',
      contentHash,
      fallbackReason: null,
    };
  }
  if (DOCX_MIMES.has(mimeType)) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').slice(0, MAX_EXTRACTED_TEXT);
      return {
        blocks: [],
        textPrefix: text ? `Document text:\n${text}\n\n` : '',
        contentHash,
        fallbackReason: null,
      };
    } catch (err) {
      logError('[bulkImportAnalyzer] mammoth extraction failed', err as Error);
      // Preserve contentHash even on extractor failure so the cache key
      // stays content-aware: two different docx files that both fail
      // extraction must not collide on the same `:no-file` slot.
      return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'extraction_failed' };
    }
  }
  if (XLSX_MIMES.has(mimeType)) {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const lines: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const csv = XLSX.utils.sheet_to_csv(sheet);
        // Strip control characters (null bytes, etc.) that can corrupt
        // the JSON payload sent to Anthropic and trigger api_error.
        // Keep printable ASCII + common whitespace (tab, LF, CR).
        const cleanCsv = csv.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\uFFFF]/g, '').trim();
        if (cleanCsv) lines.push(`# ${sheetName}\n${cleanCsv}`);
        if (lines.join('\n').length > MAX_EXTRACTED_TEXT) break;
      }
      const text = lines.join('\n').slice(0, MAX_EXTRACTED_TEXT);
      return {
        blocks: [],
        textPrefix: text ? `Spreadsheet contents:\n${text}\n\n` : '',
        contentHash,
        fallbackReason: null,
      };
    } catch (err) {
      logError('[bulkImportAnalyzer] xlsx extraction failed', err as Error);
      return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'extraction_failed' };
    }
  }

  // Unsupported MIME with bytes available: still return contentHash so
  // the analyzer cache distinguishes between two different unknown
  // files that happen to share the same prompt.
  return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'unsupported_mime' };
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
  step?: AnalyzerStep,
  logContext?: { originalName?: string; itemId?: string; sessionId?: string },
): Promise<{ data: T | null; fallbackReason: BulkImportFallbackReason | null }> {
  const c = getClient();
  // No Anthropic client = no AI run at all. Tag the result with
  // `no_api_key` so the UI can show "AI unavailable" alongside the
  // 20% stub instead of a generic low-confidence badge that makes
  // admins think the AI ran and disagreed with the document.
  if (!c) return { data: null, fallbackReason: 'no_api_key' };
  let fallbackReason: BulkImportFallbackReason | null = null;
  try {
    const loaded = await loadFileForClaude(source);
    fallbackReason = loaded.fallbackReason;
    const { blocks, textPrefix, contentHash } = loaded;
    // Cache lookup: keyed on the full prompt (which already encodes
    // step-specific inputs like sibling filenames or candidate ids) plus
    // the file content hash. A hit returns instantly and skips the
    // potentially-multi-MB upload to Anthropic entirely.
    const fullPrompt = `${textPrefix}${prompt}`;
    const cacheKey = step ? buildAnalyzerCacheKey(step, fullPrompt, contentHash) : null;
    if (cacheKey) {
      const hit = await getCachedSuggestion<{
        data: T | null;
        fallbackReason: BulkImportFallbackReason | null;
      }>(cacheKey);
      if (hit !== null) {
        logInfo('[bulkImportAnalyzer] cache hit', {
          metadata: { step, contentHash: contentHash ?? 'no-file' },
        });
        return hit;
      }
    }

    const userContent: AnthropicContentBlock[] = [
      ...blocks,
      { type: 'text', text: fullPrompt },
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
    if (!match) {
      // Anthropic replied but the response contained no JSON object.
      // Tag with a distinct per-file reason so the UI shows "AI response
      // unreadable" rather than a generic low-confidence badge, and
      // preserve any earlier per-file reason set during file loading.
      const noMatchReason = fallbackReason ?? 'unreadable_response';
      logWarn('[bulkImportAnalyzer] per-file AI response contained no JSON', {
        metadata: {
          step,
          originalName: logContext?.originalName,
          itemId: logContext?.itemId,
          sessionId: logContext?.sessionId,
        },
      });
      return { data: null, fallbackReason: noMatchReason };
    }
    const parsed = JSON.parse(match[0]) as T;
    const result = { data: parsed, fallbackReason };
    if (cacheKey) {
      // Awaited so the cache row is durable before we return — the
      // write is a single upsert and `setCachedSuggestion` already
      // swallows transport errors internally, so it cannot throw.
      // Awaiting also avoids a pending promise outliving the request,
      // which previously surfaced as "Cannot log after tests are done"
      // warnings in unit suites without a database.
      await setCachedSuggestion(cacheKey, result, ANALYZER_CACHE_TTL_MS);
    }
    return result;
  } catch (err) {
    // The Anthropic call threw (network, timeout, rate-limit, non-2xx).
    // Tag with a distinct per-file reason and preserve any earlier
    // per-file reason set during file loading (e.g. oversize, missing_file).
    const apiErrReason = fallbackReason ?? 'api_error';
    const e = err as Error & { status?: number };
    logError('[bulkImportAnalyzer] per-file AI call failed', e, {
      metadata: {
        step,
        originalName: logContext?.originalName,
        itemId: logContext?.itemId,
        sessionId: logContext?.sessionId,
        errorStatus: e.status ?? null,
      },
    });
    return { data: null, fallbackReason: apiErrReason };
  }
}

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0.2;
  return Math.max(0, Math.min(1, n));
}

function fallbackQuickAnalysis(
  fallbackReason: BulkImportFallbackReason | null = null,
): QuickAnalysis {
  return {
    typeGuess: 'unknown',
    bucketGuess: 'unknown',
    reason: 'AI did not analyze this file.',
    confidence: 0.2,
    fallbackReason,
  };
}

function fallbackScreening(
  originalName: string,
  fallbackReason: BulkImportFallbackReason | null = null,
): ScreeningResult {
  return {
    isComplete: true,
    isMultiDocument: false,
    pageOrderHint: null,
    rotationDegrees: 0,
    suggestedFilename: originalName,
    description: 'Auto-stub description (Anthropic unavailable).',
    confidence: 0.2,
    fallbackReason,
    periodHint: null,
    quickAnalysis: fallbackQuickAnalysis(fallbackReason),
  };
}

const TYPE_GUESSES: QuickAnalysisTypeGuess[] = [
  'invoice', 'contract', 'minutes', 'statement', 'letter', 'report', 'other', 'unknown',
];
const BUCKET_GUESSES: QuickAnalysisBucketGuess[] = [
  'building_documents', 'residence_documents', 'demand', 'bill', 'maintenance', 'other', 'unknown',
];

function parseQuickAnalysis(raw: unknown, fallbackReason: BulkImportFallbackReason | null): QuickAnalysis {
  if (!raw || typeof raw !== 'object') {
    // When the API was unavailable, return the deterministic stub (includes fallbackReason).
    // When the API responded but omitted quickAnalysis, return all-unknown so callers
    // know the field was genuinely not provided (distinct from the stub bucket guess).
    if (fallbackReason) return fallbackQuickAnalysis(fallbackReason);
    return { typeGuess: 'unknown', bucketGuess: 'unknown', reason: '', confidence: 0 };
  }
  const r = raw as Record<string, unknown>;
  const typeGuess: QuickAnalysisTypeGuess =
    TYPE_GUESSES.includes(r.typeGuess as QuickAnalysisTypeGuess)
      ? (r.typeGuess as QuickAnalysisTypeGuess)
      : 'unknown';
  const bucketGuess: QuickAnalysisBucketGuess =
    BUCKET_GUESSES.includes(r.bucketGuess as QuickAnalysisBucketGuess)
      ? (r.bucketGuess as QuickAnalysisBucketGuess)
      : 'unknown';
  return {
    typeGuess,
    bucketGuess,
    reason: typeof r.reason === 'string' ? r.reason : '',
    confidence: clampConfidence(r.confidence),
  };
}

export const bulkImportAnalyzer = {
  async screen(input: {
    originalName: string;
    mimeType?: string | null;
    fileSize?: number | null;
    stagedPath?: string | null;
    buffer?: Buffer | null;
    itemId?: string;
    sessionId?: string;
  }): Promise<ScreeningResult> {
    const prompt = `Analyze this uploaded document for a property-management bulk import.
Filename: ${input.originalName}
MIME: ${input.mimeType ?? 'unknown'}
Size: ${input.fileSize ?? 'unknown'} bytes
Return JSON with keys:
- isComplete (bool): whether the document appears complete (not cut off)
- isMultiDocument (bool): whether multiple separate documents are stitched together
- pageOrderHint (number[] or null): reordering hint if pages seem shuffled, else null
- rotationDegrees (0|90|180|270): clockwise rotation needed to make pages upright
- suggestedFilename (string): a cleaner filename suggestion
- description (short string): one-sentence description of the document
- confidence (0..1): your overall confidence in this analysis
- periodHint (string or null): a short label identifying the document's time period or unique identifier — a fiscal year (e.g. "2022-2023"), a calendar year ("2022"), a meeting date ("2021-10-15"), an invoice number ("INV-2024-042"), or a date range ("2023 Q3"). Use the filename and document content. Set null when you cannot determine any such identifier.
- quickAnalysis (object): { typeGuess, bucketGuess, reason, confidence }
  where typeGuess is one of: invoice|contract|minutes|statement|letter|report|other|unknown
  and bucketGuess is one of: building_documents|residence_documents|demand|bill|maintenance|other|unknown
  and reason is a one-sentence explanation of your guess
  and confidence is 0..1 for this quick-analysis guess specifically`;
    const { data: raw, fallbackReason } = await callClaudeJson<Record<string, unknown>>(
      prompt,
      {
        stagedPath: input.stagedPath,
        buffer: input.buffer,
        mimeType: input.mimeType,
      },
      'screen',
      { originalName: input.originalName, itemId: input.itemId, sessionId: input.sessionId },
    );
    if (!raw) return fallbackScreening(input.originalName, fallbackReason);
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
      fallbackReason,
      periodHint: typeof raw.periodHint === 'string' && raw.periodHint ? raw.periodHint : null,
      quickAnalysis: parseQuickAnalysis(raw.quickAnalysis, fallbackReason),
    };
  },

  async suggestMergeOrSplit(input: {
    originalName: string;
    siblings: SiblingContext[];
    quickAnalysis?: QuickAnalysis | null;
    isMultiDocument?: boolean | null;
    periodHint?: string | null;
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
    itemId?: string;
    sessionId?: string;
  }): Promise<MergeOrSplitResult> {
    const siblingLines = input.siblings
      .map((s) => {
        const qa = s.quickAnalysis;
        const periodPart = s.periodHint ? ` periodHint="${s.periodHint}"` : '';
        if (qa) {
          return `  - id=${s.id} name="${s.name}" typeGuess=${qa.typeGuess} bucketGuess=${qa.bucketGuess}${periodPart}`;
        }
        return `  - id=${s.id} name="${s.name}"${periodPart}`;
      })
      .join('\n');

    const myQa = input.quickAnalysis;
    const myPeriodHint = input.periodHint ?? null;
    const myQaLine = myQa
      ? `Screening tagged this file as: typeGuess=${myQa.typeGuess}, bucketGuess=${myQa.bucketGuess} (${myQa.reason})${myPeriodHint ? `, periodHint="${myPeriodHint}"` : ''}`
      : (myPeriodHint ? `Period/identifier hint: "${myPeriodHint}"` : '');
    const multiDocLine = input.isMultiDocument
      ? 'Screening flagged this file as isMultiDocument=true (it appears to contain multiple separate documents stitched together).'
      : '';

    const prompt = `You are branching scanned documents into keep/merge/split decisions.

Current document: "${input.originalName}"
${myQaLine}
${multiDocLine}

Other staged docs in this session:
${siblingLines || '  (none)'}

Decision rules:
- If Screening flagged isMultiDocument=true for this file, it is a strong split candidate. Set decision='split' and splitAtPage to the page number where the second document starts.
- Suggest decision='merge' ONLY when the two files are clearly parts of the SAME physical document: they share the same subject AND the same period/date (matching periodHint, or explicit "Part 1"/"Part 2", "page X of Y", or continuation-scan cues in the filename or content).
- Sharing the same typeGuess and bucketGuess alone is NOT sufficient for merge. Two meeting minutes from different years, two invoices with different invoice numbers or dates, or two reports covering different fiscal years are SEPARATE documents — decide 'keep' for each.
- When periodHints are present on both the current file and a sibling and they differ, the files cover different periods and must NOT be merged — decide 'keep'.
- Otherwise decide 'keep'.

Return JSON: { decision: 'keep'|'merge'|'split', reason: string, mergeWithItemId?: string, splitAtPage?: number, confidence: number }.`;
    const { data: raw, fallbackReason } = await callClaudeJson<Partial<MergeOrSplitResult>>(
      prompt,
      {
        stagedPath: input.stagedPath,
        buffer: input.buffer,
        mimeType: input.mimeType,
      },
      'merge-or-split',
      { originalName: input.originalName, itemId: input.itemId, sessionId: input.sessionId },
    );
    if (!raw) {
      return { decision: 'keep', reason: 'fallback', confidence: 0.2, fallbackReason };
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
      fallbackReason,
    };
  },

  async suggestBranch(input: {
    originalName: string;
    description?: string;
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
    residences?: Array<{ id: string; unitNumber: string }>;
    itemId?: string;
    sessionId?: string;
  }): Promise<BranchResult> {
    const residenceLines = (input.residences ?? [])
      .map((r) => `  - id="${r.id}" unit="${r.unitNumber}"`)
      .join('\n');
    const residenceSection = residenceLines
      ? `\nBuilding residences (use exact id when picking for residence_documents):\n${residenceLines}\n`
      : '';
    const residenceJsonNote = input.residences && input.residences.length > 0
      ? ', residenceId?: string (exact id from the list above, only when branch=residence_documents), residenceConfidence?: number (0..1 for the residence pick), residenceReason?: string (one sentence why), residenceFallbackReason?: string (set when you cannot confidently pick a residence)'
      : '';
    const prompt = `Choose the best destination for this document inside a property-management app.
Filename: ${input.originalName}
Description: ${input.description ?? ''}
${residenceSection}
Destinations: building_documents | residence_documents | demand | bill | maintenance | other
Sub-categories per destination:
  building_documents: bylaws | minutes | insurance | financial_statement | contract | correspondence | other
  residence_documents: lease | inspection | correspondence | key_handover | other
  bill: utility | insurance | tax | maintenance_invoice | condo_fee | other
  demand: complaint | request | legal_notice | other
  maintenance: work_order | quote | inspection_report | inventory | other
  other: other

Return JSON: { branch: string, subCategory: string, residenceHint?: string, reason: string, confidence: number${residenceJsonNote} }.`;
    const { data: raw, fallbackReason } = await callClaudeJson<Partial<BranchResult & { subCategory: string }>>(
      prompt,
      {
        stagedPath: input.stagedPath,
        buffer: input.buffer,
        mimeType: input.mimeType,
      },
      'branch',
      { originalName: input.originalName, itemId: input.itemId, sessionId: input.sessionId },
    );
    const allowed: BranchDestination[] = [
      'building_documents',
      'residence_documents',
      'demand',
      'bill',
      'maintenance',
      'other',
    ];
    if (!raw) {
      return { branch: 'building_documents', subCategory: 'other', reason: 'fallback', confidence: 0.2, fallbackReason, residenceId: null, residenceConfidence: null, residenceReason: null, residenceFallbackReason: null };
    }
    const branch: BranchDestination = allowed.includes(raw.branch as BranchDestination)
      ? (raw.branch as BranchDestination)
      : 'building_documents';
    const allowedSubCats = BRANCH_SUB_CATEGORIES[branch] as readonly string[];
    const subCategory: string =
      typeof raw.subCategory === 'string' && allowedSubCats.includes(raw.subCategory)
        ? raw.subCategory
        : 'other';

    let residenceId: string | null = null;
    let residenceConfidence: number | null = null;
    let residenceReason: string | null = null;
    let residenceFallbackReason: string | null = null;

    if (branch === 'residence_documents' && input.residences && input.residences.length > 0) {
      const rawResidenceId = typeof (raw as Record<string, unknown>).residenceId === 'string'
        ? (raw as Record<string, unknown>).residenceId as string
        : null;
      const validIds = new Set(input.residences.map((r) => r.id));
      if (rawResidenceId && validIds.has(rawResidenceId)) {
        residenceId = rawResidenceId;
        residenceConfidence = typeof (raw as Record<string, unknown>).residenceConfidence === 'number'
          ? clampConfidence((raw as Record<string, unknown>).residenceConfidence)
          : null;
        residenceReason = typeof (raw as Record<string, unknown>).residenceReason === 'string'
          ? (raw as Record<string, unknown>).residenceReason as string
          : null;
      } else {
        residenceFallbackReason = typeof (raw as Record<string, unknown>).residenceFallbackReason === 'string'
          ? (raw as Record<string, unknown>).residenceFallbackReason as string
          : rawResidenceId
          ? 'AI returned an unrecognised residence id'
          : 'AI could not determine the residence';
      }
    }

    return {
      branch,
      subCategory,
      residenceHint:
        typeof raw.residenceHint === 'string' ? raw.residenceHint : undefined,
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      confidence: clampConfidence(raw.confidence),
      fallbackReason,
      residenceId,
      residenceConfidence,
      residenceReason,
      residenceFallbackReason,
    };
  },

  async identify(input: {
    originalName: string;
    description?: string;
    branch?: string;
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
    itemId?: string;
    sessionId?: string;
  }): Promise<IdentificationResult> {
    const prompt = `Extract metadata for a document being filed under "${input.branch ?? 'building_documents'}".
Filename: ${input.originalName}
Description: ${input.description ?? ''}
Return JSON: { name: string, description: string, tags: string[],
effectiveDate?: 'YYYY-MM-DD', metadata: object, confidence: number }.`;
    const { data: raw, fallbackReason } = await callClaudeJson<Partial<IdentificationResult>>(
      prompt,
      {
        stagedPath: input.stagedPath,
        buffer: input.buffer,
        mimeType: input.mimeType,
      },
      'identify',
      { originalName: input.originalName, itemId: input.itemId, sessionId: input.sessionId },
    );
    if (!raw) {
      return {
        name: input.originalName,
        description: '',
        tags: [],
        metadata: {},
        confidence: 0.2,
        fallbackReason,
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
      fallbackReason,
    };
  },

  async suggestLinks(input: {
    originalName: string;
    candidates: { id: string; name: string }[];
    stagedPath?: string | null;
    buffer?: Buffer | null;
    mimeType?: string | null;
    itemId?: string;
    sessionId?: string;
  }): Promise<LinkSuggestion> {
    const prompt = `Find related documents for "${input.originalName}" from the candidates: ${JSON.stringify(
      input.candidates,
    )}. Return JSON: { beforeItemId?: string, afterItemId?: string,
relatedItemIds: string[], reason: string, confidence: number }.`;
    const { data: raw, fallbackReason } = await callClaudeJson<Partial<LinkSuggestion>>(
      prompt,
      {
        stagedPath: input.stagedPath,
        buffer: input.buffer,
        mimeType: input.mimeType,
      },
      'links',
      { originalName: input.originalName, itemId: input.itemId, sessionId: input.sessionId },
    );
    if (!raw) {
      return { relatedItemIds: [], reason: 'fallback', confidence: 0.2, fallbackReason };
    }
    return {
      beforeItemId: typeof raw.beforeItemId === 'string' ? raw.beforeItemId : undefined,
      afterItemId: typeof raw.afterItemId === 'string' ? raw.afterItemId : undefined,
      relatedItemIds: Array.isArray(raw.relatedItemIds)
        ? (raw.relatedItemIds as string[]).filter((s) => typeof s === 'string')
        : [],
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      confidence: clampConfidence(raw.confidence),
      fallbackReason,
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
