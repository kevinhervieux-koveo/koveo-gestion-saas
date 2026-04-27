/**
 * Task #1240 — Live "Retrying X of N…" progress on the bulk retry
 * button (and on the cancel-confirm AlertDialog title) must actually
 * tick as each per-item retry resolves.
 *
 * Background
 * ----------
 * Task #1238 wired a render-visible mirror of the
 * `bulkRetryProcessedRef` / `bulkRetryTotalRef` counters
 * (`bulkRetryProgress`) into:
 *
 *   - The spinner-bearing step-level "Retry AI-failed items (N)"
 *     button (`auto-run-retry-failed-${currentStep}`), which flips to
 *     `Retrying X of N…` while the loop is running.
 *   - The cancel-confirm AlertDialog title
 *     (`cancel-bulk-retry-title`), which shows
 *     `Cancel the bulk retry (X of N)?` so the admin sees how far the
 *     loop got before the dialog opened.
 *
 * Both readouts are driven by the same `setBulkRetryProgress` call
 * inside the loop in `retryAllAiFailedItems` — so a regression that
 * froze the count at `0 of N`, or that never re-rendered after the
 * loop advanced, would silently strip the live feedback the task was
 * meant to add.
 *
 * The existing `bulk-document-import-ai-failure-retry.test.tsx`
 * covers the static idle copy and the cancel-loop wiring (Task #1208 /
 * #1213), but never asserts that the count advances. This sibling
 * file adds:
 *
 *   1. A multi-row English-copy run that observes the button label
 *      transitioning through `Retrying 1 of N…` AND `Retrying 2 of N…`
 *      before settling back to `Retry AI-failed items (N)`. N is
 *      sized to BULK_RETRY_CONFIRM_THRESHOLD - 2 so the loop runs
 *      the immediate-cancel path and the count is small enough that
 *      both intermediate labels are observable (Task #1241).
 *   2. The same assertion in French (`Réessai de X sur N…` →
 *      `Réessayer les fichiers en échec IA (N)`).
 *   3. A cancel-confirm dialog assertion: with a batch sized to
 *      `BULK_RETRY_CONFIRM_THRESHOLD` (the smallest size that opens
 *      the dialog), clicking Cancel mid-loop opens the AlertDialog
 *      and the title contains the live `X of N` progress (X >= 1 —
 *      i.e. NOT the frozen `0 of N` a regression would produce).
 *   4. The French copy of (3) for completeness.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Module mocks (must be declared before importing the page under test).
// -----------------------------------------------------------------------------

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

let mockLanguage: 'en' | 'fr' = 'en';
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: mockLanguage,
    t: (key: string) => key,
    tp: (_key: string, count: number) => String(count),
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: { title: string }) => (
    <div data-testid="mock-header">{title}</div>
  ),
}));

jest.mock('@/components/common/DocumentInlineViewer', () => ({
  DocumentInlineViewer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mock-inline-viewer" /> : null,
}));

import BulkDocumentImportPage, {
  BULK_RETRY_CONFIRM_THRESHOLD,
} from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// -----------------------------------------------------------------------------
// Fixture state
// -----------------------------------------------------------------------------

let SESSION_ID = 'session-test-1240-init';

const baseItemDefaults = {
  mimeType: 'application/pdf',
  preExcludeStatus: null,
  excludeSource: null,
  screeningConfidence: null,
  screeningFallback: null,
  screeningTypeGuess: null,
  screeningBucketGuess: null,
  screeningQaReason: null,
  screeningRotationDegrees: 0,
  screeningRotationApplied: false,
  sortingConfidence: null,
  sortingFallback: null,
  sortingDecision: null,
  sortingReason: null,
  sortingMergeWithItemId: null,
  sortingMergeWithItemIds: null,
  sortingSplitAtPage: null,
  sortingDecisionState: null,
  sortingManualOverride: false,
  sortingDecisionSplitIntoItemIds: null,
  sortingDecisionDraft: false,
  sortingDecisionSplitFinalNames: null,
  finalFileName: null,
  branchingConfidence: null,
  branchingFallback: null,
  branch: null as 'building_documents' | null,
  subCategory: null,
  branchReason: null,
  branchManualOverride: false,
  residenceId: null,
  residenceConfidence: null,
  residenceReason: null,
  residenceFallbackReason: null,
  residenceManualOverride: false,
  residenceAiSuggestedId: null,
  residenceAiSuggested: false,
  residenceAiConfirmed: false,
  identificationConfidence: null,
  identificationFallback: null,
  identificationName: null,
  identificationDescription: null,
  identificationTags: null,
  identificationAiSuggestedTagIds: null,
  identificationEffectiveDate: null,
  identificationEffectiveDateManualOverride: false,
  linkingConfidence: null,
  linkingFallback: null,
  linkingReason: null,
  linkingBeforeItemId: null,
  linkingAfterItemId: null,
};

/**
 * Build a sorting-step payload with N retryable AI-failure rows.
 * Mirrors the helper in bulk-document-import-ai-failure-retry.test.tsx
 * — the rows must be in the `sorted` status with a screening signal
 * AND a sortingDecision so the page renders them on the sorting step
 * and the bulk Retry button counts them.
 */
