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
