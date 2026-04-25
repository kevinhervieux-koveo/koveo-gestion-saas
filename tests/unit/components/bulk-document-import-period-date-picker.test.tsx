/**
 * Task #1038 — Component coverage for the new Period date picker on
 * the Sorting step of the bulk-document-import wizard.
 *
 * The Period editor used to be an inline chip with a tiny text input
 * sitting on the Sorting row itself (`sorting-period-hint-editor-*`,
 * `sorting-period-hint-input-*`). Task #1003 moved it into a dedicated
 * sub-section inside the row's expanded detail panel and replaced the
 * free-text input with a real date picker. The new test IDs are
 * `sorting-period-section-*`, `sorting-period-date-picker-*`,
 * `sorting-period-clear-*` and `sorting-period-hint-manual-*`.
 *
 * No automated test exercised the new shape until now, which means a
 * future refactor that re-arranges the detail panel — or breaks the
 * `setPeriodHint` mutation wiring — could ship silently and only get
 * caught when an admin tried to override an AI-detected period in
 * production.
 *
 * This suite mounts the real BulkDocumentImportPage with a stubbed
 * lite endpoint and asserts:
 *   1. The Period section renders inside the expanded sorting panel.
 *   2. The picker is pre-filled when `screeningPeriodHint` parses as
 *      a date (`2024-03-15` → Date is forwarded into the picker).
 *   3. The picker shows the placeholder when the AI did not detect
 *      anything (`screeningPeriodHint === null`).
 *   4. The picker is disabled when the sorting decision is accepted
 *      (admins must reset the decision before re-editing the period).
 *   5. The "Manual" badge appears when
 *      `screeningPeriodHintManualOverride === true`.
 *   6. Selecting a date fires `POST /set-period-hint` with the
 *      day formatted as `YYYY-MM-DD`.
 *   7. Clicking "Clear" fires the same endpoint with `periodHint: null`.
 *
 * The Radix Popover/Calendar combo behind StandaloneDatePicker is hard
 * to drive cleanly under jsdom (positioning + portal), so we mock the
 * picker with a small button that:
 *   - Surfaces the current value via `data-value` so tests can read
 *     whether the period was pre-filled.
 *   - Shows the placeholder text when value is null so we can assert
 *     the empty-state copy.
 *   - Calls onChange with a deterministic Date when clicked, so the
 *     "select a date" assertion can verify the YYYY-MM-DD body.
 *   - Mirrors the disabled prop onto the rendered button.
 * This keeps the test focused on the Period section's wiring rather
 * than re-validating the third-party calendar widget.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
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

let currentLanguage: 'en' | 'fr' = 'en';
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: currentLanguage,
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

// The deterministic Date that the mocked picker hands back when clicked.
// Tests assert this surfaces as the YYYY-MM-DD body sent to the server.
const SELECTED_DATE = new Date(2026, 4, 17); // May 17, 2026 (local)
const SELECTED_DATE_YYYY_MM_DD = '2026-05-17';

jest.mock('@/components/common/DatePickerField', () => {
  const formatYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return {
    StandaloneDatePicker: ({
      value,
      onChange,
      placeholder,
      disabled,
      'data-testid': testId,
    }: {
      value: Date | null | undefined;
      onChange: (date: Date | null) => void;
      placeholder?: string;
      disabled?: boolean;
      'data-testid'?: string;
    }) => {
      const ymd = value ? formatYmd(value) : '';
      const display = value ? ymd : (placeholder ?? '');
      return (
        <button
          type="button"
          data-testid={testId}
          data-value={ymd}
          data-disabled={disabled ? 'true' : 'false'}
          disabled={!!disabled}
          onClick={() => {
            if (!disabled) onChange(SELECTED_DATE);
          }}
        >
          {display}
        </button>
      );
    },
    DatePickerField: () => null,
  };
});

// ---------------------------------------------------------------------------
// Imports under test (after every mock is registered).
// ---------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// ---------------------------------------------------------------------------
// Fixtures: four sorting-step rows covering the Period section's branches.
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-task-1038';

const ITEM_WITH_DATE = 'item-with-date';
const ITEM_NO_DATE = 'item-no-date';
const ITEM_ACCEPTED = 'item-accepted';
const ITEM_MANUAL = 'item-manual';

interface ItemRow {
  id: string;
  originalName: string;
  screeningPeriodHint: string | null;
  screeningPeriodHintManualOverride: boolean;
  sortingDecisionState: 'pending' | 'accepted' | 'rejected' | null;
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
      // Sorted status keeps the row out of the "needs screening" branch
      // and inside the sorting list where the Period section lives.
      status: 'sorted' as const,
      preExcludeStatus: null,
      screeningConfidence: 0.9,
      screeningFallback: null,
      screeningTypeGuess: 'invoice',
      screeningBucketGuess: null,
      screeningQaReason: null,
      screeningRotationDegrees: 0,
      screeningRotationApplied: false,
      screeningPeriodHint: it.screeningPeriodHint,
      screeningPeriodHintManualOverride: it.screeningPeriodHintManualOverride,
      screeningParsedPeriodHintDate: null,
      // Sorting fields — sortingDecision must be non-null so hasAnalysis
      // is true and the row's detail panel can be expanded.
      sortingConfidence: 0.95,
      sortingFallback: null,
      sortingDecision: 'keep' as const,
      sortingReason: 'Standalone invoice',
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingDecisionState: it.sortingDecisionState,
      sortingManualOverride: false,
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

    // The set-period-hint POST is what we want to assert on. Echo back
    // a minimal item shape so the mutation's onSuccess fires cleanly.
    if (
      method === 'POST' &&
      pathname.startsWith('/api/admin/bulk-import/items/') &&
      pathname.endsWith('/set-period-hint')
    ) {
      const id = pathname.split('/')[5];
      return jsonResponse({ item: { id }, resortedSiblingIds: [] });
    }

    if (method === 'POST') return jsonResponse({ ok: true });
    if (method === 'PATCH') return jsonResponse({ ok: true });

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  items = [
    {
      id: ITEM_WITH_DATE,
      originalName: 'with-date.pdf',
      screeningPeriodHint: '2024-03-15',
      screeningPeriodHintManualOverride: false,
      sortingDecisionState: 'pending',
    },
    {
      id: ITEM_NO_DATE,
      originalName: 'no-date.pdf',
      screeningPeriodHint: null,
      screeningPeriodHintManualOverride: false,
      sortingDecisionState: 'pending',
    },
    {
      id: ITEM_ACCEPTED,
      originalName: 'accepted.pdf',
      screeningPeriodHint: '2024-03-15',
      screeningPeriodHintManualOverride: false,
      sortingDecisionState: 'accepted',
    },
    {
      id: ITEM_MANUAL,
      originalName: 'manual.pdf',
      screeningPeriodHint: '2025-01-01',
      screeningPeriodHintManualOverride: true,
      sortingDecisionState: 'pending',
    },
  ];
  currentLanguage = 'en';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function waitForRows() {
  await screen.findByTestId(`item-preview-trigger-${ITEM_WITH_DATE}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`item-preview-trigger-${ITEM_NO_DATE}`);
  await screen.findByTestId(`item-preview-trigger-${ITEM_ACCEPTED}`);
  await screen.findByTestId(`item-preview-trigger-${ITEM_MANUAL}`);
}

async function expandRow(itemId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`button-toggle-detail-${itemId}`));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BulkDocumentImportPage — Period date picker (Task #1038)', () => {
  it('renders the Period section inside the expanded sorting panel', async () => {
    renderPage();
    await waitForRows();

    // Pending items are force-expanded in the Branching step (the collapse
    // chevron is hidden), so the period section is always visible without
    // needing to click an expand button.
    expect(
      screen.getByTestId(`sorting-period-section-${ITEM_WITH_DATE}`),
    ).toBeInTheDocument();
    // The picker itself is rendered inside the section.
    expect(
      screen.getByTestId(`sorting-period-date-picker-${ITEM_WITH_DATE}`),
    ).toBeInTheDocument();
  });

  it('pre-fills the date picker when screeningPeriodHint is a parseable date', async () => {
    renderPage();
    await waitForRows();
    // ITEM_WITH_DATE is pending → force-expanded; no expandRow needed.

    const picker = screen.getByTestId(`sorting-period-date-picker-${ITEM_WITH_DATE}`);
    // The mocked picker exposes the current Date as YYYY-MM-DD on
    // data-value. parseISO('2024-03-15') is March 15, 2024 in local
    // time, so reformatting locally must round-trip to the same string.
    expect(picker.getAttribute('data-value')).toBe('2024-03-15');
  });

  it('leaves the date picker empty when the AI did not detect a date', async () => {
    renderPage();
    await waitForRows();
    // ITEM_NO_DATE is pending → force-expanded; no expandRow needed.

    const picker = screen.getByTestId(`sorting-period-date-picker-${ITEM_NO_DATE}`);
    expect(picker.getAttribute('data-value')).toBe('');
    // When value is null the picker shows the placeholder.
    expect(picker).toHaveTextContent('No date selected');
    // Without a hint there is nothing to clear.
    expect(
      screen.queryByTestId(`sorting-period-clear-${ITEM_NO_DATE}`),
    ).not.toBeInTheDocument();
  });

  it('disables the picker (and the Clear button) when the sorting decision is accepted', async () => {
    renderPage();
    await waitForRows();
    await expandRow(ITEM_ACCEPTED);

    const picker = screen.getByTestId(`sorting-period-date-picker-${ITEM_ACCEPTED}`);
    expect(picker).toBeDisabled();
    expect(picker.getAttribute('data-disabled')).toBe('true');

    const clearBtn = screen.getByTestId(`sorting-period-clear-${ITEM_ACCEPTED}`);
    expect(clearBtn).toBeDisabled();

    // Helper hint copy reminds admins how to unblock the field.
    expect(
      screen.getByText(/Sorting decision is accepted/i),
    ).toBeInTheDocument();
  });

  it('shows the Manual badge when screeningPeriodHintManualOverride is true', async () => {
    renderPage();
    await waitForRows();
    // ITEM_MANUAL and ITEM_WITH_DATE are both pending → force-expanded;
    // no expandRow needed for either.

    const badge = screen.getByTestId(`sorting-period-hint-manual-${ITEM_MANUAL}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Manual');

    // Items whose hint came straight from the AI must NOT show it.
    expect(
      screen.queryByTestId(`sorting-period-hint-manual-${ITEM_WITH_DATE}`),
    ).not.toBeInTheDocument();
  });

  it('selecting a date fires POST /set-period-hint with the day formatted as YYYY-MM-DD', async () => {
    renderPage();
    await waitForRows();
    // ITEM_WITH_DATE is pending → force-expanded; no expandRow needed.

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`sorting-period-date-picker-${ITEM_WITH_DATE}`),
      );
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => {
        const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith(`/items/${ITEM_WITH_DATE}/set-period-hint`);
      });
      expect(calls).toHaveLength(1);
      const init = calls[0][1] as RequestInit;
      expect((init.method || 'GET').toUpperCase()).toBe('POST');
      const body = JSON.parse(init.body as string) as { periodHint: string | null };
      expect(body.periodHint).toBe(SELECTED_DATE_YYYY_MM_DD);
    });
  });

  it('clicking Clear fires POST /set-period-hint with periodHint: null', async () => {
    renderPage();
    await waitForRows();
    // ITEM_WITH_DATE is pending → force-expanded; no expandRow needed.

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`sorting-period-clear-${ITEM_WITH_DATE}`),
      );
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => {
        const url = typeof call[0] === 'string' ? call[0] : (call[0] as URL).toString();
        return url.endsWith(`/items/${ITEM_WITH_DATE}/set-period-hint`);
      });
      expect(calls).toHaveLength(1);
      const init = calls[0][1] as RequestInit;
      expect((init.method || 'GET').toUpperCase()).toBe('POST');
      const body = JSON.parse(init.body as string) as { periodHint: string | null };
      expect(body.periodHint).toBeNull();
    });
  });
});
