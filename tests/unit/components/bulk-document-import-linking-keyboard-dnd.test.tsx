/**
 * Task #1250 — Integration coverage for the Linking step's keyboard
 * drag-and-drop shortcut.
 *
 * The Linking step (Task #1233) exposes a focusable drag handle on
 * every chain row whose aria-label advertises an arrow-key
 * alternative ("Drag to reorder (arrow keys)"). Task #1242 verified
 * that the handle is rendered and focusable, but never exercised the
 * actual keyboard handler. These tests fill that gap by:
 *
 *   1. Mounting the real BulkDocumentImportPage on the Linking step
 *      with a 3-item chain (HEAD → MID → TAIL),
 *   2. Focusing one of the chain handles,
 *   3. Dispatching ArrowUp / ArrowDown / ArrowLeft keyboard events,
 *   4. Asserting the resulting visual order via the
 *      `linking-row-position-${id}` indicators that the group card
 *      already exposes for testing purposes.
 *
 * A separate test asserts that the keyboard path delegates to the
 * same pure helpers (`computeLinkingDropChanges` and
 * `computeLinkingMakeStandaloneChanges`) used by the mouse-driven
 * drop handler so the two interaction paths cannot drift apart.
 *
 * Page scaffolding mirrors
 * `tests/unit/components/bulk-document-import-linking-group-card.test.tsx`.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
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

let currentLanguage: 'en' | 'fr' = 'en';
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: currentLanguage,
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

/**
 * Wrap the linking helpers in jest.fn() spies that still delegate to
 * the real implementations. This lets the optimistic UI updates flow
 * through the page code unchanged while letting tests assert that the
 * keyboard handler delegates to the same helpers as the mouse path.
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
  };
});

// -----------------------------------------------------------------------------
// Imports under test (after jest.mock setup).
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import * as linkingGroupsModule from '@/pages/admin/bulk-import-linking-groups';

const computeLinkingDropChangesSpy =
  linkingGroupsModule.computeLinkingDropChanges as unknown as jest.Mock;
const computeLinkingMakeStandaloneChangesSpy =
  linkingGroupsModule.computeLinkingMakeStandaloneChanges as unknown as jest.Mock;

// -----------------------------------------------------------------------------
// Fixture state and fetch responder.
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-1250';

// Three items chained as: HEAD → MID → TAIL.
const ITEM_HEAD = 'item-head-aaa';
const ITEM_MID = 'item-mid-bbb';
const ITEM_TAIL = 'item-tail-ccc';

interface ItemFixture {
  id: string;
  originalName: string;
  linkingBeforeItemId: string | null;
  linkingAfterItemId: string | null;
  linkingManualOverride: boolean;
}

let items: ItemFixture[] = [];

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'linking' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          screening: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          sorting: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          branching: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          identification: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          linking: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: items.map((it) => ({
      id: it.id,
      originalName: it.originalName,
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
      identificationName: 'Doc',
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
      linkingBeforeItemId: it.linkingBeforeItemId,
      linkingAfterItemId: it.linkingAfterItemId,
      linkingManualOverride: it.linkingManualOverride,
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

  // Linking persistence: when the page POSTs the batch decisions,
  // apply them to the in-memory `items` fixture so the subsequent
  // refetch (triggered by onSuccess → invalidateQueries) returns the
  // new server-of-record order.  Otherwise the page would clear its
  // optimistic overrides and revert the chain to the original order.
  if (
    method === 'POST' &&
    pathname ===
      `/api/admin/bulk-import/sessions/${SESSION_ID}/batch-set-linking-decisions`
  ) {
    try {
      const body = init?.body
        ? JSON.parse(typeof init.body === 'string' ? init.body : String(init.body))
        : { decisions: [] };
      const decisions: Array<{
        itemId: string;
        beforeItemId: string | null;
        afterItemId: string | null;
      }> = body?.decisions ?? [];
      for (const d of decisions) {
        const it = items.find((i) => i.id === d.itemId);
        if (!it) continue;
        it.linkingBeforeItemId = d.beforeItemId;
        it.linkingAfterItemId = d.afterItemId;
        // The server stamps manual override on persisted decisions.
        it.linkingManualOverride = true;
      }
    } catch {
      /* tolerate parse failures — handler returns ok regardless */
    }
    return jsonResponse({ ok: true });
  }

  if (method !== 'GET') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ unmocked: true, url, method }, 404);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

