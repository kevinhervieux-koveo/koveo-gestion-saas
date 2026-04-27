/**
 * REST adapter around the MCP write-error classifier.
 *
 * Task #257 — the structured error envelope built by
 * `server/mcp/server.ts → buildWriteErrorResponse` previously only protected
 * the MCP surface. This adapter lets REST routes reuse the exact same
 * classifier so web clients get:
 *   - the same retryable-vs-permanent signal,
 *   - a consistent message catalog,
 *   - a sane HTTP status mapped from the SQLSTATE category,
 *   - a `Retry-After` header on transient failures.
 *
 * Usage:
 *   try {
 *     await db.insert(...).values(...);
 *   } catch (e) {
 *     return sendDbWriteError(res, e, 'bill', 'create', {
 *       logPrefix: '[BILLS API] create failed',
 *     });
 *   }
 */

import type { Response } from 'express';
import { buildWriteErrorResponse } from '../mcp/server';
import { logError } from './logger';

type WriteAction = 'create' | 'update' | 'delete';

interface SendDbWriteErrorOptions {
  /** Optional log prefix; the full error is always logged before sanitization. */
  logPrefix?: string;
  /** Extra fields merged into the response body (e.g. legacy `error_id`). */
  extraFields?: Record<string, unknown>;
  /**
   * Optional structured FK blocker count map to merge into the response
   * envelope when the underlying error is a delete-FK violation. Keys are
   * DB table names, values are row counts > 0. Built by
   * `queryAllDeleteBlockerCounts` in `server/mcp/server.ts` (Task #1471).
   */
  blockers?: Record<string, number> | null;
}

interface ParsedEnvelope {
  status?: string;
  code?: string;
  retryable?: boolean;
  message?: string;
  pgCode?: string;
  blocking_entity?: string;
  blocking_entities?: Record<string, number>;
  referenced_entity?: string;
}

/**
 * Map the envelope `code` to an HTTP status. FK and unique-violation
 * conflicts surface as 409, schema-rule failures as 400, transient
 * failures as 503 (with a `Retry-After`), and the catch-all generic
 * fallback as 500. The mapping is intentionally narrow — every code the
 * MCP catalog knows about is covered explicitly.
 */
function statusForCode(code: string | undefined): number {
  switch (code) {
    case 'FK_VIOLATION':
    case 'UNIQUE_VIOLATION':
      return 409;
    case 'CHECK_VIOLATION':
    case 'NOT_NULL_VIOLATION':
      return 400;
    case 'SERIALIZATION_FAILURE':
    case 'DEADLOCK_DETECTED':
    case 'STATEMENT_TIMEOUT':
    case 'CONNECTION_FAILURE':
      return 503;
    default:
      return 500;
  }
}

/**
 * Classify `err` with the shared MCP `buildWriteErrorResponse` helper and
 * write a JSON response that mirrors the envelope shape. Always logs the
 * raw error first so operators retain full diagnostic context — only the
 * sanitized envelope is ever sent over the wire.
 *
 * Returns the Response object for fluent `return sendDbWriteError(...)`
 * usage inside route handlers.
 */
export function sendDbWriteError(
  res: Response,
  err: unknown,
  entityLabel: string,
  action: WriteAction = 'create',
  options: SendDbWriteErrorOptions = {},
): Response {
  // Always log the raw error; buildWriteErrorResponse strips driver detail
  // from the response, so server logs are the only place operators can see
  // the full SQLSTATE + message.
  logError(
    options.logPrefix ?? `[REST DB ERROR] ${action} ${entityLabel}`,
    err instanceof Error ? err : new Error(String(err)),
  );

  const blockers = options.blockers && Object.keys(options.blockers).length > 0 ? options.blockers : null;
  const envelope = buildWriteErrorResponse(err, entityLabel, action, blockers);
  const text = envelope.content[0]?.text ?? '';

  let parsed: ParsedEnvelope | null = null;
  try {
    const candidate = JSON.parse(text);
    if (candidate && typeof candidate === 'object') {
      parsed = candidate as ParsedEnvelope;
    }
  } catch {
    // Generic fallback path — buildWriteErrorResponse returned a plain
    // sentence ("Failed to <action> <label> — please retry") rather than
    // the JSON envelope. Treat it as an unclassified 500.
    parsed = null;
  }

  if (!parsed) {
    return res.status(500).json({
      status: 'unknown_error',
      code: 'UNKNOWN',
      retryable: false,
      message: text || `Failed to ${action} ${entityLabel}`,
      ...(options.extraFields ?? {}),
    });
  }

  const status = statusForCode(parsed.code);

  // Transient categories advertise a Retry-After hint so HTTP clients
  // (and intermediaries) can schedule a backoff. The value is a coarse
  // 1-second floor — actual backoff strategy lives client-side.
  if (parsed.retryable) {
    res.setHeader('Retry-After', '1');
  }

  // Task #1341 — surface a top-level `error: 'fk_violation'` discriminator
  // alongside the existing `status`/`code` envelope so frontend delete
  // dialogs can branch on a single, stable shape (matches the contract
  // documented in the task description).
  const errorDiscriminator = parsed.code === 'FK_VIOLATION' ? 'fk_violation' : undefined;

  return res.status(status).json({
    ...(errorDiscriminator ? { error: errorDiscriminator } : {}),
    ...parsed,
    ...(options.extraFields ?? {}),
  });
}
