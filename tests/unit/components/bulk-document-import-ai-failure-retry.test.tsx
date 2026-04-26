/**
 * Task #1202 / Task #1225 — Inline & step-level Retry surface for
 * AI-failed bulk import rows.
 *
 * Background
 * ----------
 * Task #1202 makes a transient Anthropic failure recoverable from
 * inside the wizard:
 *
 *   1. Each yellow "AI service error" alert (the
 *      `detail-fallback-explanation-${id}` block) renders an inline
 *      Retry button (`button-fallback-retry-${id}`). Task #1202
 *      originally restricted this to `api_error` / `unreadable_response`
 *      fallback reasons; Task #1225 removed that gate — the button now
 *      renders for ALL fallback reasons because the backend per-item
 *      endpoint runs unconditionally.
 *
 *   2. The auto-run progress banner gets a step-level
 *      "Retry AI-failed items (N)" button
 *      (`auto-run-retry-failed-${currentStep}`) whenever there is at
 *      least one row in the current step with a retryable fallback.
 *      The count must equal the number of retryable AI-failed rows
 *      (excluding rejected / excluded rows). The step-level bulk
 *      button retains its original RETRYABLE_AI_FALLBACK_REASONS scope
 *      (Task #1225 out-of-scope: only the per-row surfaces changed).
 *
 * Coverage
 * --------
 * The fixture below renders the SORTING step with three rows:
 *   - retryRow         : status=screened, sortingFallback=api_error
 *   - permanentFailRow : status=screened, sortingFallback=oversize
 *   - excludedFailRow  : status=rejected,  sortingFallback=api_error
 *
 * We assert that the inline button shows up on BOTH retryRow and
 * permanentFailRow (Task #1225), that the step-level button shows the
 * count "1" (only retryRow's api_error reason qualifies — the step-
 * level scope is unchanged), and that the French copy is correct when
 * the language switches.
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

let SESSION_ID = 'session-test-1202-init';
const RETRY_ID = 'item-retry-api-error';
const PERMANENT_ID = 'item-permanent-oversize';
const EXCLUDED_ID = 'item-excluded-api-error';

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

function buildSessionPayload() {
  // Sorting step rows. The yellow "AI service error" alert
  // (`detail-fallback-explanation-${id}`) lives inside the per-item
  // detail panel that opens via `button-toggle-detail-${id}`. The
  // toggle is only rendered when the row has at least one quick-
  // analysis signal (`screeningTypeGuess`) AND the AI step has
  // produced a decision (`sortingDecision`), so we populate both
  // here. Status is `'sorted'` (not the pre-status `'screened'`)
  // so the row stays visible in the sorting list. See the
  // `setupSortingApiErrorItem` helper in
  // `bulk-document-import-detail-panel.test.tsx` for the same pattern.
  const sortedDefaults = {
    status: 'sorted' as const,
    screeningTypeGuess: 'invoice',
    screeningBucketGuess: null as null,
    screeningConfidence: 0.7,
    sortingDecisionState: 'accepted' as const,
    sortingConfidence: 0.05,
    sortingDecision: 'keep' as const,
  };
  const retryRow = {
    ...baseItemDefaults,
    ...sortedDefaults,
    id: RETRY_ID,
    originalName: 'doc-retry.pdf',
    sortingFallback: 'api_error' as const,
    sortingReason: 'AI failed',
  };
  const permanentRow = {
    ...baseItemDefaults,
    ...sortedDefaults,
    id: PERMANENT_ID,
    originalName: 'doc-permanent.pdf',
    sortingFallback: 'oversize' as const,
    sortingReason: 'File too big',
  };
  const excludedRow = {
    ...baseItemDefaults,
    ...sortedDefaults,
    id: EXCLUDED_ID,
    originalName: 'doc-excluded.pdf',
    status: 'rejected' as const,
    sortingFallback: 'api_error' as const,
    sortingReason: 'AI failed',
  };

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
            total: 3,
            processed: 3,
            failed: 1,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
            inFlight: [],
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: [retryRow, permanentRow, excludedRow],
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
 * Default responder for the suite. Pulled out as a standalone
 * function so individual tests that need a custom payload can call
 * `fetchMock.mockImplementation(...)` and the per-test `beforeEach`
 * can restore this one between cases — without that restoration a
 * custom responder would leak into subsequent tests in the same
 * file (Task #1208 review feedback, also relied on by Task #1209
 * banner tests that run after the step-level "no retry" cases).
 */
const defaultFetchImpl = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
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
      return jsonResponse(buildSessionPayload());
    }
    if (pathname === '/api/admin/bulk-import/sessions') {
      return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
    }
  }

  // The page issues `POST /run-all` on mount and may issue a few
  // other POSTs in passing. Resolving them with `{ ok: true }` is
  // enough for the assertions here — we never click a button in
  // this suite.
  if (method === 'POST') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ unmocked: true, url, method }, 404);
};

