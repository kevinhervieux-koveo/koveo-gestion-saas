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
import { render, screen, cleanup, act } from '@testing-library/react';
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
      // 'identified' is late enough that the row is visible in the
      // Linking step (not filtered as 'rejected').
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

  // No mutations are exercised by these read-only rendering tests.
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
    {
      id: ITEM_ALONE,
      originalName: 'standalone-doc.pdf',
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
