/**
 * Task #1242 — Integration coverage for the Linking step's group card.
 *
 * Task #1233 introduced AI-suggested document chains in the Linking step.
 * Each chain is rendered as a single group card with:
 *   - a header showing the chain size (and a "Manual" badge if any item
 *     in the chain has `linkingManualOverride === true`),
 *   - a draggable row per chain member with:
 *       - a keyboard-accessible drag handle
 *         (`linking-drag-handle-${id}`),
 *       - a position indicator showing "N/total"
 *         (`linking-row-position-${id}`),
 *       - a per-row "Manual" tag when that specific item has
 *         `linkingManualOverride === true`
 *         (`linking-manual-tag-${id}`),
 *   - the chain members hidden from the flat list (only standalone
 *     items appear outside groups).
 *
 * This suite mounts the real BulkDocumentImportPage on a session
 * sitting on the Linking step with a 3-item chain plus a standalone
 * item and asserts each of those surfaces.  Page scaffolding mirrors
 * `tests/unit/components/bulk-document-import-text-only-degraded-badge.test.tsx`.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, act, fireEvent, within, waitFor } from '@testing-library/react';
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

// -----------------------------------------------------------------------------
// Imports under test (after jest.mock setup).
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Fixture state and fetch responder.
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-1242';

// Three items chained as: HEAD → MID → TAIL.
const ITEM_HEAD = 'item-head-aaa';
const ITEM_MID = 'item-mid-bbb';
const ITEM_TAIL = 'item-tail-ccc';
// Plus a standalone item so we can also assert "non-group" rendering.
const ITEM_ALONE = 'item-alone-ddd';

interface ItemFixture {
  id: string;
  originalName: string;
  status: string;
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
      // status comes from the fixture so individual tests can set it to
      // 'linked' (to verify the Commit button) without losing the
      // default 'identified' fixture used by all other tests.
      status: it.status as 'identified' | 'linked' | 'committed' | 'duplicate' | 'rejected',
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
  // optimistic overrides and revert the chain to the original order
  // before the break-group assertions can run.
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

/**
 * Default fixture: 3-item chain (HEAD → MID → TAIL) with no manual
 * overrides, plus a standalone fourth item.  Individual tests override
 * fields (e.g. linkingManualOverride) by reassigning the array before
 * calling renderPage().
 */
