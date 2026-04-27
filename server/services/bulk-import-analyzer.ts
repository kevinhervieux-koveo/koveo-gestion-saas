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
import { logDebug, logError, logInfo, logWarn } from '../utils/logger';
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
  /**
   * Number of Anthropic API attempts made for this call (Task #1157),
   * including the final failed attempt. Bounded by `MAX_RETRY_ATTEMPTS`
   * (currently 3). Zero when no call was made (no API key, pre-call
   * file-load throw) or when the result was returned from the analyzer
   * cache without re-uploading. Surfaced so the admin Bulk Import
   * detail panel can distinguish a momentary blip ("tried 1×") from a
   * persistent problem ("tried 3×") without changing the
   * `fallbackReason` badge logic itself.
   */
  retryCount?: number;
  /**
   * Set when the analyzer degraded a PDF to text-only because the raw
   * bytes would have exceeded Anthropic's per-document size or page-count
   * limit (Task #1217). `'pdf_text_only'` means the AI saw only extracted
   * text rather than the full PDF document block; suggestions may be
   * slightly less accurate but are still real AI results — not stubs.
   * `null` means the document was sent normally.
   */
  degraded?: 'pdf_text_only' | null;
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

/**
 * Task #1217: PDFs at or above this raw size will be degraded to
 * text-only instead of being shipped as a base64 `document` block.
 *
 * Anthropic's per-request body cap is ~32 MB on the wire.  Base64
 * inflates by ~33 %, so a 20 MB PDF becomes ~26.7 MB encoded — very
 * close to the limit and consistently slow.  Keeping this well below
 * `MAX_DOCUMENT_BYTES` means a file that passes the local size guard
 * may still be sent as text-only when it is likely to be rejected or
 * timeout in practice.  Tune this constant (alongside
 * `PDF_TEXT_ONLY_PAGE_THRESHOLD`) as Anthropic's limits evolve.
 */
const PDF_TEXT_ONLY_SIZE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Task #1217: PDFs with a page count at or above this value will be
 * degraded to text-only.  Anthropic currently caps per-document
 * page count at 100; we use a lower threshold to avoid borderline
 * timeouts on the full 30 s per-call budget.  Tune alongside
 * `PDF_TEXT_ONLY_SIZE_THRESHOLD_BYTES` as limits evolve.
 */
const PDF_TEXT_ONLY_PAGE_THRESHOLD = 80;

// ── Retry configuration ────────────────────────────────────────────────────
//
// The retry budget below is sized to fit inside the Bulk Document Import
// run-all loop's per-item timeout (`RUN_ALL_ITEM_TIMEOUT_MS` in
// `server/api/bulk-import.ts`). The relationship is:
//
//   worst-case per-item AI work
//     = MAX_RETRY_ATTEMPTS × PER_CALL_TIMEOUT_MS                  (calls)
//     + Σ(min(RETRY_BASE_DELAY_MS × 2^(attempt-1), RETRY_MAX_DELAY_MS))
//                                                                 (backoffs)
//   With the current values (3 × 30s) + (1s + 2s capped at 8s)
//     = 90s + ~3s (with ±10% jitter) ≈ 93s
//
// `RUN_ALL_ITEM_TIMEOUT_MS` is set to 120s in the API layer, leaving
// ~25s of headroom for big-PDF latency, base64 upload time, and the
// inter-call sleeps inside the loop. Bumping any of these constants
// without re-checking that math can re-introduce the original
// "AI failed after 3 attempts" badges that Task #1191 fixed: a single
// hung call ate the whole 90s budget so the second attempt never ran.
//
// Tests in `tests/unit/services/bulk-import-analyzer.test.ts` lock in
// this relationship — update them too if you tune any value here.
//
/** Maximum number of attempts (first try + retries). */
export const MAX_RETRY_ATTEMPTS = 3;
/** Base delay in ms before the first retry; doubles each attempt. */
export const RETRY_BASE_DELAY_MS = 1_000;
/** Absolute cap on inter-attempt wait so a single call can't hang forever. */
export const RETRY_MAX_DELAY_MS = 8_000;
/**
 * Per-call Anthropic SDK timeout (Task #1202). Without this the SDK
 * defaults to a 10-minute deadline, so a single hung HTTP request
 * could consume the entire `RUN_ALL_ITEM_TIMEOUT_MS` budget before any
 * retry was attempted. Capping each individual call lets the worst
 * case still fit `MAX_RETRY_ATTEMPTS` calls plus their backoff inside
 * the per-item budget. Pass `{ timeout: PER_CALL_TIMEOUT_MS }` to
 * `messages.create(...)` so it overrides the SDK default per-request.
 */
