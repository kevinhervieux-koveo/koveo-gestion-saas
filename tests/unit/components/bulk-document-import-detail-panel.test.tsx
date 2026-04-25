/**
 * Task #783 — Bulk-document-import detail-panel visibility coverage.
 *
 * Task #771 added a per-row detail panel on the bulk-document-import
 * page (`client/src/pages/admin/bulk-document-import.tsx`) that is
 * gated by `hasQuickAnalysisSignal(item)`. The chevron toggle button
 * (`button-toggle-detail-{id}`) and the panel itself
 * (`item-detail-panel-{id}`) only appear when the item has at least
 * one quickAnalysis guess (`screeningTypeGuess` or
 * `screeningBucketGuess`) that is set and not the literal
 * `"unknown"`. Items with no AI signal stay in the compact layout
 * with neither the chevron nor the panel.
 *
 * Without an automated test pinning that behaviour the gate could
 * silently regress — for example, an innocent edit that always
 * renders the chevron would still pass the existing
 * preview-trigger and confidence-badge suites. This file mounts the
 * real BulkDocumentImportPage with three fixture items (one with a
 * type guess, one with both guesses null, one with both guesses set
 * to `"unknown"`) and asserts that:
 *
 *   1. `button-toggle-detail-{id}` is ABSENT for items with no
 *      quickAnalysis signal (null/null and unknown/unknown).
 *   2. `item-detail-panel-{id}` is ABSENT for those same items even
 *      after attempts to interact with the row.
 *   3. The button IS present for items with a real type or bucket
 *      guess and toggling it shows then hides
 *      `item-detail-panel-{id}`.
 *   4. The open panel surfaces the labelled "Confidence: NN%" pill
 *      (Task #771) so the screening-confidence percentage stays
 *      reachable from the detail panel.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
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

// The active language is read from this mutable variable so individual
// tests can switch between English and French without re-mocking the
// module. Reset to 'en' in beforeEach so legacy tests stay deterministic.
let currentLanguage: 'en' | 'fr' = 'en';

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    get language() {
      return currentLanguage;
    },
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: { title: string }) => (
    <div data-testid="mock-header">{title}</div>
  ),
}));

// Stub the inline viewer so accidental row clicks don't pull in the
// real Dialog tree. The detail panel toggle lives on a separate
// button so the popup should never open in this suite, but defending
// against it keeps assertion failures readable.
jest.mock('@/components/common/DocumentInlineViewer', () => ({
  DocumentInlineViewer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mock-inline-viewer" /> : null,
}));

// -----------------------------------------------------------------------------
// Imports under test (after jest.mock setup).
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-783';

const ITEM_WITH_TYPE_ID = 'item-has-type-guess';
const ITEM_NULL_GUESSES_ID = 'item-null-guesses';
const ITEM_UNKNOWN_GUESSES_ID = 'item-unknown-guesses';

const ITEM_WITH_TYPE_NAME = 'invoice-march.pdf';
const ITEM_NULL_GUESSES_NAME = 'mystery-attachment.bin';
const ITEM_UNKNOWN_GUESSES_NAME = 'old-session-file.pdf';

interface ItemFixture {
  id: string;
  originalName: string;
  status: 'screened' | 'screening' | 'sorted' | 'branched' | 'rejected';
  /** Optional — null by default (not admin-excluded). */
  preExcludeStatus?: string | null;
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
  screeningConfidence: number | null;
  screeningQaReason: string | null;
  /** Optional screening fallback reason — used by Task #853 tests. */
  screeningFallback?: string | null;
  /** Optional sorting fields — used by Task #853 tests. */
  sortingConfidence?: number | null;
  sortingFallback?: string | null;
  sortingDecision?: 'keep' | 'merge' | 'split' | null;
  sortingReason?: string | null;
  sortingDecisionState?: 'pending' | 'accepted' | 'rejected' | null;
  /**
   * Optional — used by Task #901 regression tests. When set, mimics a file
   * that was previously the lead of a split (so the field is populated in the
   * DB) but was subsequently excluded by the admin. The filter must honour
   * preExcludeStatus and hide such items.
   */
  sortingDecisionSplitIntoItemIds?: string[] | null;
  /**
   * Optional — used by Task #1055 to seed AI-suggested split pages on
   * rejected Branching items so the read-only suggestion card can render
   * "Split after page N".
   */
  sortingSplitAtPage?: number | null;
  /**
   * Optional — used by Task #1055 to seed AI-suggested merge groups on
   * rejected Branching items. When set, computeMergeGroup will resolve the
   * sibling filenames so the read-only suggestion card can render
   * "Merge with: <file names>".
   */
  sortingMergeWithItemIds?: string[] | null;
  /**
   * Optional — used by Task #1055. The AI-suggestion card is gated on
   * !sortingDecisionDraft so the card only renders while sortingDecision
   * still reflects the AI's original guess (not an auto-saved manual draft).
   * Defaults to false in the payload so existing fixtures stay unchanged.
   */
  sortingDecisionDraft?: boolean;
}

