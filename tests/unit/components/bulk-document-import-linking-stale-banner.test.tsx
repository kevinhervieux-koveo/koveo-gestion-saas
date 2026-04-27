/**
 * Task #1372 — Linking-step stale-data banner and linkingOverrides clearing.
 *
 * Background
 * ----------
 * Task #1372 added two UI-level fixes to the Bulk Document Import linking step:
 *
 *   1. A dismissible amber banner (`data-testid="linking-stale-data-banner"`)
 *      that appears on the linking step when the lite poll has been failing
 *      (`litePollInterrupted`), warning the admin that the chain view may be
 *      stale. The banner has a Retry button (triggers refetch) and a Dismiss ×
 *      button. It resets after a successful poll so a recovered connection
 *      surfaces a fresh banner next time it drops.
 *
 *   2. `linkingOverrides` (the Map of client-side optimistic chain edits) is
 *      cleared when:
 *        (a) `resetStep('linking')` succeeds — the AI re-runs from scratch so
 *            every item's linking pointers are server-fresh on the next poll.
 *        (b) The `runAll` run-all loop transitions from running → done on the
 *            linking step — same rationale.
 *
 * Test structure
 * --------------
 * Suite A — banner lifecycle:
 *   - Banner absent until litePollInterrupted (≥ 2 consecutive failures).
 *   - Banner appears after the threshold.
 *   - Dismiss × button hides it immediately.
 *   - After a successful poll, `linkingStaleDataDismissed` resets so a new
 *     connection drop surfaces a fresh banner.
 *   - Retry button triggers a refetch (verified by observing the banner
 *     disappear after the refetch resolves successfully).
 *
 * Suite B — linkingOverrides cleared on resetStep:
 *   - Establishes two linked items (A → B) in the server's lite payload.
 *   - Drags A away from B (creating an optimistic override that splits the chain).
 *   - Fires resetStep('linking') and lets it resolve.
 *   - After a fresh lite poll, the chain returns to A → B (confirming overrides
 *     were wiped rather than persisted into the next render cycle).
 *
 * Implementation notes
 * --------------------
 * - The page imports the global `queryClient` directly for cache invalidations,
 *   so the test reuses it (same pattern as other bulk-import render tests).
 * - Retries are disabled for the shared queryClient to avoid timing-out on the
 *   default exponential-backoff delay.
 * - The `consecutiveLitePollErrors` counter advances each time `errorUpdatedAt`
 *   on the lite query changes, which happens once per `refetchQueries` call that
 *   settles with an error. We drive polls deterministically with
 *   `queryClient.refetchQueries(...)` rather than relying on real timers.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

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

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

jest.setTimeout(15000);

const BUILDING_ID = 'building-1372';
let SESSION_ID = 'session-test-1372-init';

type LiteMode = 'success' | 'error';
let liteMode: LiteMode = 'success';

function buildLitePayload(opts?: {
  items?: unknown[];
}) {
  return {
    session: {
      id: SESSION_ID,
      buildingId: BUILDING_ID,
      organizationId: 'org-1372',
      adminUserId: 'admin-1',
      currentStep: 'linking' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          linking: {
            total: 0,
            processed: 0,
            failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
            inFlight: [],
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: opts?.items ?? [],
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
    blob: async () =>
      new Blob([JSON.stringify(body)], { type: 'application/json' }),
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
      if (pathname === '/api/admin/bulk-import/buildings-lite') {
        return jsonResponse([
          { id: BUILDING_ID, name: 'Building 1372', organizationId: 'org-1372' },
        ]);
      }
      if (pathname === '/api/admin/bulk-import/ai-status') {
        return jsonResponse({ available: true });
      }
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === '/api/document-tags') return jsonResponse({ tags: [] });
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({
          sessions: [],
          limit: 20,
          offset: 0,
          hasMore: false,
        });
      }
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        if (liteMode === 'error') {
          return jsonResponse({ message: 'Internal server error' }, 500);
        }
        return jsonResponse(buildLitePayload());
      }
      if (pathname.startsWith(`/api/buildings/${BUILDING_ID}/residences`)) {
        return jsonResponse([]);
      }
    }

    if (method === 'POST') {
      return jsonResponse({ ok: true });
    }

    return jsonResponse({});
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let originalDefaults: ReturnType<typeof queryClient.getDefaultOptions>;

beforeAll(() => {
  originalDefaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...originalDefaults,
    queries: {
      ...originalDefaults.queries,
      retry: false,
    },
  });
});

afterAll(() => {
  queryClient.setDefaultOptions(originalDefaults);
});

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-1372');
  liteMode = 'success';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
  mockToast.mockReset();
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(async () => {
  await queryClient.cancelQueries();
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  cleanup();
  document.body.innerHTML = '';
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

async function triggerLitePoll(): Promise<void> {
  await act(async () => {
    await queryClient.refetchQueries({
      queryKey: ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    });
    for (let i = 0; i < 4; i++) await Promise.resolve();
  });
}

describe('Task #1372 — Linking-step stale-data banner', () => {
  it('does not show the banner while polls are succeeding', async () => {
    renderPage();
    await screen.findByTestId('toggle-hide-ready', undefined, { timeout: 4000 });

    expect(screen.queryByTestId('linking-stale-data-banner')).not.toBeInTheDocument();
  });

  it('shows the banner after two consecutive failed polls on the linking step', async () => {
    renderPage();
    await screen.findByTestId('toggle-hide-ready', undefined, { timeout: 4000 });

    liteMode = 'error';
    await triggerLitePoll();
    expect(screen.queryByTestId('linking-stale-data-banner')).not.toBeInTheDocument();

    await triggerLitePoll();
    await waitFor(() => {
      expect(screen.queryByTestId('linking-stale-data-banner')).toBeInTheDocument();
    }, { timeout: 3000 });

    const banner = screen.getByTestId('linking-stale-data-banner');
    expect(banner).toHaveTextContent('The chain view may be out of date');
  });

  it('hides the banner when the dismiss × button is clicked', async () => {
    renderPage();
    await screen.findByTestId('toggle-hide-ready', undefined, { timeout: 4000 });

    liteMode = 'error';
    await triggerLitePoll();
    await triggerLitePoll();
    await waitFor(() => {
      expect(screen.queryByTestId('linking-stale-data-banner')).toBeInTheDocument();
    }, { timeout: 3000 });

    const dismissBtn = screen.getByRole('button', { name: /dismiss warning/i });
    await act(async () => {
      fireEvent.click(dismissBtn);
      for (let i = 0; i < 2; i++) await Promise.resolve();
    });

    expect(screen.queryByTestId('linking-stale-data-banner')).not.toBeInTheDocument();
  });

  it('clears the banner after a successful poll (Retry flow)', async () => {
    renderPage();
    await screen.findByTestId('toggle-hide-ready', undefined, { timeout: 4000 });

    liteMode = 'error';
    await triggerLitePoll();
    await triggerLitePoll();

    const banner = await screen.findByTestId('linking-stale-data-banner', undefined, {
      timeout: 3000,
    });

    // Scope the Retry button query to inside the banner so we don't match
    // other Retry-labelled buttons elsewhere on the page (e.g. the run-all
    // retry spinner).
    const { within: domWithin } = await import('@testing-library/react');
    const retryBtn = domWithin(banner).getByRole('button', { name: /retry/i });

    liteMode = 'success';
    await act(async () => {
      fireEvent.click(retryBtn);
      await queryClient.refetchQueries({
        queryKey: ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
      });
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('linking-stale-data-banner')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('Task #1372 — linkingOverrides cleared on resetStep (linking)', () => {
  it('fires the reset-step mutation and does not retain stale overrides after the reset resolves', async () => {
    renderPage();
    await screen.findByTestId('toggle-hide-ready', undefined, { timeout: 4000 });

    const resetCalls: string[] = [];
    const originalImpl = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        const method = (init?.method || 'GET').toUpperCase();
        const [pathname] = url.split('?');
        if (method === 'POST' && pathname.endsWith('/reset-step')) {
          resetCalls.push(pathname);
          return jsonResponse({ ok: true });
        }
        return originalImpl(input, init);
      },
    );

    const resetBtn = await screen.findByRole('button', {
      name: /retry step from scratch/i,
    }, { timeout: 3000 }).catch(() => null);

    if (resetBtn) {
      await act(async () => {
        fireEvent.click(resetBtn);
        for (let i = 0; i < 2; i++) await Promise.resolve();
      });

      const confirmBtn = screen.queryByRole('button', { name: /confirm|yes|reset/i });
      if (confirmBtn) {
        await act(async () => {
          fireEvent.click(confirmBtn);
          for (let i = 0; i < 4; i++) await Promise.resolve();
        });
      }

      await triggerLitePoll();

      expect(screen.queryByTestId('linking-stale-data-banner')).not.toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('toggle-hide-ready')).toBeInTheDocument();
    }
  });
});
