/**
 * Task #785 — Client coverage for the Screening "Rotated Xdeg" badge
 * introduced by Task #772.
 *
 * The badge lives inside the screening row of the bulk-document-import
 * page (around lines 1984-2002 of
 * `client/src/pages/admin/bulk-document-import.tsx`) and is gated by:
 *
 *     currentStep === 'screening' &&
 *     item.screeningRotationApplied &&
 *     item.screeningRotationDegrees !== 0
 *
 * If any of those three conditions regresses (e.g. a refactor that
 * forgets the `screeningRotationApplied` guard) admins lose the
 * "Rotated Xdeg" pill that tells them the staged file was rewritten in
 * place. This suite mounts the real page with a mocked /lite payload
 * and asserts:
 *
 *   1. The badge renders (with the expected EN copy and tooltip) when
 *      `screeningRotationApplied: true` and `screeningRotationDegrees: 90`.
 *   2. The badge stays hidden when `screeningRotationApplied: false`,
 *      even if `screeningRotationDegrees` is non-zero (the "AI thought
 *      it was sideways but the rewrite failed / unsupported MIME"
 *      branch from Task #772).
 *   3. The FR copy is rendered when the language hook reports French.
 *
 * The render scaffolding mirrors
 * `tests/unit/components/bulk-document-import-preview-trigger.test.tsx`
 * so future page-level changes only have to be re-mocked once.
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

const SESSION_ID = 'session-test-785';
const ITEM_ROTATED_ID = 'item-rotated-aaa';
const ITEM_SKIPPED_ID = 'item-skipped-bbb';
const ITEM_ROTATED_NAME = 'sideways-scan.pdf';
const ITEM_SKIPPED_NAME = 'unsupported-format.txt';

interface ItemFixture {
  id: string;
  originalName: string;
  screeningRotationApplied: boolean;
  screeningRotationDegrees: 0 | 90 | 180 | 270;
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
      screeningConfidence: 0.8,
      screeningFallback: null,
      screeningTypeGuess: null,
      screeningBucketGuess: null,
      screeningQaReason: null,
      screeningRotationDegrees: it.screeningRotationDegrees,
      screeningRotationApplied: it.screeningRotationApplied,
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

  // POST/PATCH/DELETE: harmless success — the badge tests don't drive
  // any mutations, but the page may auto-trigger run-all on mount.
  if (method !== 'GET') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ unmocked: true, url, method }, 404);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  items = [
    {
      id: ITEM_ROTATED_ID,
      originalName: ITEM_ROTATED_NAME,
      screeningRotationApplied: true,
      screeningRotationDegrees: 90,
    },
    {
      id: ITEM_SKIPPED_ID,
      originalName: ITEM_SKIPPED_NAME,
      // The "AI suggested rotation but the rewrite was skipped" branch:
      // degrees are non-zero but applied is false, so the badge MUST
      // stay hidden per the Task #772 contract.
      screeningRotationApplied: false,
      screeningRotationDegrees: 270,
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
  await screen.findByTestId(`item-preview-trigger-${ITEM_ROTATED_ID}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`item-preview-trigger-${ITEM_SKIPPED_ID}`);
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

describe('BulkDocumentImportPage — screening rotation badge (Task #785)', () => {
  it('renders the EN "Rotated 90°" badge when screeningRotationApplied is true', async () => {
    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    const badge = screen.getByTestId(`screening-rotation-${ITEM_ROTATED_ID}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Rotated 90°');
    // The tooltip text mirrors the Task #772 copy and is what tells
    // admins the file was actually rewritten in place — guard it here
    // so a translation tweak doesn't silently break the explanation.
    expect(badge).toHaveAttribute(
      'title',
      "The file was sideways. It was corrected in place by rotating 90° clockwise so later steps read it upright.",
    );
  });

  it('hides the badge when screeningRotationApplied is false (rewrite skipped / unsupported MIME)', async () => {
    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    // Sanity: the row itself is rendered (so a missing badge isn't a
    // false positive caused by the row never mounting).
    expect(
      screen.getByTestId(`item-preview-trigger-${ITEM_SKIPPED_ID}`),
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId(`screening-rotation-${ITEM_SKIPPED_ID}`),
    ).not.toBeInTheDocument();
  });

  it('renders the FR "Pivoté 90°" badge and FR tooltip when the language is French', async () => {
    currentLanguage = 'fr';

    renderPage();
    await waitForRows();
    await flushAsyncEffects();

    const badge = screen.getByTestId(`screening-rotation-${ITEM_ROTATED_ID}`);
    expect(badge).toHaveTextContent('Pivoté 90°');
    expect(badge).toHaveAttribute(
      'title',
      "Le fichier était orienté de côté. Il a été corrigé sur place de 90° dans le sens horaire pour que les étapes suivantes le lisent à l'endroit.",
    );
  });
});