const fetchMock = jest.fn(defaultFetchImpl) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-1202');
  mockLanguage = 'en';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  // Reset wipes BOTH the call history AND any per-test
  // `mockImplementation` overrides applied by an earlier test, so
  // we then reapply the suite's default responder. Without this
  // restoration a custom responder set by one test would leak into
  // every later test in the same file (Task #1208 review feedback;
  // Task #1209's banner suite also depends on this restoration).
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultFetchImpl);
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

async function waitForRow(id: string, timeout = 4000) {
  await screen.findByTestId(`item-row-${id}`, undefined, { timeout });
}

/**
 * Open the per-item detail panel by clicking the chevron toggle. The
 * yellow "AI service error" alert and the inline Retry button live
 * inside this panel — without expanding it the assertions can't see
 * either testid. Mirrors the helper in
 * `bulk-document-import-detail-panel.test.tsx`.
 */
async function expandPanel(id: string) {
  const toggle = await screen.findByTestId(
    `button-toggle-detail-${id}`,
    undefined,
    { timeout: 4000 },
  );
  await act(async () => {
    fireEvent.click(toggle);
  });
  return screen.getByTestId(`item-detail-panel-${id}`);
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — Task #1202 AI failure retry surfaces', () => {
  describe('inline Retry inside the AI-service-error alert', () => {
    it('renders inline Retry on rows whose sortingFallback is api_error', async () => {
      renderPage();
      await waitForRow(RETRY_ID);
      await expandPanel(RETRY_ID);

      // The yellow alert anchors the inline button — confirm both
      // exist so the assertion fails loudly if the alert is missing
      // for some other reason (e.g. the row didn't reach the
      // detail-rendering branch).
      expect(
        screen.getByTestId(`detail-fallback-explanation-${RETRY_ID}`),
      ).toBeInTheDocument();
      const inlineRetry = screen.getByTestId(
        `button-fallback-retry-${RETRY_ID}`,
      );
      expect(inlineRetry).toBeInTheDocument();
      expect(inlineRetry).toBeEnabled();
    });

    it('renders inline Retry on rows whose sortingFallback is permanent (oversize) — Task #1225', async () => {
      renderPage();
      await waitForRow(PERMANENT_ID);
      await expandPanel(PERMANENT_ID);

      // Task #1225: InlineFallbackRetryButton no longer gates on the
      // fallback reason. The per-item backend endpoint runs
      // unconditionally so admins should always be able to retry from
      // the yellow alert, even for permanent file-side failures like
      // `oversize` — the admin may e.g. have replaced the file
      // out-of-band and wants to rerun the step.
      expect(
        screen.getByTestId(`detail-fallback-explanation-${PERMANENT_ID}`),
      ).toBeInTheDocument();
      const inlineRetry = screen.getByTestId(
        `button-fallback-retry-${PERMANENT_ID}`,
      );
      expect(inlineRetry).toBeInTheDocument();
      expect(inlineRetry).toBeEnabled();
    });

    it('renders inline Retry inside detail panel on excluded (rejected) rows — Task #1225', async () => {
      renderPage();
      // Task #1225: sorting is an AI auto-step, so excluded rows are now
      // included in visibleItems and the admin can reach their detail panel
      // without first un-excluding the file.
      await waitForRow(EXCLUDED_ID);
      await expandPanel(EXCLUDED_ID);

      // The fallback alert and its inline Retry button should both appear
      // because InlineFallbackRetryButton no longer gates on exclusion status.
      expect(
        screen.getByTestId(`detail-fallback-explanation-${EXCLUDED_ID}`),
      ).toBeInTheDocument();
      const inlineRetry = screen.getByTestId(
        `button-fallback-retry-${EXCLUDED_ID}`,
      );
      expect(inlineRetry).toBeInTheDocument();
      expect(inlineRetry).toBeEnabled();
    });
  });

  /**
   * Task #1208 — In-page Cancel button for the bulk retry loop.
   *
   * The bulk-retry loop in `retryAllAiFailedItems` walks the failed
   * rows sequentially with a 200 ms stagger between calls. There was
   * no way for the admin to abort it from inside the page (only
   * navigating away or refreshing). #1208 wires a Cancel button next
   * to the spinner-bearing "Retry AI-failed items (N)" button that
   * flips the same `bulkRetryAbortedRef` the session-change effect
   * uses, so the loop breaks out cooperatively before dispatching
   * the next per-item retry.
   *
   * This test renders the SORTING step with three retryable rows,
   * starts the bulk retry, waits for the first per-item POST to fire,
   * clicks Cancel, and asserts:
   *   1. The Cancel button is visible while `bulkRetryStep` is set.
   *   2. Clicking it stops the loop — the per-item retry endpoint is
   *      NOT called for the remaining rows even after waiting well
   *      past the 200 ms inter-call stagger.
   *   3. The Cancel button (and the spinner state) clears once
   *      `bulkRetryStep` returns to null, so the UI is back to its
   *      idle "Retry AI-failed items (N)" affordance.
   */
  describe('Task #1208 — Cancel button for the in-flight bulk retry loop', () => {
    // Task #1241 — size the small-batch fixture relative to
    // BULK_RETRY_CONFIRM_THRESHOLD so the test still exercises the
    // immediate-cancel path (no AlertDialog) no matter what value
    // the threshold is tuned to. THRESHOLD - 2 keeps it strictly
    // below the threshold while leaving at least one row to act as
    // "the next iteration" the cancel must prevent.
    const BULK_RETRY_ROW_COUNT = BULK_RETRY_CONFIRM_THRESHOLD - 2;
    const BULK_RETRY_IDS = Array.from(
      { length: BULK_RETRY_ROW_COUNT },
      (_, idx) => `item-1208-bulk-${idx + 1}`,
    ) as readonly string[];

    function buildPayloadWithSubThresholdRetryableRows() {
      const sortedDefaults = {
        status: 'sorted' as const,
        screeningTypeGuess: 'invoice',
        screeningBucketGuess: null as null,
        screeningConfidence: 0.7,
        sortingDecisionState: 'accepted' as const,
        sortingConfidence: 0.05,
        sortingDecision: 'keep' as const,
      };
      const rows = BULK_RETRY_IDS.map((id, idx) => ({
        ...baseItemDefaults,
        ...sortedDefaults,
        id,
        originalName: `doc-bulk-${idx + 1}.pdf`,
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
                total: BULK_RETRY_ROW_COUNT,
                processed: BULK_RETRY_ROW_COUNT,
                failed: BULK_RETRY_ROW_COUNT,
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

    it('shows Cancel during bulk retry and halts further runStep calls when clicked', async () => {
      // Track every per-item retry POST so we can prove the loop
      // stopped firing after Cancel. The loop's per-item endpoint on
      // the SORTING step is `/api/admin/bulk-import/items/:id/sort`.
      const perItemSortPosts: string[] = [];
      const payload = buildPayloadWithSubThresholdRetryableRows();

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

      renderPage();
      await waitForRow(BULK_RETRY_IDS[0]);

      const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
      expect(bulkBtn).toHaveTextContent(
        `Retry AI-failed items (${BULK_RETRY_ROW_COUNT})`,
      );

      // Cancel must NOT be visible before the loop is kicked off.
      expect(
        screen.queryByTestId('auto-run-retry-cancel-sorting'),
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(bulkBtn);
      });

      // Cancel surfaces as soon as `bulkRetryStep` flips to the
      // current step.
      const cancelBtn = await screen.findByTestId(
        'auto-run-retry-cancel-sorting',
        undefined,
        { timeout: 4000 },
      );
      expect(cancelBtn).toBeInTheDocument();
      expect(cancelBtn).toHaveTextContent('Cancel');

      // Wait until the loop has dispatched at least one per-item
      // retry. After this point the loop is in its 200 ms inter-call
      // stagger and Cancel must prevent the next iteration's POST.
      await waitFor(
        () => {
          expect(perItemSortPosts.length).toBeGreaterThanOrEqual(1);
        },
        { timeout: 4000 },
      );
      const callsBeforeCancel = perItemSortPosts.length;
      expect(callsBeforeCancel).toBeLessThan(BULK_RETRY_IDS.length);

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      // Wait well past the loop's 200 ms inter-call stagger so any
      // queued next-iteration POST would have had time to land.
      await act(async () => {
        await new Promise<void>((r) => setTimeout(r, 800));
      });

      // No additional per-item retry POSTs fired after Cancel — the
      // cooperative abort short-circuited the loop before the next
      // `runStep.mutateAsync` call.
      expect(perItemSortPosts.length).toBe(callsBeforeCancel);

      // The Cancel button (and the spinner-bearing state) should
      // clear once `bulkRetryStep` is reset to null.
      await waitFor(() => {
        expect(
          screen.queryByTestId('auto-run-retry-cancel-sorting'),
        ).not.toBeInTheDocument();
      });

      // Task #1213 — small-batch path: this fixture's row count is
      // BULK_RETRY_CONFIRM_THRESHOLD - 2 so it stays below the
      // confirmation threshold and Cancel must abort immediately
      // without ever opening the confirm-cancel AlertDialog.
      expect(
        screen.queryByTestId('cancel-bulk-retry-dialog'),
      ).not.toBeInTheDocument();
    });
  });

  /**
   * Task #1213 — Confirm before canceling a long bulk retry.
   *
   * The Task #1208 Cancel button aborts immediately on click, which
   * is fine for small batches (1-5 rows) but a single accidental
   * click while scanning a 30-row failure list would halt the whole
   * batch with no undo. Task #1213 wires an AlertDialog (mirroring
   * the existing `pendingResetStep` confirmation pattern) on top of
   * the existing cooperative-abort path:
   *
   *   - Batches strictly below BULK_RETRY_CONFIRM_THRESHOLD keep
   *     the Task #1208 immediate-cancel behaviour so trivial cases
   *     stay friction-free (covered by the `BULK_RETRY_IDS` test
   *     above, which uses BULK_RETRY_CONFIRM_THRESHOLD - 2 rows).
   *   - Batches at or above the threshold open the AlertDialog.
   *     Confirming flips `bulkRetryAbortedRef.current = true` (the
   *     same cooperative path) and the loop stops dispatching new
   *     per-item retries. Dismissing the dialog leaves the loop
   *     running so a mis-click costs nothing.
   *
   * Task #1241 — the fixture below sizes the "above threshold" row
   * count to BULK_RETRY_CONFIRM_THRESHOLD + 1 so it lands just over
   * the threshold no matter what the threshold is tuned to.
   */
  describe('Task #1213 — Confirm before canceling a long bulk retry', () => {
    const LONG_BULK_RETRY_ROW_COUNT = BULK_RETRY_CONFIRM_THRESHOLD + 1;
    const LONG_BULK_RETRY_IDS = Array.from(
      { length: LONG_BULK_RETRY_ROW_COUNT },
      (_, idx) => `item-1213-bulk-${idx + 1}`,
    ) as readonly string[];

    function buildPayloadWithAboveThresholdRetryableRows() {
      const sortedDefaults = {
        status: 'sorted' as const,
        screeningTypeGuess: 'invoice',
        screeningBucketGuess: null as null,
        screeningConfidence: 0.7,
        sortingDecisionState: 'accepted' as const,
        sortingConfidence: 0.05,
        sortingDecision: 'keep' as const,
      };
      const rows = LONG_BULK_RETRY_IDS.map((id, idx) => ({
        ...baseItemDefaults,
        ...sortedDefaults,
        id,
        originalName: `doc-bulk-${idx + 1}.pdf`,
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
                total: LONG_BULK_RETRY_ROW_COUNT,
                processed: LONG_BULK_RETRY_ROW_COUNT,
                failed: LONG_BULK_RETRY_ROW_COUNT,
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

    /**
     * Wire the suite-default fetch responder to serve the above-
     * threshold payload AND record every per-item sort POST so each
     * test can assert on whether the loop kept dispatching after
     * Cancel was clicked (or after the confirm-dialog was dismissed).
     */
    function installAboveThresholdFetchMock() {
      const perItemSortPosts: string[] = [];
      const payload = buildPayloadWithAboveThresholdRetryableRows();
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

    it('opens the confirm-cancel AlertDialog (instead of aborting immediately) when Cancel is clicked on an at-or-above-threshold batch, and confirming the dialog halts the loop', async () => {
      const perItemSortPosts = installAboveThresholdFetchMock();
      renderPage();
      await waitForRow(LONG_BULK_RETRY_IDS[0]);

      const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
      expect(bulkBtn).toHaveTextContent(
        `Retry AI-failed items (${LONG_BULK_RETRY_ROW_COUNT})`,
      );

      // Dialog must NOT be present before Cancel is clicked.
      expect(
        screen.queryByTestId('cancel-bulk-retry-dialog'),
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(bulkBtn);
      });

      const cancelBtn = await screen.findByTestId(
        'auto-run-retry-cancel-sorting',
        undefined,
        { timeout: 4000 },
      );

      // Wait for the loop to dispatch at least one per-item retry so
      // the abort branch is exercised mid-flight (matching real-world
      // usage — admins click Cancel once they see the spinner).
      await waitFor(
        () => {
          expect(perItemSortPosts.length).toBeGreaterThanOrEqual(1);
        },
        { timeout: 4000 },
      );

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      // The bulk retry MUST still be running at this point — the
      // immediate-cancel path was bypassed because the batch is
      // above the confirmation threshold. The Cancel button stays
      // visible (the spinner-bearing state isn't cleared until the
      // admin actually confirms) and the loop keeps dispatching.
      const dialog = await screen.findByTestId(
        'cancel-bulk-retry-dialog',
        undefined,
        { timeout: 4000 },
      );
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent(/Stop retrying/);
      expect(dialog).toHaveTextContent(
        new RegExp(`of ${LONG_BULK_RETRY_ROW_COUNT}`),
      );

      // The Cancel button is still mounted (loop is still active
      // because the abort ref hasn't been flipped yet).
      expect(
        screen.getByTestId('auto-run-retry-cancel-sorting'),
      ).toBeInTheDocument();

      const callsBeforeConfirm = perItemSortPosts.length;

      // Confirm the dialog — this flips the abort ref, dismisses
      // the dialog, and clears the spinner state.
      const confirmBtn = screen.getByTestId('cancel-bulk-retry-confirm');
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      // Wait past the loop's 200 ms inter-call stagger so any
      // queued next-iteration POST would have had time to land.
      await act(async () => {
        await new Promise<void>((r) => setTimeout(r, 800));
      });

      expect(perItemSortPosts.length).toBe(callsBeforeConfirm);

      await waitFor(() => {
        expect(
          screen.queryByTestId('cancel-bulk-retry-dialog'),
        ).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(
          screen.queryByTestId('auto-run-retry-cancel-sorting'),
        ).not.toBeInTheDocument();
      });
    });

    it('lets the bulk retry continue when the admin dismisses the confirm-cancel dialog', async () => {
      const perItemSortPosts = installAboveThresholdFetchMock();
      renderPage();
      await waitForRow(LONG_BULK_RETRY_IDS[0]);

      const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
      expect(bulkBtn).toHaveTextContent(
        `Retry AI-failed items (${LONG_BULK_RETRY_ROW_COUNT})`,
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

      const dismissBtn = await screen.findByTestId(
        'cancel-bulk-retry-dismiss',
        undefined,
        { timeout: 4000 },
      );
      const callsBeforeDismiss = perItemSortPosts.length;

      await act(async () => {
        fireEvent.click(dismissBtn);
      });

      // Dialog closes but the loop is still alive. Wait long enough
      // for at least one more per-item POST to land so we prove the
      // dismiss path did NOT flip the abort ref.
      await waitFor(
        () => {
          expect(perItemSortPosts.length).toBeGreaterThan(callsBeforeDismiss);
        },
        { timeout: 4000 },
      );

      expect(
        screen.queryByTestId('cancel-bulk-retry-dialog'),
      ).not.toBeInTheDocument();
    });

    /**
     * Task #1237 — once the bulk retry is almost done (fewer than
     * `BULK_RETRY_CONFIRM_THRESHOLD` items still pending), Cancel
     * should fall back to the Task #1208 immediate-cancel path even
     * on a batch that started large. Asking "Stop retrying 1 of 6?"
     * is more friction than safety at that point.
     *
     * Setup: BULK_RETRY_CONFIRM_THRESHOLD + 1 retryable rows
     * (strictly above the threshold, so the Task #1237 carve-out
     * applies). Wait for the loop to dispatch enough per-item
     * retries that `processed` is >= 2 — i.e., remaining is at most
     * (THRESHOLD - 1), which is below the confirmation threshold.
     * Then click Cancel and assert no dialog opens and the spinner
     * state clears immediately.
     */
    it('skips the confirm dialog and aborts immediately when the batch started large but only a handful of items remain', async () => {
      const perItemSortPosts = installAboveThresholdFetchMock();
      renderPage();
      await waitForRow(LONG_BULK_RETRY_IDS[0]);

      const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
      expect(bulkBtn).toHaveTextContent(
        `Retry AI-failed items (${LONG_BULK_RETRY_ROW_COUNT})`,
      );

      await act(async () => {
        fireEvent.click(bulkBtn);
      });

      const cancelBtn = await screen.findByTestId(
        'auto-run-retry-cancel-sorting',
        undefined,
        { timeout: 4000 },
      );

      // Wait until the 3rd per-item POST has been dispatched. The
      // loop awaits each POST then increments `processed` before
      // starting the next iteration, so observing length >= 3
      // guarantees iterations 1 and 2 fully completed and
      // `bulkRetryProcessedRef.current >= 2`. With total = 6, that
      // means remaining <= 4, which is below the confirmation
      // threshold — Cancel must take the immediate-cancel path.
      await waitFor(
        () => {
          expect(perItemSortPosts.length).toBeGreaterThanOrEqual(3);
        },
        { timeout: 4000 },
      );

      const callsBeforeCancel = perItemSortPosts.length;

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      // No confirmation dialog must appear — Task #1237 skips it
      // because the batch is almost done.
      expect(
        screen.queryByTestId('cancel-bulk-retry-dialog'),
      ).not.toBeInTheDocument();

      // The Cancel button is unmounted right away (the immediate-
      // cancel path eagerly clears `bulkRetryStep`).
      await waitFor(() => {
        expect(
          screen.queryByTestId('auto-run-retry-cancel-sorting'),
        ).not.toBeInTheDocument();
      });

      // Wait past the loop's 200 ms inter-call stagger so any
      // queued next-iteration POST would have had time to land,
      // then prove the loop stopped dispatching.
      await act(async () => {
        await new Promise<void>((r) => setTimeout(r, 800));
      });
      expect(perItemSortPosts.length).toBeLessThanOrEqual(callsBeforeCancel + 1);
    });
  });

  describe('step-level "Retry AI-failed items (N)" button', () => {
    it('renders the bulk retry button with the retryable count and English copy', async () => {
      renderPage();
      await waitForRow(RETRY_ID);

      const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
      expect(bulkBtn).toBeInTheDocument();
      // Only the api_error row counts; the oversize row (permanent)
      // and the rejected row (excluded) must be filtered out.
      expect(bulkBtn).toHaveTextContent('Retry AI-failed items (1)');
    });

    it('renders the French copy when the language is fr', async () => {
      mockLanguage = 'fr';
      renderPage();
      await waitForRow(RETRY_ID);

      const bulkBtn = await screen.findByTestId('auto-run-retry-failed-sorting');
      expect(bulkBtn).toHaveTextContent(
        'Réessayer les fichiers en échec IA (1)',
      );
    });

    it('does NOT render the bulk retry button when there are zero retryable failed rows', async () => {
      // Mutate the responder once to drop the only retryable row.
      const original = buildSessionPayload();
      const onlyPermanent = {
        ...original,
        items: original.items.filter((i) => i.id !== RETRY_ID),
      };
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
            return jsonResponse(onlyPermanent);
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
        if (method === 'POST') return jsonResponse({ ok: true });
        return jsonResponse({ unmocked: true, url, method }, 404);
      });

      renderPage();
      await waitForRow(PERMANENT_ID);
      // Anchor — give the page a tick to settle past the auto-run effect.
      await waitFor(
        () => {
          expect(
            screen.getByTestId('auto-run-progress-sorting'),
          ).toBeInTheDocument();
        },
        { timeout: 4000 },
      );

      expect(
        screen.queryByTestId('auto-run-retry-failed-sorting'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Task #1209 "Anthropic looks degraded" banner', () => {
    it('shows the yellow banner above the items list with the count and step name when the AI failure rate exceeds the threshold', async () => {
      // Fixture: 3 items total, 1 retryable AI failure (api_error).
      // Failure rate = 1/3 ≈ 33% which is above the 25% threshold,
      // so the banner must appear with English copy that includes
      // both the failed count and the visible step label
      // ("Branching" — STEP_LABEL_EN['sorting'] swap from Task #543).
      // Timeout raised to 10 s: Task #1225 makes the sorting step show the
      // excluded row too (3 items rendered instead of 2), adding render time.
      renderPage();
      await waitForRow(RETRY_ID, 10000);

      const banner = await screen.findByTestId(
        'auto-run-ai-degraded-banner-sorting',
        undefined,
        { timeout: 10000 },
      );
      expect(banner).toBeInTheDocument();

      const message = screen.getByTestId(
        'auto-run-ai-degraded-message-sorting',
      );
      expect(message).toHaveTextContent(
        'Anthropic returned errors for 1 of 3 Branching items — service may be degraded right now.',
      );

      // The banner's retry control points at the same bulk action
      // as the existing step-level "Retry AI-failed items (N)"
      // button so admins can act without scrolling.
      const bannerRetry = screen.getByTestId(
        'auto-run-ai-degraded-retry-sorting',
      );
      expect(bannerRetry).toHaveTextContent('Retry AI-failed items (1)');
      expect(bannerRetry).toBeEnabled();
    }, 15000);

    it('renders the French copy when the language is fr', async () => {
      mockLanguage = 'fr';
      renderPage();
      await waitForRow(RETRY_ID, 10000);

      const message = await screen.findByTestId(
        'auto-run-ai-degraded-message-sorting',
        undefined,
        { timeout: 10000 },
      );
      expect(message).toHaveTextContent(
        "Anthropic a retourné des erreurs pour 1 des 3 fichiers de l'étape « Aiguillage » — le service est peut-être dégradé en ce moment.",
      );

      const bannerRetry = screen.getByTestId(
        'auto-run-ai-degraded-retry-sorting',
      );
      expect(bannerRetry).toHaveTextContent(
        'Réessayer les fichiers en échec IA (1)',
      );
    }, 15000);

    // The "no retryable failures => no banner" case is exercised
    // implicitly by the step-level "no retry button" test above,
    // which uses the same onlyPermanent fixture and would surface
    // the banner if it ignored aiFailedCount=0. Keeping a dedicated
    // assertion here would require another fetchMock.mockImplementation
    // override that bleeds into subsequent tests in this suite.
    it('does NOT render the banner when there are zero retryable AI failures', async () => {
      // Fresh override for this test only — declared LAST in the
      // file so the lingering mockImplementation doesn't affect any
      // earlier test (matches the placement of the equivalent
      // step-level test above for the same reason).
      const original = buildSessionPayload();
      const onlyPermanent = {
        ...original,
        items: original.items.filter((i) => i.id !== RETRY_ID),
      };
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
            return jsonResponse(onlyPermanent);
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
        if (method === 'POST') return jsonResponse({ ok: true });
        return jsonResponse({ unmocked: true, url, method }, 404);
      });

      renderPage();
      await waitForRow(PERMANENT_ID, 10000);
      await waitFor(
        () => {
          expect(
            screen.getByTestId('auto-run-progress-sorting'),
          ).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      expect(
        screen.queryByTestId('auto-run-ai-degraded-banner-sorting'),
      ).not.toBeInTheDocument();
    }, 15000);
  });
});

// -----------------------------------------------------------------------------
// Task #1207 — Inline Retry must surface on every auto step, not just sorting.
//
// The previous tests cover the sorting step (where the active row is always
// expanded so the alert is visible by default). For identification and linking
// the per-item detail panel renders the same alert and now also exposes the
// inline Retry button — gated by the same per-step manual-override guards
// used by each step's row-toolbar Retry button. (The branching step has its
// own IIFE renderer and the residence sub-step lives inside it; both are
// covered by the branching IIFE's gate on `branchManualOverride`.)
//
// We exercise the IDENTIFICATION step here as a representative non-sorting
// auto step that goes through the shared code path — linking shares it and
// has no manual-override field, so the identification cases are the strictest
// gate to verify.
// -----------------------------------------------------------------------------

const ID_RETRY_ID = 'item-id-retry-api-error';
const ID_OVERRIDE_ID = 'item-id-manual-override-api-error';
const ID_PERMANENT_ID = 'item-id-permanent-oversize';

function buildIdentificationSessionPayload() {
  // Identification rows mirror the sorting fixture: the detail-panel
  // toggle (`button-toggle-detail-${id}`) only shows when the row has
  // a quick-analysis signal (`screeningTypeGuess` / `screeningBucketGuess`),
  // and the alert/button live inside the panel that opens via that toggle.
  // Status `'identified'` keeps the row visible on the identification step.
  const idDefaults = {
    status: 'identified' as const,
    screeningTypeGuess: 'invoice',
    screeningBucketGuess: null as null,
    screeningConfidence: 0.7,
  };
  const retryRow = {
    ...baseItemDefaults,
    ...idDefaults,
    id: ID_RETRY_ID,
    originalName: 'doc-id-retry.pdf',
    identificationFallback: 'api_error' as const,
    identificationConfidence: 0.05,
  };
  const overrideRow = {
    ...baseItemDefaults,
    ...idDefaults,
    id: ID_OVERRIDE_ID,
    originalName: 'doc-id-manual.pdf',
    identificationFallback: 'api_error' as const,
    identificationConfidence: 0.05,
    // The admin already filled in the effective date by hand, so the
    // per-step manual-override gate must hide Retry even though the
    // fallback reason is otherwise retryable.
    identificationEffectiveDateManualOverride: true,
  };
  const permanentRow = {
    ...baseItemDefaults,
    ...idDefaults,
    id: ID_PERMANENT_ID,
    originalName: 'doc-id-permanent.pdf',
    identificationFallback: 'oversize' as const,
    identificationConfidence: 0.0,
  };

  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'identification' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          identification: {
            total: 3,
            processed: 3,
            failed: 2,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
            inFlight: [],
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: [retryRow, overrideRow, permanentRow],
  };
}

function installIdentificationFetchMock() {
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
      if (pathname === '/api/admin/bulk-import/buildings-lite')
        return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status')
        return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(buildIdentificationSessionPayload());
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
    if (method === 'POST') return jsonResponse({ ok: true });
    return jsonResponse({ unmocked: true, url, method }, 404);
  });
}

describe('BulkDocumentImportPage — Task #1207 inline Retry on non-sorting auto steps', () => {
  it('renders inline Retry inside the AI-service-error alert on the identification step', async () => {
    installIdentificationFetchMock();
    renderPage();
    await waitForRow(ID_RETRY_ID);
    await expandPanel(ID_RETRY_ID);

    expect(
      screen.getByTestId(`detail-fallback-explanation-${ID_RETRY_ID}`),
    ).toBeInTheDocument();
    const inlineRetry = screen.getByTestId(
      `button-fallback-retry-${ID_RETRY_ID}`,
    );
    expect(inlineRetry).toBeInTheDocument();
    expect(inlineRetry).toBeEnabled();
  });

  it('shows inline Retry when the admin has already manually overridden the identification effective date — Task #1225', async () => {
    installIdentificationFetchMock();
    renderPage();
    await waitForRow(ID_OVERRIDE_ID);
    await expandPanel(ID_OVERRIDE_ID);

    // Task #1225: the inline Retry button is no longer hidden for
    // manual-override rows. The backend endpoint runs unconditionally,
    // so the admin can always re-run the AI step from the yellow alert.
    // The row-toolbar Retry button carries a warning aria-label in this
    // case; the inline alert button follows the same always-visible
    // policy.
    expect(
      screen.getByTestId(`detail-fallback-explanation-${ID_OVERRIDE_ID}`),
    ).toBeInTheDocument();
    const inlineRetry = screen.getByTestId(
      `button-fallback-retry-${ID_OVERRIDE_ID}`,
    );
    expect(inlineRetry).toBeInTheDocument();
    expect(inlineRetry).toBeEnabled();
  });

  it('shows inline Retry on rows whose identificationFallback is permanent (oversize) — Task #1225', async () => {
    installIdentificationFetchMock();
    renderPage();
    await waitForRow(ID_PERMANENT_ID);
    await expandPanel(ID_PERMANENT_ID);

    // Task #1225: the fallback-reason gate on InlineFallbackRetryButton
    // is removed. The button now renders for all fallback reasons.
    expect(
      screen.getByTestId(`detail-fallback-explanation-${ID_PERMANENT_ID}`),
    ).toBeInTheDocument();
    const inlineRetryPerm = screen.getByTestId(
      `button-fallback-retry-${ID_PERMANENT_ID}`,
    );
    expect(inlineRetryPerm).toBeInTheDocument();
    expect(inlineRetryPerm).toBeEnabled();
  });

});

// -----------------------------------------------------------------------------
// Task #1225 — Retry must also show on sorting-step draft-split-lead rows.
//
// A draft-split lead has status='rejected' and sortingDecisionSplitIntoItemIds
// populated. Before Task #1225, the per-row Retry button in the flat-list path
// was gated by `!isDraftSplitLead`. That gate was dead code in practice (the
// flat list only runs for non-sorting steps) but was removed for correctness.
// The branching IIFE (which renders sorting-step items) never had the gate.
// This test confirms the button renders for a draft-split lead row.
// -----------------------------------------------------------------------------

const SPLIT_LEAD_ID = 'item-sorting-draft-split-lead-1225';

describe('BulkDocumentImportPage — Task #1225 draft-split-lead Retry visibility', () => {
  it('shows Retry on a sorting-step draft-split-lead row', async () => {
    const normalItemId = 'item-sorting-normal-1225';
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
        if (pathname === '/api/admin/bulk-import/buildings-lite')
          return jsonResponse([]);
        if (pathname === '/api/admin/bulk-import/ai-status')
          return jsonResponse({ available: true });
        if (pathname === '/api/organizations') return jsonResponse([]);
        if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
          return jsonResponse({
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
                    total: 2,
                    processed: 2,
                    failed: 0,
                    startedAt: '2024-01-01T00:00:00.000Z',
                    finishedAt: '2024-01-01T00:01:00.000Z',
                    inFlight: [],
                  },
                },
              },
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            items: [
              {
                ...baseItemDefaults,
                id: normalItemId,
                originalName: 'doc-normal-1225.pdf',
                status: 'sorted' as const,
                sortingDecision: 'keep' as const,
                sortingDecisionState: 'accepted' as const,
                sortingConfidence: 0.9,
              },
              {
                // Draft-split lead: rejected by the SPLIT action,
                // not by the admin — preExcludeStatus is null so
                // isExcluded = false and isDraftSplitLead = true.
                ...baseItemDefaults,
                id: SPLIT_LEAD_ID,
                originalName: 'doc-split-lead-1225.pdf',
                status: 'rejected' as const,
                preExcludeStatus: null,
                sortingDecision: 'split' as const,
                sortingDecisionState: 'accepted' as const,
                sortingDecisionSplitIntoItemIds: ['child-item-1225'],
                sortingDecisionDraft: true,
                sortingConfidence: 0.85,
              },
            ],
          });
        }
        if (pathname === '/api/admin/bulk-import/sessions')
          return jsonResponse({
            sessions: [],
            limit: 20,
            offset: 0,
            hasMore: false,
          });
      }
      if (method === 'POST') return jsonResponse({ ok: true });
      return jsonResponse({ unmocked: true, url, method }, 404);
    });

    renderPage();

    // Wait for the draft-split lead row to appear in the DOM —
    // confirms the branching IIFE keeps it visible.
    await screen.findByTestId(`item-row-${SPLIT_LEAD_ID}`, undefined, {
      timeout: 4000,
    });

    // The per-row Retry button must be present. The branching IIFE's
    // showRetry = !!retryAction (no isDraftSplitLead gate), so any row
    // with a retryAction shows Retry.
    const retryBtn = screen.getByTestId(
      `button-retry-sorting-${SPLIT_LEAD_ID}`,
    );
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toBeEnabled();
  });
});
