/**
 * Task #1202 — Inline & step-level Retry surface for AI-failed bulk
 * import rows.
 *
 * Background
 * ----------
 * Task #1202 makes a transient Anthropic failure recoverable from
 * inside the wizard:
 *
 *   1. Each yellow "AI service error" alert (the
 *      `detail-fallback-explanation-${id}` block) renders an inline
 *      Retry button (`button-fallback-retry-${id}`) — but only when
 *      the fallback reason is one the per-item endpoint can actually
 *      recover from (`api_error` or `unreadable_response`). Other
 *      reasons (`oversize`, `unsupported_mime`, …) describe permanent
 *      file-side problems and must NOT show the inline Retry.
 *
 *   2. The auto-run progress banner gets a step-level
 *      "Retry AI-failed items (N)" button
 *      (`auto-run-retry-failed-${currentStep}`) whenever there is at
 *      least one row in the current step with a retryable fallback.
 *      The count must equal the number of retryable AI-failed rows
 *      (excluding rejected / excluded rows).
 *
 * Coverage
 * --------
 * The fixture below renders the SORTING step with three rows:
 *   - retryRow         : status=screened, sortingFallback=api_error
 *   - permanentFailRow : status=screened, sortingFallback=oversize
 *   - excludedFailRow  : status=rejected,  sortingFallback=api_error
 *
 * We assert that the inline button shows up only on retryRow, that
 * the step-level button shows the count "1" (only retryRow qualifies)
 * and that the French copy is correct when the language switches.
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

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
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

const fetchMock = jest.fn(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-1202');
  mockLanguage = 'en';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
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

    it('does NOT render inline Retry on rows whose sortingFallback is permanent (oversize)', async () => {
      renderPage();
      await waitForRow(PERMANENT_ID);
      await expandPanel(PERMANENT_ID);

      // The alert STILL renders for permanent reasons (it explains
      // *why* the row failed) — but the inline Retry button must
      // stay hidden because the per-item endpoint cannot recover
      // from a permanent file-side problem.
      expect(
        screen.getByTestId(`detail-fallback-explanation-${PERMANENT_ID}`),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId(`button-fallback-retry-${PERMANENT_ID}`),
      ).not.toBeInTheDocument();
    });

    it('does NOT render inline Retry on excluded (rejected) rows even when fallback is api_error', async () => {
      renderPage();
      // Excluded rows are dropped from `visibleItems` on non-
      // screening steps (sorting included). Wait on a sibling row
      // so we know the lite payload landed before asserting absence.
      await waitForRow(RETRY_ID);

      expect(
        screen.queryByTestId(`button-fallback-retry-${EXCLUDED_ID}`),
      ).not.toBeInTheDocument();
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
});
