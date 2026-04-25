/**
 * Task #756 — Bulk-document-import row preview-trigger coverage.
 *
 * The clickable thumbnail+filename area on each item row of the
 * bulk-document-import page (lines ~1700-1735 in
 * `client/src/pages/admin/bulk-document-import.tsx`) opens the
 * DocumentInlineViewer popup. The implementation tags the trigger
 * with `data-testid="item-preview-trigger-{id}"` and uses
 * `role="button"` + a keyboard handler to support Enter/Space
 * activation. The action buttons that sit next to it
 * (`button-toggle-exclude-{id}`, `button-retry-{step}-{id}`,
 * `button-commit-{id}`) must NOT open the preview because they
 * trigger their own destructive mutations.
 *
 * This suite mounts the real BulkDocumentImportPage with mocked
 * network responses, drives the run-step page into the `linking`
 * step (where every action button is rendered alongside the trigger),
 * and asserts:
 *
 *   1. Clicking the thumbnail+filename area opens the popup with the
 *      clicked item's filename.
 *   2. Clicking each action button (exclude / retry / commit) leaves
 *      the popup closed.
 *   3. Pressing Enter or Space on the trigger opens the popup.
 *
 * Without this coverage the click/keyboard contract added for the
 * preview popup could regress silently — there is no other automated
 * test that exercises the trigger surface on the import page.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
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

// Replace the inline viewer with a thin probe so the test can check
// "is the popup open?" without rendering the real Dialog (which pulls
// in its own queries, focus traps, and blob URL plumbing). The real
// viewer is exercised in `tests/unit/components/document-inline-viewer.test.tsx`.
jest.mock('@/components/common/DocumentInlineViewer', () => ({
  DocumentInlineViewer: ({
    isOpen,
    fileName,
  }: {
    isOpen: boolean;
    fileName?: string | null;
  }) =>
    isOpen ? (
      <div
        data-testid="mock-inline-viewer"
        data-file-name={fileName ?? ''}
      >
        Preview open: {fileName}
      </div>
    ) : null,
}));

// -----------------------------------------------------------------------------
// Imports under test (after jest.mock setup).
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Fixture state and fetch responder.
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-756';
const ITEM_A_ID = 'item-aaa';
const ITEM_B_ID = 'item-bbb';
const ITEM_A_NAME = 'lease-2024.pdf';
const ITEM_B_NAME = 'invoice-may.pdf';

interface ItemFixture {
  id: string;
  originalName: string;
  mimeType: string | null;
  status:
    | 'pending'
    | 'screening'
    | 'screened'
    | 'sorted'
    | 'branched'
    | 'identified'
    | 'linked'
    | 'committed'
    | 'rejected'
    | 'duplicate';
  preExcludeStatus: ItemFixture['status'] | null;
  linkingFallback: 'oversize' | 'unsupported_mime' | 'extraction_failed' | 'missing_file' | 'no_api_key' | null;
}

let items: ItemFixture[] = [];

function buildSessionPayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'linking' as const,
      status: 'active' as const,
      // Mark the linking auto-run as finished so the retry button can
      // surface for items that still carry a fallback reason.
      progress: {
        runAll: {
          linking: {
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
      mimeType: it.mimeType,
      status: it.status,
      preExcludeStatus: it.preExcludeStatus,
      screeningConfidence: null,
      screeningFallback: null,
      sortingConfidence: null,
      sortingFallback: null,
      branchingConfidence: null,
      branchingFallback: null,
      identificationConfidence: null,
      identificationFallback: null,
      linkingConfidence: 0.5,
      linkingFallback: it.linkingFallback,
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

  // ---- GET routes ----
  if (method === 'GET') {
    if (pathname === '/api/admin/bulk-import/buildings-lite') return jsonResponse([]);
    if (pathname === '/api/admin/bulk-import/ai-status') return jsonResponse({ available: true });
    if (pathname === '/api/organizations') return jsonResponse([]);
    if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
      return jsonResponse(buildSessionPayload());
    }
    // Sessions history list (paginated). The page only fetches it
    // when no session is selected, but be defensive.
    if (pathname === '/api/admin/bulk-import/sessions') {
      return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
    }
  }

  // ---- POST mutations triggered by buttons / auto-run effect. ----
  // We just resolve them with an empty success payload — the test
  // only cares whether the popup opens or not, not whether the
  // mutation re-renders the list.
  if (method === 'POST') {
    return jsonResponse({ ok: true });
  }

  // Anything else (PATCH, DELETE) — not reachable in this suite.
  return jsonResponse({ unmocked: true, url, method }, 404);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  // Two items: A is fully linked (commit + exclude available), B has
  // a linkingFallback reason so the retry button surfaces.
  items = [
    {
      id: ITEM_A_ID,
      originalName: ITEM_A_NAME,
      mimeType: 'application/pdf',
      status: 'linked',
      preExcludeStatus: null,
      linkingFallback: null,
    },
    {
      id: ITEM_B_ID,
      originalName: ITEM_B_NAME,
      mimeType: 'application/pdf',
      status: 'identified',
      preExcludeStatus: null,
      linkingFallback: 'extraction_failed',
    },
  ];

  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  // Resume the page directly into our test session by seeding the
  // same localStorage key the page uses on mount (`STORAGE_KEY` in
  // `bulk-document-import.tsx`).
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

async function flushAsyncEffects() {
  await act(async () => {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  });
}

async function waitForRows() {
  await screen.findByTestId(`item-preview-trigger-${ITEM_A_ID}`, undefined, {
    timeout: 4000,
  });
  await screen.findByTestId(`item-preview-trigger-${ITEM_B_ID}`);
}

function expectViewerClosed() {
  expect(screen.queryByTestId('mock-inline-viewer')).not.toBeInTheDocument();
}

function expectViewerOpenWith(fileName: string) {
  const viewer = screen.getByTestId('mock-inline-viewer');
  expect(viewer).toBeInTheDocument();
  expect(viewer).toHaveAttribute('data-file-name', fileName);
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — row preview trigger (Task #756)', () => {
  it('resumes the seeded session from localStorage and fetches its lite payload', async () => {
    // Behavioural guard: if the page renames its resume key
    // (`STORAGE_KEY` in bulk-document-import.tsx) every other test
    // here would time out on the items list with a confusing message.
    // Instead, prove the page actually issued the lite-payload fetch
    // for our seeded session id, so a key rename fails fast with a
    // clear signal.
    renderPage();
    await waitForRows();

    const fetchedLite = fetchMock.mock.calls.some(([input]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      return url.split('?')[0] === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`;
    });
    expect(fetchedLite).toBe(true);
  });

  it('opens the inline viewer when the thumbnail+filename area is clicked', async () => {
    renderPage();
    await waitForRows();

    expectViewerClosed();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`item-preview-trigger-${ITEM_A_ID}`));
    });

    expectViewerOpenWith(ITEM_A_NAME);

    // Clicking a different item's trigger should swap the popup target.
    await act(async () => {
      fireEvent.click(screen.getByTestId(`item-preview-trigger-${ITEM_B_ID}`));
    });

    expectViewerOpenWith(ITEM_B_NAME);
  });

  it('does NOT open the inline viewer when the exclude action button is clicked', async () => {
    renderPage();
    await waitForRows();
    expectViewerClosed();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-toggle-exclude-${ITEM_A_ID}`));
    });

    // Even after the optimistic update + mutation settle, the viewer
    // must stay closed because the exclude button lives in a sibling
    // container with `e.stopPropagation()` and is not inside the
    // preview-trigger element.
    await flushAsyncEffects();
    expectViewerClosed();
  });

  it('does NOT open the inline viewer when the retry action button is clicked', async () => {
    renderPage();
    await waitForRows();
    // Item B has a linkingFallback, so the retry button must render
    // alongside its preview trigger. If this assertion breaks, the
    // fixture above is out of sync with `showRetry` in the page.
    const retryButton = await screen.findByTestId(
      `button-retry-linking-${ITEM_B_ID}`,
    );
    expectViewerClosed();

    await act(async () => {
      fireEvent.click(retryButton);
    });

    await flushAsyncEffects();
    expectViewerClosed();
  });

  it('does NOT open the inline viewer when the commit action button is clicked', async () => {
    renderPage();
    await waitForRows();
    // Item A is `linked` on the `linking` step, which is the only
    // combination that surfaces the commit button.
    const commitButton = await screen.findByTestId(`button-commit-${ITEM_A_ID}`);
    expectViewerClosed();

    await act(async () => {
      fireEvent.click(commitButton);
    });

    await flushAsyncEffects();
    expectViewerClosed();
  });

  it('opens the inline viewer when the trigger is activated with the Enter key', async () => {
    renderPage();
    await waitForRows();
    expectViewerClosed();

    const trigger = screen.getByTestId(`item-preview-trigger-${ITEM_A_ID}`);
    await act(async () => {
      fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
    });

    expectViewerOpenWith(ITEM_A_NAME);
  });

  it('opens the inline viewer when the trigger is activated with the Space key', async () => {
    renderPage();
    await waitForRows();
    expectViewerClosed();

    const trigger = screen.getByTestId(`item-preview-trigger-${ITEM_B_ID}`);
    await act(async () => {
      fireEvent.keyDown(trigger, { key: ' ', code: 'Space' });
    });

    expectViewerOpenWith(ITEM_B_NAME);
  });

  it('does not open the inline viewer for unrelated keypresses on the trigger', async () => {
    renderPage();
    await waitForRows();
    expectViewerClosed();

    const trigger = screen.getByTestId(`item-preview-trigger-${ITEM_A_ID}`);
    await act(async () => {
      fireEvent.keyDown(trigger, { key: 'a', code: 'KeyA' });
      fireEvent.keyDown(trigger, { key: 'Tab', code: 'Tab' });
      fireEvent.keyDown(trigger, { key: 'ArrowDown', code: 'ArrowDown' });
    });

    expectViewerClosed();
  });

  it('exposes the trigger with role="button" and tabIndex=0 for keyboard users', async () => {
    renderPage();
    await waitForRows();
    const trigger = screen.getByTestId(`item-preview-trigger-${ITEM_A_ID}`);
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAttribute('tabindex', '0');
  });
});
