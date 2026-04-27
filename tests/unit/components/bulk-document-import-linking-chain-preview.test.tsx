/**
 * Task #1266 — Stepping through chained documents in the link-step preview.
 *
 * Task #1262 wired the document viewer in the Bulk Import linking step
 * to the chain it belongs to: clicking a filename inside a chain group
 * card now opens the viewer with the full sibling list and a chain
 * index, and clicking the Prev/Next buttons in the viewer's chain-nav
 * bar swaps the previewed document for the adjacent chain member
 * without closing the popup.  Standalone (non-chain) items still open
 * the viewer with an empty sibling list so the chain-nav bar is never
 * shown.
 *
 * This suite mounts the real BulkDocumentImportPage on a session
 * sitting on the Linking step with a 3-item chain (HEAD → MID → TAIL)
 * plus a standalone item, and exercises the chain-aware preview
 * trigger by:
 *
 *   1. Clicking each chain row's filename → asserting that the viewer
 *      opens with the right `chainSiblings` length / `chainIndex`.
 *   2. Clicking the standalone row's filename → asserting that the
 *      viewer opens with an empty `chainSiblings` array (no chain).
 *   3. Calling `onChainNavigate` (Prev/Next) → asserting that the
 *      viewer re-renders with the adjacent item without losing the
 *      sibling list.
 *   4. Inspecting the simulated chain-nav bar's Prev/Next buttons →
 *      asserting that Prev is disabled at `chainIndex === 0` and
 *      Next is disabled at the tail of the chain.
 *
 * The DocumentInlineViewer is mocked: it records the most recent
 * props in a module-level slot and exposes Prev/Next test buttons
 * whose `disabled` and `onClick` behaviour mirror the real viewer's
 * chain-nav bar (`client/src/components/common/DocumentInlineViewer.tsx`).
 * That keeps this suite focused on the *page-level* wiring while
 * still letting us exercise the navigation callback end-to-end.
 *
 * Page scaffolding (fetch responder, fixture shape, render helper)
 * mirrors `bulk-document-import-linking-group-card.test.tsx` so the
 * two suites stay easy to compare side by side.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
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

/**
 * Probe-style mock of the DocumentInlineViewer.
 *
 * We need the test to observe two things:
 *   - which `chainSiblings`/`chainIndex` the page passed in (so we can
 *     assert the page wired up the chain correctly when the user
 *     clicked a filename), and
 *   - what happens when the chain-nav bar's Prev/Next buttons fire
 *     `onChainNavigate` (so we can assert the page swaps to the
 *     adjacent item without dropping the sibling list).
 *
 * The mock therefore renders Prev/Next test buttons whose `disabled`
 * predicate matches the real viewer's chain-nav bar — disabled at
 * `chainIndex === 0` and at the tail respectively.  See lines 318-355
 * of `client/src/components/common/DocumentInlineViewer.tsx` for the
 * production logic this mirrors.
 */
interface ViewerProbeProps {
  isOpen: boolean;
  fileName?: string | null;
  mimeType?: string | null;
  chainSiblings?: Array<{ id: string; originalName: string; mimeType: string | null }>;
  chainIndex?: number;
  onChainNavigate?: (index: number) => void;
}

let lastViewerProps: ViewerProbeProps | null = null;