function defaultFixture(): ItemFixture[] {
  return [
    {
      id: ITEM_HEAD,
      originalName: 'invoice-page-1.pdf',
      status: 'identified',
      linkingBeforeItemId: null,
      linkingAfterItemId: ITEM_MID,
      linkingManualOverride: false,
    },
    {
      id: ITEM_MID,
      originalName: 'invoice-page-2.pdf',
      status: 'identified',
      linkingBeforeItemId: ITEM_HEAD,
      linkingAfterItemId: ITEM_TAIL,
      linkingManualOverride: false,
    },
    {
      id: ITEM_TAIL,
      originalName: 'invoice-page-3.pdf',
      status: 'identified',
      linkingBeforeItemId: ITEM_MID,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
    {
      id: ITEM_ALONE,
      originalName: 'standalone-doc.pdf',
      status: 'identified',
      linkingBeforeItemId: null,
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

// =============================================================================
// 1. Group card structure: card present, drag handles, position indicators
// =============================================================================

describe('BulkDocumentImportPage — Linking group card structure (Task #1233/#1242)', () => {
  it('renders one group card containing every chain member, in order', async () => {
    renderPage();
    // The chain head's group card uses HEAD as its key.
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    expect(groupCard).toBeInTheDocument();
    await flushAsyncEffects();

    // Every chain member must be rendered as a row inside the group.
    expect(
      screen.getByTestId(`linking-row-${ITEM_HEAD}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`linking-row-${ITEM_MID}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`linking-row-${ITEM_TAIL}`),
    ).toBeInTheDocument();

    // Visual order (rows top→bottom) must match the chain order. The
    // group card contains the rows directly; querying by testid prefix
    // preserves DOM order. Exclude `linking-row-position-*` (the per-row
    // position indicator) which shares the same prefix.
    const rowEls = Array.from(
      groupCard.querySelectorAll(
        '[data-testid^="linking-row-"]:not([data-testid^="linking-row-position-"])',
      ),
    ) as HTMLElement[];
    expect(rowEls.map((el) => el.getAttribute('data-testid'))).toEqual([
      `linking-row-${ITEM_HEAD}`,
      `linking-row-${ITEM_MID}`,
      `linking-row-${ITEM_TAIL}`,
    ]);
  });

  it('renders a keyboard-accessible drag handle for every chain member', async () => {
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      const handle = screen.getByTestId(`linking-drag-handle-${id}`);
      expect(handle).toBeInTheDocument();
      // The handle is a real focusable button so admins can use the
      // arrow-key DnD shortcuts.
      expect(handle.tagName).toBe('BUTTON');
      expect(handle).toHaveAttribute('tabindex', '0');
      // Aria-label uses the EN copy because currentLanguage='en'.
      expect(handle).toHaveAttribute(
        'aria-label',
        'Drag to reorder (arrow keys)',
      );
    }
  });

  it('renders a position indicator showing "N/total" for each chain member', async () => {
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    expect(
      screen.getByTestId(`linking-row-position-${ITEM_HEAD}`),
    ).toHaveTextContent('1/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_MID}`),
    ).toHaveTextContent('2/3');
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_TAIL}`),
    ).toHaveTextContent('3/3');
  });

  it('shows the chain header with the file count (EN copy)', async () => {
    renderPage();
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    // Header includes the localized "Chain · 3 files" copy. Use the
    // group card scope so we don't accidentally match other text on
    // the page.
    expect(groupCard).toHaveTextContent('Chain · 3 files');
  });

  it('renders the standalone item OUTSIDE any group card', async () => {
    renderPage();
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    // In the Linking step, BOTH chain members AND standalone items use
    // the `linking-row-${id}` testid (chain members are rendered inside
    // the group card; standalones are rendered at the top level).
    // The standalone row must therefore exist on the page but NOT
    // inside any group card.
    const standaloneRow = screen.getByTestId(`linking-row-${ITEM_ALONE}`);
    expect(standaloneRow).toBeInTheDocument();
    expect(groupCard.contains(standaloneRow)).toBe(false);

    // And conversely, the chain members must be rendered INSIDE the
    // group card — never at the top level alongside standalones.
    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      const row = screen.getByTestId(`linking-row-${id}`);
      expect(groupCard.contains(row)).toBe(true);
    }
  });
});

// =============================================================================
// 2. Manual-override badges
// =============================================================================

describe('BulkDocumentImportPage — Linking Manual badge (Task #1233/#1242)', () => {
  it('does NOT render any per-row Manual tag when no chain member is overridden', async () => {
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      expect(
        screen.queryByTestId(`linking-manual-tag-${id}`),
      ).not.toBeInTheDocument();
    }
  });

  it('renders the per-row Manual tag only on items with linkingManualOverride=true', async () => {
    items = defaultFixture();
    // Only the MID row is admin-curated.
    items[1].linkingManualOverride = true;
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    expect(
      screen.getByTestId(`linking-manual-tag-${ITEM_MID}`),
    ).toBeInTheDocument();
    // Other chain members must NOT carry the per-row tag.
    expect(
      screen.queryByTestId(`linking-manual-tag-${ITEM_HEAD}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`linking-manual-tag-${ITEM_TAIL}`),
    ).not.toBeInTheDocument();
  });

  /**
   * Locate the group's HEADER element by anchoring on the "Chain · N
   * files" copy and walking up to its enclosing flex row. Avoids
   * coupling the test to specific class names.
   */
  function getGroupHeader(groupCard: HTMLElement): HTMLElement {
    const chainText = Array.from(
      groupCard.querySelectorAll('span, div'),
    ).find((el) =>
      (el.textContent || '').trim().startsWith('Chain · '),
    ) as HTMLElement | undefined;
    if (!chainText) {
      throw new Error('Could not locate "Chain · N files" header text');
    }
    // The header is the immediate parent that holds the icon, the
    // "Chain · ..." span and (optionally) the Manual badge.
    const header = chainText.parentElement;
    if (!header) {
      throw new Error('Chain header text has no parent element');
    }
    return header as HTMLElement;
  }

  it('renders the group-level "Manual" header badge when any chain member is admin-curated', async () => {
    items = defaultFixture();
    items[2].linkingManualOverride = true; // TAIL was reordered manually.
    renderPage();
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    const header = getGroupHeader(groupCard);
    expect(header).toHaveTextContent('Chain · 3 files');
    // The header is the only place the bare word "Manual" appears
    // (per-row tags use the same word but live in row siblings, not
    // inside the header element).
    expect(header).toHaveTextContent('Manual');
  });

  it('does NOT render the group-level "Manual" header badge when every chain member is AI-suggested', async () => {
    renderPage();
    const groupCard = await screen.findByTestId(
      `linking-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    const header = getGroupHeader(groupCard);
    // Header still shows the chain-size copy but not the "Manual" badge.
    expect(header).toHaveTextContent('Chain · 3 files');
    expect(header).not.toHaveTextContent('Manual');
  });
});

// =============================================================================
// 3. Break-group button (Task #1281)
// =============================================================================

describe('BulkDocumentImportPage — Linking Break-group button (Task #1281)', () => {
  // The flow does several async hops (initial lite poll → break click →
  // mutation fetch).  Give the test a generous timeout (15s) — passed
  // as the third argument to `it` because `jest.setTimeout()` only
  // affects subsequent tests.
  it('renders the break-group button and persists null/null for every chain member when clicked', async () => {
    renderPage();
    // Wait for the break-group button to appear — only rendered once
    // the chain group card has been resolved and laid out.
    const breakBtn = await screen.findByTestId(
      `linking-break-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    expect(breakBtn).toHaveAttribute('aria-label', 'Break chain');
    expect(breakBtn).toHaveTextContent('Break chain');
    // Sanity: the chain rows really exist on the page before the click.
    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      expect(screen.getByTestId(`linking-row-${id}`)).toBeInTheDocument();
    }

    // Re-query the button immediately before clicking. The page does
    // multiple async settles between mount and "ready", and the live
    // group card may have been re-keyed/re-rendered during the lite
    // poll, leaving the original reference detached from the DOM.
    const liveBreakBtn = screen.getByTestId(
      `linking-break-group-${ITEM_HEAD}`,
    );
    expect(liveBreakBtn.isConnected).toBe(true);
    expect(liveBreakBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(liveBreakBtn);
    });
    await flushAsyncEffects();

    // The handler synchronously updates the aria-live announcement
    // *after* the optimistic `applyLinkingChanges` call, so seeing the
    // expected EN copy in the live region proves the click handler ran
    // to completion (and the optimistic state was queued).
    const liveRegion = document.querySelector(
      '[role="status"][aria-live="polite"]',
    );
    expect(liveRegion).not.toBeNull();
    expect(liveRegion!.textContent).toBe(
      'Chain broken — 3 files now standalone',
    );

    // The persistence mutation runs asynchronously — fetch() resolves on
    // a later microtask.  Wait until the batch endpoint has been hit,
    // then inspect the request body.
    function getPersistenceCalls() {
      return fetchMock.mock.calls.filter(([input, init]) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        const method = (init?.method || 'GET').toUpperCase();
        return (
          method === 'POST' &&
          url.includes(
            `/sessions/${SESSION_ID}/batch-set-linking-decisions`,
          )
        );
      });
    }
    await waitFor(
      () => {
        expect(getPersistenceCalls().length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 8000 },
    );
    const persistenceCalls = getPersistenceCalls();
    const [, init] = persistenceCalls[0]!;
    const body = JSON.parse(
      typeof init?.body === 'string' ? init.body : String(init?.body),
    );
    const decisions: Array<{
      itemId: string;
      beforeItemId: string | null;
      afterItemId: string | null;
    }> = body?.decisions ?? [];
    const decisionIds = decisions.map((d) => d.itemId).sort();
    expect(decisionIds).toEqual([ITEM_HEAD, ITEM_MID, ITEM_TAIL].sort());
    for (const d of decisions) {
      expect(d.beforeItemId).toBeNull();
      expect(d.afterItemId).toBeNull();
    }

    // UI outcome: optimistic update should remove the chain group card
    // and surface every former member as a standalone row (each item
    // still renders a `linking-row-position-*` testid, just no longer
    // nested inside the group container).
    await waitFor(
      () => {
        expect(
          screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
        ).not.toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      expect(
        screen.getByTestId(`linking-row-position-${id}`),
      ).toBeInTheDocument();
    }
  }, 15000);

  it('renders the FR aria-label and live-region copy when language is fr', async () => {
    currentLanguage = 'fr';
    try {
      renderPage();
      const breakBtn = await screen.findByTestId(
        `linking-break-group-${ITEM_HEAD}`,
        undefined,
        { timeout: 4000 },
      );
      await flushAsyncEffects();

      expect(breakBtn).toHaveAttribute('aria-label', 'Dissocier la chaîne');
      expect(breakBtn).toHaveTextContent('Dissocier la chaîne');

      const liveBreakBtn = screen.getByTestId(
        `linking-break-group-${ITEM_HEAD}`,
      );
      await act(async () => {
        fireEvent.click(liveBreakBtn);
      });
      await flushAsyncEffects();

      const liveRegion = document.querySelector(
        '[role="status"][aria-live="polite"]',
      );
      expect(liveRegion).not.toBeNull();
      expect(liveRegion!.textContent).toBe(
        'Chaîne dissociée — 3 fichiers désormais autonomes',
      );
    } finally {
      currentLanguage = 'en';
    }
  }, 15000);

  it('activates the break-group button via keyboard (Enter)', async () => {
    renderPage();
    const breakBtn = await screen.findByTestId(
      `linking-break-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    // Native <button> elements activate their click handler on
    // Enter / Space keypresses; firing a `click` event after focus
    // mirrors what assistive technologies trigger when activating the
    // control via the keyboard.  We additionally assert focusability.
    const liveBreakBtn = screen.getByTestId(
      `linking-break-group-${ITEM_HEAD}`,
    );
    liveBreakBtn.focus();
    expect(document.activeElement).toBe(liveBreakBtn);

    await act(async () => {
      fireEvent.keyDown(liveBreakBtn, { key: 'Enter', code: 'Enter' });
      // jsdom does not auto-fire `click` on Enter for buttons, so emit
      // it explicitly to model the platform behaviour observed in real
      // browsers when a focused <button> receives Enter.
      fireEvent.click(liveBreakBtn);
    });
    await flushAsyncEffects();

    const liveRegion = document.querySelector(
      '[role="status"][aria-live="polite"]',
    );
    expect(liveRegion).not.toBeNull();
    expect(liveRegion!.textContent).toBe(
      'Chain broken — 3 files now standalone',
    );
  }, 15000);
});

// =============================================================================
// 4. Task #1298 — Chains stay broken after a fresh page mount
//
// Task #1281 covers the click → optimistic UI → persistence payload cycle
// for the "Break group" button.  It does NOT verify that the persisted
// nulls round-trip back through `buildSessionPayload` (the lite poll's
// payload shape) and re-derive into the standalone topology when the
// page is mounted from scratch.  A regression in how the session loader
// re-hydrates `linkingBeforeItemId/AfterItemId` (or how
// `resolveLinkingGroups` derives groups from those pointers) could
// silently restore the chain on reload even though Task #1281 still
// passes.
//
// This test mounts the page once, clicks Break group, waits for the
// optimistic + persistence cycle to complete (the fetch responder
// mutates the in-memory `items` fixture so the next lite payload
// reflects the persisted nulls), then unmounts the page and clears the
// React Query cache.  It re-mounts a brand-new page tree against the
// same SESSION_ID and asserts the chain is gone:
//   - no `linking-group-${ITEM_HEAD}` card is rendered, and
//   - each former chain member appears as a standalone row keyed by its
//     `linking-row-position-${id}` testid.
// =============================================================================

describe('BulkDocumentImportPage — Chain stays broken across page remount (Task #1298)', () => {
  it('re-mounts a fresh page against persisted nulls and shows every former member standalone', async () => {
    // ---- First mount: trigger Break group and let persistence settle ----
    const { unmount } = renderPage();
    const breakBtn = await screen.findByTestId(
      `linking-break-group-${ITEM_HEAD}`,
      undefined,
      { timeout: 4000 },
    );
    await flushAsyncEffects();

    const liveBreakBtn = screen.getByTestId(
      `linking-break-group-${ITEM_HEAD}`,
    );
    await act(async () => {
      fireEvent.click(liveBreakBtn);
    });
    await flushAsyncEffects();

    // Wait for the persistence POST to land — the fetch responder
    // mutates `items` in place when this call arrives, so once it has
    // fired the in-memory fixture reflects the persisted nulls and
    // any subsequent `buildSessionPayload()` call will hand back the
    // post-break server-of-record state.
    function getPersistenceCalls() {
      return fetchMock.mock.calls.filter(([input, init]) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        const method = (init?.method || 'GET').toUpperCase();
        return (
          method === 'POST' &&
          url.includes(
            `/sessions/${SESSION_ID}/batch-set-linking-decisions`,
          )
        );
      });
    }
    await waitFor(
      () => {
        expect(getPersistenceCalls().length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 8000 },
    );

    // Sanity: confirm the fetch responder really did persist nulls into
    // the shared `items` fixture before we unmount.  Without this the
    // remount could silently re-hydrate the original chain pointers
    // and the assertions below would no longer prove anything about
    // the round-trip.
    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      const persisted = items.find((i) => i.id === id);
      expect(persisted).toBeDefined();
      expect(persisted!.linkingBeforeItemId).toBeNull();
      expect(persisted!.linkingAfterItemId).toBeNull();
    }

    // ---- Unmount the page and drop all in-memory React Query state ----
    // `queryClient.clear()` removes every cached lite-poll entry so the
    // next mount has to re-fetch the session from scratch (mirroring a
    // browser hard-reload).  `localStorage` is intentionally NOT
    // cleared so the page picks up the same SESSION_ID as before.
    unmount();
    cleanup();
    queryClient.clear();

    // ---- Second mount: fresh page tree, fresh fetches ----
    renderPage();

    // The lite poll fires a GET against the same endpoint as before.
    // Wait until the page has finished re-hydrating from the
    // updated `buildSessionPayload()` (the linking step renders the
    // standalone-row position indicators only after the session has
    // resolved and the chain derivation has run).
    await waitFor(
      () => {
        for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL, ITEM_ALONE]) {
          expect(
            screen.getByTestId(`linking-row-position-${id}`),
          ).toBeInTheDocument();
        }
      },
      { timeout: 8000 },
    );
    await flushAsyncEffects();

    // The chain head's group card must be GONE — derivation against
    // the persisted nulls should produce zero groups for the former
    // chain members.
    expect(
      screen.queryByTestId(`linking-group-${ITEM_HEAD}`),
    ).not.toBeInTheDocument();
    // Defensive: no other former member should anchor a group card
    // either (e.g. via a stale before-pointer that got persisted by
    // mistake).
    expect(
      screen.queryByTestId(`linking-group-${ITEM_MID}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`linking-group-${ITEM_TAIL}`),
    ).not.toBeInTheDocument();

    // Each former chain member must now render its own
    // `linking-row-position-${id}` testid as a top-level standalone
    // row.  The position indicator is the canonical "this row exists
    // in the flat list" signal asked for by the task spec.
    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      const positionEl = screen.getByTestId(
        `linking-row-position-${id}`,
      );
      expect(positionEl).toBeInTheDocument();
    }

    // The original standalone item from the fixture should still be
    // present and unaffected by the break — guards against the
    // remount accidentally dropping unrelated rows.
    expect(
      screen.getByTestId(`linking-row-position-${ITEM_ALONE}`),
    ).toBeInTheDocument();
  }, 20000);
});

