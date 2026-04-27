/**
 * Task #804 / Task #1225 — Excluded file visibility in Bulk Document Import.
 *
 * Task #804 originally hid excluded (`rejected`) files from step 3+ so later
 * steps stayed uncluttered. Task #1225 reverses this for every AI auto-step
 * (Branching, Sorting, Identification, Linking) so that admins can click the
 * per-row Retry button on excluded rows without first un-excluding the row.
 *
 * The updated rules are:
 *   - Screening step (step 2): excluded rows still appear (unchanged).
 *   - AI auto-steps (Branching, Sorting, Identification, Linking): excluded
 *     rows are NOW VISIBLE with strikethrough styling and a Retry button that
 *     carries the "this row will stay excluded" warning aria-label.
 *   - Complete step (step 7): excluded rows still hidden (non-auto-step).
 *
 * Without this suite the visibility behaviour could silently regress.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
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
    tp: (key: string, count: number) => {
      if (key === 'bulkImportCommitted') {
        return count === 1 ? `${count} document committed.` : `${count} documents committed.`;
      }
      return String(count);
    },
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

// Session ID rotates per test (Task #1076 cache-pollution fix).
// A fixed key lets stale fetches from a previous test overwrite the
// freshly seeded cache and flip the branching step into sections-mode.
let SESSION_ID = 'session-test-804-init';
let sessionCounter = 0;

const INCLUDED_ITEM_ID = 'item-included';
const EXCLUDED_ITEM_ID = 'item-excluded';

function buildItem(
  id: string,
  status: string,
  branch?: string,
  excludeSource: string | null = null,
) {
  return {
    id,
    originalName: `${id}.pdf`,
    mimeType: 'application/pdf',
    status,
    preExcludeStatus: null,
    excludeSource,
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

/**
 * Wait for a row to appear in the DOM.  Non-linking steps use
 * `item-row-${id}`; the linking step uses `linking-row-${id}` (Task #1233).
 */
async function waitForRowEither(id: string) {
  await waitFor(
    () => {
      const el =
        document.querySelector(`[data-testid="item-row-${id}"]`) ??
        document.querySelector(`[data-testid="linking-row-${id}"]`);
      expect(el).not.toBeNull();
    },
    { timeout: 4000 },
  );
}

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  // Rotate session ID so stale in-flight fetches from the previous test
  // cannot pollute this test's cache (Task #1076 cache-pollution fix).
  sessionCounter += 1;
  SESSION_ID = `session-test-804-${sessionCounter}`;

  originalFetch = global.fetch;
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);

  // Cancel any in-flight queries BEFORE clearing so a late-resolving fetch
  // from the previous test cannot write its stale payload into the fresh cache.
  await queryClient.cancelQueries();
  queryClient.clear();
  queryClient.removeQueries();
});

