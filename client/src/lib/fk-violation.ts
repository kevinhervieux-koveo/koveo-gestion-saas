/**
 * Helpers for parsing the structured FK-violation envelope returned by REST
 * delete endpoints (Task #1341). When a delete is rejected because child rows
 * still reference the target record, the server replies with:
 *
 *   {
 *     error: 'fk_violation',
 *     status: 'fk_violation',
 *     code: 'FK_VIOLATION',
 *     blocking_entity: 'residence',
 *     blockers: [{ id, label? }, ...],
 *     message: 'Cannot delete ...'
 *   }
 *
 * Use `extractFkViolation(error)` on a thrown `ApiError` to detect the case
 * and read the blocker list, then `formatFkViolationDescription(...)` to
 * produce a toast-friendly multi-line description.
 */

import type { ApiError } from './queryClient';

export interface FkBlocker {
  id: string;
  label?: string;
}

export interface FkViolationDetails {
  blockingEntity?: string;
  message?: string;
  blockers: FkBlocker[];
}

interface FkViolationBody {
  error?: unknown;
  status?: unknown;
  code?: unknown;
  blocking_entity?: unknown;
  message?: unknown;
  blockers?: unknown;
}

function isFkBlocker(value: unknown): value is FkBlocker {
  if (!value || typeof value !== 'object') return false;
  const v = value as { id?: unknown; label?: unknown };
  return typeof v.id === 'string' && (v.label === undefined || typeof v.label === 'string');
}

/**
 * Returns FK-violation details when `error` is an `ApiError` whose body has
 * the structured envelope, otherwise `null`. Detection is loose on purpose —
 * it accepts either the top-level `error: 'fk_violation'` discriminator or
 * the legacy `code: 'FK_VIOLATION'` field so older deploys keep working.
 */
export function extractFkViolation(error: unknown): FkViolationDetails | null {
  if (!error || typeof error !== 'object') return null;
  const body = (error as { body?: unknown; status?: unknown }).body;
  if (!body || typeof body !== 'object') return null;
  const envelope = body as FkViolationBody;
  const isFk =
    envelope.error === 'fk_violation' ||
    envelope.status === 'fk_violation' ||
    envelope.code === 'FK_VIOLATION';
  if (!isFk) return null;
  const blockers = Array.isArray(envelope.blockers)
    ? envelope.blockers.filter(isFkBlocker)
    : [];
  return {
    blockingEntity:
      typeof envelope.blocking_entity === 'string' ? envelope.blocking_entity : undefined,
    message: typeof envelope.message === 'string' ? envelope.message : undefined,
    blockers,
  };
}

/**
 * Build a toast-ready multi-line description from an FK-violation envelope.
 * Lists up to `limit` blockers by label (falling back to ID) and appends a
 * "+N more" line when the server truncated the list.
 */
export function formatFkViolationDescription(
  details: FkViolationDetails,
  options: { limit?: number; emptyFallback?: string } = {},
): string {
  const limit = options.limit ?? 5;
  const fallback =
    options.emptyFallback ??
    details.message ??
    'Other records still reference this item. Remove them first.';
  if (details.blockers.length === 0) return fallback;
  const shown = details.blockers.slice(0, limit);
  const lines = shown.map((b) => `• ${b.label ?? b.id}`);
  const remainder = details.blockers.length - shown.length;
  const header =
    details.message ??
    `${details.blockers.length} record${details.blockers.length === 1 ? '' : 's'} must be removed first:`;
  const tail = remainder > 0 ? [`• …and ${remainder} more`] : [];
  return [header, ...lines, ...tail].join('\n');
}

/**
 * Convenience helper for `useCreateUpdateMutation` `errorMessage` callbacks.
 * Returns the formatted blocker description when the error is an FK
 * violation, otherwise `null` so the caller can fall back to its default
 * error message.
 */
export function fkViolationToastDescription(error: unknown): string | null {
  const details = extractFkViolation(error);
  if (!details) return null;
  return formatFkViolationDescription(details);
}

export type { ApiError };
