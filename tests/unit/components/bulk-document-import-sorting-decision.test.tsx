/**
 * Task #825 — Client coverage for the sorting (branching) decision
 * accept / reject UI added in Task #817.
 *
 * The wizard shows three distinct shapes per row on the sorting step,
 * driven entirely by `item.sortingDecisionState`:
 *   - 'pending'  → Accept and Reject buttons are visible.
 *   - 'rejected' → The keep/merge/split picker is shown immediately,
 *                  pre-filled from the AI suggestion (Task #905).
 *                  No separate "Choose manually" button is needed.
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

// Mounting the real BulkDocumentImportPage (4k+ lines, with many lite
// queries and effects) routinely takes 2–3s under jsdom. Several
// findByTestId calls in this suite already use a 4000ms wait, which
// would race against the global 3000ms test timeout configured in
// jest.config.cjs. Give every test in this file a comfortable budget so
// the suite is not flake-prone when run alongside the rest of the
// fast-unit pool.
jest.setTimeout(15000);

// ---------------------------------------------------------------------------
// Module mocks (must be declared before importing the page under test).
// ---------------------------------------------------------------------------
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mutable language ref so individual tests can flip to French to assert
// the localized "Dans cette fusion" / "In this merge" label rendering
// added by Task #927.
const languageRef = { current: 'en' as 'en' | 'fr' };
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    get language() {
      return languageRef.current;
    },
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

    // The exclude PATCH is wired to a per-item endpoint; echo back a
    // minimal record so the optimistic update committed by the
    // mutation's onMutate isn't reverted.
    if (
      method === 'PATCH' &&
      pathname.startsWith('/api/admin/bulk-import/items/') &&
      pathname.endsWith('/exclude')
    ) {
      const id = pathname.split('/')[5];
      return jsonResponse({ id, status: 'rejected' });
    }
    if (method === 'PATCH') return jsonResponse({ ok: true });

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
  languageRef.current = 'en';
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

  it('shows the picker immediately and the rejected badge for already-rejected rows (Task #905)', async () => {
    renderPage();
    await waitForRows();

    // The rejected badge is still shown so admins can see at a glance.
    expect(
      screen.getByTestId(`sorting-rejected-badge-${ITEM_REJECTED}`),
    ).toBeInTheDocument();

    // The picker is now visible immediately — no extra click required.
    expect(
      screen.getByTestId(`sorting-manual-picker-${ITEM_REJECTED}`),
    ).toBeInTheDocument();

    // No separate "Choose manually" button should exist.
    expect(
      screen.queryByTestId(`button-sorting-manual-open-${ITEM_REJECTED}`),
    ).not.toBeInTheDocument();
  });

  it('picker for a rejected row is pre-filled from the AI suggestion (Task #905)', async () => {
    // ITEM_REJECTED has AI decision 'merge' with target ITEM_ACCEPTED.
    // The picker should pre-select merge and show the merge target dropdown.
    renderPage();
    await waitForRows();

    const picker = screen.getByTestId(`sorting-manual-picker-${ITEM_REJECTED}`);
    expect(picker).toBeInTheDocument();

    // All three option buttons are present.
    expect(
      screen.getByTestId(`sorting-picker-option-keep-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`sorting-picker-option-merge-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`sorting-picker-option-split-${ITEM_REJECTED}`),
    ).toBeInTheDocument();

    // Merge is pre-selected (AI said merge) so the merge-target dropdown appears.
    expect(
      screen.getByTestId(`sorting-picker-merge-target-${ITEM_REJECTED}`),
    ).toBeInTheDocument();

    // Choosing "split" replaces the merge dropdown with the split-page input.
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

    // Choosing "keep" hides all sub-forms.
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`sorting-picker-option-keep-${ITEM_REJECTED}`),
      );
    });
    expect(
      screen.queryByTestId(`sorting-picker-split-page-${ITEM_REJECTED}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`sorting-picker-merge-target-${ITEM_REJECTED}`),
    ).not.toBeInTheDocument();

    // Confirm button is present (and enabled for keep).
    expect(
      screen.getByTestId(`button-sorting-confirm-${ITEM_REJECTED}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`button-sorting-confirm-${ITEM_REJECTED}`),
    ).not.toBeDisabled();
  });

  it('pre-fill: AI split decision → Slice option pre-selected with the AI page (Task #905)', async () => {
    const ITEM_REJECTED_SPLIT = 'item-rejected-split';
    items.push({
      id: ITEM_REJECTED_SPLIT,
      originalName: 'rejected-split.pdf',
      status: 'sorted',
      sortingDecisionState: 'rejected',
      sortingDecision: 'split',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: 4,
      sortingManualOverride: false,
      sortingReason: 'AI thought it was two docs',
      sortingConfidence: 0.6,
    });

    renderPage();
    await screen.findByTestId(`item-preview-trigger-${ITEM_REJECTED_SPLIT}`, undefined, { timeout: 4000 });

    // Picker should show immediately with split pre-selected.
    expect(
      screen.getByTestId(`sorting-manual-picker-${ITEM_REJECTED_SPLIT}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`sorting-picker-split-page-${ITEM_REJECTED_SPLIT}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`sorting-picker-merge-target-${ITEM_REJECTED_SPLIT}`),
    ).not.toBeInTheDocument();
  });

  it('pre-fill: AI keep decision → Keep option pre-selected (Task #905)', async () => {
    const ITEM_REJECTED_KEEP = 'item-rejected-keep';
    items.push({
      id: ITEM_REJECTED_KEEP,
      originalName: 'rejected-keep.pdf',
      status: 'sorted',
      sortingDecisionState: 'rejected',
      sortingDecision: 'keep',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingManualOverride: false,
      sortingReason: 'AI thought it was standalone',
      sortingConfidence: 0.7,
    });

    renderPage();
    await screen.findByTestId(`item-preview-trigger-${ITEM_REJECTED_KEEP}`, undefined, { timeout: 4000 });

    // Picker should show immediately with keep pre-selected — no sub-forms.
    expect(
      screen.getByTestId(`sorting-manual-picker-${ITEM_REJECTED_KEEP}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`sorting-picker-merge-target-${ITEM_REJECTED_KEEP}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`sorting-picker-split-page-${ITEM_REJECTED_KEEP}`),
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

  // ---------------------------------------------------------------------------
  // Rename UI sub-section (Task #860).
  // ---------------------------------------------------------------------------

  it('shows the Rename section for a pending keep item when detail is expanded', async () => {
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_PENDING}`));
    });

    // The rename section must be present (pending keep decision).
    await waitFor(() => {
      expect(screen.getByTestId(`branching-rename-section-${ITEM_PENDING}`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-rename-${ITEM_PENDING}`)).toBeInTheDocument();
    });
  });

  it('does NOT show the Rename section for an accepted item', async () => {
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_ACCEPTED}`));
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId(`branching-rename-section-${ITEM_ACCEPTED}`),
      ).not.toBeInTheDocument();
    });
  });

  it('typing in the Rename input updates the controlled input value', async () => {
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_PENDING}`));
    });

    const renameInput = await screen.findByTestId(
      `branching-rename-${ITEM_PENDING}`,
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(renameInput, { target: { value: 'My New Name' } });
    });

    await waitFor(() => {
      expect(renameInput.value).toBe('My New Name');
    });
  });

  it('split decision shows Part 1 and Part 2 rename inputs', async () => {
    const ITEM_SPLIT_PENDING = 'item-split-pending';
    items.push({
      id: ITEM_SPLIT_PENDING,
      originalName: 'split-doc.pdf',
      status: 'sorted',
      sortingDecisionState: 'pending',
      sortingDecision: 'split',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: 2,
      sortingManualOverride: false,
      sortingReason: 'Two parts detected',
      sortingConfidence: 0.85,
    });

    renderPage();
    await screen.findByTestId(`item-preview-trigger-${ITEM_SPLIT_PENDING}`, undefined, { timeout: 4000 });

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-detail-${ITEM_SPLIT_PENDING}`));
    });

    await waitFor(() => {
      expect(screen.getByTestId(`branching-rename-section-${ITEM_SPLIT_PENDING}`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-rename-split-${ITEM_SPLIT_PENDING}-0`)).toBeInTheDocument();
      expect(screen.getByTestId(`branching-rename-split-${ITEM_SPLIT_PENDING}-1`)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Nested merge-group rendering on the sorting (Branching) step (Task #927).
  //
  // The lead's card is the only top-level row for a merge group; siblings
  // are rendered as nested children inside `branching-merge-group-<leadId>`
  // so admins see the grouping at a glance instead of a flat list of
  // duplicate-looking rows. These tests guard that contract end-to-end:
  // the sibling does not leak back to the top level, the container and
  // each sibling row are present with the right testids and filenames,
  // clicking a sibling opens its preview, the per-sibling exclude button
  // hits the right per-item PATCH, and the localized header label
  // matches the active language.
  // ---------------------------------------------------------------------------

  /**
   * Push a single merge-lead with two nested siblings. Returns the IDs
   * so each test can refer to them without repeating the literals.
   */
  function pushMergeGroupFixture() {
    const LEAD = 'item-merge-lead-927';
    const SIB_A = 'item-merge-sib-927-a';
    const SIB_B = 'item-merge-sib-927-b';
    items.push(
      {
        id: LEAD,
        originalName: 'lead-invoice.pdf',
        status: 'sorted',
        sortingDecisionState: 'pending',
        sortingDecision: 'merge',
        sortingMergeWithItemId: null,
        sortingMergeWithItemIds: [SIB_A, SIB_B],
        sortingSplitAtPage: null,
        sortingManualOverride: false,
        sortingReason: 'Three pages of the same invoice',
        sortingConfidence: 0.93,
      },
      {
        id: SIB_A,
        originalName: 'sibling-page-2.pdf',
        status: 'sorted',
        sortingDecisionState: 'pending',
        sortingDecision: 'merge',
        sortingMergeWithItemId: LEAD,
        sortingMergeWithItemIds: null,
        sortingSplitAtPage: null,
        sortingManualOverride: false,
        sortingReason: null,
        sortingConfidence: null,
      },
      {
        id: SIB_B,
        originalName: 'sibling-page-3.pdf',
        status: 'sorted',
        sortingDecisionState: 'pending',
        sortingDecision: 'merge',
        sortingMergeWithItemId: LEAD,
        sortingMergeWithItemIds: null,
        sortingSplitAtPage: null,
        sortingManualOverride: false,
        sortingReason: null,
        sortingConfidence: null,
      },
    );
    return { LEAD, SIB_A, SIB_B };
  }

  /**
   * Wait until the page has finished its initial loading spinner and the
   * sorting-step list has rendered the merge-lead card AND its nested
   * merge-group container.
   *
   * We deliberately wait in two stages — first for the always-present
   * pending item's row (proof that the lite query resolved and the
   * sorting-step list mounted), then for the merge-group container
   * itself. Under heavy parallel load the fast-unit pool was observed
   * to fail a single straight findByTestId on the merge-group testid
   * while the page was still showing its loading spinner; staging the
   * wait this way mirrors the proven `waitForRows` pattern used by the
   * pre-Task-#927 tests and keeps the suite stable in CI.
   */
  async function waitForMergeGroup(leadId: string) {
    await screen.findByTestId(`item-preview-trigger-${ITEM_PENDING}`, undefined, {
      timeout: 8000,
    });
    await screen.findByTestId(`branching-merge-group-${leadId}`, undefined, {
      timeout: 8000,
    });
  }

  it('siblings of a merge lead do NOT render as standalone item-row cards', async () => {
    const { LEAD, SIB_A, SIB_B } = pushMergeGroupFixture();

    renderPage();
    await waitForMergeGroup(LEAD);

    // The lead is a top-level row…
    expect(screen.getByTestId(`item-row-${LEAD}`)).toBeInTheDocument();
    // …but neither sibling appears as a top-level item-row-<sibId>.
    expect(screen.queryByTestId(`item-row-${SIB_A}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`item-row-${SIB_B}`)).not.toBeInTheDocument();

    // The other sorting-step rows (pending, rejected, accepted) are
    // unaffected by the grouping logic.
    expect(screen.getByTestId(`item-row-${ITEM_PENDING}`)).toBeInTheDocument();
    expect(screen.getByTestId(`item-row-${ITEM_REJECTED}`)).toBeInTheDocument();
    expect(screen.getByTestId(`item-row-${ITEM_ACCEPTED}`)).toBeInTheDocument();
  });

  it('renders the branching-merge-group container nested inside the lead card', async () => {
    const { LEAD } = pushMergeGroupFixture();

    renderPage();
    await waitForMergeGroup(LEAD);

    const group = screen.getByTestId(`branching-merge-group-${LEAD}`);
    expect(group).toBeInTheDocument();
    // The container must live inside the lead's card, not at the page root.
    const leadRow = screen.getByTestId(`item-row-${LEAD}`);
    expect(leadRow.contains(group)).toBe(true);
  });

  it('renders one branching-merge-group-sibling row per sibling, each with its filename', async () => {
    const { LEAD, SIB_A, SIB_B } = pushMergeGroupFixture();

    renderPage();
    await waitForMergeGroup(LEAD);

    const sibARow = screen.getByTestId(
      `branching-merge-group-sibling-${LEAD}-${SIB_A}`,
    );
    const sibBRow = screen.getByTestId(
      `branching-merge-group-sibling-${LEAD}-${SIB_B}`,
    );
    expect(sibARow).toHaveTextContent('sibling-page-2.pdf');
    expect(sibBRow).toHaveTextContent('sibling-page-3.pdf');
  });

  it("clicking a nested sibling's filename opens the preview for that sibling", async () => {
    const { LEAD, SIB_A } = pushMergeGroupFixture();

    renderPage();
    await waitForMergeGroup(LEAD);

    // The viewer is closed initially.
    expect(screen.queryByTestId('mock-inline-viewer')).not.toBeInTheDocument();

    // The sibling's filename is a button with the standard
    // item-preview-trigger testid scoped to the sibling id.
    const sibTrigger = screen.getByTestId(`item-preview-trigger-${SIB_A}`);
    // Sanity: the trigger lives inside the nested merge-group row, not at
    // the top level — so clicking it can only be the sibling's preview.
    const nestedRow = screen.getByTestId(
      `branching-merge-group-sibling-${LEAD}-${SIB_A}`,
    );
    expect(nestedRow.contains(sibTrigger)).toBe(true);

    await act(async () => {
      fireEvent.click(sibTrigger);
    });

    // The (mocked) inline viewer becomes visible — the page only renders
    // it when previewItem is set, so this is proof setPreviewItem fired.
    await waitFor(() => {
      expect(screen.getByTestId('mock-inline-viewer')).toBeInTheDocument();
    });
  });

  it("clicking the nested sibling's exclude button PATCHes /exclude for that sibling id", async () => {
    const { LEAD, SIB_A } = pushMergeGroupFixture();

    renderPage();
    await waitForMergeGroup(LEAD);

    const excludeBtn = screen.getByTestId(`button-toggle-exclude-${SIB_A}`);
    // Belt-and-braces: the button must be the one nested in the merge
    // group, otherwise we'd be re-asserting an unrelated top-level row.
    const nestedRow = screen.getByTestId(
      `branching-merge-group-sibling-${LEAD}-${SIB_A}`,
    );
    expect(nestedRow.contains(excludeBtn)).toBe(true);

    await act(async () => {
      fireEvent.click(excludeBtn);
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => {
        const url =
          typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith(`/items/${SIB_A}/exclude`);
      });
      expect(calls).toHaveLength(1);
      const init = calls[0][1] as RequestInit;
      expect((init.method || 'GET').toUpperCase()).toBe('PATCH');
      const body = JSON.parse(init.body as string);
      expect(body.excluded).toBe(true);

      // The lead's exclude endpoint must NOT have been hit — clicking a
      // sibling's exclude must only affect that sibling.
      const leadCalls = fetchMock.mock.calls.filter((call) => {
        const url =
          typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith(`/items/${LEAD}/exclude`);
      });
      expect(leadCalls).toHaveLength(0);
    });
  });

  it('renders the English "In this merge" header above the nested sibling list', async () => {
    const { LEAD } = pushMergeGroupFixture();

    renderPage();
    await waitForMergeGroup(LEAD);

    const group = screen.getByTestId(`branching-merge-group-${LEAD}`);
    expect(group).toHaveTextContent('In this merge');
    expect(group).not.toHaveTextContent('Dans cette fusion');
  });

  it('renders the French "Dans cette fusion" header when the language is fr', async () => {
    languageRef.current = 'fr';
    const { LEAD } = pushMergeGroupFixture();

    renderPage();
    await waitForMergeGroup(LEAD);

    const group = screen.getByTestId(`branching-merge-group-${LEAD}`);
    expect(group).toHaveTextContent('Dans cette fusion');
    expect(group).not.toHaveTextContent('In this merge');
  });

  it('surfaces the server error message as toast description when set-sorting-decision returns 400 (Task #924)', async () => {
    const SERVER_ERROR = 'Staged file missing for this item';

    // Temporarily override fetch: set-sorting-decision POST returns 400 with
    // a classified error body; all other calls pass through to fetchMock.
    const savedFetch = global.fetch;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = (init?.method || 'GET').toUpperCase();
      const [pathname] = url.split('?');
      if (
        method === 'POST' &&
        pathname.startsWith('/api/admin/bulk-import/items/') &&
        pathname.endsWith('/set-sorting-decision')
      ) {
        return jsonResponse({ error: SERVER_ERROR, code: 'MERGE_LEAD_FILE_MISSING' }, 400);
      }
      return (fetchMock as unknown as (i: RequestInfo | URL, init?: RequestInit) => Promise<Response>)(input, init);
    }) as unknown as typeof fetch;

    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-sorting-accept-${ITEM_PENDING}`));
    });

    await waitFor(
      () => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            description: SERVER_ERROR,
          }),
        );
      },
      { timeout: 4000 },
    );

    global.fetch = savedFetch;
  });
});