let items: ItemFixture[] = [];
// The current wizard step the mock session is sitting on. Defaults to
// `screening` so the original Task #783 suite still exercises the
// screening-row detail panel; Task #853 tests override this to
// `sorting` to exercise the sorting/branching detail panel.
let currentStep: 'screening' | 'sorting' = 'screening';

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep,
      status: 'active' as const,
      // Mark the relevant auto-run as finished so the page does not
      // attempt to launch additional run-step mutations during the
      // test and the rows render in their stable, post-AI shape.
      progress: {
        runAll: {
          [currentStep]: {
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
    items: items.map((it) => ({
      id: it.id,
      originalName: it.originalName,
      mimeType: 'application/pdf',
      status: it.status,
      preExcludeStatus: it.preExcludeStatus ?? null,
      screeningConfidence: it.screeningConfidence,
      screeningFallback: it.screeningFallback ?? null,
      screeningTypeGuess: it.screeningTypeGuess,
      screeningBucketGuess: it.screeningBucketGuess,
      screeningQaReason: it.screeningQaReason,
      sortingConfidence: it.sortingConfidence ?? null,
      sortingFallback: it.sortingFallback ?? null,
      sortingDecision: it.sortingDecision ?? null,
      sortingReason: it.sortingReason ?? null,
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: it.sortingMergeWithItemIds ?? null,
      sortingSplitAtPage: it.sortingSplitAtPage ?? null,
      sortingDecisionState: it.sortingDecisionState ?? null,
      sortingManualOverride: false,
      sortingDecisionDraft: it.sortingDecisionDraft ?? false,
      sortingDecisionSplitIntoItemIds: it.sortingDecisionSplitIntoItemIds ?? null,
      branchingConfidence: null,
      branchingFallback: null,
      identificationConfidence: null,
      identificationFallback: null,
      linkingConfidence: null,
      linkingFallback: null,
    })),
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
    blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' }),
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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

  // Any incidental POST (e.g. a defensive run-step kick) just resolves —
  // the test is purely about render-state gating.
  if (method === 'POST') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ unmocked: true, url, method }, 404);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  currentLanguage = 'en';
  currentStep = 'screening';
  items = [
    {
      id: ITEM_WITH_TYPE_ID,
      originalName: ITEM_WITH_TYPE_NAME,
      status: 'screened',
      // Real type guess + null bucket guess → has signal.
      screeningTypeGuess: 'invoice',
      screeningBucketGuess: null,
      screeningConfidence: 0.83,
      screeningQaReason: 'Looks like an invoice header.',
    },
    {
      id: ITEM_NULL_GUESSES_ID,
      originalName: ITEM_NULL_GUESSES_NAME,
      status: 'screened',
      // Both null → NO signal (e.g. legacy session before Task #767).
      screeningTypeGuess: null,
      screeningBucketGuess: null,
      screeningConfidence: 0.42,
      screeningQaReason: null,
    },
    {
      id: ITEM_UNKNOWN_GUESSES_ID,
      originalName: ITEM_UNKNOWN_GUESSES_NAME,
      status: 'screened',
      // Both 'unknown' → NO signal (the placeholder the AI returns
      // when it has no opinion). hasQuickAnalysisSignal must treat
      // this exactly like null/null.
      screeningTypeGuess: 'unknown',
      screeningBucketGuess: 'unknown',
      screeningConfidence: 0.15,
      screeningQaReason: 'No usable text extracted.',
    },
  ];

  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);

  queryClient.clear();
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  mockToast.mockReset();
  queryClient.clear();
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function waitForRows() {
  // Wait for all three fixture rows to be in the DOM before any assertion.
  // Use the always-present preview trigger as the readiness signal; the
  // detail-toggle button is conditional and is the thing under test.
  await screen.findByTestId(`item-preview-trigger-${ITEM_WITH_TYPE_ID}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`item-preview-trigger-${ITEM_NULL_GUESSES_ID}`);
  await screen.findByTestId(`item-preview-trigger-${ITEM_UNKNOWN_GUESSES_ID}`);
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — detail panel visibility (Task #783)', () => {
  it('renders the chevron toggle ONLY for items with a quickAnalysis signal', async () => {
    renderPage();
    await waitForRows();

    // Has signal (real type guess) → chevron is present.
    expect(
      screen.getByTestId(`button-toggle-detail-${ITEM_WITH_TYPE_ID}`),
    ).toBeInTheDocument();

    // Both guesses null → chevron is hidden.
    expect(
      screen.queryByTestId(`button-toggle-detail-${ITEM_NULL_GUESSES_ID}`),
    ).not.toBeInTheDocument();

    // Both guesses 'unknown' → chevron is hidden.
    expect(
      screen.queryByTestId(`button-toggle-detail-${ITEM_UNKNOWN_GUESSES_ID}`),
    ).not.toBeInTheDocument();
  });

  it('keeps the detail panel hidden for items with no quickAnalysis signal', async () => {
    renderPage();
    await waitForRows();

    // Panels for the two no-signal items must be absent on initial render.
    expect(
      screen.queryByTestId(`item-detail-panel-${ITEM_NULL_GUESSES_ID}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`item-detail-panel-${ITEM_UNKNOWN_GUESSES_ID}`),
    ).not.toBeInTheDocument();

    // Clicking on the row body (preview trigger) must not somehow open
    // the detail panel — the panel is gated separately.
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`item-preview-trigger-${ITEM_NULL_GUESSES_ID}`),
      );
      fireEvent.click(
        screen.getByTestId(`item-preview-trigger-${ITEM_UNKNOWN_GUESSES_ID}`),
      );
    });

    expect(
      screen.queryByTestId(`item-detail-panel-${ITEM_NULL_GUESSES_ID}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`item-detail-panel-${ITEM_UNKNOWN_GUESSES_ID}`),
    ).not.toBeInTheDocument();
  });

  it('toggles the detail panel for items with a real guess and surfaces the labelled confidence', async () => {
    renderPage();
    await waitForRows();

    // Initially collapsed.
    expect(
      screen.queryByTestId(`item-detail-panel-${ITEM_WITH_TYPE_ID}`),
    ).not.toBeInTheDocument();

    const toggle = screen.getByTestId(`button-toggle-detail-${ITEM_WITH_TYPE_ID}`);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Open the panel.
    await act(async () => {
      fireEvent.click(toggle);
    });

    const panel = screen.getByTestId(`item-detail-panel-${ITEM_WITH_TYPE_ID}`);
    expect(panel).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // The labelled "Confidence: NN%" pill must be inside the open
    // panel (Task #771). screeningConfidence in the fixture is 0.83
    // so the rounded percentage is 83.
    const confidence = screen.getByTestId(`detail-confidence-${ITEM_WITH_TYPE_ID}`);
    expect(panel).toContainElement(confidence);
    expect(confidence).toHaveTextContent(/Confidence:\s*83%/);

    // Close it again — the panel must come back out of the DOM so a
    // collapsed state truly hides the AI guesses.
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(
      screen.queryByTestId(`item-detail-panel-${ITEM_WITH_TYPE_ID}`),
    ).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

// -----------------------------------------------------------------------------
// Task #853 — Friendly fallback explanation block in the detail panel.
//
// Task #852 introduced a per-step amber explanation block inside the
// expanded detail panel that translates the raw fallbackReason enum
// (e.g. `api_error`, `oversize`) into a friendly short label plus a
// one-sentence explanation. The block lives at:
//
//   - lines ~3372–3394 of bulk-document-import.tsx (sorting/branching
//     decision detail panel — gated by `currentStep === 'sorting'`)
//   - lines ~3442–3464 (screening / other-step detail panel — the
//     `else` branch of the same conditional)
//
// Without coverage, an innocent edit could silently regress the block
// back to the raw enum (or drop the explanation paragraph entirely).
// The cases below mount the real page on a session whose item carries
// a known fallback reason, expand the row's detail panel, and assert
// that:
//
//   1. The raw enum string (e.g. `api_error`) is NOT in the DOM.
//   2. The friendly short label IS rendered inside the
//      `detail-fallback-explanation-{id}` container.
//   3. The one-sentence explanation IS rendered inside the same
//      container.
//
// Both English and French label/explanation tables are covered for
// each step.
// -----------------------------------------------------------------------------

const SORTING_ITEM_ID = 'item-sorting-api-error';
const SORTING_ITEM_NAME = 'sorting-api-error.pdf';
const SCREENING_FALLBACK_ITEM_ID = 'item-screening-oversize';
const SCREENING_FALLBACK_ITEM_NAME = 'screening-oversize.pdf';

function setupSortingApiErrorItem() {
  currentStep = 'sorting';
  items = [
    {
      id: SORTING_ITEM_ID,
      originalName: SORTING_ITEM_NAME,
      // Status must not be 'rejected' — non-screening steps filter
      // those out. 'sorted' keeps the row visible and stable.
      status: 'sorted',
      // Screening guesses unused on the sorting detail panel but
      // populated so the row can't accidentally match the
      // hasQuickAnalysisSignal-only path.
      screeningTypeGuess: 'invoice',
      screeningBucketGuess: null,
      screeningConfidence: 0.7,
      screeningQaReason: null,
      // hasAnalysis on the sorting step requires sortingDecision != null.
      sortingDecision: 'keep',
      sortingDecisionState: 'accepted',
      sortingConfidence: 0.6,
      sortingFallback: 'api_error',
      sortingReason: 'AI returned an error mid-batch.',
    },
  ];
}

function setupScreeningOversizeItem() {
  currentStep = 'screening';
  items = [
    {
      id: SCREENING_FALLBACK_ITEM_ID,
      originalName: SCREENING_FALLBACK_ITEM_NAME,
      status: 'screened',
      // hasQuickAnalysisSignal needs at least one real guess so the
      // detail panel and chevron toggle are rendered for the row.
      screeningTypeGuess: 'invoice',
      screeningBucketGuess: null,
      screeningConfidence: 0.4,
      screeningQaReason: 'File too large for AI to analyze.',
      screeningFallback: 'oversize',
    },
  ];
}

async function expandPanel(itemId: string): Promise<HTMLElement> {
  const toggle = await screen.findByTestId(`button-toggle-detail-${itemId}`);
  await act(async () => {
    fireEvent.click(toggle);
  });
  return screen.getByTestId(`item-detail-panel-${itemId}`);
}

describe('BulkDocumentImportPage — fallback explanation in detail panel (Task #853)', () => {
  describe('sorting/branching step (api_error)', () => {
    it('shows the friendly English label and explanation, not the raw enum', async () => {
      setupSortingApiErrorItem();
      currentLanguage = 'en';

      renderPage();
      await screen.findByTestId(`item-preview-trigger-${SORTING_ITEM_ID}`, undefined, {
        timeout: 4000,
      });

      const panel = await expandPanel(SORTING_ITEM_ID);
      const explanation = screen.getByTestId(
        `detail-fallback-explanation-${SORTING_ITEM_ID}`,
      );
      expect(panel).toContainElement(explanation);

      // The raw enum must never bleed through into the UI.
      expect(explanation).not.toHaveTextContent('api_error');

      // Friendly short label.
      expect(explanation).toHaveTextContent('AI service error');

      // One-sentence explanation (stable substring chosen so a small
      // copy tweak doesn't break the assertion).
      expect(explanation).toHaveTextContent(
        /AI service returned an error/i,
      );
    });

    it('shows the friendly French label and explanation, not the raw enum', async () => {
      setupSortingApiErrorItem();
      currentLanguage = 'fr';

      renderPage();
      await screen.findByTestId(`item-preview-trigger-${SORTING_ITEM_ID}`, undefined, {
        timeout: 4000,
      });

      const panel = await expandPanel(SORTING_ITEM_ID);
      const explanation = screen.getByTestId(
        `detail-fallback-explanation-${SORTING_ITEM_ID}`,
      );
      expect(panel).toContainElement(explanation);

      expect(explanation).not.toHaveTextContent('api_error');
      expect(explanation).toHaveTextContent('Erreur du service IA');
      expect(explanation).toHaveTextContent(
        /le service IA a retourn\u00e9 une erreur/i,
      );
    });
  });

  describe('screening step (oversize)', () => {
    it('shows the friendly English label and explanation, not the raw enum', async () => {
      setupScreeningOversizeItem();
      currentLanguage = 'en';

      renderPage();
      await screen.findByTestId(
        `item-preview-trigger-${SCREENING_FALLBACK_ITEM_ID}`,
        undefined,
        { timeout: 4000 },
      );

      const panel = await expandPanel(SCREENING_FALLBACK_ITEM_ID);
      const explanation = screen.getByTestId(
        `detail-fallback-explanation-${SCREENING_FALLBACK_ITEM_ID}`,
      );
      expect(panel).toContainElement(explanation);

      expect(explanation).not.toHaveTextContent('oversize');
      expect(explanation).toHaveTextContent('File too large to analyze');
      expect(explanation).toHaveTextContent(
        /because it is too large/i,
      );
    });

    it('shows the friendly French label and explanation, not the raw enum', async () => {
      setupScreeningOversizeItem();
      currentLanguage = 'fr';

      renderPage();
      await screen.findByTestId(
        `item-preview-trigger-${SCREENING_FALLBACK_ITEM_ID}`,
        undefined,
        { timeout: 4000 },
      );

      const panel = await expandPanel(SCREENING_FALLBACK_ITEM_ID);
      const explanation = screen.getByTestId(
        `detail-fallback-explanation-${SCREENING_FALLBACK_ITEM_ID}`,
      );
      expect(panel).toContainElement(explanation);

      expect(explanation).not.toHaveTextContent('oversize');
      expect(explanation).toHaveTextContent(
        /Fichier trop volumineux pour l\u2019analyse/,
      );
      expect(explanation).toHaveTextContent(
        /car il est trop volumineux/i,
      );
    });
  });
});

// -----------------------------------------------------------------------------
// Task #901 — Excluded files must be hidden from the Branching step (internal
// step key `sorting`) even when `sortingDecisionSplitIntoItemIds` is populated.
//
// The regression: an admin-excluded item that previously had a split-decision
// recorded (so `sortingDecisionSplitIntoItemIds` is non-empty in the DB) was
// incorrectly kept visible because the filter exception only checked
// `!!sortingDecisionSplitIntoItemIds?.length` without also verifying that
// `preExcludeStatus == null` (i.e. the rejection is from the split action, not
// from the admin explicitly excluding the item). This test locks down the fixed
// behaviour: an excluded item (preExcludeStatus set) must NEVER appear in the
// Branching step flat list, regardless of its `sortingDecisionSplitIntoItemIds`
// value.
// -----------------------------------------------------------------------------

const SORTING_EXCLUDED_ID = 'item-sorting-excluded-with-split-history';
const SORTING_EXCLUDED_NAME = 'excluded-was-split.pdf';
const SORTING_NORMAL_ID = 'item-sorting-normal';
const SORTING_NORMAL_NAME = 'normal-sorted-file.pdf';

function setupExcludedAndNormalSortingItems() {
  currentStep = 'sorting';
  items = [
    {
      id: SORTING_EXCLUDED_ID,
      originalName: SORTING_EXCLUDED_NAME,
      // status='rejected' because the admin clicked "Exclude".
      // preExcludeStatus='sorted' proves it is admin-excluded, not a
      // draft-split lead (which would have preExcludeStatus=null).
      // sortingDecisionSplitIntoItemIds is non-empty because the item
      // previously had a split decision; without the Task #901 fix, the
      // filter exception would incorrectly keep this item visible.
      status: 'rejected' as const,
      preExcludeStatus: 'sorted',
      sortingDecisionSplitIntoItemIds: ['child-item-1', 'child-item-2'],
      screeningTypeGuess: 'invoice',
      screeningBucketGuess: null,
      screeningConfidence: 0.75,
      screeningQaReason: null,
      sortingDecision: 'split',
      sortingDecisionState: 'accepted',
    },
    {
      id: SORTING_NORMAL_ID,
      originalName: SORTING_NORMAL_NAME,
      status: 'sorted' as const,
      preExcludeStatus: null,
      sortingDecisionSplitIntoItemIds: null,
      screeningTypeGuess: 'contract',
      screeningBucketGuess: null,
      screeningConfidence: 0.9,
      screeningQaReason: null,
      sortingDecision: 'keep',
      sortingDecisionState: 'accepted',
    },
  ];
}

describe('BulkDocumentImportPage — excluded files hidden in Branching step (Task #901)', () => {
  it('hides an admin-excluded item that has sortingDecisionSplitIntoItemIds set', async () => {
    setupExcludedAndNormalSortingItems();

    renderPage();

    // Wait for the non-excluded item to appear — confirms the step rendered.
    await screen.findByTestId(`item-preview-trigger-${SORTING_NORMAL_ID}`, undefined, {
      timeout: 4000,
    });

    // The excluded item must be completely absent from the DOM — neither the
    // row wrapper nor the preview trigger should be rendered.
    expect(
      screen.queryByTestId(`item-row-${SORTING_EXCLUDED_ID}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`item-preview-trigger-${SORTING_EXCLUDED_ID}`),
    ).not.toBeInTheDocument();
  });

  it('keeps a genuine draft-split lead (preExcludeStatus null) visible in the Branching step', async () => {
    // A draft-split lead has status='rejected' because the SPLIT action
    // set it, but preExcludeStatus=null (not admin-excluded). It must
    // remain visible so the admin can adjust or revert the split.
    currentStep = 'sorting';
    items = [
      {
        id: SORTING_NORMAL_ID,
        originalName: SORTING_NORMAL_NAME,
        status: 'sorted' as const,
        preExcludeStatus: null,
        sortingDecisionSplitIntoItemIds: null,
        screeningTypeGuess: null,
        screeningBucketGuess: null,
        screeningConfidence: null,
        screeningQaReason: null,
        sortingDecision: 'keep',
        sortingDecisionState: 'accepted',
      },
      {
        id: SORTING_EXCLUDED_ID,
        originalName: SORTING_EXCLUDED_NAME,
        // Draft-split lead: rejected by the split action, NOT by admin.
        status: 'rejected' as const,
        preExcludeStatus: null,
        sortingDecisionSplitIntoItemIds: ['child-item-1'],
        screeningTypeGuess: null,
        screeningBucketGuess: null,
        screeningConfidence: null,
        screeningQaReason: null,
        sortingDecision: 'split',
        sortingDecisionState: 'accepted',
      },
    ];

    renderPage();

    // Both items should render — the draft-split lead is kept visible.
    await screen.findByTestId(`item-preview-trigger-${SORTING_NORMAL_ID}`, undefined, {
      timeout: 4000,
    });
    await screen.findByTestId(`item-preview-trigger-${SORTING_EXCLUDED_ID}`);
  });
});

