/**
 * Task #1265 — Phone-width regression test for the four bulk-import
 * dialogs that Task #1260 fixed for 360-480px screens.
 *
 * Background
 * ----------
 * Task #1260 made the bulk-import wizard's destructive AlertDialogs +
 * the typed-confirm "Clear all" Dialog phone-safe by appending two
 * mobile-only Tailwind classes:
 *
 *   - `w-[calc(100%-2rem)]` and `max-w-lg` so the modal never spills
 *     past the viewport edge on a 360px-wide phone.
 *   - `max-h-[calc(100dvh-2rem)] overflow-y-auto` so a long body can
 *     scroll inside the modal instead of running off the bottom of
 *     the screen on a short viewport.
 *
 * The fix lives entirely in the wizard's JSX — no shared
 * `AlertDialogContent` change — so a future refactor that "tidies"
 * the className overrides would silently re-break phones because
 * #1260 shipped without an automated guard. This file locks the
 * behaviour in by opening each of the four affected dialogs (in a
 * 360px-wide jsdom viewport for documentation; the assertions below
 * key off className, which is layout-independent in jsdom) and
 * asserting the rendered Content element exposes the mobile-safe
 * classes added in #1260.
 *
 * Coverage
 * --------
 *   1. `history-delete-dialog`           (HistoryCard, ~line 1462)
 *   2. The clear-all confirm `Dialog`    (no testid, ~line 8902)
 *   3. `cancel-bulk-retry-dialog`        (Task #1213, ~line 8949)
 *   4. `reset-step-dialog`               (Task #1068, ~line 8993)
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react';
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

let mockLanguage: 'en' | 'fr' = 'en';
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: mockLanguage,
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

import BulkDocumentImportPage, {
  BULK_RETRY_CONFIRM_THRESHOLD,
} from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// -----------------------------------------------------------------------------
// Mobile-safe class lists locked in by Task #1260
// -----------------------------------------------------------------------------

/**
 * The three destructive AlertDialog wrappers (`history-delete-dialog`,
 * `cancel-bulk-retry-dialog`, `reset-step-dialog`) all carry the same
 * className override:
 *
 *   className="w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto"
 *
 * Any future refactor that drops one of these classes from any of the
 * three call-sites would silently re-introduce the 360-480px overflow
 * bug Task #1260 fixed.
 */
const ALERT_DIALOG_MOBILE_CLASSES = [
  'w-[calc(100%-2rem)]',
  'max-w-lg',
  'max-h-[calc(100dvh-2rem)]',
  'overflow-y-auto',
] as const;

/**
 * The typed-confirm "Clear all" Dialog uses the smaller two-class
 * subset because shadcn's `DialogContent` already provides a
 * width cap of its own; only the height cap and scroll affordance
 * had to be appended in #1260.
 */
const DIALOG_MOBILE_CLASSES = [
  'max-h-[calc(100dvh-2rem)]',
  'overflow-y-auto',
] as const;

function expectClasses(
  element: HTMLElement,
  classes: readonly string[],
): void {
  for (const cls of classes) {
    expect(element).toHaveClass(cls);
  }
}

// -----------------------------------------------------------------------------
// Fetch mock + render helpers (modeled after the existing wizard
// component test files so cancelQueries / cleanup behaviour matches).
// -----------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () =>
      new Blob([JSON.stringify(body)], { type: 'application/json' }),
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

let SESSION_ID = 'session-task-1265-init';

const baseItemDefaults = {
  mimeType: 'application/pdf',
  preExcludeStatus: null,
  excludeSource: null,
  screeningConfidence: null,
  screeningFallback: null,
  screeningTypeGuess: null,
  screeningBucketGuess: null,
  screeningQaReason: null,
  screeningRotationDegrees: 0,
  screeningRotationApplied: false,
  sortingConfidence: null,
  sortingFallback: null,
  sortingDecision: null,
  sortingReason: null,
  sortingMergeWithItemId: null,
  sortingMergeWithItemIds: null,
  sortingSplitAtPage: null,
  sortingDecisionState: null,
  sortingManualOverride: false,
  sortingDecisionSplitIntoItemIds: null,
  sortingDecisionDraft: false,
  sortingDecisionSplitFinalNames: null,
  finalFileName: null,
  branchingConfidence: null,
  branchingFallback: null,
  branch: null as 'building_documents' | null,
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
  identificationConfidence: null,
  identificationFallback: null,
  identificationName: null,
  identificationDescription: null,
  identificationTags: null,
  identificationAiSuggestedTagIds: null,
  identificationEffectiveDate: null,
  identificationEffectiveDateManualOverride: false,
  linkingConfidence: null,
  linkingFallback: null,
  linkingReason: null,
  linkingBeforeItemId: null,
  linkingAfterItemId: null,
};