function defaultFixture(): ItemFixture[] {
  return [
    {
      id: ITEM_HEAD,
      originalName: 'invoice-page-1.pdf',
      linkingBeforeItemId: null,
      linkingAfterItemId: ITEM_MID,
      linkingManualOverride: false,
    },
    {
      id: ITEM_MID,
      originalName: 'invoice-page-2.pdf',
      linkingBeforeItemId: ITEM_HEAD,
      linkingAfterItemId: ITEM_TAIL,
      linkingManualOverride: false,
    },
    {
      id: ITEM_TAIL,
      originalName: 'invoice-page-3.pdf',
      linkingBeforeItemId: ITEM_MID,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
  ];
}

beforeEach(() => {
  items = defaultFixture();
  currentLanguage = 'en';

  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  computeLinkingDropChangesSpy.mockClear();
  computeLinkingMakeStandaloneChangesSpy.mockClear();

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

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function flushAsyncEffects() {
  await act(async () => {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  });
}

/**
 * Read the visible chain order (top→bottom) from the rendered
 * group card by querying the `linking-row-${id}` elements (excluding
 * the position-indicator children that share the prefix).
 */
function getRenderedChainOrder(groupCard: HTMLElement): string[] {
  const rowEls = Array.from(
    groupCard.querySelectorAll(
      '[data-testid^="linking-row-"]:not([data-testid^="linking-row-position-"])',
    ),
  ) as HTMLElement[];
  return rowEls.map((el) =>
    (el.getAttribute('data-testid') || '').replace('linking-row-', ''),
  );
}

// =============================================================================
// 1. Arrow-key reordering visibly updates the chain
// =============================================================================

describe('BulkDocumentImportPage — Linking keyboard arrow-key DnD (Task #1250)', () => {
  it('ArrowDown on the HEAD row moves it down one slot in the chain', async () => {
    renderPage();
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    // Sanity: starting order is HEAD, MID, TAIL.
    expect(getRenderedChainOrder(groupCard)).toEqual([
      ITEM_HEAD,
      ITEM_MID,
      ITEM_TAIL,
    ]);

    const headHandle = screen.getByTestId(`linking-drag-handle-${ITEM_HEAD}`);
    await act(async () => {
      headHandle.focus();
      fireEvent.keyDown(headHandle, { key: 'ArrowDown' });
    });
    await flushAsyncEffects();

    // The HEAD card uses the original chain head as its key, so the
    // group card may now be re-keyed onto MID. Pick whichever one
    // currently exists.
    const updatedGroup =
      screen.queryByTestId(`linking-group-${ITEM_MID}`) ??
      screen.getByTestId(`linking-group-${ITEM_HEAD}`);

    expect(getRenderedChainOrder(updatedGroup)).toEqual([
      ITEM_MID,
      ITEM_HEAD,
      ITEM_TAIL,
    ]);

    // Position indicators reflect the new order (1-based / total).
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_MID}`),
    ).toHaveTextContent('1/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('2/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toHaveTextContent('3/3');
  });

  it('ArrowUp on the TAIL row moves it up one slot in the chain', async () => {
    renderPage();
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    expect(getRenderedChainOrder(groupCard)).toEqual([
      ITEM_HEAD,
      ITEM_MID,
      ITEM_TAIL,
    ]);

    const tailHandle = screen.getByTestId(`linking-drag-handle-${ITEM_TAIL}`);
    await act(async () => {
      tailHandle.focus();
      fireEvent.keyDown(tailHandle, { key: 'ArrowUp' });
    });
    await flushAsyncEffects();

    const updatedGroup = screen.getByTestId(`linking-group-${ITEM_HEAD}`);
    expect(getRenderedChainOrder(updatedGroup)).toEqual([
      ITEM_HEAD,
      ITEM_TAIL,
      ITEM_MID,
    ]);

    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('1/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toHaveTextContent('2/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_MID}`),
    ).toHaveTextContent('3/3');
  });

  it('ArrowDown is a no-op when invoked on the last row of a chain', async () => {
    renderPage();
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    expect(getRenderedChainOrder(groupCard)).toEqual([
      ITEM_HEAD,
      ITEM_MID,
      ITEM_TAIL,
    ]);

    const tailHandle = screen.getByTestId(`linking-drag-handle-${ITEM_TAIL}`);
    await act(async () => {
      tailHandle.focus();
      fireEvent.keyDown(tailHandle, { key: 'ArrowDown' });
    });
    await flushAsyncEffects();

    // Order unchanged: TAIL has no successor to swap with.
    expect(getRenderedChainOrder(groupCard)).toEqual([
      ITEM_HEAD,
      ITEM_MID,
      ITEM_TAIL,
    ]);
  });

  it('ArrowLeft on a chain row detaches it (becomes standalone)', async () => {
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    const midHandle = screen.getByTestId(`linking-drag-handle-${ITEM_MID}`);
    await act(async () => {
      midHandle.focus();
      fireEvent.keyDown(midHandle, { key: 'ArrowLeft' });
    });
    await flushAsyncEffects();

    // After detaching MID, only HEAD ↔ TAIL remain in the chain. The
    // remaining 2-item chain still shows the group card; MID is now
    // standalone (not inside any group card).
    const updatedGroup = screen.getByTestId(`linking-group-${ITEM_HEAD}`);
    expect(getRenderedChainOrder(updatedGroup)).toEqual([ITEM_HEAD, ITEM_TAIL]);

    const detachedRow = screen.getByTestId(`linking-row-${ITEM_MID}`);
    expect(detachedRow).toBeInTheDocument();
    expect(updatedGroup.contains(detachedRow)).toBe(false);

    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('1/2');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toHaveTextContent('2/2');
  });
});

