/**
 * Task #1158 — Frontend coverage for the auto-apply useEffect added to the
 * Identification step by Task #1149.
 *
 * The page-level effect at `client/src/pages/admin/bulk-document-import.tsx`
 * watches every item visible in the identification step and, on the admin's
 * behalf, fires:
 *
 *   - the existing `setEffectiveDate` mutation (POST
 *     `/api/admin/bulk-import/items/{id}/set-effective-date`) when the
 *     screening step parsed a period-hint date but identification didn't
 *     return a date of its own — and the admin hasn't manually overridden
 *     the field;
 *
 *   - the existing `setItemTags` mutation (POST
 *     `/api/admin/bulk-import/items/{id}/set-tags`) when the identification
 *     step suggested real `document_tags` UUIDs but no tags are stored on
 *     the row yet.
 *
 * Both branches are guarded by per-item refs so the auto-apply happens at
 * most once per "suggestion signature" per browser session, with two
 * carve-outs:
 *
 *   1. When `identificationEffectiveDateManualOverride` is true the date
 *      branch must NEVER fire (the admin is in charge).
 *
 *   2. When the admin uses "Reprendre l'étape à zéro" — visible to this
 *      effect as a non-null → null transition on `identificationEffective
 *      Date` — the date ref entry is cleared so a fresh hint can re-apply
 *      automatically.
 *
 * The four cases below pin those four behaviours.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
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

// -----------------------------------------------------------------------------
// Imports under test
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// jsdom doesn't implement a few DOM APIs that the radix popover/command
// primitives exercise on mount (the page mounts a TagPicker per item).
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

const SESSION_ID = 'session-test-1158';
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
  branch?: 'building_documents' | 'residence_documents' | null;
  identificationTags?: string[] | null;
  identificationEffectiveDate?: string | null;
  identificationEffectiveDateManualOverride?: boolean;
  screeningParsedPeriodHintDate?: string | null;
  identificationAiSuggestedTagIds?: string[] | null;
}

function buildItem(overrides: ItemFixture) {
  return {
    id: overrides.id,
    originalName: overrides.originalName,
    mimeType: 'application/pdf',
    status: 'identified',
    preExcludeStatus: null,
    excludeSource: null,
    branch: overrides.branch ?? 'building_documents',
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
    screeningParsedPeriodHintDate: overrides.screeningParsedPeriodHintDate ?? null,
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
    identificationTags: overrides.identificationTags ?? null,
    identificationAiSuggestedTagIds: overrides.identificationAiSuggestedTagIds ?? null,
    identificationEffectiveDate: overrides.identificationEffectiveDate ?? null,
    identificationEffectiveDateManualOverride:
      overrides.identificationEffectiveDateManualOverride ?? false,
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

interface SetEffectiveDateCall {
  itemId: string;
  body: { effectiveDate: string | null };
}

interface SetTagsCall {
  itemId: string;
  body: { tagIds: string[] };
}

const setEffectiveDateCalls: SetEffectiveDateCall[] = [];
const setTagsCalls: SetTagsCall[] = [];

// `itemsRef` is captured by the fetch mock so tests can mutate the in-memory
// item list (via `updateItems`) and have the next `lite` refetch return the
// new state. This is what drives the reset-transition test below.
let itemsRef: ReturnType<typeof buildItem>[] = [];

function makeFetchMock() {
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
        return jsonResponse(buildPayload(itemsRef));
      }
      if (pathname === `/api/buildings/${BUILDING_ID}/residences`) {
        return jsonResponse([]);
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      }
    }

    if (method === 'POST') {
      const setEffectiveDateMatch = pathname.match(
        /^\/api\/admin\/bulk-import\/items\/([^/]+)\/set-effective-date$/,
      );
      if (setEffectiveDateMatch) {
        const itemId = setEffectiveDateMatch[1];
        const body = init?.body
          ? (JSON.parse(init.body as string) as { effectiveDate: string | null })
          : { effectiveDate: null };
        setEffectiveDateCalls.push({ itemId, body });
        return jsonResponse({
          id: itemId,
          identification: { effectiveDate: body.effectiveDate },
        });
      }

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
  itemsRef = items;
  global.fetch = makeFetchMock();
  // Pre-warm the queries that drive the identification rows so the test
  // doesn't race with the network on first render.
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    buildPayload(items),
  );
  queryClient.setQueryData(['/api/document-tags'], { tags: TAGS });
}

/**
 * Replace the cached `lite` payload with a new item list. Used by the
 * reset-transition test to flip `identificationEffectiveDate` from a
 * stored value back to null without round-tripping the server.
 */
function updateItems(items: ReturnType<typeof buildItem>[]) {
  itemsRef = items;
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    buildPayload(items),
  );
}

beforeEach(() => {
  originalFetch = global.fetch;
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
  setEffectiveDateCalls.length = 0;
  setTagsCalls.length = 0;
  itemsRef = [];
  queryClient.clear();
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
});

