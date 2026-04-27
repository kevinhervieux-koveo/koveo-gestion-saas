/**
 * Task #1047 — Per-row Retry button keeps its spinner while the
 * fire-and-forget AI call is still running on the server.
 *
 * Background:
 *   The per-item retry endpoints (`/items/:id/{screen,sort,branch,
 *   identify,link}`) used to call Anthropic synchronously and could
 *   exceed the Replit edge proxy's ~60 s HTTP timeout, surfacing as
 *   a 502 in the wizard. The server was reshaped into the same
 *   fire-and-forget pattern as `runAllForStep`: the HTTP response
 *   returns a snapshot in milliseconds, and the in-flight state lives
 *   in `progress.runAll[step].inFlight` until the background task
 *   finishes.
 *
 *   Because the React Query mutation now flips `runStep.isPending`
 *   back to `false` almost immediately, the row spinner would
 *   disappear long before the analyzer actually returns. To keep the
 *   admin's mental model intact, the page combines the mutation flag
 *   with a polled signal:
 *
 *     polledRetryInFlight = !!progress?.inFlight?.some(
 *       (e) => e.itemId === item.id,
 *     );
 *     retryPending =
 *       (runStep.isPending && runStep.variables?.itemId === item.id)
 *       || polledRetryInFlight;
 *
 *   Both render paths (the flat list at line ~3596 and the grouped
 *   branching section at line ~3161 in
 *   `client/src/pages/admin/bulk-document-import.tsx`) wire the
 *   button's `disabled` and Loader2 spinner to `retryPending`.
 *
 * What this suite pins:
 *   When the polled session payload reports a row as in-flight (and
 *   the React Query mutation is *not* pending — i.e. the HTTP
 *   response already came back), the retry button for that row must
 *   still be disabled and still show the spinner. A sibling row in
 *   the same view, NOT in the inFlight list, must remain enabled and
 *   spinner-free.
 *
 *   This guards against any future refactor that drops the
 *   `polledRetryInFlight` term and falls back to the old
 *   `runStep.isPending` check, which would visibly bring back the
 *   "spinner disappears mid-AI-call" UX bug from Task #1047.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  render,
  screen,
  cleanup,
} from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
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

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// SESSION_ID is reassigned in `beforeEach` (see Task #1081) so each test
// gets a unique React Query key. That prevents a previous test's stale
// in-flight fetch from polluting this test's cache after `clear()`.
let SESSION_ID = 'session-test-1047-init';
const IN_FLIGHT_ITEM_ID = 'item-in-flight';
const IDLE_ITEM_ID = 'item-idle';

type ScenarioStep = 'linking' | 'branching';
let scenarioStep: ScenarioStep = 'linking';

/**
 * Build a polled `/sessions/:id/lite` payload where ONE of the two
 * items is reported in `runAll[step].inFlight`. The mutation isn't
 * pending here — the response we mock for the per-item POST is a fast
 * snapshot (Task #1047) — so the page can only know the row is still
 * being processed by reading `inFlight`.
 */