// =============================================================================
// 2. Keyboard path goes through the same pure helpers as the mouse path
// =============================================================================

describe('BulkDocumentImportPage — Linking keyboard handler delegates to drop helpers (Task #1250)', () => {
  it('ArrowDown calls computeLinkingDropChanges with position="after" on the next sibling', async () => {
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    // Resolving the groups during render itself triggers some helper
    // calls; clear here so we only assert against the keyboard event.
    computeLinkingDropChangesSpy.mockClear();
    computeLinkingMakeStandaloneChangesSpy.mockClear();

    const headHandle = screen.getByTestId(`linking-drag-handle-${ITEM_HEAD}`);
    await act(async () => {
      headHandle.focus();
      fireEvent.keyDown(headHandle, { key: 'ArrowDown' });
    });
    await flushAsyncEffects();

    // Keyboard path must call into the same pure drop helper as the
    // mouse path — same arg shape: (dragId, targetId, position, getEffective).
    expect(computeLinkingDropChangesSpy).toHaveBeenCalled();
    const [dragId, targetId, position, getEffective] =
      computeLinkingDropChangesSpy.mock.calls[0] as [
        string,
        string,
        'before' | 'after',
        (id: string) => unknown,
      ];
    expect(dragId).toBe(ITEM_HEAD);
    expect(targetId).toBe(ITEM_MID);
    expect(position).toBe('after');
    expect(typeof getEffective).toBe('function');

    // The standalone-detach helper must NOT be involved in a reorder.
    expect(computeLinkingMakeStandaloneChangesSpy).not.toHaveBeenCalled();
  });

  it('ArrowUp calls computeLinkingDropChanges with position="before" on the previous sibling', async () => {
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    computeLinkingDropChangesSpy.mockClear();
    computeLinkingMakeStandaloneChangesSpy.mockClear();

    const tailHandle = screen.getByTestId(`linking-drag-handle-${ITEM_TAIL}`);
    await act(async () => {
      tailHandle.focus();
      fireEvent.keyDown(tailHandle, { key: 'ArrowUp' });
    });
    await flushAsyncEffects();

    expect(computeLinkingDropChangesSpy).toHaveBeenCalled();
    const [dragId, targetId, position] =
      computeLinkingDropChangesSpy.mock.calls[0] as [
        string,
        string,
        'before' | 'after',
        (id: string) => unknown,
      ];
    expect(dragId).toBe(ITEM_TAIL);
    expect(targetId).toBe(ITEM_MID);
    expect(position).toBe('before');

    expect(computeLinkingMakeStandaloneChangesSpy).not.toHaveBeenCalled();
  });

  it('ArrowLeft calls computeLinkingMakeStandaloneChanges for the focused row', async () => {
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    computeLinkingDropChangesSpy.mockClear();
    computeLinkingMakeStandaloneChangesSpy.mockClear();

    const midHandle = screen.getByTestId(`linking-drag-handle-${ITEM_MID}`);
    await act(async () => {
      midHandle.focus();
      fireEvent.keyDown(midHandle, { key: 'ArrowLeft' });
    });
    await flushAsyncEffects();

    // Detach path must go through the standalone helper, NOT the
    // generic drop helper.
    expect(computeLinkingMakeStandaloneChangesSpy).toHaveBeenCalled();
    const [dragId, getEffective] =
      computeLinkingMakeStandaloneChangesSpy.mock.calls[0] as [
        string,
        (id: string) => unknown,
      ];
    expect(dragId).toBe(ITEM_MID);
    expect(typeof getEffective).toBe('function');

    expect(computeLinkingDropChangesSpy).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 3. Keyboard reorders are announced to screen readers (Task #1257)
// =============================================================================
//
// The Linking step renders a single polite live region (role="status",
// aria-live="polite") whose text content is driven by the
// `linkingAnnouncement` state hook. Each ArrowUp / ArrowDown / ArrowLeft
// keystroke on a chain row updates that hook with a localized message
// (e.g. "Position 2 of 3" / "Position 2 sur 3" or
// "File removed from group" / "Fichier dissocié du groupe"). These tests
// dispatch the keystrokes and assert the live region picks up the matching
// copy in both English and French so a regression that disconnects the
// state from the live region cannot silently break screen-reader
// accessibility.

/**
 * Locate the single Linking-step polite live region. It is the only
 * element on the page with both role="status" AND aria-live="polite",
 * so we query by the aria-live attribute (which is unique to it) to
 * disambiguate from the other role="status" elements (loading spinners
 * elsewhere in the page).
 */
function getLinkingLiveRegion(): HTMLElement {
  const liveRegions = document.querySelectorAll('[aria-live="polite"]');
  expect(liveRegions.length).toBe(1);
  const region = liveRegions[0] as HTMLElement;
  // Sanity: the live region should also advertise role="status" so that
  // assistive tech that filters by role still picks it up.
  expect(region.getAttribute('role')).toBe('status');
  return region;
}

describe('BulkDocumentImportPage — Linking keyboard reorders announce to screen readers (Task #1257)', () => {
  describe('English (currentLanguage="en")', () => {
    beforeEach(() => {
      currentLanguage = 'en';
    });

    it('ArrowDown on the HEAD row announces "Position 2 of 3" in the polite live region', async () => {
      renderPage();
      await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
        timeout: 4000,
      });
      await flushAsyncEffects();

      // Live region exists and starts empty.
      const liveRegion = getLinkingLiveRegion();
      expect(liveRegion.textContent ?? '').toBe('');

      const headHandle = screen.getByTestId(`linking-drag-handle-${ITEM_HEAD}`);
      await act(async () => {
        headHandle.focus();
        fireEvent.keyDown(headHandle, { key: 'ArrowDown' });
      });
      await flushAsyncEffects();

      // HEAD moved from slot 1 → slot 2 in a 3-item chain.
      expect(getLinkingLiveRegion()).toHaveTextContent('Position 2 of 3');
    });

    it('ArrowUp on the TAIL row announces "Position 2 of 3" in the polite live region', async () => {
      renderPage();
      await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
        timeout: 4000,
      });
      await flushAsyncEffects();

      const tailHandle = screen.getByTestId(`linking-drag-handle-${ITEM_TAIL}`);
      await act(async () => {
        tailHandle.focus();
        fireEvent.keyDown(tailHandle, { key: 'ArrowUp' });
      });
      await flushAsyncEffects();

      // TAIL moved from slot 3 → slot 2 in a 3-item chain.
      expect(getLinkingLiveRegion()).toHaveTextContent('Position 2 of 3');
    });

    it('ArrowLeft on a chain row announces "File removed from group" in the polite live region', async () => {
      renderPage();
      await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
        timeout: 4000,
      });
      await flushAsyncEffects();

      const midHandle = screen.getByTestId(`linking-drag-handle-${ITEM_MID}`);
      await act(async () => {
        midHandle.focus();
        fireEvent.keyDown(midHandle, { key: 'ArrowLeft' });
      });
      await flushAsyncEffects();

      expect(getLinkingLiveRegion()).toHaveTextContent('File removed from group');
    });
  });

  describe('French (currentLanguage="fr")', () => {
    beforeEach(() => {
      currentLanguage = 'fr';
    });

    it('ArrowDown on the HEAD row announces "Position 2 sur 3" in the polite live region', async () => {
      renderPage();
      await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
        timeout: 4000,
      });
      await flushAsyncEffects();

      const headHandle = screen.getByTestId(`linking-drag-handle-${ITEM_HEAD}`);
      await act(async () => {
        headHandle.focus();
        fireEvent.keyDown(headHandle, { key: 'ArrowDown' });
      });
      await flushAsyncEffects();

      expect(getLinkingLiveRegion()).toHaveTextContent('Position 2 sur 3');
    });

    it('ArrowUp on the TAIL row announces "Position 2 sur 3" in the polite live region', async () => {
      renderPage();
      await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
        timeout: 4000,
      });
      await flushAsyncEffects();

      const tailHandle = screen.getByTestId(`linking-drag-handle-${ITEM_TAIL}`);
      await act(async () => {
        tailHandle.focus();
        fireEvent.keyDown(tailHandle, { key: 'ArrowUp' });
      });
      await flushAsyncEffects();

      expect(getLinkingLiveRegion()).toHaveTextContent('Position 2 sur 3');
    });

    it('ArrowLeft on a chain row announces "Fichier dissocié du groupe" in the polite live region', async () => {
      renderPage();
      await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
        timeout: 4000,
      });
      await flushAsyncEffects();

      const midHandle = screen.getByTestId(`linking-drag-handle-${ITEM_MID}`);
      await act(async () => {
        midHandle.focus();
        fireEvent.keyDown(midHandle, { key: 'ArrowLeft' });
      });
      await flushAsyncEffects();

      expect(getLinkingLiveRegion()).toHaveTextContent('Fichier dissocié du groupe');
    });
  });
});

