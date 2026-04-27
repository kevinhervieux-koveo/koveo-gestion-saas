/**
 * Task #801 — Component coverage for the per-row "Review or exclude this file"
 * advisory hint in the bulk-document-import page.
 *
 * The hint (`hint-review-or-exclude-{id}`) is rendered in two JSX blocks
 * inside `client/src/pages/admin/bulk-document-import.tsx` — one inside the
 * branching-section row path and one inside the non-branching-section row
 * path. Both are gated by `decision?.fallbackReason` being truthy.
 *
 * Without a component test, a future refactor that removes one of those two
 * hint blocks (or inverts the condition) would ship silently. This suite:
 *
 *   1. Asserts the hint IS present for an item whose `screeningFallback` is
 *      `'api_error'` (EN and FR copies verified separately).
 *   2. Asserts the hint is ABSENT for an item whose `screeningFallback` is
 *      null (AI ran successfully).
 *
 * Render scaffolding mirrors the pattern used by Task #785's
 * `bulk-document-import-screening-rotation-badge.test.tsx`.
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

const SESSION_ID = 'session-test-801';
const ITEM_WITH_FALLBACK_ID = 'item-fallback-aaa';
const ITEM_NO_FALLBACK_ID = 'item-ok-bbb';

interface ItemFixture {
  id: string;
  originalName: string;
  screeningFallback: string | null;
}

let items: ItemFixture[] = [];

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'screening' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          screening: {
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
      status: 'screened' as const,
      preExcludeStatus: null,
      screeningConfidence: 0.2,
      screeningFallback: it.screeningFallback,
      screeningTypeGuess: null,
      screeningBucketGuess: null,
      screeningQaReason: 'AI did not analyze this file.',
      screeningRotationDegrees: 0,
      screeningRotationApplied: false,
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

  if (method !== 'GET') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ unmocked: true, url, method }, 404);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  items = [
    { id: ITEM_WITH_FALLBACK_ID, originalName: 'api-error.pdf', screeningFallback: 'api_error' },
    { id: ITEM_NO_FALLBACK_ID, originalName: 'ok-doc.pdf', screeningFallback: null },
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
  await screen.findByTestId(`item-preview-trigger-${ITEM_WITH_FALLBACK_ID}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`item-preview-trigger-${ITEM_NO_FALLBACK_ID}`);
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

describe('BulkDocumentImportPage — "Review or exclude" fallback hint (Task #801)', () => {
  it('shows the EN hint for an item with screeningFallback set to api_error', async () => {
    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    const hint = screen.getByTestId(`hint-review-or-exclude-${ITEM_WITH_FALLBACK_ID}`);
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent('Review or exclude this file');
  });

  it('hides the hint for an item with screeningFallback null (AI ran successfully)', async () => {
    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    expect(
      screen.queryByTestId(`hint-review-or-exclude-${ITEM_NO_FALLBACK_ID}`),
    ).not.toBeInTheDocument();
  });

  it('shows the FR hint when the language is French', async () => {
    currentLanguage = 'fr';

    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    const hint = screen.getByTestId(`hint-review-or-exclude-${ITEM_WITH_FALLBACK_ID}`);
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent('V\u00e9rifiez ce fichier ou excluez-le');
  });
});