function buildSessionPayload() {
  const cfg =
    scenarioStep === 'branching'
      ? {
          currentStep: 'branching' as const,
          itemStatus: 'sorted' as const,
          fallbackKey: 'branchingFallback' as const,
          branch: 'building_documents' as const,
          runAllKey: 'branching' as const,
        }
      : {
          currentStep: 'linking' as const,
          itemStatus: 'identified' as const,
          fallbackKey: 'linkingFallback' as const,
          branch: null,
          runAllKey: 'linking' as const,
        };

  const baseItem = {
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
    branch: null,
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
    linkingConfidence: null,
    linkingFallback: null,
    linkingReason: null,
    linkingBeforeItemId: null,
    linkingAfterItemId: null,
  };

  const items = [
    { id: IN_FLIGHT_ITEM_ID, originalName: 'in-flight.pdf' },
    { id: IDLE_ITEM_ID, originalName: 'idle.pdf' },
  ].map((it) => ({
    ...baseItem,
    ...it,
    status: cfg.itemStatus,
    branch: cfg.branch,
    [cfg.fallbackKey]: 'extraction_failed',
  }));

  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: cfg.currentStep,
      status: 'active' as const,
      progress: {
        runAll: {
          [cfg.runAllKey]: {
            total: items.length,
            processed: items.length,
            failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            // The run-all loop has finished — only the per-item retry
            // is still in flight. `finishedAt` is what makes
            // `stillEligible && !!progress.finishedAt` flip the retry
            // button on for the idle row, so both rows render the
            // button in the first place.
            finishedAt: '2024-01-01T00:01:00.000Z',
            // The Task #1047 signal: the per-item retry handler pushed
            // an entry here when the admin clicked Retry, and the
            // background AI call hasn't cleared it yet.
            inFlight: [
              {
                itemId: IN_FLIGHT_ITEM_ID,
                originalName: 'in-flight.pdf',
                startedAt: '2024-01-01T00:02:00.000Z',
              },
            ],
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items,
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
      if (pathname === '/api/admin/bulk-import/buildings-lite')
        return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status')
        return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(buildSessionPayload());
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
    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  // Cancel any stragglers from the previous test BEFORE reassigning the
  // session id and clearing the cache (Task #1081 — see
  // tests/helpers/queryClientIsolation.ts for the full rationale).
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-1047');

  scenarioStep = 'linking';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(() => {
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

function hasSpinner(button: HTMLElement): boolean {
  return !!button.querySelector('.animate-spin');
}

describe('BulkDocumentImportPage — polled retry spinner persists for in-flight items (Task #1047)', () => {
  it('flat list view: row in `runAll.linking.inFlight` keeps its spinner; sibling row stays clickable', async () => {
    scenarioStep = 'linking';
    renderPage();

    const inFlightBtn = await screen.findByTestId(
      `button-retry-linking-${IN_FLIGHT_ITEM_ID}`,
      undefined,
      { timeout: 4000 },
    );
    const idleBtn = await screen.findByTestId(
      `button-retry-linking-${IDLE_ITEM_ID}`,
    );

    // The polled `inFlight` array should keep this row's button
    // disabled and spinning even though no React Query mutation is
    // pending (Task #1047).
    expect(inFlightBtn).toBeDisabled();
    expect(hasSpinner(inFlightBtn)).toBe(true);

    // The sibling row is NOT in `inFlight`, so its button must be
    // free for a new retry click.
    expect(idleBtn).toBeEnabled();
    expect(hasSpinner(idleBtn)).toBe(false);

    // Task #1225: rows without a manual override or exclusion carry the
    // plain "Retry" aria-label and no warning title attribute.
    expect(idleBtn.getAttribute('aria-label')).toBe('Retry');
    expect(idleBtn.getAttribute('title')).toBeNull();
  });

  it('grouped branching view: row in `runAll.branching.inFlight` keeps its spinner; sibling row stays clickable', async () => {
    scenarioStep = 'branching';
    renderPage();

    const inFlightBtn = await screen.findByTestId(
      `button-retry-branching-${IN_FLIGHT_ITEM_ID}`,
      undefined,
      { timeout: 4000 },
    );
    const idleBtn = await screen.findByTestId(
      `button-retry-branching-${IDLE_ITEM_ID}`,
    );

    // Sanity: both buttons must live inside the same grouped
    // section, i.e. the branching section render path on
    // `bulk-document-import.tsx` line ~3161.
    const section = await screen.findByTestId(
      'branching-section-building_documents',
    );
    expect(
      section.querySelector(
        `[data-testid="button-retry-branching-${IN_FLIGHT_ITEM_ID}"]`,
      ),
    ).not.toBeNull();
    expect(
      section.querySelector(
        `[data-testid="button-retry-branching-${IDLE_ITEM_ID}"]`,
      ),
    ).not.toBeNull();

    expect(inFlightBtn).toBeDisabled();
    expect(hasSpinner(inFlightBtn)).toBe(true);

    expect(idleBtn).toBeEnabled();
    expect(hasSpinner(idleBtn)).toBe(false);

    // Task #1225: rows without a manual override or exclusion carry the
    // plain "Retry" aria-label and no warning title attribute.
    expect(idleBtn.getAttribute('aria-label')).toBe('Retry');
    expect(idleBtn.getAttribute('title')).toBeNull();
  });
});
