/**
 * Task #825 — Client coverage for the sorting (branching) decision
 * accept / reject UI added in Task #817.
 *
 * The wizard shows three distinct shapes per row on the sorting step,
 * driven entirely by `item.sortingDecisionState`:
 *   - 'pending'  → Accept and Reject buttons are visible.
 *   - 'rejected' → "Choose manually" button replaces them; clicking it
 *                  opens the keep/merge/split picker.
 *   - 'accepted' → No action buttons; only the decision badge remains.
 *
 * The buttons feed `POST /set-sorting-decision`, which Task #817 wired
 * to the merge/split logic on the server. This suite mounts the real
 * BulkDocumentImportPage with a stubbed lite endpoint and asserts
 * each shape renders as expected and that clicking Accept actually
 * fires the right network call. Without this coverage a regression to
 * the conditional render block could silently leave admins unable to
 * confirm or override the AI's branching suggestion.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Module mocks (must be declared before importing the page under test).
// ---------------------------------------------------------------------------
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
// real Dialog tree from radix-ui.
jest.mock('@/components/common/DocumentInlineViewer', () => ({
  DocumentInlineViewer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mock-inline-viewer" /> : null,
}));

// ---------------------------------------------------------------------------
// Imports under test (after every mock is registered).
// ---------------------------------------------------------------------------
import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// ---------------------------------------------------------------------------
// Fixtures: three rows on the sorting step, one per decisionState.
// ---------------------------------------------------------------------------
const SESSION_ID = 'session-task-825';

const ITEM_PENDING = 'item-pending';
const ITEM_REJECTED = 'item-rejected';
const ITEM_ACCEPTED = 'item-accepted';
const ITEM_SPLIT = 'item-split';
const ITEM_MERGE_LEAD = 'item-merge-lead';
const ITEM_MERGE_SIB = 'item-merge-sib';

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
      // Stay on the sorting step so the rows render in the section
      // that exercises the accept/reject UI.
      currentStep: 'sorting' as const,
      status: 'active' as const,
      // Mark the sorting auto-run as finished so the page does not
      // attempt extra run-step mutations during the test.
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
      identificationEffectiveDate: null,
      linkingConfidence: null,
      linkingFallback: null,
      linkingReason: null,
      linkingBeforeItemId: null,
      linkingAfterItemId: null,
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

    // The set-sorting-decision POST is the call we want to assert on.
    // Echo back the row with state flipped to 'accepted' so onSuccess
    // does not error.
    if (
      method === 'POST' &&
      pathname.startsWith('/api/admin/bulk-import/items/') &&
      pathname.endsWith('/set-sorting-decision')
    ) {
      const id = pathname.split('/')[5];
      return jsonResponse({ id, sortingDecisionState: 'accepted' });
    }

    if (method === 'POST') return jsonResponse({ ok: true });

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  items = [
    {
      id: ITEM_PENDING,
      originalName: 'pending.pdf',
      status: 'sorted',
      sortingDecisionState: 'pending',
      sortingDecision: 'keep',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingManualOverride: false,
      sortingReason: 'Standalone invoice',
      sortingConfidence: 0.92,
    },
    {
      id: ITEM_REJECTED,
      originalName: 'rejected.pdf',
      status: 'sorted',
      sortingDecisionState: 'rejected',
      sortingDecision: 'merge',
      sortingMergeWithItemId: ITEM_ACCEPTED,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingManualOverride: false,
      sortingReason: 'AI thought this was part 2',
      sortingConfidence: 0.51,
    },
    {
      id: ITEM_ACCEPTED,
      originalName: 'accepted.pdf',
      status: 'sorted',
      sortingDecisionState: 'accepted',
      sortingDecision: 'keep',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingManualOverride: false,
      sortingReason: 'Already-confirmed keep',
      sortingConfidence: 0.99,
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

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function waitForRows() {
  await screen.findByTestId(`item-preview-trigger-${ITEM_PENDING}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`item-preview-trigger-${ITEM_REJECTED}`);
  await screen.findByTestId(`item-preview-trigger-${ITEM_ACCEPTED}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BulkDocumentImportPage — sorting decision UI (Task #817 / #825)', () => {
  it('shows Accept and Reject buttons only on rows whose decisionState is "pending"', async () => {
    renderPage();
    await waitForRows();

    // Pending → both buttons visible.
    expect(
      screen.getByTestId(`button-sorting-accept-${ITEM_PENDING}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`button-sorting-reject-${ITEM_PENDING}`),
    ).toBeInTheDocument();
    // The pending badge sits next to them so admins know review is needed.
    expect(
      screen.getByTestId(`sorting-pending-badge-${ITEM_PENDING}`),
    ).toBeInTheDocument();

    // Rejected → no Accept/Reject buttons (the manual picker takes over).
    expect(
      screen.queryByTestId(`button-sorting-accept-${ITEM_REJECTED}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`button-sorting-reject-${ITEM_REJECTED}`),
    ).not.toBeInTheDocument();

    // Accepted → no action buttons at all, just the decision badge.
    expect(
      screen.queryByTestId(`button-sorting-accept-${ITEM_ACCEPTED}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`button-sorting-reject-${ITEM_ACCEPTED}`),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`sorting-decision-${ITEM_ACCEPTED}`),
    ).toBeInTheDocument();
  });

  it('shows the "Choose manually" entrypoint and rejected badge on rejected rows', async () => {
    renderPage();
    await waitForRows();

    expect(
      screen.getByTestId(`sorting-rejected-badge-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`button-sorting-manual-open-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    // Picker stays closed until the entrypoint is clicked.
    expect(
      screen.queryByTestId(`sorting-manual-picker-${ITEM_REJECTED}`),
    ).not.toBeInTheDocument();
  });

  it('opens the manual keep/merge/split picker when "Choose manually" is clicked on a rejected row', async () => {
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`button-sorting-manual-open-${ITEM_REJECTED}`),
      );
    });

    // Picker is now mounted with all three options + Confirm/Cancel buttons.
    const picker = screen.getByTestId(`sorting-manual-picker-${ITEM_REJECTED}`);
    expect(picker).toBeInTheDocument();
    expect(
      screen.getByTestId(`sorting-picker-option-keep-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`sorting-picker-option-merge-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`sorting-picker-option-split-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`button-sorting-confirm-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`button-sorting-cancel-picker-${ITEM_REJECTED}`),
    ).toBeInTheDocument();

    // Choosing "merge" reveals the sibling-selector dropdown — the
    // confirm button stays disabled until a sibling is picked.
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`sorting-picker-option-merge-${ITEM_REJECTED}`),
      );
    });
    expect(
      screen.getByTestId(`sorting-picker-merge-target-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`button-sorting-confirm-${ITEM_REJECTED}`),
    ).toBeDisabled();

    // Choosing "split" replaces the dropdown with the split-page input.
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`sorting-picker-option-split-${ITEM_REJECTED}`),
      );
    });
    expect(
      screen.getByTestId(`sorting-picker-split-page-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`sorting-picker-merge-target-${ITEM_REJECTED}`),
    ).not.toBeInTheDocument();
  });

  it('clicking Accept fires POST /set-sorting-decision with action=accept for the pending row', async () => {
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`button-sorting-accept-${ITEM_PENDING}`),
      );
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => {
        const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith(`/items/${ITEM_PENDING}/set-sorting-decision`);
      });
      expect(calls).toHaveLength(1);
      const init = calls[0][1] as RequestInit;
      expect((init.method || 'GET').toUpperCase()).toBe('POST');
      const body = JSON.parse(init.body as string);
      expect(body.action).toBe('accept');
    });
  });

  it('clicking Reject fires POST /set-sorting-decision with action=reject for the pending row', async () => {
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`button-sorting-reject-${ITEM_PENDING}`),
      );
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => {
        const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith(`/items/${ITEM_PENDING}/set-sorting-decision`);
      });
      expect(calls).toHaveLength(1);
      const init = calls[0][1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.action).toBe('reject');
    });
  });

  // ---------------------------------------------------------------------------
  // Inline Slice sub-section (Task #856)
  // ---------------------------------------------------------------------------

  it('shows the Slice sub-section in the detail panel when sortingDecision is "split"', async () => {
    items.push({
      id: ITEM_SPLIT,
      originalName: 'split.pdf',
      status: 'sorted',
      sortingDecisionState: 'pending',
      sortingDecision: 'split',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: 3,
      sortingManualOverride: false,
      sortingReason: 'Two separate subjects',
      sortingConfidence: 0.88,
    });

    renderPage();
    await screen.findByTestId(`item-preview-trigger-${ITEM_SPLIT}`, undefined, { timeout: 4000 });

    // Expand the card so the detail panel renders.
    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_SPLIT}`));
    });

    expect(
      screen.getByTestId(`branching-slice-section-${ITEM_SPLIT}`),
    ).toBeInTheDocument();
  });

  it('"Add slice" button appears for a pending PDF item with decision "keep" and opens the Slice sub-section', async () => {
    renderPage();
    await waitForRows();

    // ITEM_PENDING has decision 'keep', so "Add slice" should appear after expansion.
    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_PENDING}`));
    });

    const addBtn = screen.getByTestId(`branching-slice-add-${ITEM_PENDING}`);
    expect(addBtn).toBeInTheDocument();

    // Clicking it should reveal the Slice sub-section.
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(
      screen.getByTestId(`branching-slice-section-${ITEM_PENDING}`),
    ).toBeInTheDocument();
  });

  it('clicking Accept after changing the inline slice page fires action=manual with decision=split', async () => {
    items.push({
      id: ITEM_SPLIT,
      originalName: 'split.pdf',
      status: 'sorted',
      sortingDecisionState: 'pending',
      sortingDecision: 'split',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: 2,
      sortingManualOverride: false,
      sortingReason: 'Split reason',
      sortingConfidence: 0.85,
    });

    renderPage();
    await screen.findByTestId(`item-preview-trigger-${ITEM_SPLIT}`, undefined, { timeout: 4000 });

    // Expand to reveal the slice section and input.
    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_SPLIT}`));
    });

    // Locate and change the split-page input.
    const input = screen.getByTestId(`sorting-picker-split-page-${ITEM_SPLIT}`);
    await act(async () => {
      fireEvent.change(input, { target: { value: '5' } });
    });

    // Accept button should now send the inline slice value.
    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-sorting-accept-${ITEM_SPLIT}`));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => {
        const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith(`/items/${ITEM_SPLIT}/set-sorting-decision`);
      });
      expect(calls).toHaveLength(1);
      const body = JSON.parse((calls[0][1] as RequestInit).body as string);
      expect(body.action).toBe('manual');
      expect(body.decision).toBe('split');
      expect(body.splitAtPage).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Inline Merge sub-section (Task #856)
  // ---------------------------------------------------------------------------

  it('shows the Merge sub-section in the detail panel when sortingDecision is "merge"', async () => {
    items.push(
      {
        id: ITEM_MERGE_LEAD,
        originalName: 'merge-lead.pdf',
        status: 'sorted',
        sortingDecisionState: 'pending',
        sortingDecision: 'merge',
        sortingMergeWithItemId: ITEM_MERGE_SIB,
        sortingMergeWithItemIds: [ITEM_MERGE_SIB],
        sortingSplitAtPage: null,
        sortingManualOverride: false,
        sortingReason: 'Belongs together',
        sortingConfidence: 0.91,
      },
      {
        id: ITEM_MERGE_SIB,
        originalName: 'merge-sib.pdf',
        status: 'sorted',
        sortingDecisionState: 'pending',
        sortingDecision: 'merge',
        sortingMergeWithItemId: ITEM_MERGE_LEAD,
        sortingMergeWithItemIds: null,
        sortingSplitAtPage: null,
        sortingManualOverride: false,
        sortingReason: null,
        sortingConfidence: null,
      },
    );

    renderPage();
    await screen.findByTestId(`item-preview-trigger-${ITEM_MERGE_LEAD}`, undefined, { timeout: 4000 });

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_MERGE_LEAD}`));
    });

    expect(
      screen.getByTestId(`branching-merge-section-${ITEM_MERGE_LEAD}`),
    ).toBeInTheDocument();

    // Both files should appear as rows.
    expect(
      screen.getByTestId(`branching-merge-row-${ITEM_MERGE_LEAD}-0`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`branching-merge-row-${ITEM_MERGE_LEAD}-1`),
    ).toBeInTheDocument();
  });

  it('up/down buttons in the Merge sub-section reorder files; Confirm fires manual merge with updated order', async () => {
    items.push(
      {
        id: ITEM_MERGE_LEAD,
        originalName: 'part1.pdf',
        status: 'sorted',
        sortingDecisionState: 'pending',
        sortingDecision: 'merge',
        sortingMergeWithItemId: ITEM_MERGE_SIB,
        sortingMergeWithItemIds: [ITEM_MERGE_SIB],
        sortingSplitAtPage: null,
        sortingManualOverride: false,
        sortingReason: 'Need to merge',
        sortingConfidence: 0.9,
      },
      {
        id: ITEM_MERGE_SIB,
        originalName: 'part2.pdf',
        status: 'sorted',
        sortingDecisionState: 'pending',
        sortingDecision: 'merge',
        sortingMergeWithItemId: ITEM_MERGE_LEAD,
        sortingMergeWithItemIds: null,
        sortingSplitAtPage: null,
        sortingManualOverride: false,
        sortingReason: null,
        sortingConfidence: null,
      },
    );

    renderPage();
    await screen.findByTestId(`item-preview-trigger-${ITEM_MERGE_LEAD}`, undefined, { timeout: 4000 });

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_MERGE_LEAD}`));
    });

    // Move sibling (index 1) up — it should now become index 0.
    const moveUpBtn = screen.getByTestId(`branching-merge-move-up-${ITEM_MERGE_LEAD}-1`);
    await act(async () => {
      fireEvent.click(moveUpBtn);
    });

    // The confirm button should now be visible (inline state changed).
    const confirmBtn = screen.getByTestId(`branching-merge-confirm-${ITEM_MERGE_LEAD}`);
    expect(confirmBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => {
        const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith('/set-sorting-decision');
      });
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const last = calls[calls.length - 1];
      const body = JSON.parse((last[1] as RequestInit).body as string);
      expect(body.action).toBe('manual');
      expect(body.decision).toBe('merge');
      expect(Array.isArray(body.mergeWithItemIds)).toBe(true);
    });
  });
});