// -----------------------------------------------------------------------------
// Task #1055 — Rejected Branching items must show the AI suggestion summary.
//
// Task #1034 added a read-only "AI suggestion: Split after page N" /
// "AI suggestion: Merge with: <names>" card to the Branching detail panel
// for items whose `sortingDecisionState === 'rejected'`. The card lives at
// `branching-ai-suggestion-${id}` and is gated by:
//
//   - sortingIsRejected (sortingDecisionState === 'rejected')
//   - !sortingDecisionDraft (the saved decision still reflects the AI's
//     guess, not an admin-side auto-saved draft)
//   - sortingDecision === 'split' || 'merge'
//
// The interactive `branching-slice-section-${id}` is suppressed for
// rejected items (`!sortingIsRejected` in showSliceSection) because the
// manual picker owns slice editing for rejected rows.
//
// Without this coverage a future refactor of `showSliceSection` /
// `showMergeSection` could silently regress the read-only card and admins
// would lose the AI context on rejected items.
// -----------------------------------------------------------------------------

const BRANCHING_REJECTED_SPLIT_ID = 'item-rejected-split-task-1055';
const BRANCHING_REJECTED_SPLIT_NAME = 'rejected-split-source.pdf';
const BRANCHING_REJECTED_MERGE_LEAD_ID = 'item-rejected-merge-lead-task-1055';
const BRANCHING_REJECTED_MERGE_LEAD_NAME = 'rejected-merge-lead.pdf';
const BRANCHING_MERGE_PARTNER_A_ID = 'item-merge-partner-a-task-1055';
const BRANCHING_MERGE_PARTNER_A_NAME = 'merge-partner-a.pdf';
const BRANCHING_MERGE_PARTNER_B_ID = 'item-merge-partner-b-task-1055';
const BRANCHING_MERGE_PARTNER_B_NAME = 'merge-partner-b.pdf';