export const PER_CALL_TIMEOUT_MS = 30_000;

/**
 * Replaceable sleep implementation so unit tests can eliminate wall-clock
 * delays without touching the retry logic itself.
 */
let sleepFn: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Anthropic SDK errors (APIError subclass) expose:
 *  - `.request_id` — direct string property (preferred, SDK >= 0.6)
 *  - `.headers`    — a real `Headers` object (use `.get('request-id')`)
 *                    OR a plain record in tests (use bracket access)
 * This interface names only what we actually read.
 */
interface AnthropicApiError extends Error {
  status?: number;
  request_id?: string | null;
  error?: { type?: string; message?: string };
  /** May be a real `Headers` object or a plain record depending on context. */
  headers?: { get?: (name: string) => string | null | undefined } & Record<string, string | string[] | undefined>;
}

// Known Node.js network error codes that are transient and safe to retry.
const RETRYABLE_NODE_ERROR_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE',
  'ECONNABORTED', 'ENETUNREACH', 'EHOSTUNREACH',
]);

/**
 * Return true when the error indicates a deployment-level AI
 * misconfiguration: an invalid/revoked API key (HTTP 401,
 * `authentication_error`) or an unrecognised model name (HTTP 404,
 * `not_found_error`). These failures cannot be fixed by retrying — the
 * admin must correct the deployment settings — so they are tagged with
 * `model_misconfigured` instead of the generic `api_error` reason.
 */
function isMisconfiguredAnthropicError(err: unknown): boolean {
  const e = err as AnthropicApiError;
  const status = e?.status;
  const errorType = e?.error?.type;
  if (status === 401 || errorType === 'authentication_error') return true;
  if (status === 404 && errorType === 'not_found_error') return true;
  return false;
}

/**
 * Return true when the error is transient and retrying has a reasonable
 * chance of succeeding.  Non-retryable errors (bad request, auth, not-found,
 * permission) fall through immediately.
 */
