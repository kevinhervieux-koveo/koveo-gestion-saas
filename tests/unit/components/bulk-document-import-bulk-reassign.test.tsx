/**
 * Task #796 — "Reassign all in group" must never move excluded files
 * by accident.
 *
 * Companion component test for the integration coverage in
 * `tests/integration/bulk-import-rest-endpoints.test.ts`. The
 * Branching step renders one "Reassign all in group" button per
 * destination section. The button:
 *
 *   1. Reports a count of the items it will move ("Apply to N") that
 *      excludes any item whose status disqualifies it from a bulk
 *      reassign — `rejected` (filtered earlier at the section level),
 *      plus `committed` and `duplicate` which can still appear inside
 *      a section but must not be moved.
 *   2. Sends only those eligible ids in the POST body so the server
 *      never has to defend against a too-broad payload (it does
 *      anyway, see the integration test, but the client must not
 *      lean on that safety net).
 *   3. Triggers exactly one refetch of the lite session query after
 *      the POST resolves — not one per item, not zero.
 *
 * Without this suite a future regression on the eligible-id filter
 * could silently re-include excluded files in a bulk move, or the
 * cache invalidation could be removed and the wizard would render
 * stale data after the bulk action.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Module mocks (mirrors tests/unit/components/bulk-document-import-excluded-visibility.test.tsx)
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
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// -----------------------------------------------------------------------------
// Fixture helpers
// -----------------------------------------------------------------------------

// SESSION_ID is reassigned in `beforeEach` (see Task #1081) so each test
// gets a unique React Query key. That prevents a previous test's stale
// in-flight fetch from polluting this test's cache after `clear()` —
// `setupTest` and `buildPayload` both interpolate the current value at
// call time, so reassignment is enough.
let SESSION_ID = 'session-test-796-init';
const BUILDING_ID = 'building-1';
const ORG_ID = 'org-1';

const LIVE_A_ID = 'item-live-a';
const LIVE_B_ID = 'item-live-b';
const COMMITTED_ID = 'item-committed';
const DUPLICATE_ID = 'item-duplicate';

function buildItem(
  id: string,
  status: string,
  branch?: string,
) {
  return {
    id,
    originalName: `${id}.pdf`,
    mimeType: 'application/pdf',
    status,
    preExcludeStatus: null,
    excludeSource: null,
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

function buildPayload(items: ReturnType<typeof buildItem>[]) {
  return {
    session: {
      id: SESSION_ID,
      buildingId: BUILDING_ID,
      organizationId: ORG_ID,
      adminUserId: 'admin-1',
      currentStep: 'branching',
      status: 'active',
      progress: {
        runAll: {
          screening: { total: 1, processed: 1, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          sorting: { total: 1, processed: 1, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          branching: { total: 1, processed: 1, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          identification: { total: 1, processed: 1, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          linking: { total: 1, processed: 1, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
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

interface FetchCallSummary {
  url: string;
  method: string;
  body: unknown;
}

interface FetchHarness {
  liteCalls: number;
  reassignCalls: FetchCallSummary[];
  reassignResponseItems: ReturnType<typeof buildItem>[];
}

function makeFetchMock(
  initialItems: ReturnType<typeof buildItem>[],
  harness: FetchHarness,
) {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();
    const [pathname] = url.split('?');

    if (method === 'GET') {
      if (pathname === '/api/admin/bulk-import/buildings-lite') return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status') return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        harness.liteCalls += 1;
        return jsonResponse(buildPayload(initialItems));
      }
      if (pathname === '/api/admin/bulk-import/sessions') return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      if (pathname === `/api/buildings/${BUILDING_ID}/residences`) return jsonResponse([]);
    }
    if (
      method === 'POST'
      && pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/items/reassign-bulk`
    ) {
      const parsed = init?.body ? JSON.parse(init.body as string) : {};
      harness.reassignCalls.push({ url: pathname, method, body: parsed });
      return jsonResponse({
        updated: harness.reassignResponseItems.length,
        items: harness.reassignResponseItems,
      });
    }
    if (method === 'POST') return jsonResponse({ ok: true });
    return jsonResponse({ unmocked: true }, 404);
  }) as unknown as jest.MockedFunction<typeof fetch>;
}

function setupTest(items: ReturnType<typeof buildItem>[], harness: FetchHarness) {
  global.fetch = makeFetchMock(items, harness);
  // Pre-seed the cache so the initial render does NOT trigger a fetch
  // — only the post-mutation invalidation should bump `liteCalls`.
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    buildPayload(items),
  );
}

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  // Cancel any stragglers from the previous test BEFORE reassigning the
  // session id and clearing the cache (Task #1081 — see
  // tests/helpers/queryClientIsolation.ts for the full rationale).
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-796');

  originalFetch = global.fetch;
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  mockToast.mockReset();
  queryClient.clear();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — bulk group reassign safety net (Task #796)', () => {
  it('"Apply to N" counts only non-excluded items in the section', async () => {
    // Two live (eligible) items + one committed + one duplicate, all in
    // the same destination so they render in a single section. The
    // section badge will show 4, but the Apply button must show 2.
    const items = [
      buildItem(LIVE_A_ID, 'branched', 'building_documents'),
      buildItem(LIVE_B_ID, 'branched', 'building_documents'),
      buildItem(COMMITTED_ID, 'committed', 'building_documents'),
      buildItem(DUPLICATE_ID, 'duplicate', 'building_documents'),
    ];
    const harness: FetchHarness = {
      liteCalls: 0,
      reassignCalls: [],
      reassignResponseItems: [],
    };
    setupTest(items, harness);

    renderPage();

    // Section renders all four (rejected would be filtered out earlier
    // but we deliberately don't include any here so we can prove the
    // committed/duplicate filtering is exercised at the eligibleIds
    // step, not at the section level).
    const sectionCount = await screen.findByTestId(
      'branching-section-count-building_documents',
      undefined,
      { timeout: 4000 },
    );
    expect(sectionCount).toHaveTextContent('4');

    // Open the group picker.
    const openBtn = screen.getByTestId('button-reassign-group-building_documents');
    fireEvent.click(openBtn);

    const apply = await screen.findByTestId('button-reassign-group-save-building_documents');
    // Even though the section holds 4 rows, only the 2 live ones are
    // eligible — the button label and disabled state must reflect that.
    expect(apply).toHaveTextContent('Apply to 2');
    expect(apply).not.toBeDisabled();
  });

  it('submits only the live item ids and refetches the lite session query exactly once', async () => {
    const items = [
      buildItem(LIVE_A_ID, 'branched', 'building_documents'),
      buildItem(LIVE_B_ID, 'branched', 'building_documents'),
      buildItem(COMMITTED_ID, 'committed', 'building_documents'),
      buildItem(DUPLICATE_ID, 'duplicate', 'building_documents'),
    ];
    const harness: FetchHarness = {
      liteCalls: 0,
      // The server reports it updated both live items — used for the
      // success-toast count, not relevant to the safety net itself.
      reassignResponseItems: [
        buildItem(LIVE_A_ID, 'branched', 'building_documents'),
        buildItem(LIVE_B_ID, 'branched', 'building_documents'),
      ],
      reassignCalls: [],
    };
    setupTest(items, harness);

    renderPage();

    // Wait until the section is rendered, then snapshot the lite-fetch
    // count. The pre-seeded cache means liteCalls should still be 0 at
    // this point — any later increment is purely from the cache
    // invalidation path we want to verify.
    await screen.findByTestId(
      'branching-section-count-building_documents',
      undefined,
      { timeout: 4000 },
    );
    const liteCallsBefore = harness.liteCalls;

    // Open the group picker. This pre-fills the destination + sub-cat
    // from the items already in the section, so we can immediately
    // click Apply without touching the selects.
    fireEvent.click(screen.getByTestId('button-reassign-group-building_documents'));

    const apply = await screen.findByTestId('button-reassign-group-save-building_documents');
    fireEvent.click(apply);

    // The POST must have fired exactly once with only the eligible ids.
    await waitFor(() => {
      expect(harness.reassignCalls).toHaveLength(1);
    });
    const sentBody = harness.reassignCalls[0].body as {
      branch: string;
      subCategory: string;
      itemIds: string[];
    };
    expect(sentBody.branch).toBe('building_documents');
    expect(typeof sentBody.subCategory).toBe('string');
    // The committed and duplicate ids must not be in the payload — that
    // is the regression this whole task was written to prevent.
    expect([...sentBody.itemIds].sort()).toEqual([LIVE_A_ID, LIVE_B_ID].sort());
    expect(sentBody.itemIds).not.toContain(COMMITTED_ID);
    expect(sentBody.itemIds).not.toContain(DUPLICATE_ID);

    // After the mutation resolves, the lite session query must be
    // refetched exactly once (not zero, not once-per-item).
    await waitFor(() => {
      expect(harness.liteCalls - liteCallsBefore).toBe(1);
    });

    // And the success toast confirms the count came from the server
    // payload, so the wizard does not silently re-count the eligibles
    // on its own and disagree with what was actually moved.
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Reassigned 2') }),
    );

    // No additional POSTs were fired by any other on-success side
    // effect — the bulk endpoint is the single write path.
    expect(harness.reassignCalls).toHaveLength(1);
  });
});
