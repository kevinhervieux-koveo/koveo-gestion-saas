/**
 * Task #1320 — UI test for the AI residence confidence chip.
 *
 * When an item has an AI-suggested residence (residenceAiSuggested: true)
 * and a residenceConfidence value, the row must render:
 *   - The violet "AI" badge (data-testid `badge-residence-ai-{id}`)
 *   - A colour-coded confidence chip (data-testid `badge-residence-confidence-{id}`)
 *     whose visible text is "High", "Medium", or "Low" according to the
 *     bandForConfidence thresholds (≥0.80 → High, ≥0.50 → Medium, <0.50 → Low).
 *
 * When residenceConfidence is null the confidence chip must be absent.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
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

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function () {};
}

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-chip-1320';
const BUILDING_ID = 'building-chip-1';

function buildAiItem(overrides: {
  id: string;
  residenceConfidence: number | null;
  residenceAiSuggested?: boolean;
}) {
  return {
    id: overrides.id,
    originalName: `${overrides.id}.pdf`,
    mimeType: 'application/pdf',
    status: 'branched',
    preExcludeStatus: null,
    excludeSource: null,
    branch: 'residence_documents',
    subCategory: 'lease',
    branchManualOverride: false,
    branchReason: 'looks like a lease',
    residenceId: 'res-ai-1',
    residenceConfidence: overrides.residenceConfidence,
    residenceReason: 'matched unit number in filename',
    residenceFallbackReason: null,
    residenceManualOverride: false,
    residenceAiSuggestedId: 'res-ai-1',
    residenceAiSuggested: overrides.residenceAiSuggested ?? true,
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
    identificationConfidence: null,
    identificationFallback: null,
    linkingConfidence: null,
    linkingFallback: null,
  };
}

function buildPayload(items: ReturnType<typeof buildAiItem>[]) {
  return {
    session: {
      id: SESSION_ID,
      buildingId: BUILDING_ID,
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'branching',
      status: 'active',
      progress: {
        runAll: {
          screening: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00Z', finishedAt: '2024-01-01T00:01:00Z' },
          sorting: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00Z', finishedAt: '2024-01-01T00:01:00Z' },
          branching: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00Z', finishedAt: '2024-01-01T00:01:00Z' },
        },
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
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

function makeFetchMock(items: ReturnType<typeof buildAiItem>[]) {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input
        : input instanceof URL ? input.toString()
          : (input as Request).url;
    const method = ((init?.method) ?? 'GET').toUpperCase();
    const [pathname] = url.split('?');

    if (method === 'GET') {
      if (pathname === '/api/admin/bulk-import/buildings-lite') return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status') return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(buildPayload(items));
      }
      if (pathname === `/api/buildings/${BUILDING_ID}/residences`) {
        return jsonResponse([{ id: 'res-ai-1', unitNumber: '101' }]);
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      }
    }
    return jsonResponse({ unmocked: true, url, method }, 404);
  }) as unknown as jest.MockedFunction<typeof fetch>;
}

let originalFetch: typeof fetch | undefined;

function setupTest(items: ReturnType<typeof buildAiItem>[]) {
  global.fetch = makeFetchMock(items);
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    buildPayload(items),
  );
  queryClient.setQueryData(
    ['/api/buildings', BUILDING_ID, 'residences'],
    [{ id: 'res-ai-1', unitNumber: '101' }],
  );
}

beforeEach(() => {
  originalFetch = global.fetch;
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
  queryClient.clear();
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  queryClient.clear();
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AI residence confidence chip — rendering (Task #1320)', () => {
  it('shows "High" chip for confidence >= 0.80', async () => {
    const item = buildAiItem({ id: 'it-high', residenceConfidence: 0.88 });
    setupTest([item]);
    renderPage();

    const chip = await screen.findByTestId('badge-residence-confidence-it-high', undefined, { timeout: 4000 });
    expect(chip).toHaveTextContent('High');
  });

  it('shows "Medium" chip for confidence in [0.50, 0.80)', async () => {
    const item = buildAiItem({ id: 'it-med', residenceConfidence: 0.65 });
    setupTest([item]);
    renderPage();

    const chip = await screen.findByTestId('badge-residence-confidence-it-med', undefined, { timeout: 4000 });
    expect(chip).toHaveTextContent('Medium');
  });

  it('shows "Low" chip for confidence < 0.50', async () => {
    const item = buildAiItem({ id: 'it-low', residenceConfidence: 0.3 });
    setupTest([item]);
    renderPage();

    const chip = await screen.findByTestId('badge-residence-confidence-it-low', undefined, { timeout: 4000 });
    expect(chip).toHaveTextContent('Low');
  });

  it('does not render the confidence chip when residenceConfidence is null', async () => {
    const item = buildAiItem({ id: 'it-null', residenceConfidence: null });
    setupTest([item]);
    renderPage();

    await screen.findByTestId('badge-residence-ai-it-null', undefined, { timeout: 4000 });
    await waitFor(() => {
      expect(screen.queryByTestId('badge-residence-confidence-it-null')).toBeNull();
    });
  });

  it('does not render the confidence chip when residenceAiSuggested is false', async () => {
    const item = buildAiItem({ id: 'it-confirmed', residenceConfidence: 0.9, residenceAiSuggested: false });
    setupTest([item]);
    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('badge-residence-ai-it-confirmed')).toBeNull();
      expect(screen.queryByTestId('badge-residence-confidence-it-confirmed')).toBeNull();
    }, { timeout: 4000 });
  });

  it('still renders the AI badge (Sparkles) alongside the confidence chip', async () => {
    const item = buildAiItem({ id: 'it-both', residenceConfidence: 0.92 });
    setupTest([item]);
    renderPage();

    await screen.findByTestId('badge-residence-ai-it-both', undefined, { timeout: 4000 });
    await screen.findByTestId('badge-residence-confidence-it-both', undefined, { timeout: 4000 });
  });
});
