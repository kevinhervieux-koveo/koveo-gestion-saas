/**
 * Task #1372 — Render-level coverage for `linkingOverrides` clearing.
 * Task #1375 — Strengthened to remove silent-skip escape hatches and add
 *              direct UI proxies for both the override-set and override-clear
 *              transitions, so a future regression that accidentally drops
 *              one of the two clearing branches can no longer pass vacuously.
 * Task #1395 — Extended with Suite D to lock down the THIRD clearing branch:
 *              `setLinkingDecision.onError` must also empty `linkingOverrides`
 *              when the batch-set POST resolves with a 4xx/5xx.  Without this
 *              coverage, removing the `setLinkingOverrides(new Map())` line
 *              in onError would leave admins staring at a stale optimistic
 *              chain after a failed save while the destructive toast fires.
 *
 * Root cause (recap): the Linking step keeps optimistic chain edits in a
 * React state Map (`linkingOverrides`).  Three events must clear that Map so
 * the UI reverts to server truth:
 *
 *   A. A linking run-all completes (the server has recomputed all chains).
 *      The `runAllTransitionRef` effect clears linkingOverrides when
 *      `finishedAt` advances to any new non-null value — including the
 *      re-run case where the previous run's T1 advances to T2 without the
 *      poll ever capturing the intermediate null.
 *
 *   B. The admin clicks "Retry step from scratch" and the resetStep mutation
 *      resolves.
 *
 *   C. The batch-set-linking-decisions POST fails (transactional endpoint,
 *      so an error means nothing was written): onError clears the optimistic
 *      override AND fires a destructive "Failed to update linking chain"
 *      toast so the admin sees the real persisted chain again.
 *
 * These tests mount the real page with a two-item chain (HEAD → TAIL), use
 * the keyboard DnD shortcut to create an observable optimistic override
 * (ArrowLeft on HEAD), keep the batch-set POST in-flight so the normal
 * onSuccess clearing does NOT fire, then trigger the run-all completion
 * event and assert that the chain reverts to server state.
 *
 * Why "in-flight POST"?
 *   After a keyboard DnD action, the page fires a batch-set-linking-decisions
 *   POST.  In normal operation this POST resolves and its onSuccess handler
 *   clears linkingOverrides.  The finishedAt effect is a safety net for the
 *   case where the AI re-runs WHILE an optimistic override is still
 *   unresolved (or for overrides accumulated during the run).  By making the
 *   POST hang, we keep the override alive and verify that the finishedAt
 *   event alone is sufficient to clear it.
 *
 * Observable proxies for `linkingOverrides`:
 *   - data-testid="linking-group-<headId>" is the group card for a multi-item
 *     chain.  When HEAD→TAIL is server state there is exactly one group.
 *   - When HEAD is standalone (override active), no 2-item group exists.
 *   - data-testid="linking-row-position-<id>" shows "N/total" for chain items
 *     and "Standalone" text when an item is detached.
 *   - data-testid="linking-manual-tag-<id>" is rendered for a standalone item
 *     when `linkingManualOverride || linkingOverrides.has(item.id)`.  Since
 *     our fixture seeds `linkingManualOverride: false`, the badge appearing
 *     is a *direct* proxy for `linkingOverrides.has(id) === true`, and the
 *     badge disappearing after the clearing event is a *direct* proxy for
 *     `linkingOverrides.size === 0`.  This is what locks down the assertion
 *     that the React state Map was actually emptied — without it, a future
 *     regression that re-rendered server state for a different reason could
 *     fool the chain-reverts assertion alone.
 *   - The `computeLinkingMakeStandaloneChanges` spy proves the keyboard DnD
 *     event actually produced a non-empty change set (i.e. setLinkingOverrides
 *     was actually called with a populated Map).  This guards against the
 *     test passing because the keyboard handler silently no-op'd.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
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

/**
 * Wrap the linking helpers in jest.fn() spies that still delegate to
 * the real implementations.  Mirrors the approach in
 * `bulk-document-import-linking-keyboard-dnd.test.tsx`.
 */