function isRetryableAnthropicError(err: unknown): boolean {
  const e = err as AnthropicApiError & { code?: string };
  const status = e.status;

  if (status === undefined) {
    // No HTTP status — could be a transport error OR a local runtime/parse
    // exception.  Only retry when the error looks like a genuine network
    // failure; local errors (SyntaxError, TypeError, …) must not be retried
    // so they surface immediately for diagnosis.
    if (typeof e.code === 'string' && RETRYABLE_NODE_ERROR_CODES.has(e.code)) {
      return true;
    }
    const msg = (e.message ?? '').toLowerCase();
    return (
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('socket hangup') ||
      msg.includes('network timeout') ||
      msg.includes('connection reset') ||
      msg.includes('connection refused') ||
      msg.includes('fetch failed') ||
      msg.includes('connect etimedout')
    );
  }

  // Explicit retryable HTTP statuses.
  if (status === 429 || status === 529 || status >= 500) return true;

  // Anthropic body-level error types that indicate a transient overload
  // even when the HTTP status itself is 2xx (rare) or other.
  const errorType = e.error?.type;
  if (
    errorType === 'overloaded_error' ||
    errorType === 'rate_limit_error' ||
    errorType === 'api_error'
  )
    return true;

  return false;
}
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
  /** Task #1217: set when this PDF was degraded to text-only extraction. */
  degraded: 'pdf_text_only' | null;
}> {
  if (!source) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: null, degraded: null };
  }
  const mimeType = (source.mimeType ?? '').toLowerCase();
  // No mimeType + no buffer/path → caller never asked us to attach
  // anything, so this isn't a fallback either.
  if (!mimeType && !source.buffer && !source.stagedPath) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: null, degraded: null };
  }
  if (!mimeType) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'unsupported_mime', degraded: null };
  }

  let buffer: Buffer | null = source.buffer ?? null;
  if (!buffer && source.stagedPath) {
    try {
      const stat = fs.statSync(source.stagedPath);
      if (stat.size > MAX_DOCUMENT_BYTES) {
        logInfo('[bulkImportAnalyzer] skipping oversize staged file', {
          metadata: { stagedPath: source.stagedPath, size: stat.size },
        });
        return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'oversize', degraded: null };
      }
      buffer = fs.readFileSync(source.stagedPath);
    } catch (err) {
      logError('[bulkImportAnalyzer] failed to read staged file', err as Error);
      return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'missing_file', degraded: null };
    }
  }
  if (!buffer) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'missing_file', degraded: null };
  }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    return { blocks: [], textPrefix: '', contentHash: null, fallbackReason: 'oversize', degraded: null };
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
    // ── Task #1217: text-only degradation pre-check ─────────────────────
    // If the PDF is large enough to risk Anthropic's per-request body-size
    // limit or its per-PDF page-count cap, extract its text and send a
    // text-only prompt instead of the full document block.  This prevents
    // the structural api_error / timeout that previously made big PDFs
    // permanently fail all AI steps.
    const needsTextOnly = buffer.length >= PDF_TEXT_ONLY_SIZE_THRESHOLD_BYTES
      || await (async () => {
        try {
          const { PDFDocument } = await import('pdf-lib');
          const doc = await PDFDocument.load(new Uint8Array(buffer!), {
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false,
          });
          const pageCount = doc.getPageCount();
          logDebug('[bulkImportAnalyzer] PDF page count check', {
            metadata: { pageCount, threshold: PDF_TEXT_ONLY_PAGE_THRESHOLD },
          });
          return pageCount >= PDF_TEXT_ONLY_PAGE_THRESHOLD;
        } catch {
          // pdf-lib could not parse the PDF for page counting; let the
          // normal document-block path handle it (or fail) rather than
          // forcing a degradation based on an unknown page count.
          return false;
        }
      })();

    if (needsTextOnly) {
      logInfo('[bulkImportAnalyzer] degrading big PDF to text-only', {
        metadata: {
          sizeBytes: buffer.length,
          sizeThreshold: PDF_TEXT_ONLY_SIZE_THRESHOLD_BYTES,
          pageThreshold: PDF_TEXT_ONLY_PAGE_THRESHOLD,
        },
      });
      try {
        const pdfParseModule = await import('pdf-parse');
        // pdf-parse exports its function as `.default` in CJS but the
        // ESM type declaration may not have that property — access it
        // safely. Fall back to the module itself if `.default` is absent.
        const pdfParse = (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default
          ?? (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
        const parsed = await pdfParse(buffer);
        const text = (parsed.text || '').trim().slice(0, MAX_EXTRACTED_TEXT);
        if (!text) {
          // Image-only or otherwise non-OCR-readable PDFs yield no extractable
          // text.  Sending a filename-only prompt to Claude would produce an
          // unreliable result, so treat this the same as an extraction error
          // rather than silently marking it as a successful text-only analysis.
          logError('[bulkImportAnalyzer] pdf-parse returned empty text for big PDF — treating as extraction_failed',
            new Error('empty extracted text'));
          return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'extraction_failed', degraded: null };
        }
        return {
          blocks: [],
          textPrefix: `Document text:\n${text}\n\n`,
          contentHash,
          fallbackReason: null,
          degraded: 'pdf_text_only',
        };
      } catch (err) {
        logError('[bulkImportAnalyzer] pdf-parse extraction failed for big PDF', err as Error);
        return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'extraction_failed', degraded: null };
      }
    }

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
      degraded: null,
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
      degraded: null,
    };
  }
  if (PLAIN_TEXT_MIMES.has(mimeType)) {
    const text = buffer.toString('utf8').slice(0, MAX_EXTRACTED_TEXT);
    return {
      blocks: [],
      textPrefix: text ? `Document text:\n${text}\n\n` : '',
      contentHash,
      fallbackReason: null,
      degraded: null,
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
        degraded: null,
      };
    } catch (err) {
      logError('[bulkImportAnalyzer] mammoth extraction failed', err as Error);
      // Preserve contentHash even on extractor failure so the cache key
      // stays content-aware: two different docx files that both fail
      // extraction must not collide on the same `:no-file` slot.
      return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'extraction_failed', degraded: null };
    }
  }
  if (XLSX_MIMES.has(mimeType)) {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const lines: string[] = [];
      for (const worksheet of workbook.worksheets) {
        const rows: string[] = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const values = (row.values as (string | number | boolean | null | undefined)[]).slice(1);
          rows.push(values.map((v) => (v == null ? '' : String(v))).join(','));
        });
        const csv = rows.join('\n');
        // Strip control characters (null bytes, etc.) that can corrupt
        // the JSON payload sent to Anthropic and trigger api_error.
        // Keep printable ASCII + common whitespace (tab, LF, CR).
        const cleanCsv = csv.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\uFFFF]/g, '').trim();
        if (cleanCsv) lines.push(`# ${worksheet.name}\n${cleanCsv}`);
        if (lines.join('\n').length > MAX_EXTRACTED_TEXT) break;
      }
      const text = lines.join('\n').slice(0, MAX_EXTRACTED_TEXT);
      return {
        blocks: [],
        textPrefix: text ? `Spreadsheet contents:\n${text}\n\n` : '',
        contentHash,
        fallbackReason: null,
        degraded: null,
      };
    } catch (err) {
      logError('[bulkImportAnalyzer] xlsx extraction failed', err as Error);
      return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'extraction_failed', degraded: null };
    }
  }

  // Unsupported MIME with bytes available: still return contentHash so
  // the analyzer cache distinguishes between two different unknown
  // files that happen to share the same prompt.
  return { blocks: [], textPrefix: '', contentHash, fallbackReason: 'unsupported_mime', degraded: null };
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
): Promise<{ data: T | null; fallbackReason: BulkImportFallbackReason | null; retryCount: number; degraded: 'pdf_text_only' | null }> {
  const c = getClient();
  // No Anthropic client = no AI run at all. Tag the result with
  // `no_api_key` so the UI can show "AI unavailable" alongside the
  // 20% stub instead of a generic low-confidence badge that makes
  // admins think the AI ran and disagreed with the document.
  // `retryCount` is 0 because no Anthropic call was ever attempted.
  if (!c) return { data: null, fallbackReason: 'no_api_key', retryCount: 0, degraded: null };
  let fallbackReason: BulkImportFallbackReason | null = null;
  let degraded: 'pdf_text_only' | null = null;
  try {
    const loaded = await loadFileForClaude(source);
    fallbackReason = loaded.fallbackReason;
    degraded = loaded.degraded;
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
        retryCount?: number;
        degraded?: 'pdf_text_only' | null;
      }>(cacheKey);
      if (hit !== null) {
        logDebug('[bulk-import] cache hit', {
          metadata: {
            step,
            contentHash: contentHash ?? 'no-file',
            itemId: logContext?.itemId ?? null,
            sessionId: logContext?.sessionId ?? null,
            cachedRetryCount: hit.retryCount ?? 0,
          },
        });
        // Replay the original `retryCount` and `degraded` recorded when
        // the cache row was written so a cache hit is observationally
        // identical to the original call. This keeps the admin UI accurate
        // ("AI failed after N attempts" still applies even when served from
        // cache, since those attempts really happened) and preserves the
        // cache-hit invariant that callers rely on. Older entries persisted
        // before Task #1157/#1217 lack these fields — default to 0/null.
        return {
          data: hit.data,
          fallbackReason: hit.fallbackReason,
          retryCount: hit.retryCount ?? 0,
          degraded: hit.degraded ?? null,
        };
      }
      logDebug('[bulk-import] cache miss', {
        metadata: { step, contentHash: contentHash ?? 'no-file' },
      });
    }

    const userContent: AnthropicContentBlock[] = [
      ...blocks,
      { type: 'text', text: fullPrompt },
    ];
    const requestParams = {
      model: MODEL,
      max_tokens: 1024,
      system:
        'You analyze property-management documents for a bulk-ingest pipeline. Respond with one JSON object only — no prose, no markdown.',
      messages: [
        {
          role: 'user' as const,
          content: userContent as unknown as Anthropic.Messages.MessageParam['content'],
        },
      ],
    };

    // Bounded exponential-backoff retry for transient Anthropic errors.
    // Non-retryable failures (bad request, auth, not-found) fall through
    // immediately so we don't waste time retrying permanent failures.
    let lastErr: unknown = null;
    let attemptsMade = 0;
    const callStartMs = Date.now();
    logDebug('[bulk-import] callClaudeJson start', {
      metadata: {
        step: step ?? null,
        itemId: logContext?.itemId ?? null,
        sessionId: logContext?.sessionId ?? null,
        hasFile: !!source,
        fileMimeType: source?.mimeType ?? null,
        fileSizeBytes: source?.buffer?.length ?? null,
      },
    });
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      logDebug('[bulk-import] callClaudeJson attempt start', {
        metadata: {
          step: step ?? null,
          itemId: logContext?.itemId ?? null,
          sessionId: logContext?.sessionId ?? null,
          attempt,
          model: requestParams.model,
        },
      });
      try {
        // Per-request timeout (Task #1202): caps each individual SDK
        // call so a single hung request cannot consume the whole
        // run-all per-item budget before the next retry runs. See the
        // budget commentary by `PER_CALL_TIMEOUT_MS` above.
        const res = await c.messages.create(requestParams, {
          timeout: PER_CALL_TIMEOUT_MS,
        });
        attemptsMade = attempt;
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
          logWarn('[bulk-import] callClaudeJson no-json-response', {
            metadata: {
              step,
              originalName: logContext?.originalName,
              itemId: logContext?.itemId,
              sessionId: logContext?.sessionId,
              attempt,
              outcome: 'failure-no-json',
              model: requestParams.model,
              durationMs: Date.now() - callStartMs,
            },
          });
          return { data: null, fallbackReason: noMatchReason, retryCount: attemptsMade, degraded };
        }
        const parsed = JSON.parse(match[0]) as T;
        // The cached payload mirrors what we return on a fresh call so a
        // subsequent cache hit can replay the original `retryCount` and
        // `degraded` fields if any callers ever choose to read them.
        const cachePayload = { data: parsed, fallbackReason, retryCount: attemptsMade, degraded };
        if (cacheKey) {
          // Awaited so the cache row is durable before we return — the
          // write is a single upsert and `setCachedSuggestion` already
          // swallows transport errors internally, so it cannot throw.
          // Awaiting also avoids a pending promise outliving the request,
          // which previously surfaced as "Cannot log after tests are done"
          // warnings in unit suites without a database.
          await setCachedSuggestion(cacheKey, cachePayload, ANALYZER_CACHE_TTL_MS);
        }
        logDebug('[bulk-import] callClaudeJson success', {
          metadata: {
            step: step ?? null,
            itemId: logContext?.itemId ?? null,
            sessionId: logContext?.sessionId ?? null,
            attempt: attemptsMade,
            outcome: 'success',
            durationMs: Date.now() - callStartMs,
            fallback: fallbackReason ?? null,
            degraded: degraded ?? null,
            inputTokens: res.usage?.input_tokens ?? null,
            outputTokens: res.usage?.output_tokens ?? null,
          },
        });
        return { data: parsed, fallbackReason, retryCount: attemptsMade, degraded };
      } catch (err) {
        lastErr = err;
        attemptsMade = attempt;
        // Only retry on transient failures. Bail immediately on terminal ones.
        if (!isRetryableAnthropicError(err)) {
          logDebug('[bulk-import] callClaudeJson attempt terminal failure', {
            metadata: {
              step: step ?? null,
              itemId: logContext?.itemId ?? null,
              sessionId: logContext?.sessionId ?? null,
              attempt,
              outcome: 'failure-terminal',
              retryable: false,
              httpStatus: (err as { status?: number })?.status ?? null,
              errorType: (err as { error?: { type?: string } })?.error?.type ?? null,
              errorClass: (err as Error)?.constructor?.name ?? null,
              durationMs: Date.now() - callStartMs,
            },
          });
          break;
        }
        if (attempt < MAX_RETRY_ATTEMPTS) {
          // Exponential backoff with ±10 % jitter, capped at RETRY_MAX_DELAY_MS.
          const base = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
          const jitter = Math.floor(base * 0.1 * Math.random());
          logDebug('[bulk-import] callClaudeJson retry', {
            metadata: {
              step: step ?? null,
              itemId: logContext?.itemId ?? null,
              sessionId: logContext?.sessionId ?? null,
              attempt,
              outcome: 'failure-retryable',
              delayMs: base + jitter,
              httpStatus: (err as { status?: number })?.status ?? null,
              errorType: (err as { error?: { type?: string } })?.error?.type ?? null,
              errorClass: (err as Error)?.constructor?.name ?? null,
            },
          });
          await sleepFn(base + jitter);
        } else {
          // All retry attempts exhausted with a retryable error.
          logDebug('[bulk-import] callClaudeJson attempts exhausted', {
            metadata: {
              step: step ?? null,
              itemId: logContext?.itemId ?? null,
              sessionId: logContext?.sessionId ?? null,
              attempt,
              outcome: 'failure-exhausted',
              retryable: true,
              httpStatus: (err as { status?: number })?.status ?? null,
              errorType: (err as { error?: { type?: string } })?.error?.type ?? null,
              errorClass: (err as Error)?.constructor?.name ?? null,
              durationMs: Date.now() - callStartMs,
            },
          });
        }
      }
    }

    // All attempts exhausted (or a terminal error short-circuited the loop).
    // Tag auth errors and model-not-found with the distinct `model_misconfigured`
    // reason so the UI can tell the admin the deployment is misconfigured,
    // not that a transient API error occurred.
    const defaultApiErrReason = isMisconfiguredAnthropicError(lastErr)
      ? 'model_misconfigured'
      : 'api_error';
    const apiErrReason = fallbackReason ?? defaultApiErrReason;
    const e = lastErr as AnthropicApiError;
    // Prefer the SDK's direct `request_id` property (Anthropic SDK APIError).
    // Fall back to `headers.get('request-id')` for real Headers objects, then
    // to plain-record bracket access for test mocks / legacy shapes.
    const requestIdFromHeaders = (() => {
      const raw = e?.headers?.['request-id'];
      return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
    })();
    const requestId: string | null =
      e?.request_id ??
      e?.headers?.get?.('request-id') ??
      requestIdFromHeaders ??
      null;
    logError('[bulkImportAnalyzer] per-file AI call failed', e ?? new Error('unknown error'), {
      metadata: {
        step,
        originalName: logContext?.originalName,
        itemId: logContext?.itemId,
        sessionId: logContext?.sessionId,
        errorStatus: e?.status ?? null,
        anthropicErrorType: e?.error?.type ?? null,
        anthropicErrorMessage: e?.error?.message ?? null,
        errorMessage: e?.message ?? null,
        requestId: requestId ?? null,
        attempts: attemptsMade,
      },
    });
    return { data: null, fallbackReason: apiErrReason, retryCount: attemptsMade, degraded };
  } catch (err) {
    // The file-loading path (loadFileForClaude) or cache lookup threw —
    // these are not Anthropic errors and should not be retried.
    const apiErrReason = fallbackReason ?? 'api_error';
    const e = err as AnthropicApiError;
    logError('[bulkImportAnalyzer] per-file AI call failed', e, {
      metadata: {
        step,
        originalName: logContext?.originalName,
        itemId: logContext?.itemId,
        sessionId: logContext?.sessionId,
        errorStatus: e.status ?? null,
        anthropicErrorType: e.error?.type ?? null,
        anthropicErrorMessage: e.error?.message ?? null,
        errorMessage: e.message ?? null,
        requestId: null,
        attempts: 0,
      },
    });
    return { data: null, fallbackReason: apiErrReason, retryCount: 0, degraded };
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
  retryCount = 0,
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
    retryCount,
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
    const { data: raw, fallbackReason, retryCount, degraded } = await callClaudeJson<Record<string, unknown>>(
      prompt,
      {
        stagedPath: input.stagedPath,
        buffer: input.buffer,
        mimeType: input.mimeType,
      },
      'screen',
      { originalName: input.originalName, itemId: input.itemId, sessionId: input.sessionId },
    );
    if (!raw) return fallbackScreening(input.originalName, fallbackReason, retryCount);
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
      retryCount,
      degraded,
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
    const { data: raw, fallbackReason, retryCount, degraded } = await callClaudeJson<Partial<MergeOrSplitResult>>(
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
      return { decision: 'keep', reason: 'fallback', confidence: 0.2, fallbackReason, retryCount, degraded };
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
      retryCount,
      degraded,
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
    const { data: raw, fallbackReason, retryCount, degraded } = await callClaudeJson<Partial<BranchResult & { subCategory: string }>>(
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
      return { branch: 'building_documents', subCategory: 'other', reason: 'fallback', confidence: 0.2, fallbackReason, retryCount, degraded, residenceId: null, residenceConfidence: null, residenceReason: null, residenceFallbackReason: null };
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
      retryCount,
      degraded,
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
    /** Parsed date from the screening AI's periodHint, when available. */
    periodHintDate?: Date | null;
    /**
     * Catalogue of tag names the Quebec property-management organisation
     * actually has in `document_tags` for this branch's scope. When provided
     * (and non-empty), the prompt instructs Claude to pick `tags` ONLY from
     * this list — exact, case-sensitive copies of the names — so the
     * downstream `resolveTagNamesToIds` step can map them to real UUIDs
     * instead of dropping every free-form suggestion. Names usually contain
     * accented French characters (e.g. "Police d'assurance du syndicat"),
     * which is why generic English fallbacks like "insurance" never match.
     */
    availableTags?: { name: string }[] | null;
  }): Promise<IdentificationResult> {
    const periodHintLine = input.periodHintDate
      ? `Screening suggested effective date: ${input.periodHintDate.toISOString().slice(0, 10)} — keep this date unless the document content clearly indicates a different effective date.`
      : '';
    // Constrain the AI's tag picks to the org's actual catalogue when we
    // know it. Without this list Claude returns generic English names
    // ("insurance", "contract") that never match the French Quebec
    // property-management tag names stored in `document_tags`, so the
    // identification step would silently produce zero tags.
    const tagCatalogueLine =
      Array.isArray(input.availableTags) && input.availableTags.length > 0
        ? `Available tag names (choose 0-5, copy each EXACTLY as written, do not invent new names): ${JSON.stringify(input.availableTags.map((t) => t.name))}`
        : '';
    const prompt = `Extract metadata for a document being filed under "${input.branch ?? 'building_documents'}".
Filename: ${input.originalName}
Description: ${input.description ?? ''}${periodHintLine ? `\n${periodHintLine}` : ''}${tagCatalogueLine ? `\n${tagCatalogueLine}` : ''}
Return JSON: { name: string, description: string, tags: string[],
effectiveDate?: 'YYYY-MM-DD', metadata: object, confidence: number }.${
      tagCatalogueLine
        ? ' The "tags" array MUST contain only names from the Available tag names list above (verbatim).'
        : ''
    }`;
    const { data: raw, fallbackReason, retryCount, degraded } = await callClaudeJson<Partial<IdentificationResult>>(
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
        retryCount,
        degraded,
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
      retryCount,
      degraded,
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
    const { data: raw, fallbackReason, retryCount, degraded } = await callClaudeJson<Partial<LinkSuggestion>>(
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
      return { relatedItemIds: [], reason: 'fallback', confidence: 0.2, fallbackReason, retryCount, degraded };
    }
    return {
      beforeItemId: typeof raw.beforeItemId === 'string' ? raw.beforeItemId : undefined,
      afterItemId: typeof raw.afterItemId === 'string' ? raw.afterItemId : undefined,
      relatedItemIds: Array.isArray(raw.relatedItemIds)
        ? (raw.relatedItemIds as string[]).filter((s) => typeof s === 'string')
        : [],
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      confidence: clampConfidence(raw.confidence),
      degraded,
      fallbackReason,
      retryCount,
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

  /**
   * Exposed so tests can eliminate real wall-clock delays from the retry
   * backoff without altering the retry logic itself. Pass `null` or omit to
   * restore the default `setTimeout`-based sleep.
   */
  __setSleepForTests(fn: ((ms: number) => Promise<void>) | null) {
    sleepFn = fn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  },
};

export type BulkImportAnalyzer = typeof bulkImportAnalyzer;
