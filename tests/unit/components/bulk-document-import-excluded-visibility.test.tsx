/**
 * Task #804 — Excluded files hidden from step 3+ in Bulk Document Import.
 *
 * Files marked as `rejected` (Excluded) must:
 *   - Still appear on the Screening step (step 2) so admins can re-include them.
 *   - Be completely hidden (no row, no badge, no placeholder) on every later
 *     step: Branching (step 3), Sorting (step 4), Identification (step 5),
 *     Linking (step 6), and Complete (step 7).
 *   - Not count in Branching section item badges.
 *   - Cause empty Branching groups to disappear.
 *
 * Without this suite the hiding logic could silently regress.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Module mocks
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

// -----------------------------------------------------------------------------
// Imports under test
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Fixture helpers
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-804';

const INCLUDED_ITEM_ID = 'item-included';
const EXCLUDED_ITEM_ID = 'item-excluded';

function buildItem(id: string, status: string, branch?: string) {
  return {
    id,
    originalName: `${id}.pdf`,
    mimeType: 'application/pdf',
    status,
    preExcludeStatus: null,
    branch: branch ?? null,
    subCategory: null,
    branchManualOverride: false,
    branchReason: null,
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
    branchingConfidence: null,
    branchingFallback: null,
    identificationConfidence: null,
    identificationFallback: null,
    linkingConfidence: null,
    linkingFallback: null,
  };
}

function buildPayload(currentStep: string, items: ReturnType<typeof buildItem>[]) {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep,
      status: 'active',
      progress: {
        runAll: {
          screening: { total: 2, processed: 2, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          sorting: { total: 2, processed: 2, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          branching: { total: 2, processed: 2, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          identification: { total: 2, processed: 2, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          linking: { total: 2, processed: 2, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
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
    clone() { return this as unknown as Response; },
  } as unknown as Response;
}

function makeFetchMock(step: string, items: ReturnType<typeof buildItem>[]) {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();
    const [pathname] = url.split('?');

    if (method === 'GET') {
      if (pathname === '/api/admin/bulk-import/buildings-lite') return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status') return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) return jsonResponse(buildPayload(step, items));
      if (pathname === '/api/admin/bulk-import/sessions') return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
    }
    if (method === 'POST') return jsonResponse({ ok: true });
    return jsonResponse({ unmocked: true }, 404);
  }) as unknown as jest.MockedFunction<typeof fetch>;
}

function setupTest(step: string, items: ReturnType<typeof buildItem>[]) {
  const payload = buildPayload(step, items);
  global.fetch = makeFetchMock(step, items);
  queryClient.setQueryData(['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'], payload);
}

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  originalFetch = global.fetch;
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
// Tests — Screening step: excluded files stay visible
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — excluded file visibility (Task #804)', () => {
  it('shows excluded file on the Screening step so it can be re-included', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'screened'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected'),
    ];
    setupTest('screening', items);

    renderPage();

    await screen.findByTestId(`item-row-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });
    await screen.findByTestId(`item-row-${EXCLUDED_ITEM_ID}`);

    expect(screen.getByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`badge-excluded-${EXCLUDED_ITEM_ID}`)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Flat list steps: Sorting, Identification, Linking
  // ---------------------------------------------------------------------------

  describe.each([
    ['sorting', 'sorted'],
    ['identification', 'branched'],
    ['linking', 'identified'],
  ] as const)('on the %s step', (step, includedStatus) => {
    it('hides the excluded file row', async () => {
      const items = [
        buildItem(INCLUDED_ITEM_ID, includedStatus),
        buildItem(EXCLUDED_ITEM_ID, 'rejected'),
      ];
      setupTest(step, items);

      renderPage();

      await screen.findByTestId(`item-row-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });

      expect(screen.queryByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`badge-excluded-${EXCLUDED_ITEM_ID}`)).not.toBeInTheDocument();
    });

    it('shows "No items" empty state when every item is excluded', async () => {
      const items = [buildItem(EXCLUDED_ITEM_ID, 'rejected')];
      setupTest(step, items);

      renderPage();

      const noItems = await screen.findByText('No items', undefined, { timeout: 4000 });
      expect(noItems).toBeInTheDocument();
      expect(screen.queryByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Branching step: grouped renderer
  // ---------------------------------------------------------------------------

  it('hides the excluded file from the Branching grouped renderer', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'branched', 'building_documents'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected', 'building_documents'),
    ];
    setupTest('branching', items);

    renderPage();

    await screen.findByTestId(`item-row-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });

    expect(screen.queryByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`item-row-${INCLUDED_ITEM_ID}`)).toBeInTheDocument();
  });

  it('reflects only non-excluded items in the Branching section count badge', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'branched', 'building_documents'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected', 'building_documents'),
    ];
    setupTest('branching', items);

    renderPage();

    const countBadge = await screen.findByTestId('branching-section-count-building_documents', undefined, { timeout: 4000 });
    expect(countBadge).toHaveTextContent('1');
  });

  it('hides a Branching group entirely when all its items are excluded', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'branched', 'building_documents'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected', 'financial_documents'),
    ];
    setupTest('branching', items);

    renderPage();

    await screen.findByTestId(`item-row-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });

    expect(screen.queryByTestId('branching-section-financial_documents')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`item-row-${INCLUDED_ITEM_ID}`)).toBeInTheDocument();
  });

  it('shows "No items" on the Branching step when every file is excluded', async () => {
    const items = [buildItem(EXCLUDED_ITEM_ID, 'rejected', 'building_documents')];
    setupTest('branching', items);

    renderPage();

    const noItems = await screen.findByText('No items', undefined, { timeout: 4000 });
    expect(noItems).toBeInTheDocument();
    expect(screen.queryByTestId('branching-grouped-sections')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Complete step
  // ---------------------------------------------------------------------------

  it('hides the excluded file from the Complete step list', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'committed'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected'),
    ];
    setupTest('complete', items);

    renderPage();

    await screen.findByTestId(`item-preview-trigger-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });

    expect(screen.queryByTestId(`item-preview-trigger-${EXCLUDED_ITEM_ID}`)).not.toBeInTheDocument();
  });

  it('still shows the committed document count on the Complete step (unaffected by exclusions)', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'committed'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected'),
    ];
    setupTest('complete', items);

    renderPage();

    const countLine = await screen.findByText(/1 document\(s\) committed\./, undefined, { timeout: 4000 });
    expect(countLine).toBeInTheDocument();
  });
});