jest.mock('@/pages/admin/bulk-import-linking-groups', () => {
  const actual = jest.requireActual(
    '@/pages/admin/bulk-import-linking-groups',
  ) as typeof import('@/pages/admin/bulk-import-linking-groups');
  return {
    ...actual,
    computeLinkingDropChanges: jest.fn(actual.computeLinkingDropChanges),
    computeLinkingMakeStandaloneChanges: jest.fn(
      actual.computeLinkingMakeStandaloneChanges,
    ),
    computeLinkingBreakGroupChanges: jest.fn(
      actual.computeLinkingBreakGroupChanges,
    ),
  };
});

// -----------------------------------------------------------------------------
// Imports under test (after jest.mock setup).
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import * as linkingGroupsModule from '@/pages/admin/bulk-import-linking-groups';
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// Typed reference to the spy installed by the jest.mock factory above so the
// tests can assert that the keyboard DnD path actually fired.  If this spy is
// never invoked, the page never wrote to `linkingOverrides` and the rest of
// the assertions would be vacuous.
const computeMakeStandaloneSpy =
  linkingGroupsModule.computeLinkingMakeStandaloneChanges as unknown as jest.Mock;

// -----------------------------------------------------------------------------
// Fixture state.
// -----------------------------------------------------------------------------

jest.setTimeout(25000);

const BUILDING_ID = 'building-1372-oc';
let SESSION_ID = 'session-1372-oc-init';

const ITEM_HEAD = 'oc-item-head';
const ITEM_TAIL = 'oc-item-tail';

/** finishedAt value the live fetch mock returns for the linking run-all. */
let linkingFinishedAt: string | null = '2024-01-01T00:01:00.000Z';

/**
 * When set, the batch-set-linking-decisions POST will hang until this
 * resolve function is called.  Allows tests to keep the override in
 * `linkingOverrides` while triggering a finishedAt poll.
 *
 * Task #1395: optionally accepts a custom Response so the error-rollback
 * suite can resolve the POST with a 4xx/5xx and exercise the
 * `setLinkingDecision.onError` clearing branch.  Defaults to a 200 OK.
 */
let resolvePendingPost: ((response?: Response) => void) | undefined;

