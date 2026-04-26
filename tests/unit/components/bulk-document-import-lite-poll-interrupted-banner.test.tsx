/**
 * Task #1248 — Linking step "poll paused" banner regression coverage.
 *
 * Background
 * ----------
 * Task #1234 added an inline amber banner
 * (`data-testid="lite-poll-interrupted-banner"`) on the Linking step
 * card so admins notice when `/api/admin/bulk-import/sessions/:id/lite`
 * keeps failing. Without this warning the run-all counter freezes
 * silently because TanStack Query keeps the previous payload around on
 * a refetch failure, and a stalled connection looks indistinguishable
 * from a stalled job.
 *
 * The behaviour was previously verified by hand only. A regression in
 * any of the moving parts could turn the warning back off:
 *
 *   - dropping the `errorUpdatedAt` / `dataUpdatedAt` destructure off
 *     the `useQuery({ queryKey: [...sessions, id, 'lite'] })` call,
 *   - missing the reset of `consecutiveLitePollErrors` on a successful
 *     poll,
 *   - changing the gate from `currentStep === 'linking'` to a stricter
 *     condition that hides the banner during an actual outage,
 *   - or future refactors that move the counter into a custom hook
 *     and forget to wire either timestamp through.
 *
 * This test renders the Bulk Document Import page on the Linking step
 * with a controllable `/lite` mock and asserts:
 *
 *   1. After two consecutive errored polls, the
 *      `lite-poll-interrupted-banner` testid appears (threshold reached).
 *   2. After the next successful poll, the banner disappears (counter
 *      reset on a settled success).
 *
 * Implementation notes
 * --------------------
 * - The page imports the global `queryClient` directly for cache
 *   invalidations, so the test reuses it (same pattern as
 *   `bulk-document-import-history-ai-degraded.test.tsx`). To avoid
 *   waiting on the default exponential-backoff retries when forcing
 *   an errored poll, retries are temporarily disabled via
 *   `queryClient.setDefaultOptions({ queries: { retry: false } })`
 *   and the original defaults are restored in `afterAll`.
 * - The page's `useQuery` for `/lite` polls on a 5s `refetchInterval`
 *   in production. Driving real timers in a unit test would be slow
 *   and flaky, so we instead trigger each "poll" deterministically
 *   with `queryClient.refetchQueries(...)` — the `errorUpdatedAt` /
 *   `dataUpdatedAt` timestamps the production code watches advance on
 *   every settled refetch exactly the same way they do under the real
 *   interval.
 */

import { describe, it, expect, jest, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
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

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

// -----------------------------------------------------------------------------
// Fixture state
// -----------------------------------------------------------------------------

let SESSION_ID = 'session-test-1248-init';
const BUILDING_ID = 'building-1248';

type LiteMode = 'success' | 'error';
let liteMode: LiteMode = 'success';

function buildLitePayload() {
  return {
    session: {
      id: SESSION_ID,
      buildingId: BUILDING_ID,
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      // Anchor the wizard on the linking step — the banner is gated
      // on `currentStep === 'linking'`.
      currentStep: 'linking' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          // Mark the run-all loop as finished so the auto-run effect
          // doesn't try to drive any side-effects during the test.
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
    items: [],
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
          {
            id: BUILDING_ID,
            name: 'Building 1248',
            organizationId: 'org-1',
          },
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
          // JSON 500 — mirrors the production failure mode the banner
          // was added for (Task #1231 / Task #1234). The shared query
          // function will throw, which advances `errorUpdatedAt`.
          return jsonResponse(
            { message: 'Internal server error' },
            500,
          );
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

    // Any other endpoint hit unexpectedly: respond with a benign 200
    // empty body so an unrelated call can't hijack the lite-poll
    // error counter we are asserting on.
    return jsonResponse({});
  },
) as unknown as jest.MockedFunction<typeof fetch>;

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

let originalFetch: typeof fetch | undefined;
let originalDefaults: ReturnType<typeof queryClient.getDefaultOptions>;

beforeAll(() => {
  // Disable retries on the shared queryClient for this suite only —
  // the production retry policy waits ~3s between attempts which
  // would blow past the 3s default Jest test timeout. Errors still
  // settle exactly once per `refetchQueries` call, which is what the
  // production banner counter watches via `errorUpdatedAt`.
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
  SESSION_ID = nextSessionId('session-test-1248');
  liteMode = 'success';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
  // Seed the active session id so the page lands directly on the
  // wizard view (not the history list) and the lite useQuery enables.
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
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

async function refetchLite(): Promise<void> {
  // Drives one settled poll cycle. `act` flushes the React state
  // updates from the page's `errorUpdatedAt` / `dataUpdatedAt`
  // useEffects so the next assertion sees the new banner state.
  await act(async () => {
    await queryClient.refetchQueries({
      queryKey: ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    });
    // Yield once more so the post-settle setState in the
    // `consecutiveLitePollErrors` effect has a chance to run.
    for (let i = 0; i < 4; i++) await Promise.resolve();
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('BulkDocumentImportPage — Task #1248 lite poll interrupted banner', () => {
  it('shows the banner after two consecutive errored polls and clears it after a successful poll', async () => {
    renderPage();

    // Anchor: the wizard's items table renders only when
    // `currentStep` is neither 'upload' nor 'complete'. Waiting for
    // its `toggle-hide-ready` button proves the first lite poll
    // succeeded and the page is now on the linking step where the
    // banner gate lives.
    await screen.findByTestId('toggle-hide-ready', undefined, {
      timeout: 4000,
    });

    // Pre-condition: with zero errored polls the banner must be
    // absent. This guards against a regression that flips the gate
    // to `true` by default (e.g. initialising the counter past the
    // threshold).
    expect(
      screen.queryByTestId('lite-poll-interrupted-banner'),
    ).not.toBeInTheDocument();

    // First errored poll — counter ticks to 1, still below the
    // threshold of 2, so the banner must NOT appear yet. This
    // pins the threshold so a future change from "2 in a row" to
    // "1 is enough" or "5 is enough" trips this assertion.
    liteMode = 'error';
    await refetchLite();
    expect(
      screen.queryByTestId('lite-poll-interrupted-banner'),
    ).not.toBeInTheDocument();

    // Second errored poll — counter ticks to 2, threshold reached,
    // banner must now render with the English copy from Task #1234.
    await refetchLite();
    const banner = await screen.findByTestId(
      'lite-poll-interrupted-banner',
      undefined,
      { timeout: 4000 },
    );
    expect(banner).toHaveTextContent('Status updates paused — retrying…');

    // Flip back to a successful payload — the next settled poll
    // must reset `consecutiveLitePollErrors` to 0 and the banner
    // must disappear. This is the half of the behaviour most
    // likely to silently regress (a missed reset on success was
    // explicitly called out in the task brief).
    liteMode = 'success';
    await refetchLite();
    await waitFor(() => {
      expect(
        screen.queryByTestId('lite-poll-interrupted-banner'),
      ).not.toBeInTheDocument();
    });
  });
});