afterEach(() => {
  // Drain any pending timers (mutations may schedule cleanup work) before
  // restoring real timers.
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
// Auto-apply identification (Task #1149) — covered by Task #1158
// =============================================================================

describe('BulkDocumentImportPage — auto-apply identification (Task #1158)', () => {
  it('auto-applies the screening period-hint date when identificationEffectiveDate is null', async () => {
    const itemId = 'item-auto-date';
    setupTest([
      buildItem({
        id: itemId,
        originalName: 'minutes.pdf',
        screeningParsedPeriodHintDate: '2024-03-15',
        identificationEffectiveDate: null,
        identificationEffectiveDateManualOverride: false,
      }),
    ]);

    renderPage();

    // The row must mount before the effect can run.
    await screen.findByTestId(`item-row-${itemId}`, undefined, { timeout: 4000 });

    // The auto-apply effect runs synchronously after render, but the
    // mutation is wrapped in apiRequest → fetch which resolves on the
    // microtask queue. Waiting for the captured POST is the cleanest
    // way to assert it actually fired.
    await waitFor(() => {
      expect(setEffectiveDateCalls).toHaveLength(1);
    });
    expect(setEffectiveDateCalls[0]).toEqual({
      itemId,
      body: { effectiveDate: '2024-03-15' },
    });
    // Tags branch must NOT have fired — there were no AI tag suggestions.
    expect(setTagsCalls).toHaveLength(0);
  });

  it('auto-applies AI-suggested tag UUIDs when identificationTags is empty', async () => {
    const itemId = 'item-auto-tags';
    setupTest([
      buildItem({
        id: itemId,
        originalName: 'rules.pdf',
        identificationTags: [],
        identificationAiSuggestedTagIds: [TAG_RECYCLING, TAG_PARKING],
        // Date branch is intentionally inert: no hint date, so it can't fire.
        screeningParsedPeriodHintDate: null,
      }),
    ]);

    renderPage();

    await screen.findByTestId(`item-row-${itemId}`, undefined, { timeout: 4000 });

    await waitFor(() => {
      expect(setTagsCalls).toHaveLength(1);
    });
    expect(setTagsCalls[0].itemId).toBe(itemId);
    expect(setTagsCalls[0].body.tagIds).toEqual(
      expect.arrayContaining([TAG_RECYCLING, TAG_PARKING]),
    );
    expect(setTagsCalls[0].body.tagIds).toHaveLength(2);

    // The date branch had no input to act on.
    expect(setEffectiveDateCalls).toHaveLength(0);
  });

  it('does NOT auto-apply the period-hint date when identificationEffectiveDateManualOverride is true', async () => {
    const itemId = 'item-manual-override';
    setupTest([
      buildItem({
        id: itemId,
        originalName: 'manual.pdf',
        // Hint date IS present and effective date IS null — the only
        // gate keeping the auto-apply at bay must be the override flag.
        screeningParsedPeriodHintDate: '2024-03-15',
        identificationEffectiveDate: null,
        identificationEffectiveDateManualOverride: true,
      }),
    ]);

    renderPage();

    await screen.findByTestId(`item-row-${itemId}`, undefined, { timeout: 4000 });

    // Give the effect / any debounced work a chance to fire — then
    // assert nothing went out. Using runOnlyPendingTimers + a real
    // microtask flush is enough; if the effect WERE to run the POST
    // would land on `setEffectiveDateCalls` synchronously (apart from
    // the awaited fetch promise resolution).
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(setEffectiveDateCalls).toHaveLength(0);
  });

  it('re-applies the period-hint date after the admin resets the step (non-null → null transition)', async () => {
    const itemId = 'item-reset';
    const initial = buildItem({
      id: itemId,
      originalName: 'lease.pdf',
      // First pass: a date is already stored, so the auto-apply guard
      // (effectiveDate !== null) suppresses the POST.
      screeningParsedPeriodHintDate: '2024-03-15',
      identificationEffectiveDate: '2024-03-15',
      identificationEffectiveDateManualOverride: false,
    });
    setupTest([initial]);

    renderPage();

    await screen.findByTestId(`item-row-${itemId}`, undefined, { timeout: 4000 });

    // Sanity-check: nothing fires on the initial render because the
    // effective date was already populated.
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(setEffectiveDateCalls).toHaveLength(0);

    // Admin clicks "Reprendre l'étape à zéro" — backend now reports the
    // row with identificationEffectiveDate === null and the same hint
    // date still parked on the screening side. We simulate that by
    // updating the cached `lite` payload in place.
    const reset = buildItem({
      id: itemId,
      originalName: 'lease.pdf',
      screeningParsedPeriodHintDate: '2024-03-15',
      identificationEffectiveDate: null,
      identificationEffectiveDateManualOverride: false,
    });
    await act(async () => {
      updateItems([reset]);
    });

    // The non-null → null transition clears the date ref, so the effect
    // is free to re-fire with the unchanged hint date.
    await waitFor(() => {
      expect(setEffectiveDateCalls).toHaveLength(1);
    });
    expect(setEffectiveDateCalls[0]).toEqual({
      itemId,
      body: { effectiveDate: '2024-03-15' },
    });
  });
});