function buildPayloadWithRetryableRows(ids: readonly string[]) {
  const sortedDefaults = {
    status: 'sorted' as const,
    screeningTypeGuess: 'invoice',
    screeningBucketGuess: null as null,
    screeningConfidence: 0.7,
    sortingDecisionState: 'accepted' as const,
    sortingConfidence: 0.05,
    sortingDecision: 'keep' as const,
  };
  const rows = ids.map((id, idx) => ({
    ...baseItemDefaults,
    ...sortedDefaults,
    id,
    originalName: `doc-1240-${idx + 1}.pdf`,
    sortingFallback: 'api_error' as const,
    sortingReason: 'AI failed',
  }));
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'sorting' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          sorting: {
            total: ids.length,
            processed: ids.length,
            failed: ids.length,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
            inFlight: [],
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: rows,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () =>
      new Blob([JSON.stringify(body)], { type: 'application/json' }),
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

/**
 * Suite-level fetch responder that knows about no specific fixture.
 * Each test calls `installFetchMockForRows(ids)` to wire the lite
 * payload its case needs — that helper also returns the per-item
 * sort-POST log so the test can observe how far the loop got before
 * asserting the live count.
 */
const fetchMock = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

function installFetchMockForRows(ids: readonly string[]): string[] {
  const perItemSortPosts: string[] = [];
  const payload = buildPayloadWithRetryableRows(ids);
  fetchMock.mockImplementation(async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();
    const [pathname] = url.split('?');

    if (method === 'GET') {
      if (pathname === '/api/admin/bulk-import/buildings-lite') return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status') return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(payload);
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({
          sessions: [],
          limit: 20,
          offset: 0,
          hasMore: false,
        });
      }
    }
    if (method === 'POST') {
      if (
        pathname.startsWith('/api/admin/bulk-import/items/') &&
        pathname.endsWith('/sort')
      ) {
        perItemSortPosts.push(pathname);
      }
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ unmocked: true, url, method }, 404);
  });
  return perItemSortPosts;
}

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-1240');
  mockLanguage = 'en';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  // Default: no fixture — tests opt in via installFetchMockForRows.
  // A bare reset would leave the responder undefined and any stray
  // fetch would throw, so we wire a 404 floor here as a safety net.
  fetchMock.mockImplementation(async () =>
    jsonResponse({ unmocked: true }, 404),
  );
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  cleanup();
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  mockToast.mockReset();
  queryClient.clear();
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function waitForRow(id: string) {
  await screen.findByTestId(`item-row-${id}`, undefined, { timeout: 4000 });
}

/**
 * Drive a multi-row bulk retry and capture every distinct
 * `textContent` the bulk-retry button surfaces while the loop runs.
 *
 * Polling the button after each `await` would race the loop's 200 ms
 * inter-call stagger, so we instead attach a `MutationObserver` that
 * records every label the button passes through. The observer is
 * cheap, deterministic, and survives cleanly across the loop's React
 * re-renders.
 *
 * Returns the set of seen labels along with the button element so
 * callers can both assert on intermediate values AND wait for the
 * final idle copy.
 */