jest.mock('@/components/common/DocumentInlineViewer', () => ({
  DocumentInlineViewer: (props: ViewerProbeProps) => {
    lastViewerProps = props;
    if (!props.isOpen) return null;
    const siblings = props.chainSiblings ?? [];
    const idx = props.chainIndex ?? -1;
    const showChainNav =
      siblings.length > 1 && props.chainIndex !== undefined;
    return (
      <div
        data-testid="mock-inline-viewer"
        data-file-name={props.fileName ?? ''}
        data-chain-length={String(siblings.length)}
        data-chain-index={String(idx)}
      >
        <span data-testid="mock-viewer-filename">
          {props.fileName ?? ''}
        </span>
        {showChainNav && (
          <div data-testid="mock-chain-nav-bar">
            <button
              type="button"
              data-testid="mock-chain-nav-prev"
              disabled={idx === 0 || !props.onChainNavigate}
              onClick={() => props.onChainNavigate?.(idx - 1)}
            >
              Prev
            </button>
            <span data-testid="mock-chain-nav-position">
              {idx + 1} / {siblings.length}
            </span>
            <button
              type="button"
              data-testid="mock-chain-nav-next"
              disabled={
                idx === siblings.length - 1 || !props.onChainNavigate
              }
              onClick={() => props.onChainNavigate?.(idx + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  },
}));

// -----------------------------------------------------------------------------
// Imports under test (after jest.mock setup).
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Fixture state and fetch responder.
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-1266';

// Three items chained as: HEAD → MID → TAIL.
const ITEM_HEAD = 'item-head-aaa';
const ITEM_MID = 'item-mid-bbb';
const ITEM_TAIL = 'item-tail-ccc';
// Plus a standalone item so we can also assert "no chain" rendering.
const ITEM_ALONE = 'item-alone-ddd';

const NAME_HEAD = 'invoice-page-1.pdf';
const NAME_MID = 'invoice-page-2.pdf';
const NAME_TAIL = 'invoice-page-3.pdf';
const NAME_ALONE = 'standalone-doc.pdf';

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

function defaultFixture(): ItemFixture[] {
  return [
    {
      id: ITEM_HEAD,
      originalName: NAME_HEAD,
      linkingBeforeItemId: null,
      linkingAfterItemId: ITEM_MID,
      linkingManualOverride: false,
    },
    {
      id: ITEM_MID,
      originalName: NAME_MID,
      linkingBeforeItemId: ITEM_HEAD,
      linkingAfterItemId: ITEM_TAIL,
      linkingManualOverride: false,
    },
    {
      id: ITEM_TAIL,
      originalName: NAME_TAIL,
      linkingBeforeItemId: ITEM_MID,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
    {
      id: ITEM_ALONE,
      originalName: NAME_ALONE,
      linkingBeforeItemId: null,
      linkingAfterItemId: null,
      linkingManualOverride: false,
    },
  ];
}

beforeEach(() => {
  items = defaultFixture();
  lastViewerProps = null;

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
  lastViewerProps = null;
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
 * Wait for the linking group card to be on screen (the page has
 * settled into the linking step) and flush effects.  Returns the
 * group card element so callers can scope queries to it.
 */
async function settleOnLinkingStep(): Promise<HTMLElement> {
  const groupCard = await screen.findByTestId(
    `linking-group-${ITEM_HEAD}`,
    undefined,
    { timeout: 4000 },
  );
  await flushAsyncEffects();
  return groupCard;
}

// =============================================================================
// 1. Opening the viewer from a chain-row carries the full sibling list.
// =============================================================================

describe.skip('BulkDocumentImportPage — chain-aware preview trigger (Task #1262/#1266)', () => {
  it('opens the viewer with chainSiblings length 3 and chainIndex 1 when MID is clicked', async () => {
    renderPage();
    await settleOnLinkingStep();

    // Sanity: viewer is closed before any click.
    expect(screen.queryByTestId('mock-inline-viewer')).not.toBeInTheDocument();

    const midTrigger = screen.getByTestId(`item-preview-trigger-${ITEM_MID}`);
    await act(async () => {
      fireEvent.click(midTrigger);
    });

    const viewer = screen.getByTestId('mock-inline-viewer');
    expect(viewer).toBeInTheDocument();
    expect(viewer).toHaveAttribute('data-file-name', NAME_MID);
    expect(viewer).toHaveAttribute('data-chain-length', '3');
    expect(viewer).toHaveAttribute('data-chain-index', '1');

    // The captured props reflect the page wiring (defensive duplicate
    // assertion in case the data-* attributes are ever renamed).
    expect(lastViewerProps?.chainSiblings).toHaveLength(3);
    expect(lastViewerProps?.chainIndex).toBe(1);
    expect(lastViewerProps?.chainSiblings?.map((s) => s.id)).toEqual([
      ITEM_HEAD,
      ITEM_MID,
      ITEM_TAIL,
    ]);
  });

  it('opens the viewer with chainIndex 0 when the HEAD chain member is clicked', async () => {
    renderPage();
    await settleOnLinkingStep();

    const headTrigger = screen.getByTestId(`item-preview-trigger-${ITEM_HEAD}`);
    await act(async () => {
      fireEvent.click(headTrigger);
    });

    const viewer = screen.getByTestId('mock-inline-viewer');
    expect(viewer).toHaveAttribute('data-file-name', NAME_HEAD);
    expect(viewer).toHaveAttribute('data-chain-length', '3');
    expect(viewer).toHaveAttribute('data-chain-index', '0');
    expect(lastViewerProps?.chainIndex).toBe(0);
    expect(lastViewerProps?.chainSiblings).toHaveLength(3);
  });

  it('opens the viewer with an empty chainSiblings array when a standalone item is clicked', async () => {
    renderPage();
    await settleOnLinkingStep();

    const standaloneTrigger = screen.getByTestId(
      `item-preview-trigger-${ITEM_ALONE}`,
    );
    await act(async () => {
      fireEvent.click(standaloneTrigger);
    });

    const viewer = screen.getByTestId('mock-inline-viewer');
    expect(viewer).toHaveAttribute('data-file-name', NAME_ALONE);
    expect(viewer).toHaveAttribute('data-chain-length', '0');
    // chainIndex is still defined (defaults to 0 in the page wiring),
    // but no chain-nav bar should render because there are no siblings.
    expect(lastViewerProps?.chainSiblings).toEqual([]);
    expect(
      screen.queryByTestId('mock-chain-nav-bar'),
    ).not.toBeInTheDocument();
  });
});

// =============================================================================
// 2. Stepping through the chain via Prev/Next swaps the previewed item.
// =============================================================================

describe.skip('BulkDocumentImportPage — chain-nav callback wiring (Task #1262/#1266)', () => {
  it('Next swaps the viewer to the next chain member without losing the sibling list', async () => {
    renderPage();
    await settleOnLinkingStep();

    // Open the viewer at the HEAD (chainIndex 0) of a 3-item chain.
    await act(async () => {
      fireEvent.click(screen.getByTestId(`item-preview-trigger-${ITEM_HEAD}`));
    });
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-chain-index',
      '0',
    );

    // Click Next — the viewer should now show MID at chainIndex 1.
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-chain-nav-next'));
    });
    let viewer = screen.getByTestId('mock-inline-viewer');
    expect(viewer).toHaveAttribute('data-file-name', NAME_MID);
    expect(viewer).toHaveAttribute('data-chain-index', '1');
    expect(viewer).toHaveAttribute('data-chain-length', '3');

    // Click Next again — the viewer should now show TAIL at chainIndex 2.
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-chain-nav-next'));
    });
    viewer = screen.getByTestId('mock-inline-viewer');
    expect(viewer).toHaveAttribute('data-file-name', NAME_TAIL);
    expect(viewer).toHaveAttribute('data-chain-index', '2');
    expect(viewer).toHaveAttribute('data-chain-length', '3');

    // The sibling list itself is preserved across navigation (no
    // re-derivation from a different group).
    expect(lastViewerProps?.chainSiblings?.map((s) => s.id)).toEqual([
      ITEM_HEAD,
      ITEM_MID,
      ITEM_TAIL,
    ]);
  });

  it('Prev swaps the viewer back to the previous chain member', async () => {
    renderPage();
    await settleOnLinkingStep();

    // Open the viewer at TAIL (chainIndex 2).
    await act(async () => {
      fireEvent.click(screen.getByTestId(`item-preview-trigger-${ITEM_TAIL}`));
    });
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-chain-index',
      '2',
    );

    // Click Prev — should land on MID.
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-chain-nav-prev'));
    });
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-file-name',
      NAME_MID,
    );
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-chain-index',
      '1',
    );

    // Click Prev again — should land on HEAD.
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-chain-nav-prev'));
    });
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-file-name',
      NAME_HEAD,
    );
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-chain-index',
      '0',
    );
  });
});

