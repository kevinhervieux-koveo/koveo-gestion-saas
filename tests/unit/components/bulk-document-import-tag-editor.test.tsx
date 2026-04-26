/**
 * Task #1104 — Frontend coverage for the per-row tag editor added to the
 * Identification step of the bulk-document-import wizard by Task #1103.
 *
 * The editor is rendered inside the existing `data-testid="item-row-{id}"`
 * card with the wrapper testid `identification-tag-editor-{id}`. Inside
 * it the shared `<TagPicker>` is mounted, which exposes:
 *   - `button-tag-picker` — the popover trigger;
 *   - `option-tag-{id}` — one CommandItem per filtered tag in the list.
 *
 * Toggling an option calls `onChange` with the new tagIds array; the
 * page-level `IdentificationTagEditor` debounces the change 300 ms then
 * fires the `setItemTags` mutation which POSTs
 *   `/api/admin/bulk-import/items/{id}/set-tags`
 * with `{ tagIds }`.
 *
 * The two cases below exercise both halves of that contract:
 *
 *   1. ADD — clicking an option for a tag the item does NOT yet have
 *      results in a single POST whose body contains the previously
 *      stored UUID(s) plus the newly toggled one (free-form AI strings
 *      are silently dropped — the picker's `value` only holds UUIDs).
 *
 *   2. REMOVE — clicking the option for a tag the item already has
 *      removes that tag from the picker value and POSTs the remaining
 *      tagIds (empty array if it was the only one).
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

// jsdom doesn't implement a few DOM APIs that the radix popover/command
// primitives exercise on mount.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function () {};
}
if (
  typeof (HTMLElement.prototype as { hasPointerCapture?: unknown })
    .hasPointerCapture !== 'function'
) {
  (HTMLElement.prototype as { hasPointerCapture?: () => boolean }).hasPointerCapture =
    function () {
      return false;
    };
}
if (
  typeof (HTMLElement.prototype as { releasePointerCapture?: unknown })
    .releasePointerCapture !== 'function'
) {
  (HTMLElement.prototype as { releasePointerCapture?: () => void }).releasePointerCapture =
    function () {};
}

// -----------------------------------------------------------------------------
// Fixture helpers
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-1104';
const BUILDING_ID = 'building-1';
const ORG_ID = 'org-1';

const TAG_RECYCLING = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TAG_PARKING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TAG_PETS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const TAGS = [
  {
    id: TAG_RECYCLING,
    name: 'Recyclage',
    description: null,
    scope: 'building' as const,
    importance: 'nice_to_have' as const,
    suggestedProfessionals: [],
    isSystem: true,
    organizationId: null,
  },
  {
    id: TAG_PARKING,
    name: 'Stationnement',
    description: null,
    scope: 'building' as const,
    importance: 'obligatoire' as const,
    suggestedProfessionals: [],
    isSystem: true,
    organizationId: null,
  },
  {
    id: TAG_PETS,
    name: 'Animaux',
    description: null,
    scope: 'building' as const,
    importance: 'extra' as const,
    suggestedProfessionals: [],
    isSystem: true,
    organizationId: null,
  },
];

interface ItemFixture {
  id: string;
  originalName: string;
  branch: 'building_documents' | 'residence_documents' | null;
  identificationTags: string[] | null;
}

function buildItem(overrides: ItemFixture) {
  return {
    id: overrides.id,
    originalName: overrides.originalName,
    mimeType: 'application/pdf',
    // Identification step is reached after branching/sorting/etc; the
    // wizard exposes the row as long as the status is past the
    // pre-identification gates. `identified` is the canonical state at
    // this step.
    status: 'identified',
    preExcludeStatus: null,
    excludeSource: null,
    branch: overrides.branch,
    subCategory: 'lease',
    branchManualOverride: false,
    branchReason: 'looks like a lease',
    residenceId: null,
    residenceConfidence: null,
    residenceReason: null,
    residenceFallbackReason: null,
    residenceManualOverride: false,
    residenceAiSuggestedId: null,
    residenceAiSuggested: false,
    residenceAiConfirmed: false,
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
    identificationConfidence: 0.92,
    identificationFallback: null,
    identificationName: overrides.originalName.replace(/\.pdf$/i, ''),
    identificationDescription: 'AI-generated description',
    identificationTags: overrides.identificationTags,
    identificationEffectiveDate: '2024-06-01',
    identificationEffectiveDateManualOverride: false,
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
      currentStep: 'identification',
      status: 'active',
      progress: {
        runAll: {
          screening: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          sorting: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          branching: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          identification: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
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

interface SetTagsCall {
  itemId: string;
  body: { tagIds: string[] };
}

const setTagsCalls: SetTagsCall[] = [];

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
      if (pathname === '/api/document-tags') return jsonResponse({ tags: TAGS });
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(buildPayload(items));
      }
      if (pathname === `/api/buildings/${BUILDING_ID}/residences`) {
        return jsonResponse([]);
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      }
    }

    if (method === 'POST') {
      const setTagsMatch = pathname.match(
        /^\/api\/admin\/bulk-import\/items\/([^/]+)\/set-tags$/,
      );
      if (setTagsMatch) {
        const itemId = setTagsMatch[1];
        const body = init?.body
          ? (JSON.parse(init.body as string) as { tagIds: string[] })
          : { tagIds: [] };
        setTagsCalls.push({ itemId, body });
        return jsonResponse({
          id: itemId,
          identification: { tags: body.tagIds },
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
  // Pre-warm the queries that drive the identification rows so the
  // test doesn't race with the network. Note: TagPicker reads from
  // the SAME `['/api/document-tags']` cache key as the editor, so a
  // single setQueryData seeds both.
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    payload,
  );
  queryClient.setQueryData(['/api/document-tags'], { tags: TAGS });
}

beforeEach(() => {
  originalFetch = global.fetch;
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
  setTagsCalls.length = 0;
  queryClient.clear();
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
});

afterEach(() => {
  // Drain any pending timers (the editor's 300 ms debounce) before
  // restoring real timers, otherwise `setTimeout` in unrelated test
  // suites may fire under fake timers and hang.
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
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
// Tag editor integration
// =============================================================================

describe('BulkDocumentImportPage — IdentificationTagEditor (Task #1104)', () => {
  it('renders an identification-tag-editor wrapper for every identification row', async () => {
    const itemA = 'item-tag-a';
    const itemB = 'item-tag-b';
    setupTest([
      buildItem({
        id: itemA,
        originalName: 'lease-a.pdf',
        branch: 'building_documents',
        identificationTags: null,
      }),
      buildItem({
        id: itemB,
        originalName: 'lease-b.pdf',
        branch: 'building_documents',
        identificationTags: [TAG_RECYCLING],
      }),
    ]);
    renderPage();

    // Both rows rendered.
    await screen.findByTestId(`item-row-${itemA}`, undefined, { timeout: 4000 });
    await screen.findByTestId(`item-row-${itemB}`, undefined, { timeout: 4000 });

    // And both have a tag editor wrapper attached. Critical regression
    // guard: the editor must NOT be gated on having pre-existing tags
    // (item A starts with `identificationTags: null`).
    expect(
      screen.getByTestId(`identification-tag-editor-${itemA}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`identification-tag-editor-${itemB}`),
    ).toBeInTheDocument();
  });

  it('toggles a tag and POSTs the new tagIds to set-tags after the debounce', async () => {
    const itemId = 'item-tag-add';
    setupTest([
      buildItem({
        id: itemId,
        originalName: 'building-policy.pdf',
        branch: 'building_documents',
        // Start with one stored UUID so we can verify the picker
        // preserves the prior selection when adding a new tag.
        identificationTags: [TAG_RECYCLING],
      }),
    ]);
    renderPage();

    // Wait for the editor wrapper, then scope every subsequent query to
    // it so we don't accidentally interact with another row's picker.
    const editor = await screen.findByTestId(
      `identification-tag-editor-${itemId}`,
      undefined,
      { timeout: 4000 },
    );

    // Open the popover. The picker root only renders the trigger
    // until clicked; the option list is portal-mounted into the body.
    const trigger = editor.querySelector(
      '[data-testid="button-tag-picker"]',
    ) as HTMLElement | null;
    expect(trigger).not.toBeNull();
    await act(async () => {
      fireEvent.click(trigger!);
    });

    // The "Stationnement" option (TAG_PARKING) is in the dropdown but
    // not yet in the picker's value array.
    const option = await screen.findByTestId(
      `option-tag-${TAG_PARKING}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(option);
    });

    // Editor debounces 300 ms — no fetch should have fired yet.
    expect(setTagsCalls).toHaveLength(0);

    // Advance the debounce window.
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    // Now the POST must have fired with both UUIDs.
    await waitFor(() => {
      expect(setTagsCalls).toHaveLength(1);
    });
    expect(setTagsCalls[0].itemId).toBe(itemId);
    expect(setTagsCalls[0].body.tagIds).toEqual(
      expect.arrayContaining([TAG_RECYCLING, TAG_PARKING]),
    );
    expect(setTagsCalls[0].body.tagIds).toHaveLength(2);
  });

  it('removing a stored tag POSTs the remaining tagIds (empty array when last)', async () => {
    const itemId = 'item-tag-remove';
    setupTest([
      buildItem({
        id: itemId,
        originalName: 'rules.pdf',
        branch: 'building_documents',
        identificationTags: [TAG_RECYCLING],
      }),
    ]);
    renderPage();

    const editor = await screen.findByTestId(
      `identification-tag-editor-${itemId}`,
      undefined,
      { timeout: 4000 },
    );

    const trigger = editor.querySelector(
      '[data-testid="button-tag-picker"]',
    ) as HTMLElement | null;
    expect(trigger).not.toBeNull();
    await act(async () => {
      fireEvent.click(trigger!);
    });

    // Click the same Recyclage option again — toggle off.
    const option = await screen.findByTestId(
      `option-tag-${TAG_RECYCLING}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(option);
    });

    // Drain debounce.
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(setTagsCalls).toHaveLength(1);
    });
    expect(setTagsCalls[0]).toEqual({
      itemId,
      body: { tagIds: [] },
    });
  });

  it('coalesces rapid toggles into a single set-tags POST', async () => {
    const itemId = 'item-tag-coalesce';
    setupTest([
      buildItem({
        id: itemId,
        originalName: 'rapidfire.pdf',
        branch: 'building_documents',
        identificationTags: null,
      }),
    ]);
    renderPage();

    const editor = await screen.findByTestId(
      `identification-tag-editor-${itemId}`,
      undefined,
      { timeout: 4000 },
    );
    const trigger = editor.querySelector(
      '[data-testid="button-tag-picker"]',
    ) as HTMLElement | null;
    await act(async () => {
      fireEvent.click(trigger!);
    });

    const optionA = await screen.findByTestId(`option-tag-${TAG_RECYCLING}`);
    const optionB = await screen.findByTestId(`option-tag-${TAG_PARKING}`);

    await act(async () => {
      fireEvent.click(optionA);
    });
    // Within the debounce window — toggle a second one.
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    await act(async () => {
      fireEvent.click(optionB);
    });

    // Still nothing — first click's timer was cleared.
    expect(setTagsCalls).toHaveLength(0);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(setTagsCalls).toHaveLength(1);
    });
    expect(setTagsCalls[0].body.tagIds).toEqual(
      expect.arrayContaining([TAG_RECYCLING, TAG_PARKING]),
    );
    expect(setTagsCalls[0].body.tagIds).toHaveLength(2);
  });
});