function captureBulkRetryButtonLabels(button: HTMLElement): {
  seen: Set<string>;
  disconnect: () => void;
} {
  const seen = new Set<string>();
  const snap = () => {
    const text = (button.textContent || '').trim();
    if (text) seen.add(text);
  };
  snap();
  const observer = new MutationObserver(snap);
  observer.observe(button, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return {
    seen,
    disconnect: () => observer.disconnect(),
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — Task #1240 live "Retrying X of N…" progress', () => {
  // Task #1241 — size the sub-threshold "tick the counter" fixture
  // relative to BULK_RETRY_CONFIRM_THRESHOLD so the test still
  // exercises the immediate-cancel (no-dialog) path no matter what
  // value the threshold is tuned to. THRESHOLD - 2 keeps the count
  // small enough that BOTH "Retrying 1 of N…" and "Retrying 2 of N…"
  // intermediate labels appear before the loop settles.
  const SUB_THRESHOLD_ROW_COUNT = BULK_RETRY_CONFIRM_THRESHOLD - 2;
  const SUB_THRESHOLD_ROW_IDS = Array.from(
    { length: SUB_THRESHOLD_ROW_COUNT },
    (_, idx) => `item-1240-tick-${idx + 1}`,
  ) as readonly string[];

  it('ticks the bulk-retry button label through Retrying 1 of N… and Retrying 2 of N… before settling back to idle (English)', async () => {
    installFetchMockForRows(SUB_THRESHOLD_ROW_IDS);
    renderPage();
    await waitForRow(SUB_THRESHOLD_ROW_IDS[0]);

    const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
    expect(bulkBtn).toHaveTextContent(
      `Retry AI-failed items (${SUB_THRESHOLD_ROW_COUNT})`,
    );

    const capture = captureBulkRetryButtonLabels(bulkBtn);

    await act(async () => {
      fireEvent.click(bulkBtn);
    });

    // Wait for the loop to finish and the button to settle back to
    // its idle copy. This both gives the MutationObserver enough time
    // to record every intermediate value and asserts the final
    // resting state — a regression that left the spinner stuck on
    // "Retrying X of N…" would fail right here.
    await waitFor(
      () => {
        expect(bulkBtn).toHaveTextContent(
          `Retry AI-failed items (${SUB_THRESHOLD_ROW_COUNT})`,
        );
      },
      { timeout: 6000 },
    );

    capture.disconnect();

    // The loop must have surfaced BOTH intermediate counts. Asserting
    // on each value individually (rather than e.g. "saw at least one
    // intermediate label") is what catches a regression that froze
    // the count at the loop's initial 0 of N: in that broken world
    // the only label seen during the loop would be "Retrying 0 of N…"
    // and neither of these assertions would pass.
    const labels = [...capture.seen];
    expect(
      labels.some((l) => l.includes(`Retrying 1 of ${SUB_THRESHOLD_ROW_COUNT}`)),
    ).toBe(true);
    expect(
      labels.some((l) => l.includes(`Retrying 2 of ${SUB_THRESHOLD_ROW_COUNT}`)),
    ).toBe(true);
  });

  it('ticks the bulk-retry button label through Réessai de 1 sur N… and Réessai de 2 sur N… before settling back to idle (French)', async () => {
    mockLanguage = 'fr';
    installFetchMockForRows(SUB_THRESHOLD_ROW_IDS);
    renderPage();
    await waitForRow(SUB_THRESHOLD_ROW_IDS[0]);

    const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
    expect(bulkBtn).toHaveTextContent(
      `Réessayer les fichiers en échec IA (${SUB_THRESHOLD_ROW_COUNT})`,
    );

    const capture = captureBulkRetryButtonLabels(bulkBtn);

    await act(async () => {
      fireEvent.click(bulkBtn);
    });

    await waitFor(
      () => {
        expect(bulkBtn).toHaveTextContent(
          `Réessayer les fichiers en échec IA (${SUB_THRESHOLD_ROW_COUNT})`,
        );
      },
      { timeout: 6000 },
    );

    capture.disconnect();

    const labels = [...capture.seen];
    expect(
      labels.some((l) => l.includes(`Réessai de 1 sur ${SUB_THRESHOLD_ROW_COUNT}`)),
    ).toBe(true);
    expect(
      labels.some((l) => l.includes(`Réessai de 2 sur ${SUB_THRESHOLD_ROW_COUNT}`)),
    ).toBe(true);
  });

  // Task #1241 — size the at-threshold cancel-confirm fixture
  // relative to BULK_RETRY_CONFIRM_THRESHOLD. A batch exactly at the
  // threshold is the smallest one that opens the AlertDialog instead
  // of aborting immediately (Task #1213), which is the second
  // surface Task #1238 mirrors `bulkRetryProgress` into. The
  // Task #1237 carve-out only fires when the batch started STRICTLY
  // larger than the threshold, so a batch at exactly threshold keeps
  // the dialog regardless of progress.
  const AT_THRESHOLD_ROW_COUNT = BULK_RETRY_CONFIRM_THRESHOLD;
  const AT_THRESHOLD_ROW_IDS = Array.from(
    { length: AT_THRESHOLD_ROW_COUNT },
    (_, idx) => `item-1240-dialog-${idx + 1}`,
  ) as readonly string[];

  it('opens the cancel-confirm dialog mid-loop with a live X of N title (English)', async () => {
    const perItemSortPosts = installFetchMockForRows(AT_THRESHOLD_ROW_IDS);
    renderPage();
    await waitForRow(AT_THRESHOLD_ROW_IDS[0]);

    const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
    expect(bulkBtn).toHaveTextContent(
      `Retry AI-failed items (${AT_THRESHOLD_ROW_COUNT})`,
    );

    await act(async () => {
      fireEvent.click(bulkBtn);
    });

    const cancelBtn = await screen.findByTestId(
      'auto-run-retry-cancel-sorting',
      undefined,
      { timeout: 4000 },
    );

    // Wait until the loop has dispatched at least one per-item retry
    // so the live count is GUARANTEED to have moved past zero before
    // we open the dialog. Without this anchor the dialog could open
    // while the count is still at the loop's initial 0/N and the
    // assertion below could pass on a regression that never ticks
    // the counter.
    await waitFor(
      () => {
        expect(perItemSortPosts.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 4000 },
    );

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    const title = await screen.findByTestId(
      'cancel-bulk-retry-title',
      undefined,
      { timeout: 4000 },
    );

    // The denominator is fixed by the batch size; the numerator MUST
    // be >= 1 because at least one per-item retry already resolved
    // before we clicked Cancel. A regression that froze the count
    // would render "(0 of N)" here — the explicit `not.toContain`
    // assertion below catches that. We match the numerator with
    // `\d+` (threshold-safe — works for any THRESHOLD value, including
    // multi-digit ones) rather than a `[1-N]` character class, which
    // would silently break for THRESHOLD >= 10 (Task #1241).
    const enLiveTitle = new RegExp(
      `Cancel the bulk retry \\(\\d+ of ${AT_THRESHOLD_ROW_COUNT}\\)\\?`,
    );
    await waitFor(
      () => {
        expect(title.textContent || '').toMatch(enLiveTitle);
      },
      { timeout: 4000 },
    );
    expect(title.textContent || '').not.toContain(
      `(0 of ${AT_THRESHOLD_ROW_COUNT})`,
    );

    // Dismiss the dialog so the loop's `finally` can clean up the
    // bulkRetryStep state before the test exits. (The `keep
    // retrying` branch is the cheaper one — it doesn't flip the
    // abort ref so the loop's afterEach drain handles the rest.)
    const dismissBtn = screen.getByTestId('cancel-bulk-retry-dismiss');
    await act(async () => {
      fireEvent.click(dismissBtn);
    });
  });

  it('opens the cancel-confirm dialog mid-loop with a live X sur N title (French)', async () => {
    mockLanguage = 'fr';
    const perItemSortPosts = installFetchMockForRows(AT_THRESHOLD_ROW_IDS);
    renderPage();
    await waitForRow(AT_THRESHOLD_ROW_IDS[0]);

    const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
    expect(bulkBtn).toHaveTextContent(
      `Réessayer les fichiers en échec IA (${AT_THRESHOLD_ROW_COUNT})`,
    );

    await act(async () => {
      fireEvent.click(bulkBtn);
    });

    const cancelBtn = await screen.findByTestId(
      'auto-run-retry-cancel-sorting',
      undefined,
      { timeout: 4000 },
    );

    await waitFor(
      () => {
        expect(perItemSortPosts.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 4000 },
    );

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    const title = await screen.findByTestId(
      'cancel-bulk-retry-title',
      undefined,
      { timeout: 4000 },
    );

    // Same threshold-safe `\d+` numerator pattern as the English
    // case above (Task #1241). The explicit `not.toContain` guard
    // below catches the frozen-at-zero regression.
    const frLiveTitle = new RegExp(
      `Annuler la relance groupée \\(\\d+ sur ${AT_THRESHOLD_ROW_COUNT}\\) \\?`,
    );
    await waitFor(
      () => {
        expect(title.textContent || '').toMatch(frLiveTitle);
      },
      { timeout: 4000 },
    );
    expect(title.textContent || '').not.toContain(
      `(0 sur ${AT_THRESHOLD_ROW_COUNT})`,
    );

    const dismissBtn = screen.getByTestId('cancel-bulk-retry-dismiss');
    await act(async () => {
      fireEvent.click(dismissBtn);
    });
  });
});