const REJECTED_SPLIT_AT_PAGE = 7;

function setupRejectedBranchingItems() {
  currentStep = 'sorting';
  items = [
    // --- Rejected SPLIT item ---
    // Status is 'sorted' (not 'rejected') so the row is not filtered out
    // by the excluded-items filter. The AI suggested splitting after a
    // specific page; the admin rejected that suggestion. The read-only
    // card must surface "Split after page 7".
    {
      id: BRANCHING_REJECTED_SPLIT_ID,
      originalName: BRANCHING_REJECTED_SPLIT_NAME,
      status: 'sorted' as const,
      preExcludeStatus: null,
      screeningTypeGuess: 'invoice',
      screeningBucketGuess: null,
      screeningConfidence: 0.8,
      screeningQaReason: null,
      sortingDecision: 'split',
      sortingDecisionState: 'rejected',
      sortingDecisionDraft: false,
      sortingSplitAtPage: REJECTED_SPLIT_AT_PAGE,
    },
    // --- Rejected MERGE lead ---
    // The AI suggested merging this item with two siblings. The admin
    // rejected that suggestion. The read-only card must surface
    // "Merge with: <partner-a name>, <partner-b name>".
    {
      id: BRANCHING_REJECTED_MERGE_LEAD_ID,
      originalName: BRANCHING_REJECTED_MERGE_LEAD_NAME,
      status: 'sorted' as const,
      preExcludeStatus: null,
      screeningTypeGuess: 'contract',
      screeningBucketGuess: null,
      screeningConfidence: 0.7,
      screeningQaReason: null,
      sortingDecision: 'merge',
      sortingDecisionState: 'rejected',
      sortingDecisionDraft: false,
      sortingMergeWithItemIds: [
        BRANCHING_MERGE_PARTNER_A_ID,
        BRANCHING_MERGE_PARTNER_B_ID,
      ],
    },
    // --- Merge partners (siblings of the rejected merge lead) ---
    // These are referenced by sortingMergeWithItemIds above so
    // computeMergeGroup can resolve their filenames into the read-only
    // "Merge with: …" sentence. They themselves are accepted-keep rows
    // so they don't add noise to the assertions.
    {
      id: BRANCHING_MERGE_PARTNER_A_ID,
      originalName: BRANCHING_MERGE_PARTNER_A_NAME,
      status: 'sorted' as const,
      preExcludeStatus: null,
      screeningTypeGuess: 'contract',
      screeningBucketGuess: null,
      screeningConfidence: 0.65,
      screeningQaReason: null,
      sortingDecision: 'keep',
      sortingDecisionState: 'accepted',
    },
    {
      id: BRANCHING_MERGE_PARTNER_B_ID,
      originalName: BRANCHING_MERGE_PARTNER_B_NAME,
      status: 'sorted' as const,
      preExcludeStatus: null,
      screeningTypeGuess: 'contract',
      screeningBucketGuess: null,
      screeningConfidence: 0.55,
      screeningQaReason: null,
      sortingDecision: 'keep',
      sortingDecisionState: 'accepted',
    },
  ];
}

