/**
 * Task #1199 / Task #1225 — Inline Retry surfaces on every bulk-import row.
 *
 * Background
 * ----------
 * Task #1194 simplified the inline Retry button on the Bulk Document
 * Import wizard so it appears on every non-excluded row that has a
 * retry action. Task #1225 removed the remaining gates: Retry now
 * appears on excluded rows, rows with manual overrides, and rows that
 * already succeeded — with a warning title/aria-label when the admin's
 * manual choice could be overwritten.
 *
 * Coverage
 * --------
 * The page has three usage sites for the inline Retry button (see
 * `bulk-document-import.tsx`):
 *
 *   1. Branching grouped section (~line 4619)
 *      no longer gated on `!item.branchManualOverride` (Task #1225)
 *   2. Identification / Linking flat list (~line 6306)
 *      no longer gated on `identificationEffectiveDateManualOverride` (Task #1225)
 *   3. Sorting flat list (~line 6785)
 *      no longer gated on `!item.sortingManualOverride` (Task #1225)
 *
 * For each site we assert:
 *   - A vanilla succeeded row (no fallback, no override, not in
 *     pre-status) renders `button-retry-{step}-{itemId}`.
 *   - An excluded row (`status: 'rejected'`) now DOES render the
 *     inline Retry button on every AI auto-step (Task #1225 reversed
 *     the Task #804 visibility filter for AI steps) and the button
 *     carries the "this row will stay excluded" warning aria-label.
 *   - A row with a manual-override flag DOES render the inline Retry
 *     button (Task #1225 flip), and the button carries a warning
 *     title / aria-label.
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
    // section (line ~4619 — `section.items.map`).
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
  // the page reliably has at least one row to render and so there is
  // always a clear anchor for waitForRow in multi-row scenarios.
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
 * Wait until the page has settled past its initial loading state by
 * confirming at least one item-row is rendered. Used as a lighter
 * anchor when the specific row under test may not be the first to
 * appear.
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

describe('BulkDocumentImportPage — inline Retry on succeeded rows (Task #1199 / Task #1225)', () => {
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

      // The grouped iteration site (~line 4619) lives inside
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

  describe('excluded row DOES render the inline Retry button (Task #1225 reversed Task #804 for AI steps)', () => {
    it('linking flat-list: excluded row (status="rejected") shows Retry with "will stay excluded" warning', async () => {
      scenarioStep = 'linking';
      scenarioVariant = 'excluded';

      renderPage();
      // The sibling success row anchors the page render. Task #1225
      // reversed the Task #804 `visibleItems` filter for AI auto-steps,
      // so the excluded row IS now rendered and its Retry button carries
      // the "this row will stay excluded" warning aria-label.
      await waitForRow(SUCCESS_ID);

      const excludedRetry = await screen.findByTestId(
        `button-retry-linking-${EXCLUDED_ID}`,
      );
      expect(excludedRetry).toBeInTheDocument();
      expect(excludedRetry).toBeEnabled();
      expect(excludedRetry.getAttribute('aria-label')).toBe(
        'Re-run AI — this row will stay excluded',
      );
      expect(excludedRetry.getAttribute('title')).toBe(
        'Re-run AI — this row will stay excluded',
      );
    });

    it('branching grouped section: excluded row (status="rejected") shows Retry with "will stay excluded" warning', async () => {
      scenarioStep = 'branching';
      scenarioVariant = 'excluded';

      renderPage();
      await waitForRow(SUCCESS_ID);

      const section = await screen.findByTestId(
        'branching-section-building_documents',
      );
      const excludedRetry = section.querySelector(
        `[data-testid="button-retry-branching-${EXCLUDED_ID}"]`,
      ) as HTMLButtonElement | null;
      expect(excludedRetry).not.toBeNull();
      expect(excludedRetry!).toBeEnabled();
      expect(excludedRetry!.getAttribute('aria-label')).toBe(
        'Re-run AI — this row will stay excluded',
      );
      expect(excludedRetry!.getAttribute('title')).toBe(
        'Re-run AI — this row will stay excluded',
      );
    });
  });

  describe('manual-override row DOES render the inline Retry button (Task #1225)', () => {
    it('branching grouped section: branchManualOverride row shows Retry with warning aria-label', async () => {
      scenarioStep = 'branching';
      scenarioVariant = 'override';

      renderPage();
      await waitForRow(OVERRIDE_ID);
      await waitForRow(SUCCESS_ID);

      const section = await screen.findByTestId(
        'branching-section-building_documents',
      );

      // Sibling without override should also have Retry (plain label).
      const siblingRetry = section.querySelector(
        `[data-testid="button-retry-branching-${SUCCESS_ID}"]`,
      ) as HTMLButtonElement | null;
      expect(siblingRetry).not.toBeNull();
      expect(siblingRetry!.getAttribute('aria-label')).toBe('Retry');

      // Override row must now also show Retry — with the warning label.
      const overrideRetry = section.querySelector(
        `[data-testid="button-retry-branching-${OVERRIDE_ID}"]`,
      ) as HTMLButtonElement | null;
      expect(overrideRetry).not.toBeNull();
      expect(overrideRetry!).toBeEnabled();
      expect(overrideRetry!.getAttribute('aria-label')).toBe(
        'Re-run AI — this may overwrite your manual choice',
      );
      expect(overrideRetry!.getAttribute('title')).toBe(
        'Re-run AI — this may overwrite your manual choice',
      );
    });

    it('identification flat-list: identificationEffectiveDateManualOverride row shows Retry with warning aria-label', async () => {
      scenarioStep = 'identification';
      scenarioVariant = 'override';

      renderPage();
      await waitForRow(OVERRIDE_ID);
      await waitForRow(SUCCESS_ID);

      // Sibling without override shows Retry with the plain label …
      const siblingRetry = screen.getByTestId(
        `button-retry-identification-${SUCCESS_ID}`,
      );
      expect(siblingRetry).toBeInTheDocument();
      expect(siblingRetry.getAttribute('aria-label')).toBe('Retry');

      // … and the override row is now also visible (Task #1225 flip).
      const overrideRetry = screen.getByTestId(
        `button-retry-identification-${OVERRIDE_ID}`,
      );
      expect(overrideRetry).toBeInTheDocument();
      expect(overrideRetry).toBeEnabled();
      expect(overrideRetry.getAttribute('aria-label')).toBe(
        'Re-run AI — this may overwrite your manual choice',
      );
      expect(overrideRetry.getAttribute('title')).toBe(
        'Re-run AI — this may overwrite your manual choice',
      );
    });

    it('sorting flat-list: sortingManualOverride row shows Retry with warning aria-label', async () => {
      scenarioStep = 'sorting';
      scenarioVariant = 'override';

      renderPage();
      await waitForRow(OVERRIDE_ID);
      await waitForRow(SUCCESS_ID);

      const siblingRetry = screen.getByTestId(
        `button-retry-sorting-${SUCCESS_ID}`,
      );
      expect(siblingRetry).toBeInTheDocument();
      expect(siblingRetry.getAttribute('aria-label')).toBe('Retry');

      const overrideRetry = screen.getByTestId(
        `button-retry-sorting-${OVERRIDE_ID}`,
      );
      expect(overrideRetry).toBeInTheDocument();
      expect(overrideRetry).toBeEnabled();
      expect(overrideRetry.getAttribute('aria-label')).toBe(
        'Re-run AI — this may overwrite your manual choice',
      );
      expect(overrideRetry.getAttribute('title')).toBe(
        'Re-run AI — this may overwrite your manual choice',
      );
    });
  });
});