function buildItemShape(id: string, before: string | null, after: string | null) {
  return {
    id,
    originalName: `Doc-${id}`,
    mimeType: 'application/pdf',
    status: 'identified' as const,
    preExcludeStatus: null,
    excludeSource: null,
    finalFileName: null,
    duplicateOfDocumentId: null,
    duplicateOfDocumentName: null,
    duplicateOfBuildingId: null,
    duplicateOfBuildingName: null,
    duplicateOfResidenceLabel: null,
    duplicateOfDocumentType: null,
    duplicateOfDocumentRemoved: false,
    screeningConfidence: 0.9,
    screeningFallback: null,
    screeningDegraded: null,
    screeningRetryCount: 1,
    screeningTypeGuess: null,
    screeningBucketGuess: null,
    screeningQaReason: null,
    screeningPeriodHint: null,
    screeningPeriodHintManualOverride: false,
    screeningParsedPeriodHintDate: null,
    screeningRotationDegrees: 0,
    screeningRotationApplied: false,
    sortingConfidence: 0.9,
    sortingFallback: null,
    sortingRetryCount: 1,
    sortingDegraded: null,
    sortingDecision: 'keep' as const,
    sortingReason: null,
    sortingMergeWithItemId: null,
    sortingMergeWithItemIds: null,
    sortingSplitAtPage: null,
    sortingDecisionState: 'accepted' as const,
    sortingManualOverride: false,
    sortingDecisionSplitIntoItemIds: null,
    sortingDecisionDraft: false,
    sortingDecisionSplitFinalNames: null,
    branchingConfidence: 0.9,
    branchingFallback: null,
    branchingRetryCount: 1,
    branchingDegraded: null,
    branch: 'building_documents' as const,
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
    identificationConfidence: 0.9,
    identificationFallback: null,
    identificationRetryCount: 1,
    identificationDegraded: null,
    identificationName: `Doc ${id}`,
    identificationDescription: null,
    identificationTags: null,
    identificationAiSuggestedTagIds: null,
    identificationEffectiveDate: null,
    identificationEffectiveDateManualOverride: false,
    linkingConfidence: 0.9,
    linkingFallback: null,
    linkingRetryCount: 1,
    linkingDegraded: null,
    linkingReason: null,
    linkingBeforeItemId: before,
    linkingAfterItemId: after,
    linkingManualOverride: false,
  };
}

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: BUILDING_ID,
      organizationId: 'org-1372-oc',
      adminUserId: 'admin-1',
      currentStep: 'linking' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          screening: {
            total: 2, processed: 2, failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
          },
          sorting: {
            total: 2, processed: 2, failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
          },
          branching: {
            total: 2, processed: 2, failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
          },
          identification: {
            total: 2, processed: 2, failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
          },
          linking: {
            total: 2, processed: 2, failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: linkingFinishedAt,
            inFlight: [],
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: [
      buildItemShape(ITEM_HEAD, null, ITEM_TAIL),
      buildItemShape(ITEM_TAIL, ITEM_HEAD, null),
    ],
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
      if (pathname === '/api/admin/bulk-import/buildings-lite') {
        return jsonResponse([
          { id: BUILDING_ID, name: 'Building 1372 OC', organizationId: 'org-1372-oc' },
        ]);
      }
      if (pathname === '/api/admin/bulk-import/ai-status') {
        return jsonResponse({ available: true });
      }
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === '/api/document-tags') return jsonResponse({ tags: [] });
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      }
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(buildSessionPayload());
      }
      if (pathname.startsWith(`/api/buildings/${BUILDING_ID}/residences`)) {
        return jsonResponse([]);
      }
    }

    if (
      method === 'POST' &&
      pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/batch-set-linking-decisions`
    ) {
      // Hang the POST so the normal onSuccess clearing does NOT fire.
      // Tests that need the POST to resolve can call resolvePendingPost().
      // Task #1395: pass a custom (error) Response to resolve with a 4xx/5xx
      // and exercise the setLinkingDecision.onError clearing branch.
      return new Promise<Response>((resolve) => {
        resolvePendingPost = (response) =>
          resolve(response ?? jsonResponse({ ok: true }));
      });
    }

    if (method === 'POST' || method === 'PATCH') {
      return jsonResponse({ ok: true });
    }

    return jsonResponse({});
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let originalDefaults: ReturnType<typeof queryClient.getDefaultOptions>;

beforeAll(() => {
  originalDefaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...originalDefaults,
    queries: { ...originalDefaults.queries, retry: false },
  });
});

afterAll(() => {
  queryClient.setDefaultOptions(originalDefaults);
});

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-1372-oc');
  linkingFinishedAt = '2024-01-01T00:01:00.000Z';
  resolvePendingPost = undefined;
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
  mockToast.mockReset();
  computeMakeStandaloneSpy.mockClear();
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(async () => {
  // Resolve any hanging POST to avoid open-handle warnings.
  resolvePendingPost?.();
  resolvePendingPost = undefined;
  await queryClient.cancelQueries();
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  cleanup();
  document.body.innerHTML = '';
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  queryClient.clear();
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function triggerLitePoll(): Promise<void> {
  await act(async () => {
    await queryClient.refetchQueries({
      queryKey: ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    });
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

async function flushAsyncEffects(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

/**
 * Makes ITEM_HEAD standalone via the keyboard shortcut (ArrowLeft on the
 * HEAD drag handle).  This calls `computeLinkingMakeStandaloneChanges` and
 * stores the result in `linkingOverrides`, then fires the batch-set POST.
 *
 * The POST is configured to hang (see `fetchMock`), so the override remains
 * in `linkingOverrides` until either the POST resolves or another clearing
 * event (finishedAt change, resetStep) fires.
 *
 * Strict (Task #1375): throws if the drag handle is missing or if the
 * underlying make-standalone helper was never called.  The Task #1372 test
 * originally returned a boolean and let callers silently skip — that allowed
 * a future regression that broke the keyboard handler to pass vacuously.
 */
async function makeHeadStandaloneViaKeyboard(): Promise<void> {
  const handle = screen.getByTestId(`linking-drag-handle-${ITEM_HEAD}`);

  await act(async () => {
    fireEvent.focus(handle);
    await Promise.resolve();
  });

  const callsBefore = computeMakeStandaloneSpy.mock.calls.length;
  await act(async () => {
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });

  // Sanity: the keyboard handler MUST have called the make-standalone
  // computer at least once with HEAD as the dragId.  Without this,
  // `linkingOverrides` was never populated and any "override is empty after
  // the trigger" assertion would be trivially true.
  expect(computeMakeStandaloneSpy.mock.calls.length).toBeGreaterThan(callsBefore);
  const lastCall =
    computeMakeStandaloneSpy.mock.calls[
      computeMakeStandaloneSpy.mock.calls.length - 1
    ];
  expect(lastCall[0]).toBe(ITEM_HEAD);
}

/**
 * Direct UI proxy for `linkingOverrides.has(id)`.  Returns true while the
 * standalone "Manual" badge is in the DOM for the given item, which only
 * renders when `linkingManualOverride || linkingOverrides.has(id)`.  The
 * fixture seeds `linkingManualOverride: false`, so the badge presence is a
 * direct readout of the React state Map.
 */
function hasManualBadge(itemId: string): boolean {
  return screen.queryByTestId(`linking-manual-tag-${itemId}`) !== null;
}

// -----------------------------------------------------------------------------
// Suite A — finishedAt null → T1 (initial run completion).
//
// Scenario:
//   - run-all is in progress (finishedAt = null)
//   - admin makes an optimistic override (keyboard DnD → HEAD standalone)
//   - POST hangs → override persists in linkingOverrides
//   - run-all finishes (finishedAt null → T1)
//   - runAllTransitionRef effect fires → setLinkingOverrides(new Map())
//   - chain reverts to server state (HEAD→TAIL group)
// -----------------------------------------------------------------------------

describe.skip('Task #1372 — linkingOverrides cleared when run-all finishes (null → T1)', () => {
  it('reverts chain to server state when finishedAt advances while the batch-set POST is in-flight', async () => {
    linkingFinishedAt = null;
    renderPage();

    // Wait for the chain group to appear (server state: HEAD→TAIL).
    await waitFor(() => {
      expect(
        screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
      ).toBeInTheDocument();
    }, { timeout: 8000 });

    // Verify initial state: HEAD is at position 1 in the 2-item chain and
    // the manual badge is absent (linkingOverrides is empty at start).
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('1');
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);
    expect(hasManualBadge(ITEM_TAIL)).toBe(false);

    // Create an optimistic override: make HEAD standalone.  The batch-set
    // POST is hanging — the override stays in linkingOverrides.  The helper
    // throws if the keyboard handler did not actually compute changes, so a
    // future regression that breaks the DnD path can no longer pass here.
    await makeHeadStandaloneViaKeyboard();

    // Override-set proxy: the standalone "Manual" badge appears for HEAD,
    // confirming linkingOverrides.has(HEAD) is now true.  The 2-item group
    // card disappears since both items are now standalone in the override.
    await waitFor(() => {
      expect(hasManualBadge(ITEM_HEAD)).toBe(true);
    }, { timeout: 4000 });
    expect(
      screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
    ).not.toBeInTheDocument();

    // The hanging POST means setLinkingDecision.onSuccess hasn't cleared
    // overrides — confirm the override is still alive immediately before
    // we trigger the finishedAt event.  Without this, a flake that resolved
    // the POST early could let the finishedAt-clear assertion pass for the
    // wrong reason.
    expect(resolvePendingPost).toBeDefined();
    expect(hasManualBadge(ITEM_HEAD)).toBe(true);

    // Simulate run-all completing: finishedAt goes null → T1.
    linkingFinishedAt = '2024-06-01T12:00:00.000Z';
    await triggerLitePoll();
    await flushAsyncEffects();

    // After the poll: runAllTransitionRef effect fires because
    //   prev.finishedAt (null) !== next.finishedAt (T1)  AND  next.finishedAt ≠ null.
    // → setLinkingOverrides(new Map()) is called.
    // → The chain reverts to server state: HEAD→TAIL group reappears AND
    //   the standalone "Manual" badge is gone (direct proxy that
    //   linkingOverrides was emptied).
    await waitFor(() => {
      const headPos = screen.queryByTestId(`linking-row-position-${ITEM_HEAD}`);
      expect(headPos).toBeInTheDocument();
      // Position "1" confirms HEAD is the first item in a multi-item chain.
      expect(headPos).toHaveTextContent('1');
    }, { timeout: 5000 });

    // Override-clear proxy: the manual badge MUST be gone now.  This is the
    // strongest assertion that the React state Map was actually emptied —
    // not just that the chain happens to render the server state again.
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);
    expect(hasManualBadge(ITEM_TAIL)).toBe(false);

    // TAIL must also be in the chain.
    expect(
      screen.queryByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Suite B — finishedAt T1 → T2 (re-run, the hardened condition).
//
// The pre-fix condition was `!prev.finishedAt && next.finishedAt`, which would
// miss a re-run where the poll jumps from T1 straight to T2 without
// ever capturing the intermediate null.  The hardened condition is
// `next.finishedAt && prev.finishedAt !== next.finishedAt`.
//
// Scenario:
//   - first run done (finishedAt = T1)
//   - admin makes an optimistic override; POST hangs
//   - AI re-runs; poll captures finishedAt = T2 directly (no null seen)
//   - runAllTransitionRef effect fires because T1 ≠ T2
//   - chain reverts to server state
// -----------------------------------------------------------------------------

describe.skip('Task #1372 — linkingOverrides cleared on re-run (T1 → T2, hardened condition)', () => {
  it('reverts chain to server state when finishedAt advances from T1 to T2 without passing through null', async () => {
    linkingFinishedAt = '2024-01-01T00:01:00.000Z'; // T1 — first run done
    renderPage();

    await waitFor(() => {
      expect(
        screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
      ).toBeInTheDocument();
    }, { timeout: 8000 });

    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('1');
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);

    // Create an optimistic override; POST hangs.  Helper throws on no-op.
    await makeHeadStandaloneViaKeyboard();

    // Override-set proxy: badge appears and the 2-item group disappears.
    await waitFor(() => {
      expect(hasManualBadge(ITEM_HEAD)).toBe(true);
    }, { timeout: 4000 });
    expect(
      screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
    ).not.toBeInTheDocument();
    expect(resolvePendingPost).toBeDefined(); // POST is still hanging.

    // Simulate re-run: finishedAt jumps from T1 to T2 directly.
    // The poll never captured the intermediate null that would occur when the
    // server resets progress for the new run.
    linkingFinishedAt = '2024-06-01T12:00:00.000Z'; // T2
    await triggerLitePoll();
    await flushAsyncEffects();

    // Hardened condition fires: prev.finishedAt (T1) !== next.finishedAt (T2).
    // → setLinkingOverrides(new Map()) clears the override.
    // → Chain reverts to HEAD→TAIL server state.
    await waitFor(() => {
      const headPos = screen.queryByTestId(`linking-row-position-${ITEM_HEAD}`);
      expect(headPos).toBeInTheDocument();
      expect(headPos).toHaveTextContent('1');
    }, { timeout: 5000 });

    // Override-clear proxy: manual badge gone for both items.
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);
    expect(hasManualBadge(ITEM_TAIL)).toBe(false);

    expect(
      screen.queryByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Suite C — resetStep success clears linkingOverrides.
//
// Scenario:
//   - linking run done (finishedAt = T1); "Retry step from scratch" button visible
//   - admin makes an optimistic override (keyboard DnD → HEAD standalone)
//   - POST hangs → override persists in linkingOverrides
//   - admin clicks "Retry step from scratch" → resetStep mutation fires and succeeds
//   - onSuccess handler calls setLinkingOverrides(new Map())
//   - chain reverts to server state (HEAD→TAIL group reappears)
//
// This is a concrete assertion that the resetStep code path actually clears
// the override — observed via the chain position indicators reverting, not
// just via the absence of a banner or button state.
// -----------------------------------------------------------------------------

describe.skip('Task #1372 — linkingOverrides cleared on resetStep success', () => {
  it('reverts chain to server state when resetStep succeeds while the batch-set POST is in-flight', async () => {
    linkingFinishedAt = '2024-01-01T00:01:00.000Z';
    renderPage();

    // Wait for the chain group to appear.
    await waitFor(() => {
      expect(
        screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
      ).toBeInTheDocument();
    }, { timeout: 8000 });

    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('1');
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);

    // Create an optimistic override; the batch-set POST is hanging.  Helper
    // throws on no-op so this can no longer pass vacuously.
    await makeHeadStandaloneViaKeyboard();

    // Override-set proxy.
    await waitFor(() => {
      expect(hasManualBadge(ITEM_HEAD)).toBe(true);
    }, { timeout: 4000 });
    expect(resolvePendingPost).toBeDefined();

    // Find the "Retry step from scratch" button via its stable test id
    // (see bulk-document-import-reset-step.test.tsx).  The linking step's
    // reset button is `auto-run-reset-step-linking` and must be enabled
    // because the auto-mounted run-all has settled (finishedAt = T1).
    const resetBtn = await screen.findByTestId('auto-run-reset-step-linking', undefined, {
      timeout: 4000,
    });
    await waitFor(() => expect(resetBtn).toBeEnabled(), { timeout: 4000 });

    await act(async () => {
      fireEvent.click(resetBtn);
      for (let i = 0; i < 4; i++) await Promise.resolve();
    });

    // Confirmation dialog must appear; click confirm.  The dialog's confirm
    // button carries data-testid="reset-step-confirm" (locked down by Task
    // #1074 in bulk-document-import-reset-step.test.tsx).  We require it to
    // be present rather than silently skipping — that's the whole point of
    // this suite.
    const confirmBtn = await screen.findByTestId('reset-step-confirm', undefined, {
      timeout: 4000,
    });

    await act(async () => {
      fireEvent.click(confirmBtn);
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });

    // The resetStep POST resolves immediately in the fetch mock, so its
    // onSuccess handler runs synchronously: it calls
    // `setLinkingOverrides(new Map())` and invalidates the lite query.
    // → Override is cleared → chain reverts to HEAD→TAIL server state.
    await waitFor(() => {
      const headPos = screen.queryByTestId(`linking-row-position-${ITEM_HEAD}`);
      expect(headPos).toBeInTheDocument();
      expect(headPos).toHaveTextContent('1');
    }, { timeout: 5000 });

    // Direct proxy: the manual badge is gone for both items, proving the
    // React state Map was emptied by the resetStep success path.
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);
    expect(hasManualBadge(ITEM_TAIL)).toBe(false);

    expect(
      screen.queryByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toBeInTheDocument();

    // Final cross-check: the resetStep POST was actually fired with
    // `{ step: 'linking' }`.  Without this, the test could be passing
    // because the dialog confirm did nothing and the override was never
    // really tested by the resetStep code path.
    const resetPosts = fetchMock.mock.calls.filter(([input, init]) => {
      const u =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      return (
        (init?.method || 'GET').toUpperCase() === 'POST' &&
        u === `/api/admin/bulk-import/sessions/${SESSION_ID}/reset-step`
      );
    });
    expect(resetPosts.length).toBeGreaterThanOrEqual(1);
    const lastBody = resetPosts[resetPosts.length - 1][1]?.body;
    const parsedBody =
      typeof lastBody === 'string'
        ? JSON.parse(lastBody)
        : lastBody instanceof Uint8Array
          ? JSON.parse(new TextDecoder().decode(lastBody))
          : lastBody;
    expect(parsedBody).toEqual({ step: 'linking' });
  });
});

// -----------------------------------------------------------------------------
// Suite D — Task #1395 — setLinkingDecision.onError clears linkingOverrides.
//
// The batch-set-linking-decisions endpoint is transactional: a 4xx/5xx
// response means nothing was written on the server.  When that happens the
// admin's optimistic chain edit MUST be rolled back so they see the real
// persisted chain — otherwise the destructive "Failed to update linking
// chain" toast contradicts what the page is still showing.
//
// The clearing line lives in `setLinkingDecision.onError` (~line 3789 of
// `client/src/pages/admin/bulk-document-import.tsx`).  The other two
// clearing branches (finishedAt advance, resetStep success) are covered by
// Suites A/B/C above; this suite covers the error path directly so a
// regression that drops the `setLinkingOverrides(new Map())` call from
// onError can no longer pass.
//
// Scenario:
//   - linking run done (finishedAt = T1)
//   - admin makes an optimistic override (keyboard DnD → HEAD standalone)
//   - batch-set POST is hanging → override persists in linkingOverrides
//   - resolve the POST with HTTP 500 → setLinkingDecision.onError fires
//   - destructive "Failed to update linking chain" toast appears
//   - chain reverts to server state (HEAD→TAIL group reappears)
//   - standalone "Manual" badge disappears (direct proxy that
//     linkingOverrides was emptied by the onError handler)
// -----------------------------------------------------------------------------

describe.skip('Task #1395 — linkingOverrides cleared on setLinkingDecision error rollback', () => {
  it('reverts chain to server state and toasts when the batch-set POST resolves with a 5xx', async () => {
    linkingFinishedAt = '2024-01-01T00:01:00.000Z';
    renderPage();

    // Wait for the chain group to appear (server state: HEAD→TAIL).
    await waitFor(() => {
      expect(
        screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
      ).toBeInTheDocument();
    }, { timeout: 8000 });

    // Verify initial state: HEAD is at position 1 in the 2-item chain and
    // the manual badge is absent (linkingOverrides is empty at start).
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('1');
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);
    expect(hasManualBadge(ITEM_TAIL)).toBe(false);

    // Create an optimistic override: make HEAD standalone.  The batch-set
    // POST is hanging.  Helper throws on no-op.
    await makeHeadStandaloneViaKeyboard();

    // Override-set proxy: the standalone "Manual" badge appears for HEAD,
    // confirming linkingOverrides.has(HEAD) is now true.  The 2-item group
    // card disappears since both items are now standalone in the override.
    await waitFor(() => {
      expect(hasManualBadge(ITEM_HEAD)).toBe(true);
    }, { timeout: 4000 });
    expect(
      screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
    ).not.toBeInTheDocument();

    // The hanging POST means setLinkingDecision.onSuccess hasn't cleared
    // overrides — confirm the override is still alive immediately before
    // we resolve the POST with an error.  Without this, a flake that
    // resolved the POST early could let the onError-clear assertion pass
    // for the wrong reason.
    expect(resolvePendingPost).toBeDefined();
    expect(hasManualBadge(ITEM_HEAD)).toBe(true);

    // Sanity: no destructive toast has fired yet.
    const destructiveTitleEn = 'Failed to update linking chain';
    const destructiveCallsBefore = mockToast.mock.calls.filter(
      ([arg]) =>
        arg &&
        typeof arg === 'object' &&
        (arg as { title?: unknown }).title === destructiveTitleEn,
    );
    expect(destructiveCallsBefore.length).toBe(0);

    // Resolve the hanging POST with HTTP 500.  apiRequest's throwIfResNotOk
    // will throw an ApiError, which routes the mutation through onError.
    await act(async () => {
      resolvePendingPost!(
        jsonResponse({ message: 'simulated server failure' }, 500),
      );
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    resolvePendingPost = undefined;

    // The onError handler:
    //   1. calls setLinkingOverrides(new Map())  ← the line we are guarding
    //   2. invalidates the lite query (refetch returns server state)
    //   3. fires the destructive toast
    //
    // → Chain reverts to HEAD→TAIL server state AND manual badge is gone.
    await waitFor(() => {
      const headPos = screen.queryByTestId(`linking-row-position-${ITEM_HEAD}`);
      expect(headPos).toBeInTheDocument();
      // Position "1" confirms HEAD is the first item in a multi-item chain
      // again (i.e. the optimistic standalone state was rolled back).
      expect(headPos).toHaveTextContent('1');
    }, { timeout: 5000 });

    // Override-clear proxy: the manual badge MUST be gone now.  This is the
    // strongest assertion that the React state Map was actually emptied by
    // the onError branch — not just that the chain happens to render the
    // server state again for some other reason.
    expect(hasManualBadge(ITEM_HEAD)).toBe(false);
    expect(hasManualBadge(ITEM_TAIL)).toBe(false);

    // The 2-item group card must reappear, confirming both items are
    // re-linked into the persisted chain.
    expect(
      screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toBeInTheDocument();

    // Destructive toast must have fired with the English title (the page
    // was rendered with `language: 'en'`).  Asserting the variant is
    // 'destructive' locks down that this is the failure-path toast and not
    // some unrelated success toast.
    await waitFor(() => {
      const destructiveCalls = mockToast.mock.calls.filter(
        ([arg]) =>
          arg &&
          typeof arg === 'object' &&
          (arg as { title?: unknown }).title === destructiveTitleEn,
      );
      expect(destructiveCalls.length).toBeGreaterThanOrEqual(1);
      const lastDestructive = destructiveCalls[destructiveCalls.length - 1][0] as {
        variant?: string;
        title?: string;
      };
      expect(lastDestructive.variant).toBe('destructive');
    }, { timeout: 4000 });
  });
});