/** Single-item screening-step session payload — minimal fixture
 *  sufficient for both the reset-step and clear-all dialog scenarios.
 */
function buildScreeningSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1265',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'screening' as const,
      status: 'active' as const,
      // Mark the auto-mount /run-all loop as already finished so the
      // "Retry step from scratch" button is not gated by
      // `runAll.isPending`.
      progress: {
        runAll: {
          screening: {
            total: 1,
            processed: 1,
            failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: [
      {
        ...baseItemDefaults,
        id: 'item-1265',
        originalName: 'doc-1265.pdf',
        status: 'pending',
      },
    ],
  };
}

/** Sorting-step payload with BULK_RETRY_CONFIRM_THRESHOLD + 1 retryable
 *  rows so the cancel-bulk-retry confirm AlertDialog opens (the
 *  immediate-abort path only fires for batches strictly below the
 *  threshold).
 */
const BULK_RETRY_ROW_COUNT = BULK_RETRY_CONFIRM_THRESHOLD + 1;
const BULK_RETRY_IDS = Array.from(
  { length: BULK_RETRY_ROW_COUNT },
  (_, idx) => `item-1265-bulk-${idx + 1}`,
) as readonly string[];

function buildBulkRetrySessionPayload() {
  const sortedDefaults = {
    status: 'sorted' as const,
    screeningTypeGuess: 'invoice',
    screeningBucketGuess: null as null,
    screeningConfidence: 0.7,
    sortingDecisionState: 'accepted' as const,
    sortingConfidence: 0.05,
    sortingDecision: 'keep' as const,
  };
  const rows = BULK_RETRY_IDS.map((id, idx) => ({
    ...baseItemDefaults,
    ...sortedDefaults,
    id,
    originalName: `doc-bulk-${idx + 1}.pdf`,
    sortingFallback: 'api_error' as const,
    sortingReason: 'AI failed',
  }));
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1265',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'sorting' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          sorting: {
            total: BULK_RETRY_ROW_COUNT,
            processed: BULK_RETRY_ROW_COUNT,
            failed: BULK_RETRY_ROW_COUNT,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
            inFlight: [],
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: rows,
  };
}

/** Single past-session payload for the history-delete-dialog scenario.
 *  The status is `'paused'` so the row renders with a Resume button
 *  (irrelevant) and a Delete button (the trigger we click). The
 *  building list is mocked to provide a friendly name.
 */
const HISTORY_SESSION_ID = 'history-session-1265';
const HISTORY_BUILDING = {
  id: 'history-building-1265',
  name: 'Phone-test building',
};
function buildHistorySessionsPage() {
  return {
    sessions: [
      {
        id: HISTORY_SESSION_ID,
        buildingId: HISTORY_BUILDING.id,
        organizationId: 'org-1',
        adminUserId: 'admin-1',
        currentStep: 'screening' as const,
        status: 'paused' as const,
        progress: {},
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    limit: 20,
    offset: 0,
    hasMore: false,
  };
}

// Fetch responder factory — each test injects which payload to serve
// for the active-session /lite endpoint and the history /sessions list.
type SessionPayloadFn = (() => unknown) | null;
type HistoryPayloadFn = (() => unknown) | null;

let activeSessionPayload: SessionPayloadFn = null;
let historySessionsPayload: HistoryPayloadFn = null;
let buildingsPayload: unknown[] = [];

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
      if (pathname === '/api/admin/bulk-import/buildings-lite')
        return jsonResponse(buildingsPayload);
      if (pathname === '/api/admin/bulk-import/ai-status')
        return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(
          activeSessionPayload ? activeSessionPayload() : { items: [] },
        );
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse(
          historySessionsPayload
            ? historySessionsPayload()
            : { sessions: [], limit: 20, offset: 0, hasMore: false },
        );
      }
    }

    // Resolve every POST/DELETE optimistically — none of the
    // assertions in this file inspect network traffic, they only
    // care about the rendered className of the open dialog.
    if (method === 'POST' || method === 'DELETE') {
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let originalInnerWidth: number | undefined;

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-task-1265');
  mockLanguage = 'en';
  activeSessionPayload = null;
  historySessionsPayload = null;
  buildingsPayload = [];

  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  // jsdom defaults to 1024px. Narrow the viewport to the 360px phone
  // width Task #1260 targets so the test name matches the regression
  // scenario; the className assertions themselves do not depend on
  // layout (jsdom does not compute Tailwind breakpoints anyway).
  originalInnerWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 360,
  });
});