describe('BulkDocumentImportPage — rejected Branching AI suggestion card (Task #1055)', () => {
  it('renders the read-only AI suggestion card for both split and merge rejections, and suppresses the interactive slice section', async () => {
    setupRejectedBranchingItems();
    currentLanguage = 'en';

    renderPage();

    // Wait for the rejected-split row to appear — confirms the Branching
    // step rendered and the rejected-but-not-excluded items are visible.
    await screen.findByTestId(
      `item-preview-trigger-${BRANCHING_REJECTED_SPLIT_ID}`,
      undefined,
      { timeout: 4000 },
    );
    await screen.findByTestId(
      `item-preview-trigger-${BRANCHING_REJECTED_MERGE_LEAD_ID}`,
    );

    // --- Rejected SPLIT item ---
    // Rejected rows are force-expanded (Task #1001) so the detail panel is
    // present without a chevron click. The AI suggestion card must be
    // inside it with the expected English split sentence.
    const splitPanel = screen.getByTestId(
      `item-detail-panel-${BRANCHING_REJECTED_SPLIT_ID}`,
    );
    const splitSuggestion = screen.getByTestId(
      `branching-ai-suggestion-${BRANCHING_REJECTED_SPLIT_ID}`,
    );
    expect(splitPanel).toContainElement(splitSuggestion);
    expect(splitSuggestion).toHaveTextContent('AI suggestion');
    expect(splitSuggestion).toHaveTextContent(
      `Split after page ${REJECTED_SPLIT_AT_PAGE}`,
    );

    // The interactive slice sub-section must NOT be rendered for the
    // rejected split item — the manual picker owns slice editing in the
    // rejected state (showSliceSection gates on !sortingIsRejected).
    expect(
      screen.queryByTestId(`branching-slice-section-${BRANCHING_REJECTED_SPLIT_ID}`),
    ).not.toBeInTheDocument();

    // --- Rejected MERGE lead ---
    // The AI suggestion card must surface "Merge with: <names>" with both
    // partner filenames in the order returned by computeMergeGroup.
    const mergePanel = screen.getByTestId(
      `item-detail-panel-${BRANCHING_REJECTED_MERGE_LEAD_ID}`,
    );
    const mergeSuggestion = screen.getByTestId(
      `branching-ai-suggestion-${BRANCHING_REJECTED_MERGE_LEAD_ID}`,
    );
    expect(mergePanel).toContainElement(mergeSuggestion);
    expect(mergeSuggestion).toHaveTextContent('AI suggestion');
    expect(mergeSuggestion).toHaveTextContent(
      `Merge with: ${BRANCHING_MERGE_PARTNER_A_NAME}, ${BRANCHING_MERGE_PARTNER_B_NAME}`,
    );
  });
});