// =============================================================================
// 5. Task #1282 — Commit button visibility for manually-curated chains
//
// The Commit / Sauvegarder button renders only when a row's status is
// 'linked'.  Before Task #1282 the manual-link endpoints never updated
// status, so rows dragged into a chain stayed 'identified' and their
// Commit buttons never appeared.  These tests confirm the button is
// present for every non-excluded chain member once the payload reflects
// the correct status.
// =============================================================================

describe('BulkDocumentImportPage — Commit button on linked chain rows (Task #1282)', () => {
  it('renders the Commit button for every chain member when all statuses are "linked"', async () => {
    // Override all chain members to status: 'linked' to simulate what the
    // fixed manual-linking endpoints now persist.
    items = defaultFixture().map((it) => ({
      ...it,
      status: it.linkingBeforeItemId !== null || it.linkingAfterItemId !== null ? 'linked' : it.status,
    }));

    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    // Commit button must appear for every chain member.
    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      expect(
        screen.getByTestId(`button-commit-${id}`),
      ).toBeInTheDocument();
    }
  });

  it('does NOT render the Commit button for chain members that are still "identified"', async () => {
    // Default fixture keeps status: 'identified' — simulating the
    // pre-fix state where the endpoint never promoted status.
    renderPage();
    await screen.findByTestId(`linking-group-${ITEM_HEAD}`, undefined, {
      timeout: 4000,
    });
    await flushAsyncEffects();

    for (const id of [ITEM_HEAD, ITEM_MID, ITEM_TAIL]) {
      expect(
        screen.queryByTestId(`button-commit-${id}`),
      ).not.toBeInTheDocument();
    }
  });
});