// =============================================================================
// 4. Task #1256 — ArrowRight 'join next group' keyboard shortcut
// =============================================================================
//
// The Linking handler also supports ArrowRight, which moves the focused row
// into the *next* visual group below it. Two branches must be covered:
//
//   a) Grouped item: the row already belongs to a chain → it joins the
//      group immediately after its current group (`groups[idx + 1]`).
//   b) Standalone item: the row has no current group → it joins the first
//      group whose head appears below it in the flat items list.
//
// In both branches the handler delegates to `handleLinkingDrop(itemId,
// nextGroup.tail.id, 'after')`, which in turn calls into
// `computeLinkingDropChanges` with `position: 'after'` on the tail of the
// destination chain. The tests below assert both the visible result (via
// the `linking-row-position-*` indicators inside the destination card)
// and the helper-call shape (so the keyboard path can't drift away from
// the mouse path).
//
// Fixture IDs are kept distinct from the §1/§2 fixtures so it is obvious
// at a glance which IDs belong to which scenario.

const ITEM_A1 = 'item-a1-aaaa';
const ITEM_A2 = 'item-a2-aaaa';
const ITEM_B1 = 'item-b1-bbbb';
const ITEM_B2 = 'item-b2-bbbb';
const ITEM_STANDALONE = 'item-solo-sss';