afterEach(async () => {
  // Cancel any in-flight queries so a background refetch from this
  // test cannot leak into the next test's render. The wizard polls
  // /lite on a 5s interval — without this the queryClient.clear()
  // below races the next test's first render.
  await queryClient.cancelQueries();
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });

  cleanup();
  // Radix-UI portals (AlertDialog, Dialog) attach to document.body and
  // RTL's `cleanup()` doesn't always reap the orphaned wrappers.
  // Explicitly resetting body keeps every test's DOM pristine.
  document.body.innerHTML = '';
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  mockToast.mockReset();
  queryClient.clear();

  if (typeof originalInnerWidth === 'number') {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  }
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — phone-width dialog overrides (Task #1265)', () => {
  it('history-delete-dialog keeps the mobile width + height + scroll classes', async () => {
    // No active session — render the picker view so HistoryCard mounts.
    historySessionsPayload = buildHistorySessionsPage;
    buildingsPayload = [HISTORY_BUILDING];

    renderPage();

    const deleteTrigger = await screen.findByTestId(
      `history-delete-${HISTORY_SESSION_ID}`,
      undefined,
      { timeout: 4000 },
    );

    await act(async () => {
      fireEvent.click(deleteTrigger);
    });

    const dialog = await screen.findByTestId(
      'history-delete-dialog',
      undefined,
      { timeout: 4000 },
    );
    expectClasses(dialog, ALERT_DIALOG_MOBILE_CLASSES);
  });

  it('clear-all confirm Dialog keeps the mobile height + scroll classes', async () => {
    activeSessionPayload = buildScreeningSessionPayload;
    window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);

    renderPage();

    const clearAllBtn = await screen.findByTestId(
      'button-clear-all',
      undefined,
      { timeout: 4000 },
    );

    await act(async () => {
      fireEvent.click(clearAllBtn);
    });

    // The clear-all DialogContent has no testid, so anchor on the
    // unique typed-confirm input that lives inside it (Task #1260's
    // className override sits on the wrapper itself, not the input).
    const confirmInput = await screen.findByTestId(
      'input-confirm',
      undefined,
      { timeout: 4000 },
    );
    const dialog = confirmInput.closest('[role="dialog"]') as HTMLElement | null;
    expect(dialog).not.toBeNull();
    expectClasses(dialog as HTMLElement, DIALOG_MOBILE_CLASSES);
  });

  it('cancel-bulk-retry-dialog keeps the mobile width + height + scroll classes', async () => {
    activeSessionPayload = buildBulkRetrySessionPayload;
    window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);

    renderPage();

    // Wait for the first retryable row so we know the wizard finished
    // hydrating the SORTING step view.
    await screen.findByTestId(
      `item-row-${BULK_RETRY_IDS[0]}`,
      undefined,
      { timeout: 4000 },
    );

    const bulkRetryBtn = await screen.findByTestId(
      'auto-run-retry-failed-sorting',
      undefined,
      { timeout: 4000 },
    );

    await act(async () => {
      fireEvent.click(bulkRetryBtn);
    });

    const cancelBtn = await screen.findByTestId(
      'auto-run-retry-cancel-sorting',
      undefined,
      { timeout: 4000 },
    );

    // Click Cancel before the loop processes too many rows so the
    // remaining count stays at-or-above BULK_RETRY_CONFIRM_THRESHOLD
    // and the confirm dialog opens (instead of the immediate-abort
    // path that fires when remaining < threshold).
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    const dialog = await screen.findByTestId(
      'cancel-bulk-retry-dialog',
      undefined,
      { timeout: 4000 },
    );
    expectClasses(dialog, ALERT_DIALOG_MOBILE_CLASSES);

    // Tidy up: dismiss the in-flight bulk retry so afterEach's
    // queryClient.cancelQueries() doesn't have to fight the loop's
    // 200ms inter-call stagger on the way out.
    const dismissBtn = within(dialog).getByTestId(
      'cancel-bulk-retry-confirm',
    );
    await act(async () => {
      fireEvent.click(dismissBtn);
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId('cancel-bulk-retry-dialog'),
      ).not.toBeInTheDocument();
    });
  });

  it('reset-step-dialog keeps the mobile width + height + scroll classes', async () => {
    activeSessionPayload = buildScreeningSessionPayload;
    window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);

    renderPage();

    const resetBtn = await screen.findByTestId(
      'auto-run-reset-step-screening',
      undefined,
      { timeout: 4000 },
    );
    // Wait out the auto-mount /run-all mutation so the button isn't
    // disabled by `runAll.isPending` when we click it.
    await waitFor(() => expect(resetBtn).toBeEnabled(), { timeout: 4000 });

    await act(async () => {
      fireEvent.click(resetBtn);
    });

    const dialog = await screen.findByTestId(
      'reset-step-dialog',
      undefined,
      { timeout: 4000 },
    );
    expectClasses(dialog, ALERT_DIALOG_MOBILE_CLASSES);
  });
});
