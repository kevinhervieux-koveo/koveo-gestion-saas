/**
 * Task #802 — Frontend coverage for the residence picker added to the
 * Sorting / Branching step of the bulk-document-import wizard by
 * Task #780.
 *
 * The picker has two distinct surface pieces, both gated by
 * `item.branch === 'residence_documents'`:
 *
 *   1. Per-row badge — the small pill on the right side of the row
 *      header that summarises the current residence assignment.
 *      It comes in two flavours:
 *        - "Residence required" (red, testid
 *          `badge-residence-needed-{id}`) when no residenceId is set.
 *          Clicking it opens the picker panel.
 *        - "<unitNumber>" (blue, testid `badge-residence-{id}`) when
 *          a residenceId IS set. Clicking it re-opens the picker so
 *          the admin can change or clear the assignment. A "(manual)"
 *          suffix is appended when `residenceManualOverride` is true.
 *
 *   2. Picker panel (testid `residence-picker-{id}`) — appears
 *      below the row when the badge is clicked. It contains:
 *        - a Select trigger (testid `residence-picker-select-{id}`)
 *          listing every residence in the active building;
 *        - a Save button (testid `button-residence-save-{id}`),
 *          disabled until a value is chosen, that POSTs to
 *          `/api/admin/bulk-import/items/{id}/set-residence`;
 *        - a Clear button (testid `button-residence-clear-{id}`)
 *          shown only when the item already has a residenceId,
 *          which POSTs `{ residenceId: null }` to the same endpoint;
 *        - a Cancel button that closes the panel without a request.
 *
 * The cases below mount the real BulkDocumentImportPage on a session
 * sitting on the branching step and verify each of those surfaces.
 * Items that are NOT routed to `residence_documents` must never show
 * the badge or the panel — this is exercised in a negative case so
 * the gating can't silently regress.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Module mocks (declared before importing the page under test).
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

// -----------------------------------------------------------------------------
// Imports under test
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// jsdom doesn't implement scrollIntoView, but radix-select calls it from
// useEffect when the listbox opens. Without this shim the listbox flushes
// a sync error and `findByRole('option')` never finds the items.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function () {};
}
if (typeof (HTMLElement.prototype as { hasPointerCapture?: unknown }).hasPointerCapture !== 'function') {
  (HTMLElement.prototype as { hasPointerCapture?: () => boolean }).hasPointerCapture = function () { return false; };
}
if (typeof (HTMLElement.prototype as { releasePointerCapture?: unknown }).releasePointerCapture !== 'function') {
  (HTMLElement.prototype as { releasePointerCapture?: () => void }).releasePointerCapture = function () {};
}

// -----------------------------------------------------------------------------
// Fixture helpers
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-802';
const BUILDING_ID = 'building-1';

const ITEM_NEEDS_RESIDENCE = 'item-needs-residence';
const ITEM_HAS_RESIDENCE = 'item-has-residence';
const ITEM_MANUAL_OVERRIDE = 'item-manual-override';
const ITEM_NOT_RESIDENCE_BRANCH = 'item-bill';

const RESIDENCES = [
  { id: 'res-101', unitNumber: '101' },
  { id: 'res-202', unitNumber: '202' },
  { id: 'res-303', unitNumber: '303' },
];

interface ItemFixture {
  id: string;
  originalName: string;
  status: string;
  branch: string | null;
  residenceId: string | null;
  residenceManualOverride: boolean;
  residenceReason: string | null;
}

function buildItem(overrides: ItemFixture) {
  return {
    id: overrides.id,
    originalName: overrides.originalName,
    mimeType: 'application/pdf',
    status: overrides.status,
    preExcludeStatus: null,
    excludeSource: null,
    branch: overrides.branch,
    subCategory: 'lease',
    branchManualOverride: false,
    branchReason: 'looks like a lease',
    residenceId: overrides.residenceId,
    residenceConfidence: overrides.residenceId ? 0.8 : null,
    residenceReason: overrides.residenceReason,
    residenceFallbackReason: overrides.residenceId
      ? null
      : 'AI could not determine the residence',
    residenceManualOverride: overrides.residenceManualOverride,
    screeningConfidence: null,
    screeningFallback: null,
    screeningTypeGuess: null,
    screeningBucketGuess: null,
    screeningQaReason: null,
    screeningRotationApplied: false,
    screeningRotationDegrees: 0,
    sortingConfidence: null,
    sortingFallback: null,
    sortingDecision: null,
    sortingReason: null,
    sortingMergeWithItemId: null,
    sortingMergeWithItemIds: null,
    sortingSplitAtPage: null,
    sortingDecisionState: null,
    sortingManualOverride: false,
    branchingConfidence: 0.9,
    branchingFallback: null,
    identificationConfidence: null,
    identificationFallback: null,
    linkingConfidence: null,
    linkingFallback: null,
  };
}

function buildPayload(items: ReturnType<typeof buildItem>[]) {
  return {
    session: {
      id: SESSION_ID,
      buildingId: BUILDING_ID,
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'branching',
      status: 'active',
      progress: {
        runAll: {
          screening: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          sorting: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          branching: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
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
    blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' }),
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

interface SetResidenceCall {
  itemId: string;
  body: { residenceId: string | null };
}

const setResidenceCalls: SetResidenceCall[] = [];

function makeFetchMock(items: ReturnType<typeof buildItem>[]) {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
        return jsonResponse(buildPayload(items));
      }
      if (pathname === `/api/buildings/${BUILDING_ID}/residences`) {
        return jsonResponse(RESIDENCES);
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      }
    }

    if (method === 'POST') {
      const setResidenceMatch = pathname.match(
        /^\/api\/admin\/bulk-import\/items\/([^/]+)\/set-residence$/,
      );
      if (setResidenceMatch) {
        const itemId = setResidenceMatch[1];
        const body = init?.body
          ? JSON.parse(init.body as string)
          : { residenceId: null };
        setResidenceCalls.push({ itemId, body });
        return jsonResponse({
          id: itemId,
          status: body.residenceId ? 'branched' : 'sorted',
          branchDecision: {
            branch: 'residence_documents',
            residenceId: body.residenceId,
            residenceManualOverride: !!body.residenceId,
          },
        });
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ unmocked: true, url, method }, 404);
  }) as unknown as jest.MockedFunction<typeof fetch>;
}

let originalFetch: typeof fetch | undefined;

function setupTest(items: ReturnType<typeof buildItem>[]) {
  const payload = buildPayload(items);
  global.fetch = makeFetchMock(items);
  // Pre-warm both queries so the page renders the rows + residence
  // dropdown immediately, without depending on the async fetch
  // settle.
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    payload,
  );
  queryClient.setQueryData(
    ['/api/buildings', BUILDING_ID, 'residences'],
    RESIDENCES,
  );
}

beforeEach(() => {
  originalFetch = global.fetch;
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
  setResidenceCalls.length = 0;
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

// =============================================================================
// 1. Per-row residence badge
// =============================================================================

describe('BulkDocumentImportPage — residence badge (Task #780/#802)', () => {
  it('shows the red "Residence required" badge when branch=residence_documents and residenceId is null', async () => {
    setupTest([
      buildItem({
        id: ITEM_NEEDS_RESIDENCE,
        originalName: 'lease-no-unit.pdf',
        status: 'sorted', // gate held the item back
        branch: 'residence_documents',
        residenceId: null,
        residenceManualOverride: false,
        residenceReason: null,
      }),
    ]);
    renderPage();

    const badge = await screen.findByTestId(
      `badge-residence-needed-${ITEM_NEEDS_RESIDENCE}`,
      undefined,
      { timeout: 4000 },
    );
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/Residence required/i);

    // The "assigned" variant of the badge must NOT be present.
    expect(
      screen.queryByTestId(`badge-residence-${ITEM_NEEDS_RESIDENCE}`),
    ).not.toBeInTheDocument();
  });

  it('shows the blue residence badge with the unit number when residenceId is set', async () => {
    setupTest([
      buildItem({
        id: ITEM_HAS_RESIDENCE,
        originalName: 'lease-101.pdf',
        status: 'branched',
        branch: 'residence_documents',
        residenceId: 'res-101',
        residenceManualOverride: false,
        residenceReason: 'unit 101 in filename',
      }),
    ]);
    renderPage();

    const badge = await screen.findByTestId(
      `badge-residence-${ITEM_HAS_RESIDENCE}`,
      undefined,
      { timeout: 4000 },
    );
    expect(badge).toBeInTheDocument();
    // The unit number from the residences fetch (101) must be rendered,
    // not the raw residenceId — that's the whole point of the lookup map.
    expect(badge).toHaveTextContent('101');
    // No "(manual)" suffix on AI-picked rows.
    expect(badge).not.toHaveTextContent(/manual/i);

    expect(
      screen.queryByTestId(`badge-residence-needed-${ITEM_HAS_RESIDENCE}`),
    ).not.toBeInTheDocument();
  });

  it('appends "(manual)" to the badge when residenceManualOverride is true', async () => {
    setupTest([
      buildItem({
        id: ITEM_MANUAL_OVERRIDE,
        originalName: 'lease-manual.pdf',
        status: 'branched',
        branch: 'residence_documents',
        residenceId: 'res-202',
        residenceManualOverride: true,
        residenceReason: null,
      }),
    ]);
    renderPage();

    const badge = await screen.findByTestId(
      `badge-residence-${ITEM_MANUAL_OVERRIDE}`,
      undefined,
      { timeout: 4000 },
    );
    expect(badge).toHaveTextContent('202');
    expect(badge).toHaveTextContent(/\(manual\)/);
  });

  it('does NOT render either residence badge when the item is routed to a non-residence branch', async () => {
    setupTest([
      buildItem({
        id: ITEM_NOT_RESIDENCE_BRANCH,
        originalName: 'electricity.pdf',
        status: 'branched',
        branch: 'bill',
        residenceId: null,
        residenceManualOverride: false,
        residenceReason: null,
      }),
    ]);
    renderPage();

    // Wait for the row to render before asserting absence so we don't
    // pass simply because the page hasn't loaded yet.
    await screen.findByTestId(
      `item-row-${ITEM_NOT_RESIDENCE_BRANCH}`,
      undefined,
      { timeout: 4000 },
    );
    expect(
      screen.queryByTestId(`badge-residence-${ITEM_NOT_RESIDENCE_BRANCH}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`badge-residence-needed-${ITEM_NOT_RESIDENCE_BRANCH}`),
    ).not.toBeInTheDocument();
  });
});

// =============================================================================
// 2. Picker panel — open / save / clear
// =============================================================================

describe('BulkDocumentImportPage — residence picker panel (Task #780/#802)', () => {
  it('opens the picker panel when the "Residence required" badge is clicked', async () => {
    setupTest([
      buildItem({
        id: ITEM_NEEDS_RESIDENCE,
        originalName: 'lease.pdf',
        status: 'sorted',
        branch: 'residence_documents',
        residenceId: null,
        residenceManualOverride: false,
        residenceReason: null,
      }),
    ]);
    renderPage();

    const badge = await screen.findByTestId(
      `badge-residence-needed-${ITEM_NEEDS_RESIDENCE}`,
      undefined,
      { timeout: 4000 },
    );

    // Picker panel hidden initially.
    expect(
      screen.queryByTestId(`residence-picker-${ITEM_NEEDS_RESIDENCE}`),
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(badge);
    });

    const panel = await screen.findByTestId(
      `residence-picker-${ITEM_NEEDS_RESIDENCE}`,
    );
    expect(panel).toBeInTheDocument();
    // The Select trigger is inside the panel.
    expect(
      screen.getByTestId(`residence-picker-select-${ITEM_NEEDS_RESIDENCE}`),
    ).toBeInTheDocument();
    // Save button is rendered but disabled (nothing picked yet).
    const save = screen.getByTestId(`button-residence-save-${ITEM_NEEDS_RESIDENCE}`);
    expect(save).toBeInTheDocument();
    expect(save).toBeDisabled();
    // Clear button is NOT rendered when there is no residenceId yet.
    expect(
      screen.queryByTestId(`button-residence-clear-${ITEM_NEEDS_RESIDENCE}`),
    ).not.toBeInTheDocument();
  });

  it('shows the Clear button in the panel when the item already has a residenceId, and POSTs null when clicked', async () => {
    setupTest([
      buildItem({
        id: ITEM_HAS_RESIDENCE,
        originalName: 'lease-101.pdf',
        status: 'branched',
        branch: 'residence_documents',
        residenceId: 'res-101',
        residenceManualOverride: false,
        residenceReason: null,
      }),
    ]);
    renderPage();

    const badge = await screen.findByTestId(
      `badge-residence-${ITEM_HAS_RESIDENCE}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(badge);
    });

    const clearBtn = await screen.findByTestId(
      `button-residence-clear-${ITEM_HAS_RESIDENCE}`,
    );
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(clearBtn);
    });

    await waitFor(() => {
      expect(setResidenceCalls).toHaveLength(1);
    });
    expect(setResidenceCalls[0]).toEqual({
      itemId: ITEM_HAS_RESIDENCE,
      body: { residenceId: null },
    });
  });

  it('Save button stays disabled until a residence is chosen, then POSTs the chosen residenceId', async () => {
    // Use a "needs residence" item so the badge click opens an empty
    // picker; we then drive `setResidencePickerValue` directly via the
    // hidden native select that shadcn renders (the visual SelectContent
    // is portal-mounted and harder to reach in a unit test). The
    // production code reads the same underlying state either way.
    setupTest([
      buildItem({
        id: ITEM_NEEDS_RESIDENCE,
        originalName: 'lease.pdf',
        status: 'sorted',
        branch: 'residence_documents',
        residenceId: null,
        residenceManualOverride: false,
        residenceReason: null,
      }),
    ]);
    renderPage();

    const badge = await screen.findByTestId(
      `badge-residence-needed-${ITEM_NEEDS_RESIDENCE}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(badge);
    });

    const save = await screen.findByTestId(
      `button-residence-save-${ITEM_NEEDS_RESIDENCE}`,
    );
    // Initially disabled because residencePickerValue is ''.
    expect(save).toBeDisabled();

    // Drive the underlying Select state by dispatching a change on the
    // hidden native <select> shadcn keeps in sync with the visible
    // trigger. The trigger holds the testid so we use queryAllBy on
    // the document for the matching native control.
    const trigger = screen.getByTestId(
      `residence-picker-select-${ITEM_NEEDS_RESIDENCE}`,
    );
    expect(trigger).toBeInTheDocument();
    // Open the dropdown — radix renders the listbox into a portal.
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0 });
      fireEvent.click(trigger);
    });

    // Find the option for unit 202 in the open listbox.
    const option = await screen.findByRole(
      'option',
      { name: /^202$/ },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(option);
    });

    // Save button must now be enabled.
    await waitFor(() => {
      expect(save).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() => {
      expect(setResidenceCalls).toHaveLength(1);
    });
    expect(setResidenceCalls[0]).toEqual({
      itemId: ITEM_NEEDS_RESIDENCE,
      body: { residenceId: 'res-202' },
    });
  });
});
