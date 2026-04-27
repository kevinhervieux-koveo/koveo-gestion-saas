/**
 * Task #1220 — Client coverage for the "Analyzed from text only" badge in
 * the Sorting, Branching, Identification and Linking steps.
 *
 * Background:
 *   - Task #1217 introduced `TextOnlyDegradedBadge` and rendered it in the
 *     Screening step item card whenever the underlying PDF was degraded to
 *     text-only extraction (`screeningDegraded === 'pdf_text_only'`).
 *   - The PDF text-only degradation actually happens at the file-loading
 *     layer, so every later AI step (Sorting, Branching, Identification,
 *     Linking) also reads from extracted text when that flag fires.
 *   - This task surfaces the same `pdf_text_only` marker on the lite
 *     endpoint for the four later steps and renders the badge in their
 *     item cards too — so admins reviewing Sorting, Branching, etc. can
 *     also tell the AI worked from text-only input.
 *
 * The page-level scaffolding mirrors
 * `tests/unit/components/bulk-document-import-screening-rotation-badge.test.tsx`
 * so future page changes only have to be re-mocked once.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, act } from '@testing-library/react';
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

let currentLanguage: 'en' | 'fr' = 'en';
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: currentLanguage,
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
// Imports under test (after jest.mock setup).
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Fixture state and fetch responder.
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-1220';
const ITEM_DEGRADED_ID = 'item-degraded-aaa';
const ITEM_NORMAL_ID = 'item-normal-bbb';
const ITEM_DEGRADED_NAME = 'huge-scan.pdf';
const ITEM_NORMAL_NAME = 'small-doc.pdf';

type Step = 'sorting' | 'branching' | 'identification' | 'linking';

interface ItemFixture {
  id: string;
  originalName: string;
  // Step-specific degraded flags. Only the marker for the active step
  // matters for the badge under test, but we set them all to keep the
  // payload self-consistent with the lite endpoint contract.
  sortingDegraded: 'pdf_text_only' | null;
  branchingDegraded: 'pdf_text_only' | null;
  identificationDegraded: 'pdf_text_only' | null;
  linkingDegraded: 'pdf_text_only' | null;
}

let items: ItemFixture[] = [];
let activeStep: Step = 'sorting';

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: activeStep,
      status: 'active' as const,
      progress: {
        runAll: {
          screening: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          sorting: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          branching: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          identification: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          linking: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: items.map((it) => ({
      id: it.id,
      originalName: it.originalName,
      mimeType: 'application/pdf',
      // Use a status late enough that the row appears in every step
      // (Screening through Linking never filter out 'identified' rows).
      status: 'identified' as const,
      preExcludeStatus: null,
      excludeSource: null,
      finalFileName: null,
      duplicateOfDocumentId: null,
      duplicateOfDocumentName: null,
      duplicateOfBuildingId: null,
      duplicateOfBuildingName: null,
      duplicateOfResidenceLabel: null,
      duplicateOfDocumentType: null,
      duplicateOfDocumentRemoved: false,
      // Screening: not degraded — keeps the screening test gating intact
      // and lets us assert the new badges are step-specific.
      screeningConfidence: 0.9,
      screeningFallback: null,
      screeningDegraded: null,
      screeningRetryCount: 1,
      screeningTypeGuess: null,
      screeningBucketGuess: null,
      screeningQaReason: null,
      screeningPeriodHint: null,
      screeningPeriodHintManualOverride: false,
      screeningParsedPeriodHintDate: null,
      screeningRotationDegrees: 0,
      screeningRotationApplied: false,
      sortingConfidence: 0.9,
      sortingFallback: null,
      sortingRetryCount: 1,
      sortingDegraded: it.sortingDegraded,
      // Mark sorting as accepted so the badges row renders in the Sorting
      // step (the layout hides AI badges while a row is pending review).
      sortingDecision: 'keep' as const,
      sortingReason: null,
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingDecisionState: 'accepted' as const,
      sortingManualOverride: false,
      sortingDecisionSplitIntoItemIds: null,
      sortingDecisionDraft: false,
      sortingDecisionSplitFinalNames: null,
      branchingConfidence: 0.9,
      branchingFallback: null,
      branchingRetryCount: 1,
      branchingDegraded: it.branchingDegraded,
      // Route to building_documents so the branching layout renders the
      // standard badge row (residence_documents takes a different path
      // that gates the FallbackReasonBadge / TextOnlyDegradedBadge on
      // residence selection).
      branch: 'building_documents' as const,
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
      identificationConfidence: 0.9,
      identificationFallback: null,
      identificationRetryCount: 1,
      identificationDegraded: it.identificationDegraded,
      identificationName: 'Doc',
      identificationDescription: null,
      identificationTags: null,
      identificationAiSuggestedTagIds: null,
      identificationEffectiveDate: null,
      identificationEffectiveDateManualOverride: false,
      linkingConfidence: 0.9,
      linkingFallback: null,
      linkingRetryCount: 1,
      linkingDegraded: it.linkingDegraded,
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

const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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

  // POST/PATCH/DELETE: harmless success — the badge tests don't drive
  // any mutations.
  if (method !== 'GET') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ unmocked: true, url, method }, 404);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  items = [
    {
      id: ITEM_DEGRADED_ID,
      originalName: ITEM_DEGRADED_NAME,
      sortingDegraded: 'pdf_text_only',
      branchingDegraded: 'pdf_text_only',
      identificationDegraded: 'pdf_text_only',
      linkingDegraded: 'pdf_text_only',
    },
    {
      id: ITEM_NORMAL_ID,
      originalName: ITEM_NORMAL_NAME,
      sortingDegraded: null,
      branchingDegraded: null,
      identificationDegraded: null,
      linkingDegraded: null,
    },
  ];
  currentLanguage = 'en';
  activeStep = 'sorting';

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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function waitForRows() {
  await screen.findByTestId(`item-preview-trigger-${ITEM_DEGRADED_ID}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`item-preview-trigger-${ITEM_NORMAL_ID}`);
}

async function flushAsyncEffects() {
  await act(async () => {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — TextOnlyDegradedBadge in later steps (Task #1220)', () => {
  it.each<[Step]>([
    ['sorting'],
    ['branching'],
    ['identification'],
    ['linking'],
  ])('renders exactly one "Analyzed from text only" badge in the %s step (degraded item only)', async (step) => {
    activeStep = step;

    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    // Two items are mounted (one degraded, one not). When the lite payload
    // surfaces the per-step degraded marker only on the first item, the
    // page must render the badge exactly once. If a regression dropped
    // the per-step gating and rendered the badge for every row, this
    // assertion would catch it (count would be 2). If the rendering for
    // the active step regressed entirely, the count would be 0.
    const badges = screen.getAllByTestId('badge-text-only-degraded');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('Analyzed from text only');
  });

  it.each<[Step]>([
    ['sorting'],
    ['branching'],
    ['identification'],
    ['linking'],
  ])('renders the FR copy in the %s step when the language is French', async (step) => {
    activeStep = step;
    currentLanguage = 'fr';

    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    const badges = screen.getAllByTestId('badge-text-only-degraded');
    // Only the degraded item carries the badge — `getAllByTestId` would
    // throw if none exist, so this also covers the "badge present" assert.
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(badges[0]).toHaveTextContent('Analys\u00e9 \u00e0 partir du texte');
  });
});
