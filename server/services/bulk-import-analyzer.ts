/**
 * Anthropic-powered analyzer for the admin "Bulk Document Import" page.
 *
 * Every AI step in the bulk-import pipeline goes through this service so
 * route handlers and MCP tools never call the Anthropic SDK directly.
 *
 * If `ANTHROPIC_API_KEY` is missing the analyzer still works in
 * "fallback" mode — it returns deterministic low-confidence stubs so the
 * UI keeps moving and tests don't need a live key.
 */
import Anthropic from '@anthropic-ai/sdk';
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

const MODEL = 'claude-3-5-sonnet-latest';

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
 * Send a prompt to Claude and parse a single JSON object out of the
 * response. Returns null on transport / parse failure so callers can
 * fall back to a deterministic stub.
 */
async function callClaudeJson<T>(prompt: string): Promise<T | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        'You analyze property-management documents for a bulk-ingest pipeline. Respond with one JSON object only — no prose, no markdown.',
      messages: [{ role: 'user', content: prompt }],
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
  }): Promise<ScreeningResult> {
    const prompt = `Analyze this uploaded document for a property-management bulk import.
Filename: ${input.originalName}
MIME: ${input.mimeType ?? 'unknown'}
Size: ${input.fileSize ?? 'unknown'} bytes
Return JSON with keys: isComplete (bool), isMultiDocument (bool), pageOrderHint (number[] or null),
rotationDegrees (0|90|180|270), suggestedFilename (string), description (short string),
confidence (0..1).`;
    const raw = await callClaudeJson<Partial<ScreeningResult>>(prompt);
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
  }): Promise<MergeOrSplitResult> {
    const prompt = `You are sorting scanned documents. The current document is "${input.originalName}".
Other staged docs in this session: ${JSON.stringify(input.siblingNames)}.
Decide whether to keep, merge, or split. Return JSON: { decision: 'keep'|'merge'|'split',
reason: string, mergeWithItemId?: string, splitAtPage?: number, confidence: number }.`;
    const raw = await callClaudeJson<Partial<MergeOrSplitResult>>(prompt);
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
  }): Promise<BranchResult> {
    const prompt = `Choose the best destination for this document inside a property-management app.
Filename: ${input.originalName}
Description: ${input.description ?? ''}
Return JSON: { branch: 'building_documents'|'residence_documents'|'demand'|'bill'|'maintenance'|'other',
residenceHint?: string, reason: string, confidence: number }.`;
    const raw = await callClaudeJson<Partial<BranchResult>>(prompt);
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
  }): Promise<IdentificationResult> {
    const prompt = `Extract metadata for a document being filed under "${input.branch ?? 'building_documents'}".
Filename: ${input.originalName}
Description: ${input.description ?? ''}
Return JSON: { name: string, description: string, tags: string[],
effectiveDate?: 'YYYY-MM-DD', metadata: object, confidence: number }.`;
    const raw = await callClaudeJson<Partial<IdentificationResult>>(prompt);
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
  }): Promise<LinkSuggestion> {
    const prompt = `Find related documents for "${input.originalName}" from the candidates: ${JSON.stringify(
      input.candidates,
    )}. Return JSON: { beforeItemId?: string, afterItemId?: string,
relatedItemIds: string[], reason: string, confidence: number }.`;
    const raw = await callClaudeJson<Partial<LinkSuggestion>>(prompt);
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