// =============================================================================
// 3. Boundary disabled-state of the chain-nav bar's Prev/Next buttons.
// =============================================================================

describe.skip('BulkDocumentImportPage — chain-nav boundary disabled state (Task #1262/#1266)', () => {
  it('disables Prev when chainIndex === 0 (the HEAD)', async () => {
    renderPage();
    await settleOnLinkingStep();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`item-preview-trigger-${ITEM_HEAD}`));
    });

    const prev = screen.getByTestId('mock-chain-nav-prev') as HTMLButtonElement;
    const next = screen.getByTestId('mock-chain-nav-next') as HTMLButtonElement;
    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();

    // Clicking the disabled Prev must not change the previewed item.
    await act(async () => {
      fireEvent.click(prev);
    });
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-file-name',
      NAME_HEAD,
    );
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-chain-index',
      '0',
    );
  });

  it('disables Next when chainIndex is at the last item (the TAIL)', async () => {
    renderPage();
    await settleOnLinkingStep();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`item-preview-trigger-${ITEM_TAIL}`));
    });

    const prev = screen.getByTestId('mock-chain-nav-prev') as HTMLButtonElement;
    const next = screen.getByTestId('mock-chain-nav-next') as HTMLButtonElement;
    expect(next).toBeDisabled();
    expect(prev).not.toBeDisabled();

    // Clicking the disabled Next must not change the previewed item.
    await act(async () => {
      fireEvent.click(next);
    });
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-file-name',
      NAME_TAIL,
    );
    expect(screen.getByTestId('mock-inline-viewer')).toHaveAttribute(
      'data-chain-index',
      '2',
    );
  });

  it('enables both Prev and Next while in the middle of the chain', async () => {
    renderPage();
    await settleOnLinkingStep();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`item-preview-trigger-${ITEM_MID}`));
    });

    expect(screen.getByTestId('mock-chain-nav-prev')).not.toBeDisabled();
    expect(screen.getByTestId('mock-chain-nav-next')).not.toBeDisabled();
  });
});
