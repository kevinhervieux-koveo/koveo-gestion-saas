/**
 * Task #1199 — Inline Retry surfaces on succeeded bulk-import rows.
 *
 * Background
 * ----------
 * Task #1194 simplified the inline Retry button on the Bulk Document
 * Import wizard so it appears on every non-excluded row that has a
 * retry action — including rows that succeeded normally (no
 * `*Fallback`, no manual override, not in the step's pre-status). The
 * existing retry coverage (`bulk-document-import-retry-isolation`,
 * `bulk-document-import-polled-retry-spinner`,
 * `bulk-document-import-fallback-hint`) only exercises rows that have
 * a step-specific fallback set or rows in a stalled run-all state, so
 * a regression that re-introduced the old `fallbackReason || stalled`
 * gate would silently drop Retry from vanilla succeeded rows again.
 *
 * Coverage
 * --------
 * The page has three usage sites for the inline Retry button (see
 * `bulk-document-import.tsx`):
 *
 *   1. Branching grouped section (~line 4104)
 *      gate: `!item.branchManualOverride`
 *   2. Identification / Linking flat list (~line 5688)
 *      gate: `!(currentStep === 'identification' && item.identificationEffectiveDateManualOverride)`
 *   3. Sorting flat list (~line 6101)
 *      gate: `!item.sortingManualOverride`
 *
 * For each site we assert:
 *   - A vanilla succeeded row (no fallback, no override, not in
 *     pre-status) renders `button-retry-{step}-{itemId}`.
 *   - An excluded row (`status: 'rejected'`) does NOT render the
 *     inline Retry button on that step.
 *   - A row with the relevant manual-override flag does NOT render
 *     the inline Retry button on that step.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
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
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// -----------------------------------------------------------------------------
// Fixture state
// -----------------------------------------------------------------------------

let SESSION_ID = 'session-test-1199-init';
const SUCCESS_ID = 'item-success';
const EXCLUDED_ID = 'item-excluded';
const OVERRIDE_ID = 'item-override';

type ScenarioStep = 'linking' | 'branching' | 'identification' | 'sorting';
type ScenarioVariant = 'success' | 'excluded' | 'override';

let scenarioStep: ScenarioStep = 'linking';
let scenarioVariant: ScenarioVariant = 'success';

// Per-step tuning so the same fetch responder serves every scenario.
//
// `successStatus` is the status a row carries AFTER the AI step
// completed normally — chosen so it is NOT the step's pre-status (the
// status that means "the AI hasn't run on this row yet"). Pre-statuses
// per `STEP_PRE_STATUS` in
// `client/src/pages/admin/bulk-import-next-step-block.tsx`:
//   linking         → 'identified'
//   branching       → 'sorted'
//   identification  → 'branched'
//   sorting         → 'screened'
const STEP_CONFIG: Record<
  ScenarioStep,
  {
    successStatus:
      | 'screened'
      | 'sorted'
      | 'branched'
      | 'identified'
      | 'linked';
    branch: 'building_documents' | null;
    overrideField:
      | 'branchManualOverride'
      | 'identificationEffectiveDateManualOverride'
      | 'sortingManualOverride';
  }
> = {
  linking: {
    successStatus: 'linked',
    branch: null,
    // Linking has no manual-override gate at the usage site, so we
    // never run the override variant for it.
    overrideField: 'branchManualOverride',
  },
  branching: {
    successStatus: 'branched',
    // Items must share a branch so they land in the SAME grouped
    // section (line ~4104 — `section.items.map`).
    branch: 'building_documents',
    overrideField: 'branchManualOverride',
  },
  identification: {
    successStatus: 'identified',
    branch: null,
    overrideField: 'identificationEffectiveDateManualOverride',
  },
  sorting: {
    successStatus: 'sorted',
    branch: null,
    overrideField: 'sortingManualOverride',
  },
};

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
  const cfg = STEP_CONFIG[scenarioStep];

  // Every scenario also includes a sibling vanilla-succeeded row so
  // the page reliably has at least one row to render even when the
  // primary fixture row is filtered out (e.g. the excluded variant on
  // a non-screening step is dropped from `visibleItems`).
  const siblingItem = {
    ...baseItemDefaults,
    id: SUCCESS_ID,
    originalName: 'doc-success.pdf',
    status: cfg.successStatus,
    branch: cfg.branch,
  };

  let primaryItem: typeof siblingItem;
  if (scenarioVariant === 'success') {
    // The primary row IS the vanilla success row — drop the duplicate
    // sibling by reusing the same id below.
    primaryItem = siblingItem;
  } else if (scenarioVariant === 'excluded') {
    primaryItem = {
      ...baseItemDefaults,
      id: EXCLUDED_ID,
      originalName: 'doc-excluded.pdf',
      status: 'rejected' as const,
      branch: cfg.branch,
    };
  } else {
    primaryItem = {
      ...baseItemDefaults,
      id: OVERRIDE_ID,
      originalName: 'doc-override.pdf',
      status: cfg.successStatus,
      branch: cfg.branch,
      [cfg.overrideField]: true,
    };
  }

  const items =
    scenarioVariant === 'success'
      ? [primaryItem]
      : [primaryItem, siblingItem];

  // Mark the run-all loop as finished so the auto-run effect doesn't
  // start spinning the row and so the polled-retry-spinner branch
  // (`runAll[step].inFlight`) stays empty.
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: scenarioStep,
      status: 'active' as const,
      progress: {
        runAll: {
          [scenarioStep]: {
            total: items.length,
            processed: items.length,
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

    // The auto-run effect fires `POST /sessions/:id/run-all` on mount
    // and the page may issue a few other POSTs in passing. Resolving
    // them with `{ ok: true }` is enough for the assertions here —
    // we never click a button in this suite.
    if (method === 'POST') {
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  // See tests/helpers/queryClientIsolation.ts (Task #1081) — cancel
  // any stragglers from the previous test BEFORE reassigning the
  // session id and clearing the cache.
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-1199');

  scenarioStep = 'linking';
  scenarioVariant = 'success';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(async () => {
  // Drain any pending microtasks so React Query / fetch settle before
  // teardown — keeps the test from logging an unhandled rejection on
  // the next test's `clear()`.
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

/**
 * Wait until the page has rendered the row whose id is supplied.
 * Non-linking steps use `item-row-${id}`; the linking step uses
 * `linking-row-${id}` (Task #1233). We try the legacy testid first
 * (fast path for other steps) then fall back to the linking testid.
 */
