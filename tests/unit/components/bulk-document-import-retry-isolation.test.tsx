/**
 * Task #904 — Per-row Retry button isolation on the Bulk Document Import page.
 *
 * Each item row in `client/src/pages/admin/bulk-document-import.tsx` renders
 * its own Retry button. Both render paths — the grouped branching section
 * (line ~2849, inside `section.items.map`) and the flat list (line ~3425,
 * inside `visibleItems.map`) — gate the spinner / disabled state on the
 * per-row predicate
 *
 *   `runStep.isPending && runStep.variables?.itemId === item.id`
 *
 * If a future refactor drops the `variables.itemId === item.id` guard,
 * every Retry button on the page would spin and disable simultaneously
 * while a single retry is in flight. This regression was previously fixed
 * by hand and verified manually only.
 *
 * The suite mounts the real page with two sibling rows for each render
 * path, freezes the run-step mutation in flight by returning a
 * never-resolving Promise from the mocked fetch for
 * `/api/admin/bulk-import/items/:id/:action`, clicks one row's Retry
 * button, and asserts only that row spins / disables.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
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

const SESSION_ID = 'session-test-904';
const ITEM_A_ID = 'item-aaa';
const ITEM_B_ID = 'item-bbb';

type ScenarioStep = 'linking' | 'branching';
let scenarioStep: ScenarioStep = 'linking';

function buildSessionPayload() {
  // Per-step config picked at request time so the same fetch responder
  // serves both flat-list (linking) and grouped (branching) scenarios.
  // `STEP_PRE_STATUS.linking === 'identified'` and
  // `STEP_PRE_STATUS.branching === 'sorted'` are the statuses that make
  // `stillEligible` true; we also set the step's `*Fallback` so the
  // retry button surfaces unconditionally via the `fallbackReason`
  // branch of `showRetry`.
  const cfg =
    scenarioStep === 'branching'
      ? {
          currentStep: 'branching' as const,
          itemStatus: 'sorted' as const,
          fallbackKey: 'branchingFallback' as const,
          // Both items share a branch so they land in the SAME grouped
          // section — the iteration site at line ~2849.
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
    identificationEffectiveDate: null,
    linkingConfidence: null,
    linkingFallback: null,
    linkingReason: null,
    linkingBeforeItemId: null,
    linkingAfterItemId: null,
  };

  const items = [
    { id: ITEM_A_ID, originalName: 'doc-a.pdf' },
    { id: ITEM_B_ID, originalName: 'doc-b.pdf' },
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
            finishedAt: '2024-01-01T00:01:00.000Z',
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

// Pending POSTs to the per-item run-step endpoint stay unresolved so the
// React Query mutation stays in `isPending`. afterEach drains them.
const pendingResolvers: Array<(value: Response) => void> = [];

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

    if (method === 'POST') {
      const isPerItemRunStep =
        /^\/api\/admin\/bulk-import\/items\/[^/]+\/(screen|sort|branch|identify|link)$/.test(
          pathname,
        );
      if (isPerItemRunStep) {
        return new Promise<Response>((resolve) => {
          pendingResolvers.push(resolve);
        });
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  scenarioStep = 'linking';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
  pendingResolvers.length = 0;

  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
  queryClient.clear();
});

afterEach(async () => {
  // Drain pending run-step Promises so React Query + the mocked fetch
  // can settle before the QueryClient is cleared. Keeps the test from
  // logging an unhandled rejection on teardown.
  await act(async () => {
    while (pendingResolvers.length > 0) {
      const resolve = pendingResolvers.shift()!;
      resolve(jsonResponse({ ok: true }));
    }
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

async function waitForRetryButtons(step: 'linking' | 'branching') {
  await screen.findByTestId(`button-retry-${step}-${ITEM_A_ID}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`button-retry-${step}-${ITEM_B_ID}`);
}

/**
 * The Loader2 spinner from `lucide-react` renders as an SVG with the
 * `animate-spin` class. Probe by class name so the assertion does not
 * depend on the (mockable) icon implementation.
 */
function hasSpinner(button: HTMLElement): boolean {
  return !!button.querySelector('.animate-spin');
}

/**
 * Drive the click + assertion shared between the two coverage paths.
 * Uses `waitFor` so the React Query mutation has a window to flip
 * `isPending` to true and React has a window to flush the resulting
 * re-render before the disabled / spinner / sibling assertions run.
 */
async function assertRetryIsolation(step: 'linking' | 'branching') {
  const buttonA = screen.getByTestId(`button-retry-${step}-${ITEM_A_ID}`);
  const buttonB = screen.getByTestId(`button-retry-${step}-${ITEM_B_ID}`);

  // Pre-condition: nothing pending yet.
  expect(buttonA).toBeEnabled();
  expect(buttonB).toBeEnabled();
  expect(hasSpinner(buttonA)).toBe(false);
  expect(hasSpinner(buttonB)).toBe(false);

  await act(async () => {
    fireEvent.click(buttonA);
  });

  await waitFor(
    () => {
      const a = screen.getByTestId(`button-retry-${step}-${ITEM_A_ID}`);
      expect(a).toBeDisabled();
      expect(hasSpinner(a)).toBe(true);
    },
    { timeout: 2000 },
  );

  // Sibling row must remain enabled while A is pending — this is the
  // core regression guard for Task #904.
  const buttonBAfter = screen.getByTestId(`button-retry-${step}-${ITEM_B_ID}`);
  expect(buttonBAfter).toBeEnabled();
  expect(hasSpinner(buttonBAfter)).toBe(false);

  // Belt-and-suspenders: only the clicked row should have issued a POST
  // to the per-item run-step endpoint. If the disabled state were
  // shared, callers might still bind only one click — but a future
  // refactor that fans the click out would fail this guard too.
  const itemBPostCalls = fetchMock.mock.calls.filter(([input, init]) => {
    const u =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return (
      (init?.method || 'GET').toUpperCase() === 'POST' &&
      u.startsWith(`/api/admin/bulk-import/items/${ITEM_B_ID}/`)
    );
  });
  expect(itemBPostCalls).toHaveLength(0);
}

describe('BulkDocumentImportPage — per-row Retry isolation (Task #904)', () => {
  describe('flat list view (currentStep = "linking", line ~3425)', () => {
    beforeEach(() => {
      scenarioStep = 'linking';
    });

    it('only the clicked row spins / is disabled; siblings remain enabled', async () => {
      renderPage();
      await waitForRetryButtons('linking');
      await assertRetryIsolation('linking');
    });
  });

  describe('grouped branching view (currentStep = "branching", line ~2849)', () => {
    beforeEach(() => {
      scenarioStep = 'branching';
    });

    it('only the clicked row spins / is disabled; siblings remain enabled', async () => {
      renderPage();
      await waitForRetryButtons('branching');
      // Sanity guard: both items must be in the SAME grouped section,
      // i.e. the JSX path that owns line ~2849 (`section.items.map`).
      const section = await screen.findByTestId(
        'branching-section-building_documents',
      );
      expect(
        section.querySelector(`[data-testid="button-retry-branching-${ITEM_A_ID}"]`),
      ).not.toBeNull();
      expect(
        section.querySelector(`[data-testid="button-retry-branching-${ITEM_B_ID}"]`),
      ).not.toBeNull();

      await assertRetryIsolation('branching');
    });
  });
});