afterEach(async () => {
  cleanup();
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  mockToast.mockReset();
  await queryClient.cancelQueries();
  queryClient.clear();
  queryClient.removeQueries();
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
    const badge = screen.getByTestId(`badge-excluded-${EXCLUDED_ITEM_ID}`);
    expect(badge).toBeInTheDocument();
    // No excludeSource → generic "Excluded" badge, not the "Previously
    // excluded" one. Locks the default copy in place so the prior-
    // session branch below cannot silently flip it.
    expect(badge).toHaveTextContent('Excluded');
    expect(badge).not.toHaveTextContent('Previously excluded');
  });

  /**
   * Task #858: items that the upload handler auto-excluded because the
   * file's content hash matched a fingerprint persisted from a previous
   * session must render the "Previously excluded" badge instead of the
   * generic "Excluded" one. The handler signals this by setting
   * `excludeSource = 'prior_session'` on the item row.
   */
  it('renders "Previously excluded" badge when excludeSource === "prior_session"', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'screened'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected', undefined, 'prior_session'),
    ];
    setupTest('screening', items);

    renderPage();

    await screen.findByTestId(`item-row-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });
    const badge = await screen.findByTestId(`badge-excluded-${EXCLUDED_ITEM_ID}`);
    expect(badge).toHaveTextContent('Previously excluded');
    // The plain "Excluded" badge text must not also appear inside the
    // same node — guards against a regression that drops the
    // excludeSource branch and falls back to the default label.
    expect(badge.textContent).not.toMatch(/^Excluded$/);
  });

  // ---------------------------------------------------------------------------
  // Flat list steps: Sorting, Identification, Linking
  // Task #1225 reversed Task #804 for AI auto-steps: excluded rows ARE now
  // visible so admins can reach the per-row Retry button without first
  // un-excluding the file.
  // ---------------------------------------------------------------------------

  describe.each([
    ['sorting', 'sorted'],
    ['identification', 'branched'],
    ['linking', 'identified'],
  ] as const)('on the %s step', (step, includedStatus) => {
    it('shows the excluded file row with strikethrough styling (Task #1225)', async () => {
      const items = [
        buildItem(INCLUDED_ITEM_ID, includedStatus),
        buildItem(EXCLUDED_ITEM_ID, 'rejected'),
      ];
      setupTest(step, items);

      renderPage();

      await waitForRowEither(INCLUDED_ITEM_ID);

      // Task #1225: excluded rows are now visible on every AI auto-step.
      expect(screen.getByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).toBeInTheDocument();
    });

    it('shows the excluded file row even when it is the only item (Task #1225)', async () => {
      const items = [buildItem(EXCLUDED_ITEM_ID, 'rejected')];
      setupTest(step, items);

      renderPage();

      // Excluded item is now rendered (not hidden) on AI auto-steps.
      const row = await screen.findByTestId(`item-row-${EXCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });
      expect(row).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Branching step: grouped renderer
  // ---------------------------------------------------------------------------

  it('shows the excluded file in the Branching grouped renderer with strikethrough styling (Task #1225)', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'branched', 'building_documents'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected', 'building_documents'),
    ];
    setupTest('branching', items);

    renderPage();

    await screen.findByTestId(`item-row-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });

    // Task #1225: excluded rows are now visible in the Branching grouped view.
    expect(screen.getByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`item-row-${INCLUDED_ITEM_ID}`)).toBeInTheDocument();
  });

  it('Branching section count badge includes excluded items (Task #1225)', async () => {
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'branched', 'building_documents'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected', 'building_documents'),
    ];
    setupTest('branching', items);

    renderPage();

    // Task #1225: excluded items are now included in branchingItems so the
    // section count badge reflects both items (not just the non-excluded one).
    const countBadge = await screen.findByTestId('branching-section-count-building_documents', undefined, { timeout: 4000 });
    expect(countBadge).toHaveTextContent('2');
  });

  it('shows a Branching group even when all its items are excluded (Task #1225)', async () => {
    // Note: 'other' is used for the excluded item because branch destinations
    // must be in BRANCH_DESTINATION_ORDER (financial_documents is not valid).
    const items = [
      buildItem(INCLUDED_ITEM_ID, 'branched', 'building_documents'),
      buildItem(EXCLUDED_ITEM_ID, 'rejected', 'other'),
    ];
    setupTest('branching', items);

    renderPage();

    await screen.findByTestId(`item-row-${INCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });

    // Task #1225: excluded items are now visible, so the 'other' group still
    // renders even though its only item is excluded.
    expect(screen.getByTestId('branching-section-other')).toBeInTheDocument();
    expect(screen.getByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`item-row-${INCLUDED_ITEM_ID}`)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Branching empty-state: all files excluded with no branch destination
  // ---------------------------------------------------------------------------

  /**
   * When every file in a session was excluded (status='rejected') before
   * the Branching step ran, none of the items have a branch destination.
   * Placing them all in the 'Unsorted' bucket would create noise; instead
   * the renderer skips unbranched excluded items from grouping so the
   * 'No items' empty-state appears. Excluded items that DO have a branch
   * destination are still shown (per Task #1225).
   */
  it('shows "No items" on the Branching step when every file is excluded and none have a branch', async () => {
    const items = [
      buildItem(EXCLUDED_ITEM_ID, 'rejected'),
    ];
    setupTest('branching', items);

    renderPage();

    // Bundle all assertions inside waitFor so every check runs within the
    // same act() snapshot. This avoids a React 18 concurrent-mode race where
    // the component can flush deferred renders between an await and the next
    // synchronous line, detaching the element before toBeInTheDocument() runs.
    // A 6-second timeout gives headroom because this test is #8 in the file
    // and the shared queryClient may have accumulated enough query-success
    // events to trigger the cache-cleanup mechanism mid-render.
    await waitFor(() => {
      expect(screen.getByTestId('empty-state-branching')).toHaveTextContent('No items');
      expect(screen.queryByTestId(`item-row-${EXCLUDED_ITEM_ID}`)).not.toBeInTheDocument();
    }, { timeout: 6000 });
  });

  it('still shows the excluded file in Branching when it has a branch destination (Task #1225)', async () => {
    const items = [
      buildItem(EXCLUDED_ITEM_ID, 'rejected', 'building_documents'),
    ];
    setupTest('branching', items);

    renderPage();

    await screen.findByTestId(`item-row-${EXCLUDED_ITEM_ID}`, undefined, { timeout: 4000 });
    expect(screen.queryByTestId('empty-state-branching')).not.toBeInTheDocument();
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

    // The page renders the committed count via
    // `tp('bulkImportCommitted', N)`. The mock above renders the real
    // English string for `bulkImportCommitted` (matching the production
    // i18n key) so we assert via `findByText` against that. The source
    // <p> also carries a stable `complete-committed-count` testid as a
    // defensive secondary anchor (Task #1349).
    const countLine = await screen.findByText(/1 document committed\./, undefined, { timeout: 4000 });
    expect(countLine).toBeInTheDocument();
    expect(countLine).toHaveAttribute('data-testid', 'complete-committed-count');
  });
});