async function waitForRow(id: string) {
  await waitFor(
    () => {
      const el =
        document.querySelector(`[data-testid="item-row-${id}"]`) ??
        document.querySelector(`[data-testid="linking-row-${id}"]`);
      expect(el).not.toBeNull();
    },
    { timeout: 4000 },
  );
}

/**
 * Wait until the page has settled past its initial loading state.
 * Used for scenarios where the row of interest is filtered out of
 * `visibleItems` (e.g. excluded rows on non-screening steps) — we
 * still need a render anchor so the assertions don't fire before the
 * lite payload is processed.
 */
async function waitForAnyRow() {
  await waitFor(
    () => {
      const found =
        document.querySelector('[data-testid^="item-row-"]') ??
        document.querySelector('[data-testid^="linking-row-"]');
      expect(found).not.toBeNull();
    },
    { timeout: 4000 },
  );
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — inline Retry on succeeded rows (Task #1199)', () => {
  describe('vanilla succeeded row renders the inline Retry button', () => {
    it('linking flat-list: succeeded row (status="linked", no fallback, no override) shows Retry', async () => {
      scenarioStep = 'linking';
      scenarioVariant = 'success';

      renderPage();
      await waitForRow(SUCCESS_ID);

      const retry = await screen.findByTestId(
        `button-retry-linking-${SUCCESS_ID}`,
      );
      expect(retry).toBeInTheDocument();
      expect(retry).toBeEnabled();
    });

    it('branching grouped section: succeeded row (status="branched", no fallback, no override) shows Retry', async () => {
      scenarioStep = 'branching';
      scenarioVariant = 'success';

      renderPage();
      await waitForRow(SUCCESS_ID);

      // The grouped iteration site (line ~4104) lives inside
      // `branching-section-${branch}`. Confirm the button is rendered
      // by that path so a future refactor that moves the branching
      // view back into the flat list fails this assertion explicitly.
      const section = await screen.findByTestId(
        'branching-section-building_documents',
      );
      const retry = section.querySelector(
        `[data-testid="button-retry-branching-${SUCCESS_ID}"]`,
      );
      expect(retry).not.toBeNull();
      expect(retry as HTMLButtonElement).toBeEnabled();
    });
  });

  describe('excluded row does NOT render the inline Retry button', () => {
    it('linking flat-list: excluded row (status="rejected") has no inline Retry', async () => {
      scenarioStep = 'linking';
      scenarioVariant = 'excluded';

      renderPage();
      // The sibling success row anchors the page render. The excluded
      // row itself is dropped from `visibleItems` on every non-
      // screening step (Task #804), which is exactly the contract we
      // want to lock in: regardless of WHERE the guard sits — at the
      // visibility filter or at the per-row `!isExcluded` check in
      // `showRetry` — Retry must not surface on a rejected row.
      await waitForRow(SUCCESS_ID);

      expect(
        screen.queryByTestId(`button-retry-linking-${EXCLUDED_ID}`),
      ).not.toBeInTheDocument();
    });

    it('branching grouped section: excluded row (status="rejected") has no inline Retry', async () => {
      scenarioStep = 'branching';
      scenarioVariant = 'excluded';

      renderPage();
      await waitForRow(SUCCESS_ID);

      expect(
        screen.queryByTestId(`button-retry-branching-${EXCLUDED_ID}`),
      ).not.toBeInTheDocument();
    });
  });

  describe('manual-override row does NOT render the inline Retry button', () => {
    it('branching grouped section: branchManualOverride hides Retry on that row', async () => {
      scenarioStep = 'branching';
      scenarioVariant = 'override';

      renderPage();
      // Both rows must render so the assertion is meaningful: the
      // sibling without override proves the page did reach the
      // grouped retry render path; the primary row proves the gate
      // hides Retry only on the manual-override row.
      await waitForRow(OVERRIDE_ID);
      await waitForRow(SUCCESS_ID);

      const section = await screen.findByTestId(
        'branching-section-building_documents',
      );
      expect(
        section.querySelector(
          `[data-testid="button-retry-branching-${SUCCESS_ID}"]`,
        ),
      ).not.toBeNull();
      expect(
        section.querySelector(
          `[data-testid="button-retry-branching-${OVERRIDE_ID}"]`,
        ),
      ).toBeNull();
    });

    it('identification flat-list: identificationEffectiveDateManualOverride hides Retry on that row', async () => {
      scenarioStep = 'identification';
      scenarioVariant = 'override';

      renderPage();
      await waitForRow(OVERRIDE_ID);
      await waitForRow(SUCCESS_ID);

      // Sibling without override proves the identification flat list
      // reached the retry render path …
      expect(
        screen.getByTestId(`button-retry-identification-${SUCCESS_ID}`),
      ).toBeInTheDocument();
      // … and the override row is the only one whose Retry button is
      // hidden by the `identificationEffectiveDateManualOverride`
      // gate at line ~5688.
      expect(
        screen.queryByTestId(`button-retry-identification-${OVERRIDE_ID}`),
      ).not.toBeInTheDocument();
    });

    it('sorting flat-list: sortingManualOverride hides Retry on that row', async () => {
      scenarioStep = 'sorting';
      scenarioVariant = 'override';

      renderPage();
      await waitForRow(OVERRIDE_ID);
      await waitForRow(SUCCESS_ID);

      expect(
        screen.getByTestId(`button-retry-sorting-${SUCCESS_ID}`),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId(`button-retry-sorting-${OVERRIDE_ID}`),
      ).not.toBeInTheDocument();
    });
  });
});
