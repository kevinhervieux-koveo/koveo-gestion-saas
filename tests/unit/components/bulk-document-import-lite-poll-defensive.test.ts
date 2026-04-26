/**
 * Task #1231 — Polling callback defensiveness against malformed lite payloads.
 *
 * When the `/sessions/:id/lite` endpoint returns a 502, an empty body, or a
 * payload that is missing `session` or `items`, the `refetchInterval`
 * callback must NOT throw. Throwing inside a TanStack Query interval callback
 * unmounts the component into the error boundary and shows "Loading…" forever.
 *
 * These tests exercise the interval callback logic in isolation (no React
 * render, no QueryClient) so they run fast and cannot regress to the old
 * "TypeError: Cannot read properties of undefined (reading 'currentStep')"
 * crash path.
 */

import { describe, it, expect } from '@jest/globals';

// ─── Mirror of the production refetchInterval callback ──────────────────────
//
// Keep in sync with `client/src/pages/admin/bulk-document-import.tsx`
// (the `refetchInterval` for the `/sessions/:id/lite` useQuery).
// Anything that would have previously thrown on `data.session.currentStep`
// must now return a cadence safely.

type RunAllProgress = { finishedAt: string | null };

interface SessionPayloadLite {
  session?: {
    currentStep?: string;
    progress?: {
      runAll?: Record<string, RunAllProgress>;
    } | null;
  };
  items?: Array<{ status: string }>;
}

/**
 * Extracted callback — mirrors the production implementation exactly,
 * including the optional chaining fix from Task #1231.
 */
function refetchIntervalCallback(data: SessionPayloadLite | undefined): number {
  if (!data) return 5000;
  const screeningActive =
    data?.session?.currentStep === 'screening' &&
    data?.items?.some((i) => i.status === 'pending' || i.status === 'screening');
  if (screeningActive) return 2000;
  const progress = data?.session?.progress as Record<string, unknown> | null | undefined;
  const runAll = progress?.runAll as Record<string, RunAllProgress> | undefined;
  const anyRunning =
    runAll &&
    Object.values(runAll).some(
      (p) => p && typeof p === 'object' && !p.finishedAt,
    );
  return anyRunning ? 2000 : 5000;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('refetchInterval callback — defensiveness against malformed payloads (Task #1231)', () => {
  it('returns 5000 when data is undefined', () => {
    expect(refetchIntervalCallback(undefined)).toBe(5000);
  });

  it('returns 5000 when data is an empty object ({})', () => {
    expect(refetchIntervalCallback({})).toBe(5000);
  });

  it('returns 5000 when session is missing from payload', () => {
    expect(refetchIntervalCallback({ items: [] })).toBe(5000);
  });

  it('returns 5000 when items is missing from payload', () => {
    expect(refetchIntervalCallback({ session: { currentStep: 'linking' } })).toBe(5000);
  });

  it('returns 5000 when both session and items are missing', () => {
    // Simulates the 502 path where res.json() receives an HTML body and
    // the client default queryFn returns null / throws and TanStack Query
    // leaves stale data with an empty object shape.
    const badPayload = {} as SessionPayloadLite;
    expect(() => refetchIntervalCallback(badPayload)).not.toThrow();
    expect(refetchIntervalCallback(badPayload)).toBe(5000);
  });

  it('returns 5000 when session.currentStep is undefined', () => {
    expect(refetchIntervalCallback({ session: {}, items: [] })).toBe(5000);
  });

  it('returns 2000 when a run-all step is still in progress', () => {
    const payload: SessionPayloadLite = {
      session: {
        currentStep: 'linking',
        progress: {
          runAll: {
            linking: { finishedAt: null },
          },
        },
      },
      items: [{ status: 'identified' }],
    };
    expect(refetchIntervalCallback(payload)).toBe(2000);
  });

  it('returns 5000 when all run-all steps are finished', () => {
    const payload: SessionPayloadLite = {
      session: {
        currentStep: 'linking',
        progress: {
          runAll: {
            linking: { finishedAt: '2026-01-01T00:00:00Z' },
          },
        },
      },
      items: [{ status: 'linked' }],
    };
    expect(refetchIntervalCallback(payload)).toBe(5000);
  });

  it('returns 2000 during active screening', () => {
    const payload: SessionPayloadLite = {
      session: { currentStep: 'screening' },
      items: [{ status: 'screening' }, { status: 'linked' }],
    };
    expect(refetchIntervalCallback(payload)).toBe(2000);
  });

  it('does not throw for any of several malformed shapes', () => {
    const malformedPayloads: unknown[] = [
      {},
      { session: null },
      { session: undefined },
      { items: null },
      { session: {}, items: null },
      { session: { progress: null }, items: [] },
    ];
    for (const p of malformedPayloads) {
      expect(() =>
        refetchIntervalCallback(p as SessionPayloadLite | undefined),
      ).not.toThrow();
    }
  });
});
