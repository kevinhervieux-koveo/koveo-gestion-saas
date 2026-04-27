/**
 * Task #1321 — Per-file "Remove from group" button on the merge sub-section.
 *
 * On the Sorting (Branching) step, admins can edit a merge group from the
 * lead's expanded card.  Before this task, once a file was added to a
 * group the only way to take it back out was to cancel the whole edit.
 * This suite covers the new per-row X (Remove from group) affordance:
 *
 *   1. Render a row with a committed 3-file merge group.
 *   2. Click the X on the middle sibling — the row disappears, the
 *      "Add file" dropdown offers it again, and the auto-saved draft
 *      fires with the new mergeWithItemIds (without the removed sib).
 *   3. Re-add the removed sibling via the dropdown — the group is back
 *      to 3 rows.
 *   4. With a 2-file group, removing the only sibling collapses the
 *      merge section and the auto-save reverts the decision to keep
 *      (the server rejects empty mergeWithItemIds, so we must NOT
 *      send a `merge` draft with an empty array).
 *   5. The lead's remove button is disabled (the lead can never be
 *      removed from its own group).
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

jest.setTimeout(15000);

// ---------------------------------------------------------------------------
// Module mocks (must be declared before importing the page under test).
// ---------------------------------------------------------------------------
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en' as const,
    t: (key: string) => key,
    tp: (key: string, _count: number) => key,
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

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------
let SESSION_ID = 'session-task-1321-init';

const ITEM_LEAD = 'item-merge-lead-1321';
const ITEM_SIB_A = 'item-merge-sib-a-1321';
const ITEM_SIB_B = 'item-merge-sib-b-1321';

interface ItemRow {
  id: string;
  originalName: string;
  status: 'sorted' | 'screened';
  sortingDecisionState: 'pending' | 'accepted' | 'rejected' | null;
  sortingDecision: 'keep' | 'merge' | 'split' | null;
  sortingMergeWithItemId: string | null;
  sortingMergeWithItemIds: string[] | null;
  sortingSplitAtPage: number | null;
  sortingManualOverride: boolean;
  sortingReason: string | null;
  sortingConfidence: number | null;
}

let items: ItemRow[] = [];

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'sorting' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          sorting: {
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
      screeningConfidence: 0.9,
      screeningFallback: null,
      screeningTypeGuess: 'invoice',
      screeningBucketGuess: null,
      screeningQaReason: null,
      screeningRotationDegrees: 0,
      screeningRotationApplied: false,
      sortingConfidence: it.sortingConfidence,
      sortingFallback: null,
      sortingDecision: it.sortingDecision,
      sortingReason: it.sortingReason,
      sortingMergeWithItemId: it.sortingMergeWithItemId,
      sortingMergeWithItemIds: it.sortingMergeWithItemIds,
      sortingSplitAtPage: it.sortingSplitAtPage,
      sortingDecisionState: it.sortingDecisionState,
      sortingManualOverride: it.sortingManualOverride,
      branchingConfidence: null,
      branchingFallback: null,
      branch: null,
      subCategory: null,
      branchReason: null,
      branchManualOverride: false,
      residenceId: null,
      residenceConfidence: null,
      residenceReason: null,
      residenceFallbackReason: null,
      residenceManualOverride: false,
      identificationConfidence: null,
      identificationFallback: null,
      identificationName: null,
      identificationDescription: null,
      identificationTags: null,
      identificationAiSuggestedTagIds: null,
      identificationEffectiveDate: null,
      linkingConfidence: null,
      linkingFallback: null,
      linkingReason: null,
      linkingBeforeItemId: null,
      linkingAfterItemId: null,
      sortingDecisionSplitIntoItemIds: null,
      sortingDecisionDraft: false,
      sortingDecisionSplitFinalNames: null,
      finalFileName: null,
      excludeSource: null,
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

const fetchMock = jest.fn(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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

    if (
      method === 'POST' &&
      pathname.startsWith('/api/admin/bulk-import/items/') &&
      pathname.endsWith('/set-sorting-decision')
    ) {
      const id = pathname.split('/')[5];
      return jsonResponse({ id, sortingDecisionState: 'pending' });
    }

    if (method === 'POST') return jsonResponse({ ok: true });
    if (method === 'PATCH') return jsonResponse({ ok: true });

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

function pushMergeFixture(siblings: string[]) {
  items.push({
    id: ITEM_LEAD,
    originalName: 'lead-invoice.pdf',
    status: 'sorted',
    sortingDecisionState: 'pending',
    sortingDecision: 'merge',
    sortingMergeWithItemId: null,
    sortingMergeWithItemIds: siblings,
    sortingSplitAtPage: null,
    sortingManualOverride: false,
    sortingReason: 'AI grouped these pages together',
    sortingConfidence: 0.93,
  });
  for (const sibId of siblings) {
    items.push({
      id: sibId,
      originalName: sibId === ITEM_SIB_A ? 'sibling-a.pdf' : 'sibling-b.pdf',
      status: 'sorted',
      sortingDecisionState: 'pending',
      sortingDecision: 'merge',
      sortingMergeWithItemId: ITEM_LEAD,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingManualOverride: false,
      sortingReason: null,
      sortingConfidence: null,
    });
  }
}

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-task-1321');
  items = [];

  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
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

function getMergeAddSelect(ownerId: string) {
  return screen.getByTestId(`branching-merge-add-${ownerId}`) as HTMLSelectElement;
}

function getDecisionPostBodies(): Array<{ id: string; body: any }> {
  return fetchMock.mock.calls
    .filter((call) => {
      const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
      const init = call[1] as RequestInit | undefined;
      return (
        (init?.method || '').toUpperCase() === 'POST' &&
        url.endsWith('/set-sorting-decision')
      );
    })
    .map((call) => {
      const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
      const id = url.split('/')[url.split('/').length - 2];
      const body = JSON.parse((call[1] as RequestInit).body as string);
      return { id, body };
    });
}

describe('BulkDocumentImportPage — merge-group per-file remove (Task #1321)', () => {
  it('admins can build a 3-file merge group, remove a sibling, and rebuild back to 3', async () => {
    pushMergeFixture([ITEM_SIB_A, ITEM_SIB_B]);
    renderPage();

    // Wait for the lead row and its merge group to render.
    await screen.findByTestId(`item-preview-trigger-${ITEM_LEAD}`, undefined, {
      timeout: 8000,
    });
    await screen.findByTestId(`branching-merge-group-${ITEM_LEAD}`, undefined, {
      timeout: 8000,
    });

    // The merge sub-section is visible (sortingDecision='merge') with
    // three rows: [lead, sib-a, sib-b].
    await waitFor(() => {
      expect(screen.getByTestId(`branching-merge-section-${ITEM_LEAD}`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-0`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-1`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-2`)).toBeInTheDocument();
    });

    // The lead's remove button must be disabled (cannot remove yourself).
    const leadRemoveBtn = screen.getByTestId(
      `branching-merge-remove-${ITEM_LEAD}-0`,
    ) as HTMLButtonElement;
    expect(leadRemoveBtn.disabled).toBe(true);

    // -----------------------------------------------------------------
    // Remove the middle sibling (idx=1, sib-a).
    // -----------------------------------------------------------------
    fetchMock.mockClear();
    const removeMiddleBtn = screen.getByTestId(
      `branching-merge-remove-${ITEM_LEAD}-1`,
    ) as HTMLButtonElement;
    expect(removeMiddleBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(removeMiddleBtn);
    });

    // Row at idx=2 is gone; the lead is still at idx=0 and sib-b
    // shifted to idx=1.
    await waitFor(() => {
      expect(screen.queryByTestId(`branching-merge-row-${ITEM_LEAD}-2`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-0`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-1`)).toBeInTheDocument();
    });

    // The Add-file dropdown should now offer sib-a again as a candidate.
    const addSelectAfterRemove = getMergeAddSelect(ITEM_LEAD);
    const optionValuesAfterRemove = Array.from(addSelectAfterRemove.options).map((o) => o.value);
    expect(optionValuesAfterRemove).toContain(ITEM_SIB_A);

    // The auto-save fires (debounced 500 ms) saving the trimmed merge
    // group as a draft against the lead.
    await waitFor(
      () => {
        const drafts = getDecisionPostBodies().filter((c) => c.id === ITEM_LEAD);
        expect(drafts.length).toBeGreaterThanOrEqual(1);
        const last = drafts[drafts.length - 1].body;
        expect(last.draft).toBe(true);
        expect(last.decision).toBe('merge');
        // After removing sib-a, only sib-b should remain in the
        // mergeWithItemIds (the lead is the request target itself).
        expect(last.mergeWithItemIds).toEqual([ITEM_SIB_B]);
      },
      { timeout: 4000 },
    );

    // -----------------------------------------------------------------
    // Re-add sib-a via the dropdown — group is back to 3 rows.
    // -----------------------------------------------------------------
    await act(async () => {
      fireEvent.change(getMergeAddSelect(ITEM_LEAD), { target: { value: ITEM_SIB_A } });
    });
    await waitFor(() => {
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-0`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-1`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-2`)).toBeInTheDocument();
    });
  });

  it('removing the last sibling collapses the group and reverts the draft to keep', async () => {
    // 2-file merge: [lead, sib-a]. Removing sib-a leaves only the lead,
    // so the auto-save must switch the decision back to keep instead
    // of sending an empty mergeWithItemIds (which the server rejects).
    pushMergeFixture([ITEM_SIB_A]);
    renderPage();

    await screen.findByTestId(`item-preview-trigger-${ITEM_LEAD}`, undefined, {
      timeout: 8000,
    });
    await screen.findByTestId(`branching-merge-group-${ITEM_LEAD}`, undefined, {
      timeout: 8000,
    });

    await waitFor(() => {
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-0`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-merge-row-${ITEM_LEAD}-1`)).toBeInTheDocument();
    });

    fetchMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`branching-merge-remove-${ITEM_LEAD}-1`));
    });

    // The auto-save must persist `decision: keep` with no
    // mergeWithItemIds (the server rejects empty mergeWithItemIds, so
    // dropping to a single file MUST flip the draft to keep — not send
    // a merge with an empty siblings list).
    //
    // We deliberately assert on the request body rather than the DOM:
    // because our lite mock keeps returning the original 2-file merge
    // fixture, the saved-decision-driven render still shows the merge
    // section until the server-side state is refreshed end-to-end.
    // The contract being tested is the network call shape, which is
    // what the server validates against.
    await waitFor(
      () => {
        const drafts = getDecisionPostBodies().filter((c) => c.id === ITEM_LEAD);
        expect(drafts.length).toBeGreaterThanOrEqual(1);
        const last = drafts[drafts.length - 1].body;
        expect(last.draft).toBe(true);
        expect(last.decision).toBe('keep');
        expect(last.mergeWithItemIds).toBeUndefined();
      },
      { timeout: 4000 },
    );
  });
});
