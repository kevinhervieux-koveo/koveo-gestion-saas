/**
 * Task #1223 — Sessions-list "Anthropic looks degraded" surfaces.
 *
 * Background
 * ----------
 * Task #1219 added two warning surfaces to the bulk-import sessions
 * list (rendered by `HistoryCard` inside
 * `client/src/pages/admin/bulk-document-import.tsx` whenever no active
 * `sessionId` is selected):
 *
 *   1. An aggregated yellow banner above the list
 *      (`data-testid="history-ai-degraded-banner"`) that counts the
 *      sessions whose `aiFailureSummary.aiDegraded` flag is true and
 *      tells admins to open them.
 *   2. A per-row indicator
 *      (`data-testid="history-ai-degraded-${session.id}"`) that
 *      renders only on degraded rows and, when clicked, calls
 *      `onResume(session.id)` so the wizard opens at the failing step.
 *
 * The wizard's in-page banner from Task #1209 already has dedicated
 * coverage in `bulk-document-import-ai-failure-retry.test.tsx`, but the
 * sessions-list surfaces were verified manually only. A regression in
 * either the API payload (`aiFailureSummary`) or in the
 * `HistoryCard`/`HistorySessionRow` rendering would silently hide the
 * warning admins now rely on to triage Anthropic outages.
 *
 * Coverage
 * --------
 * The fixture below mocks `/api/admin/bulk-import/sessions` to return
 * three sessions:
 *   - degraded session #1: aiFailureSummary.aiDegraded = true (sorting)
 *   - degraded session #2: aiFailureSummary.aiDegraded = true (screening)
 *   - healthy session:     aiFailureSummary.aiDegraded = false
 *
 * Together those exercise both the singular and plural copy of the
 * aggregated banner (we re-render the page with a one-degraded fixture
 * to hit the singular path) and the presence/absence of the per-row
 * indicator. A click on the indicator must trigger `onResume`, which
 * the page wires to `setSessionId(id)` — we observe the side effect by
 * checking that the cached active session id lands in `localStorage`
 * (the page's `useEffect` writes `bulkImportActiveSessionId` whenever
 * `sessionId` flips to a string) and that the history list unmounts.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
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

// -----------------------------------------------------------------------------
// Module mocks (must be declared before importing the page under test).
// -----------------------------------------------------------------------------

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

let mockLanguage: 'en' | 'fr' = 'en';
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: mockLanguage,
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
import { resetSharedQueryClient } from '../../helpers/queryClientIsolation';

// -----------------------------------------------------------------------------
// Fixture state
// -----------------------------------------------------------------------------

const DEGRADED_SORTING_ID = 'session-1223-degraded-sorting';
const DEGRADED_SCREENING_ID = 'session-1223-degraded-screening';
const HEALTHY_ID = 'session-1223-healthy';
const BUILDING_ID = 'building-1223';

type SessionRow = {
  id: string;
  buildingId: string;
  organizationId: string;
  adminUserId: string;
  currentStep:
    | 'upload'
    | 'screening'
    | 'sorting'
    | 'branching'
    | 'identification'
    | 'linking'
    | 'complete';
  status: 'active' | 'paused' | 'completed' | 'cleared';
  progress: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  aiFailureSummary: {
    step: SessionRow['currentStep'] | null;
    aiTotalCount: number;
    aiFailedCount: number;
    aiDegraded: boolean;
  };
};

function buildDegradedSortingSession(): SessionRow {
  return {
    id: DEGRADED_SORTING_ID,
    buildingId: BUILDING_ID,
    organizationId: 'org-1',
    adminUserId: 'admin-1',
    currentStep: 'sorting',
    status: 'active',
    progress: {},
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
    aiFailureSummary: {
      step: 'sorting',
      aiTotalCount: 4,
      aiFailedCount: 3,
      aiDegraded: true,
    },
  };
}

function buildDegradedScreeningSession(): SessionRow {
  return {
    id: DEGRADED_SCREENING_ID,
    buildingId: BUILDING_ID,
    organizationId: 'org-1',
    adminUserId: 'admin-1',
    currentStep: 'screening',
    status: 'paused',
    progress: {},
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    aiFailureSummary: {
      step: 'screening',
      aiTotalCount: 5,
      aiFailedCount: 2,
      aiDegraded: true,
    },
  };
}

function buildHealthySession(): SessionRow {
  return {
    id: HEALTHY_ID,
    buildingId: BUILDING_ID,
    organizationId: 'org-1',
    adminUserId: 'admin-1',
    currentStep: 'identification',
    status: 'active',
    progress: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    aiFailureSummary: {
      step: 'identification',
      aiTotalCount: 6,
      aiFailedCount: 0,
      aiDegraded: false,
    },
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

let sessionsResponse: { sessions: SessionRow[]; limit: number; offset: number; hasMore: boolean } = {
  sessions: [],
  limit: 20,
  offset: 0,
  hasMore: false,
};

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
    if (pathname === '/api/admin/bulk-import/buildings-lite') {
      return jsonResponse([
        {
          id: BUILDING_ID,
          name: 'Test Building 1223',
          organizationId: 'org-1',
        },
      ]);
    }
    if (pathname === '/api/admin/bulk-import/ai-status') {
      return jsonResponse({ available: true });
    }
    if (pathname === '/api/organizations') return jsonResponse([]);
    if (pathname === '/api/admin/bulk-import/sessions') {
      return jsonResponse(sessionsResponse);
    }
    // The page lazy-fetches a session payload after `setSessionId` is
    // called (post-click on the Anthropic indicator). Return an empty
    // payload so the wizard transition completes without errors.
    if (pathname.startsWith('/api/admin/bulk-import/sessions/') && pathname.endsWith('/lite')) {
      return jsonResponse({
        session: {
          ...buildDegradedSortingSession(),
          aiFailureSummary: undefined,
        },
        items: [],
      });
    }
    if (pathname.startsWith('/api/admin/bulk-import/sessions/')) {
      return jsonResponse({
        session: { ...buildDegradedSortingSession(), aiFailureSummary: undefined },
        items: [],
      });
    }
  }
  if (method === 'POST') {
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ unmocked: true, url, method }, 404);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  await resetSharedQueryClient();
  mockLanguage = 'en';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
  // Default fixture: one healthy + two degraded sessions so the
  // aggregated banner renders the plural copy and the per-row
  // assertions have both states to compare.
  sessionsResponse = {
    sessions: [
      buildDegradedSortingSession(),
      buildDegradedScreeningSession(),
      buildHealthySession(),
    ],
    limit: 20,
    offset: 0,
    hasMore: false,
  };
  // Critical: do NOT seed `bulkImportActiveSessionId` so the page
  // lands on the start view that renders `HistoryCard`.
  window.localStorage.clear();
});

afterEach(async () => {
  await act(async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
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

describe('BulkDocumentImportPage — Task #1223 sessions-list Anthropic warning', () => {
  it('renders the aggregated plural banner and per-row indicators only on degraded rows (English)', async () => {
    renderPage();

    // Wait for the history list to land — anchors the assertions so a
    // missing testid fails loudly instead of timing out on a banner
    // that simply hadn't rendered yet.
    await screen.findByTestId('history-list', undefined, { timeout: 4000 });

    const banner = await screen.findByTestId('history-ai-degraded-banner');
    expect(banner).toBeInTheDocument();
    const message = screen.getByTestId('history-ai-degraded-banner-message');
    expect(message).toHaveTextContent(
      '2 sessions have a high Anthropic failure rate — open them to retry AI-failed items.',
    );

    // Per-row indicator renders for each degraded session, with the
    // failed/total count baked into the visible label so a regression
    // in the count math fails this assertion too.
    const sortingIndicator = screen.getByTestId(
      `history-ai-degraded-${DEGRADED_SORTING_ID}`,
    );
    expect(sortingIndicator).toHaveTextContent('Anthropic degraded (3/4)');

    const screeningIndicator = screen.getByTestId(
      `history-ai-degraded-${DEGRADED_SCREENING_ID}`,
    );
    expect(screeningIndicator).toHaveTextContent('Anthropic degraded (2/5)');

    // The healthy session must NOT render the indicator. We anchor
    // the absence on the row testid so we know the row itself did
    // render before asserting the indicator is absent.
    expect(
      screen.getByTestId(`history-row-${HEALTHY_ID}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`history-ai-degraded-${HEALTHY_ID}`),
    ).not.toBeInTheDocument();
  });

  it('renders the singular banner copy when exactly one session is degraded', async () => {
    sessionsResponse = {
      sessions: [buildDegradedSortingSession(), buildHealthySession()],
      limit: 20,
      offset: 0,
      hasMore: false,
    };

    renderPage();

    await screen.findByTestId('history-list', undefined, { timeout: 4000 });
    const message = await screen.findByTestId(
      'history-ai-degraded-banner-message',
    );
    expect(message).toHaveTextContent(
      '1 session has a high Anthropic failure rate — open it to retry AI-failed items.',
    );
  });

  it('renders the French copy for the aggregated banner (plural and singular)', async () => {
    mockLanguage = 'fr';

    // Plural French copy with the default two-degraded fixture.
    renderPage();
    await screen.findByTestId('history-list', undefined, { timeout: 4000 });
    const pluralMessage = await screen.findByTestId(
      'history-ai-degraded-banner-message',
    );
    expect(pluralMessage).toHaveTextContent(
      "2 sessions ont un taux d'échec Anthropic élevé — ouvrez-les pour réessayer les fichiers en échec IA.",
    );
    // The per-row indicator copy also flips to French so check it
    // here while the page is still mounted in fr.
    expect(
      screen.getByTestId(`history-ai-degraded-${DEGRADED_SORTING_ID}`),
    ).toHaveTextContent('Anthropic dégradé (3/4)');

    cleanup();
    queryClient.clear();

    // Singular French copy with a one-degraded fixture.
    sessionsResponse = {
      sessions: [buildDegradedSortingSession(), buildHealthySession()],
      limit: 20,
      offset: 0,
      hasMore: false,
    };
    renderPage();
    await screen.findByTestId('history-list', undefined, { timeout: 4000 });
    const singularMessage = await screen.findByTestId(
      'history-ai-degraded-banner-message',
    );
    expect(singularMessage).toHaveTextContent(
      "1 session a un taux d'échec Anthropic élevé — ouvrez-la pour réessayer les fichiers en échec IA.",
    );
  });

  it('does NOT render the aggregated banner when no session is degraded', async () => {
    sessionsResponse = {
      sessions: [buildHealthySession()],
      limit: 20,
      offset: 0,
      hasMore: false,
    };

    renderPage();
    // Anchor on the healthy row so we know the list rendered before
    // asserting the banner's absence.
    await screen.findByTestId(`history-row-${HEALTHY_ID}`, undefined, {
      timeout: 4000,
    });
    expect(
      screen.queryByTestId('history-ai-degraded-banner'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`history-ai-degraded-${HEALTHY_ID}`),
    ).not.toBeInTheDocument();
  });

  it('opens the session at its current step when the per-row indicator is clicked (onResume)', async () => {
    renderPage();
    await screen.findByTestId('history-list', undefined, { timeout: 4000 });

    const indicator = screen.getByTestId(
      `history-ai-degraded-${DEGRADED_SORTING_ID}`,
    );
    expect(indicator).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(indicator);
    });

    // `onResume(id)` calls `setSessionId(id)` inside the page; the
    // page's `useEffect` then writes the id to localStorage under
    // `bulkImportActiveSessionId`. Observing that side effect proves
    // the handler ran without needing to inject a spy into the
    // page component.
    await waitFor(
      () => {
        expect(window.localStorage.getItem('bulkImportActiveSessionId')).toBe(
          DEGRADED_SORTING_ID,
        );
      },
      { timeout: 4000 },
    );

    // The history list (rendered only when `!sessionId`) must
    // unmount once the wizard takes over, so the same indicator id
    // is no longer in the DOM.
    await waitFor(() => {
      expect(screen.queryByTestId('history-list')).not.toBeInTheDocument();
    });
  });
});
