/**
 * Task #1534 — Linking-step empty-result explanatory banner (frontend tests).
 *
 * When the linking run-all finishes and zero items end up with a
 * `linkingFamilyId`, the wizard shows a dismissible blue info banner
 * (`data-testid="linking-empty-result-banner"`) that explains which gate
 * filtered all candidates out.
 *
 * Test structure
 * --------------
 * Suite A — banner visibility:
 *   - Banner appears after linking run-all finishes with zero linked items.
 *   - Banner absent when at least one item has a `linkingFamilyId`.
 *   - Banner dismissed when the × button is clicked.
 *
 * Suite B — reason variants (data-reason attribute):
 *   - `no-families`    when `candidateSummary.familyCount === 0`.
 *   - `low-confidence` when `maxInScopeCount > 0` (in-scope candidates exist).
 *
 * Implementation notes
 * --------------------
 * - Follows the same render/mock pattern as
 *   `bulk-document-import-linking-stale-banner.test.tsx`.
 * - Uses `nextSessionId` / `resetSharedQueryClient` to avoid cross-test
 *   stale-cache interference (Task #1076 pattern).
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
import {
  nextSessionId,
  resetSharedQueryClient,
} from '../../helpers/queryClientIsolation';

jest.setTimeout(15000);

const BUILDING_ID = 'building-1534';
let SESSION_ID = 'session-test-1534-init';

interface LitePayloadOpts {
  items?: unknown[];
  candidateSummary?: {
    familyCount: number;
    anchorDocCount: number;
    openChainCount: number;
    maxInScopeCount: number;
  } | null;
}

function buildLitePayload(opts?: LitePayloadOpts) {
  const runAllLinking: Record<string, unknown> = {
    total: 1,
    processed: 1,
    failed: 0,
    startedAt: '2024-01-01T00:00:00.000Z',
    finishedAt: '2024-01-01T00:01:00.000Z',
    inFlight: [],
  };
  if (opts?.candidateSummary !== null && opts?.candidateSummary !== undefined) {
    runAllLinking.candidateSummary = opts.candidateSummary;
  } else if (opts?.candidateSummary === undefined) {
    runAllLinking.candidateSummary = {
      familyCount: 0,
      anchorDocCount: 0,
      openChainCount: 0,
      maxInScopeCount: 0,
    };
  }

  return {
    session: {
      id: SESSION_ID,
      buildingId: BUILDING_ID,
      organizationId: 'org-1534',
      adminUserId: 'admin-1',
      currentStep: 'linking' as const,
      status: 'active' as const,
      progress: {
        runAll: {
          linking: runAllLinking,
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: opts?.items ?? [
      {
        id: 'item-1534-a',
        originalName: 'doc-a.pdf',
        mimeType: 'application/pdf',
        status: 'identified',
        preExcludeStatus: null,
        excludeSource: null,
        screeningConfidence: null,
        screeningFallback: null,
        screeningTypeGuess: null,
        screeningBucketGuess: null,
        screeningQaReason: null,
        screeningRotationDegrees: 0,
        screeningRotationApplied: false,
        sortingConfidence: null,
        sortingFallback: null,
        sortingDecision: null,
        sortingReason: null,
        sortingMergeWithItemId: null,
        sortingMergeWithItemIds: null,
        sortingSplitAtPage: null,
        sortingDecisionState: null,
        sortingManualOverride: false,
        sortingDecisionSplitIntoItemIds: null,
        sortingDecisionDraft: false,
        sortingDecisionSplitFinalNames: null,
        finalFileName: null,
        branchingConfidence: null,
        branchingFallback: null,
        branch: null,
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
        identificationConfidence: null,
        identificationFallback: null,
        identificationName: null,
        identificationDescription: null,
        identificationTags: null,
        identificationAiSuggestedTagIds: null,
        identificationEffectiveDate: null,
        linkingConfidence: null,
        linkingFallback: null,
        linkingReason: null,
        linkingBeforeItemId: null,
        linkingAfterItemId: null,
        linkingFamilyId: null,
      },
    ],
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

let overridePayload: ReturnType<typeof buildLitePayload> | null = null;

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
          { id: BUILDING_ID, name: 'Building 1534', organizationId: 'org-1534' },
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
        return jsonResponse(overridePayload ?? buildLitePayload());
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
  SESSION_ID = nextSessionId('session-test-1534');
  overridePayload = null;
  mockLanguage = 'en';
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

describe('Task #1534 — Linking empty-result banner — visibility', () => {
  it('shows the banner when linking finishes and no item has a linkingFamilyId', async () => {
    renderPage();

    const banner = await screen.findByTestId(
      'linking-empty-result-banner',
      undefined,
      { timeout: 6000 },
    );

    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('data-reason', 'no-families');
  });

  it('does not show the banner when at least one item has a linkingFamilyId', async () => {
    const linkedItem = {
      id: 'item-linked',
      originalName: 'doc-linked.pdf',
      mimeType: 'application/pdf',
      status: 'linked',
      preExcludeStatus: null,
      excludeSource: null,
      screeningConfidence: null,
      screeningFallback: null,
      screeningTypeGuess: null,
      screeningBucketGuess: null,
      screeningQaReason: null,
      screeningRotationDegrees: 0,
      screeningRotationApplied: false,
      sortingConfidence: null,
      sortingFallback: null,
      sortingDecision: null,
      sortingReason: null,
      sortingMergeWithItemId: null,
      sortingMergeWithItemIds: null,
      sortingSplitAtPage: null,
      sortingDecisionState: null,
      sortingManualOverride: false,
      sortingDecisionSplitIntoItemIds: null,
      sortingDecisionDraft: false,
      sortingDecisionSplitFinalNames: null,
      finalFileName: null,
      branchingConfidence: null,
      branchingFallback: null,
      branch: null,
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
      identificationConfidence: null,
      identificationFallback: null,
      identificationName: null,
      identificationDescription: null,
      identificationTags: null,
      identificationAiSuggestedTagIds: null,
      identificationEffectiveDate: null,
      linkingConfidence: 0.92,
      linkingFallback: null,
      linkingReason: 'high_confidence_match',
      linkingBeforeItemId: null,
      linkingAfterItemId: 'existing-doc-1',
      linkingFamilyId: 'fam-rules',
    };

    overridePayload = buildLitePayload({ items: [linkedItem] });
    renderPage();

    await screen.findByTestId('toggle-hide-ready', undefined, { timeout: 6000 });

    expect(screen.queryByTestId('linking-empty-result-banner')).not.toBeInTheDocument();
  });

  it('hides the banner when the × dismiss button is clicked', async () => {
    renderPage();

    await screen.findByTestId(
      'linking-empty-result-banner',
      undefined,
      { timeout: 6000 },
    );

    const dismissBtn = screen.getByRole('button', {
      name: /dismiss explanation/i,
    });

    await act(async () => {
      fireEvent.click(dismissBtn);
      for (let i = 0; i < 2; i++) await Promise.resolve();
    });

    expect(screen.queryByTestId('linking-empty-result-banner')).not.toBeInTheDocument();
  });
});

describe('Task #1534 — Linking empty-result banner — reason variants', () => {
  it('shows data-reason="no-families" when candidateSummary has familyCount=0', async () => {
    overridePayload = buildLitePayload({
      candidateSummary: {
        familyCount: 0,
        anchorDocCount: 0,
        openChainCount: 0,
        maxInScopeCount: 0,
      },
    });

    renderPage();

    const banner = await screen.findByTestId(
      'linking-empty-result-banner',
      undefined,
      { timeout: 6000 },
    );

    expect(banner).toHaveAttribute('data-reason', 'no-families');
    expect(banner).toHaveTextContent(/No link families exist/i);
  });

  it('shows data-reason="low-confidence" when maxInScopeCount > 0', async () => {
    overridePayload = buildLitePayload({
      candidateSummary: {
        familyCount: 2,
        anchorDocCount: 3,
        openChainCount: 3,
        maxInScopeCount: 2,
      },
    });

    renderPage();

    const banner = await screen.findByTestId(
      'linking-empty-result-banner',
      undefined,
      { timeout: 6000 },
    );

    expect(banner).toHaveAttribute('data-reason', 'low-confidence');
    expect(banner).toHaveTextContent(/2 candidate/i);
  });
});
