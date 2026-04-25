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
  status: 'screened' | 'screening';
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
  screeningConfidence: number | null;
  screeningQaReason: string | null;
}

let items: ItemFixture[] = [];

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      // Stay on the screening step so the rows render in the section
      // that exercises the detail-panel gate.
      currentStep: 'screening' as const,
      status: 'active' as const,
      // Mark the screening auto-run as finished so the page does not
      // attempt to launch additional run-step mutations during the
      // test and the rows render in their stable, post-AI shape.
      progress: {
        runAll: {
          screening: {
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
      preExcludeStatus: null,
      screeningConfidence: it.screeningConfidence,
      screeningFallback: null,
      screeningTypeGuess: it.screeningTypeGuess,
      screeningBucketGuess: it.screeningBucketGuess,
      screeningQaReason: it.screeningQaReason,
      sortingConfidence: null,
      sortingFallback: null,
      sortingDecision: null,
      sortingReason: null,
      sortingMergeWithItemId: null,
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