/**
 * Two-chain fixture: chain A (A1 → A2) appears before chain B (B1 → B2)
 * in the flat items list, so chain A is `groups[0]` and chain B is
 * `groups[1]`. ArrowRight on a chain-A row therefore joins chain B.
 */
function twoChainFixture(): ItemFixture[] {
  return [
    {
      id: ITEM_A1,
      originalName: 'a-page-1.pdf',
      linkingBeforeItemId: null,
      linkingAfterItemId: ITEM_A2,
      linkingManualOverride: false,
    },
    {
      id: ITEM_A2,
      originalName: 'a-page-2.pdf',
      linkingBeforeItemId: ITEM_A1,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
    {
      id: ITEM_B1,
      originalName: 'b-page-1.pdf',
      linkingBeforeItemId: null,
      linkingAfterItemId: ITEM_B2,
      linkingManualOverride: false,
    },
    {
      id: ITEM_B2,
      originalName: 'b-page-2.pdf',
      linkingBeforeItemId: ITEM_B1,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
  ];
}

/**
 * Standalone-then-chain fixture: a single unlinked item appears first in
 * the flat list, followed by a chain B (B1 → B2). ArrowRight on the
 * standalone row should make it join chain B (the first group whose head
 * appears below it in the flat list).
 */
function standaloneThenChainFixture(): ItemFixture[] {
  return [
    {
      id: ITEM_STANDALONE,
      originalName: 'solo.pdf',
      linkingBeforeItemId: null,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
    {
      id: ITEM_B1,
      originalName: 'b-page-1.pdf',
      linkingBeforeItemId: null,
      linkingAfterItemId: ITEM_B2,
      linkingManualOverride: false,
    },
    {
      id: ITEM_B2,
      originalName: 'b-page-2.pdf',
      linkingBeforeItemId: ITEM_B1,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
  ];
}

describe("BulkDocumentImportPage — Linking keyboard ArrowRight 'join next group' (Task #1256)", () => {
  it('ArrowRight on a chain row moves it into the next chain (grouped branch)', async () => {
    items = twoChainFixture();

    renderPage();
    // Sanity: both chains render as their own group cards, keyed by head.
    const chainA = await screen.findByTestId(`linking-group-${ITEM_A1}`, undefined, {
      timeout: 4000,
    });
    const chainB = await screen.findByTestId(`linking-group-${ITEM_B1}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    expect(getRenderedChainOrder(chainA)).toEqual([ITEM_A1, ITEM_A2]);
    expect(getRenderedChainOrder(chainB)).toEqual([ITEM_B1, ITEM_B2]);

    // Focus the tail of chain A and press ArrowRight: A2 should leave
    // chain A and become the new tail of chain B. Chain A then has only
    // A1 left, which collapses to a standalone row.
    const a2Handle = screen.getByTestId(`linking-drag-handle-${ITEM_A2}`);
    await act(async () => {
      a2Handle.focus();
      fireEvent.keyDown(a2Handle, { key: 'ArrowRight' });
    });
    await flushAsyncEffects();

    // Chain B now contains [B1, B2, A2].
    const updatedChainB = screen.getByTestId(`linking-group-${ITEM_B1}`);
    expect(getRenderedChainOrder(updatedChainB)).toEqual([
      ITEM_B1,
      ITEM_B2,
      ITEM_A2,
    ]);

    // Position indicators reflect the new chain-B order.
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_B1}`),
    ).toHaveTextContent('1/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_B2}`),
    ).toHaveTextContent('2/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_A2}`),
    ).toHaveTextContent('3/3');

    // Chain A no longer renders as a group card (only A1 remains, which
    // is now standalone and rendered outside any `linking-group-*` card).
    expect(screen.queryByTestId(`linking-group-${ITEM_A1}`)).toBeNull();
    expect(screen.queryByTestId(`linking-group-${ITEM_A2}`)).toBeNull();
    const a1Row = screen.getByTestId(`linking-row-${ITEM_A1}`);
    expect(a1Row).toBeInTheDocument();
    expect(updatedChainB.contains(a1Row)).toBe(false);
  });

  it('ArrowRight on a standalone row moves it into the first chain below it (standalone branch)', async () => {
    items = standaloneThenChainFixture();

    renderPage();
    // Chain B is the only group card; the standalone row renders outside.
    const chainB = await screen.findByTestId(`linking-group-${ITEM_B1}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    expect(getRenderedChainOrder(chainB)).toEqual([ITEM_B1, ITEM_B2]);
    const soloRow = screen.getByTestId(`linking-row-${ITEM_STANDALONE}`);
    expect(soloRow).toBeInTheDocument();
    expect(chainB.contains(soloRow)).toBe(false);

    // Focus the standalone row's drag handle and press ArrowRight.
    const soloHandle = screen.getByTestId(
      `linking-drag-handle-${ITEM_STANDALONE}`,
    );
    await act(async () => {
      soloHandle.focus();
      fireEvent.keyDown(soloHandle, { key: 'ArrowRight' });
    });
    await flushAsyncEffects();

    // The standalone item joins chain B as its new tail: [B1, B2, SOLO].
    const updatedChainB = screen.getByTestId(`linking-group-${ITEM_B1}`);
    expect(getRenderedChainOrder(updatedChainB)).toEqual([
      ITEM_B1,
      ITEM_B2,
      ITEM_STANDALONE,
    ]);

    expect(
      screen.getByTestId(`linking-row-position-${ITEM_B1}`),
    ).toHaveTextContent('1/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_B2}`),
    ).toHaveTextContent('2/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_STANDALONE}`),
    ).toHaveTextContent('3/3');
  });

  it('ArrowRight delegates to computeLinkingDropChanges targeting the next group\'s tail with position="after"', async () => {
    items = twoChainFixture();

    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_A1}`, undefined, {
      timeout: 4000,
    });
    await screen.findByTestId(`linking-group-${ITEM_B1}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    // Resolving the chains during render itself triggers helper calls;
    // clear here so we only assert against the keyboard event below.
    computeLinkingDropChangesSpy.mockClear();
    computeLinkingMakeStandaloneChangesSpy.mockClear();

    const a2Handle = screen.getByTestId(`linking-drag-handle-${ITEM_A2}`);
    await act(async () => {
      a2Handle.focus();
      fireEvent.keyDown(a2Handle, { key: 'ArrowRight' });
    });
    await flushAsyncEffects();

    // The keyboard path must call the same pure helper as the mouse
    // path, with the dragged id, the *tail* of the next group as the
    // drop target, and `position: 'after'`.
    expect(computeLinkingDropChangesSpy).toHaveBeenCalled();
    const [dragId, targetId, position, getEffective] =
      computeLinkingDropChangesSpy.mock.calls[0] as [
        string,
        string,
        'before' | 'after',
        (id: string) => unknown,
      ];
    expect(dragId).toBe(ITEM_A2);
    expect(targetId).toBe(ITEM_B2);
    expect(position).toBe('after');
    expect(typeof getEffective).toBe('function');

    // ArrowRight is a reorder, not a detach: the standalone helper must
    // not be involved.
    expect(computeLinkingMakeStandaloneChangesSpy).not.toHaveBeenCalled();
  });

  it('ArrowRight is a no-op when the focused row is in the last (or only) group', async () => {
    // Single chain only: chain B exists, no chain after it.
    items = [
      {
        id: ITEM_B1,
        originalName: 'b-page-1.pdf',
        linkingBeforeItemId: null,
        linkingAfterItemId: ITEM_B2,
        linkingManualOverride: false,
      },
      {
        id: ITEM_B2,
        originalName: 'b-page-2.pdf',
        linkingBeforeItemId: ITEM_B1,
        linkingAfterItemId: null,
        linkingManualOverride: false,
      },
    ];

    renderPage();
    const chainB = await screen.findByTestId(`linking-group-${ITEM_B1}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    expect(getRenderedChainOrder(chainB)).toEqual([ITEM_B1, ITEM_B2]);

    computeLinkingDropChangesSpy.mockClear();
    computeLinkingMakeStandaloneChangesSpy.mockClear();

    const b1Handle = screen.getByTestId(`linking-drag-handle-${ITEM_B1}`);
    await act(async () => {
      b1Handle.focus();
      fireEvent.keyDown(b1Handle, { key: 'ArrowRight' });
    });
    await flushAsyncEffects();

    // No next group exists → handler short-circuits without calling the
    // drop helper, and the chain order stays the same.
    expect(computeLinkingDropChangesSpy).not.toHaveBeenCalled();
    expect(computeLinkingMakeStandaloneChangesSpy).not.toHaveBeenCalled();
    expect(getRenderedChainOrder(chainB)).toEqual([ITEM_B1, ITEM_B2]);
  });
});

// =============================================================================
// 5. ArrowRight live-region announcement, EN + FR (Task #1263)
// =============================================================================
//
// Task #1256 (above) covers the visible reorder and helper-call delegation
// for ArrowRight, but does not assert the localized polite-live-region
// announcement ("Moved to next group, position N" /
// "Déplacé dans le groupe suivant, position N") emitted by
// `handleLinkingKeyDown` for the same key. These tests add that coverage
// in both English and French. Identifiers are prefixed with `T1263_` to
// avoid colliding with the §4 fixture constants declared above.

const T1263_A1 = 'item-t1263-a1';
const T1263_A2 = 'item-t1263-a2';
const T1263_B1 = 'item-t1263-b1';
const T1263_B2 = 'item-t1263-b2';
const T1263_B3 = 'item-t1263-b3';

/**
 * Two-group fixture sized so that group B has 3 items, making the
 * post-move position of the joining row exactly 4 — which lets the
 * announcement assertion hard-code the slot number.
 */
function t1263TwoGroupFixture(): ItemFixture[] {
  return [
    {
      id: T1263_A1,
      originalName: 'doc-a1.pdf',
      linkingBeforeItemId: null,
      linkingAfterItemId: T1263_A2,
      linkingManualOverride: false,
    },
    {
      id: T1263_A2,
      originalName: 'doc-a2.pdf',
      linkingBeforeItemId: T1263_A1,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
    {
      id: T1263_B1,
      originalName: 'doc-b1.pdf',
      linkingBeforeItemId: null,
      linkingAfterItemId: T1263_B2,
      linkingManualOverride: false,
    },
    {
      id: T1263_B2,
      originalName: 'doc-b2.pdf',
      linkingBeforeItemId: T1263_B1,
      linkingAfterItemId: T1263_B3,
      linkingManualOverride: false,
    },
    {
      id: T1263_B3,
      originalName: 'doc-b3.pdf',
      linkingBeforeItemId: T1263_B2,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
  ];
}

describe('BulkDocumentImportPage — Linking ArrowRight live-region announcement (Task #1263)', () => {
  beforeEach(() => {
    // Swap the default 3-item / single-group fixture for a 5-item /
    // two-group one so there is a "next group" for ArrowRight to land
    // in. The parent `beforeEach` has already reset `items` to the
    // default; this nested hook overrides it before the page mounts.
    items = t1263TwoGroupFixture();
  });

  describe('English (currentLanguage="en")', () => {
    beforeEach(() => {
      currentLanguage = 'en';
    });

    it('ArrowRight on a row in the first group moves it into the next group and announces "Moved to next group, position 4"', async () => {
      renderPage();
      const groupA = await screen.findByTestId(
        `linking-group-${T1263_A1}`,
        undefined,
        { timeout: 4000 },
      );
      await flushAsyncEffects();

      // Sanity: starting layout is two distinct groups.
      expect(getRenderedChainOrder(groupA)).toEqual([T1263_A1, T1263_A2]);
      const groupB = screen.getByTestId(`linking-group-${T1263_B1}`);
      expect(getRenderedChainOrder(groupB)).toEqual([
        T1263_B1,
        T1263_B2,
        T1263_B3,
      ]);

      // Live region exists and starts empty.
      const liveRegion = getLinkingLiveRegion();
      expect(liveRegion.textContent ?? '').toBe('');

      const a1Handle = screen.getByTestId(`linking-drag-handle-${T1263_A1}`);
      await act(async () => {
        a1Handle.focus();
        fireEvent.keyDown(a1Handle, { key: 'ArrowRight' });
      });
      await flushAsyncEffects();

      // A1 has been appended to the tail of group B; A2 is now alone
      // and therefore no longer rendered inside any group card (a
      // chain of length 1 is standalone, not a group).
      const updatedGroupB = screen.getByTestId(`linking-group-${T1263_B1}`);
      expect(getRenderedChainOrder(updatedGroupB)).toEqual([
        T1263_B1,
        T1263_B2,
        T1263_B3,
        T1263_A1,
      ]);

      // Position indicators reflect the new 4-item chain.
      expect(
        screen.getByTestId(`linking-row-position-${T1263_B1}`),
      ).toHaveTextContent('1/4');
      expect(
        screen.getByTestId(`linking-row-position-${T1263_B2}`),
      ).toHaveTextContent('2/4');
      expect(
        screen.getByTestId(`linking-row-position-${T1263_B3}`),
      ).toHaveTextContent('3/4');
      expect(
        screen.getByTestId(`linking-row-position-${T1263_A1}`),
      ).toHaveTextContent('4/4');

      // Group A is dissolved (only A2 remains and it's standalone).
      expect(screen.queryByTestId(`linking-group-${T1263_A1}`)).toBeNull();
      expect(screen.queryByTestId(`linking-group-${T1263_A2}`)).toBeNull();
      const a2Row = screen.getByTestId(`linking-row-${T1263_A2}`);
      expect(updatedGroupB.contains(a2Row)).toBe(false);

      // Localized announcement: "Moved to next group, position N",
      // where N is the post-move slot of the joining row inside the
      // target group (3 existing members + 1 = position 4).
      expect(getLinkingLiveRegion()).toHaveTextContent(
        'Moved to next group, position 4',
      );
    });
  });

  describe('French (currentLanguage="fr")', () => {
    beforeEach(() => {
      currentLanguage = 'fr';
    });

    it('ArrowRight on a row in the first group moves it into the next group and announces "Déplacé dans le groupe suivant, position 4"', async () => {
      renderPage();
      const groupA = await screen.findByTestId(
        `linking-group-${T1263_A1}`,
        undefined,
        { timeout: 4000 },
      );
      await flushAsyncEffects();

      expect(getRenderedChainOrder(groupA)).toEqual([T1263_A1, T1263_A2]);
      const groupB = screen.getByTestId(`linking-group-${T1263_B1}`);
      expect(getRenderedChainOrder(groupB)).toEqual([
        T1263_B1,
        T1263_B2,
        T1263_B3,
      ]);

      const a1Handle = screen.getByTestId(`linking-drag-handle-${T1263_A1}`);
      await act(async () => {
        a1Handle.focus();
        fireEvent.keyDown(a1Handle, { key: 'ArrowRight' });
      });
      await flushAsyncEffects();

      const updatedGroupB = screen.getByTestId(`linking-group-${T1263_B1}`);
      expect(getRenderedChainOrder(updatedGroupB)).toEqual([
        T1263_B1,
        T1263_B2,
        T1263_B3,
        T1263_A1,
      ]);

      expect(
        screen.getByTestId(`linking-row-position-${T1263_A1}`),
      ).toHaveTextContent('4/4');

      // French live-region copy must match the bilingual UI.
      expect(getLinkingLiveRegion()).toHaveTextContent(
        'Déplacé dans le groupe suivant, position 4',
      );
    });
  });
});
  });
});
