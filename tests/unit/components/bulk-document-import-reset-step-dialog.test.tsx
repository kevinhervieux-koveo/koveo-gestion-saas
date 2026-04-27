/**
 * Task #1421 — Linking-step "Retry step from scratch" dialog bilingual copy.
 *
 * When the admin clicks "Retry step from scratch" on the Linking step, the
 * confirmation dialog must show Linking-specific copy (EN + FR) that
 * explains existing-platform document links are preserved. Other steps
 * continue to use the generic wording.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

let mockLanguage = 'en';
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
import { nextSessionId, resetSharedQueryClient } from '../../helpers/queryClientIsolation';

let SESSION_ID = 'session-test-1421-init';

function buildLinkingSessionPayload() {
  const items = [
    { id: 'item-link-aaa', originalName: 'doc-a.pdf' },
    { id: 'item-link-bbb', originalName: 'doc-b.pdf' },
  ].map((it) => ({
    ...it,
    mimeType: 'application/pdf',
    status: 'identified' as const,
    preExcludeStatus: null,
    excludeSource: null,
    screeningConfidence: null,
    screeningFallback: null,
    screeningTypeGuess: null,
    screeningBucketGuess: null,
    screeningQaReason: null,
    screeningRotationDegrees: 0,
    screeningRotationApplied: false,
    screeningDegraded: null,
    screeningRetryCount: null,
    screeningPeriodHint: null,
    screeningPeriodHintManualOverride: false,
    screeningParsedPeriodHintDate: null,
    sortingConfidence: null,
    sortingFallback: null,
    sortingDegraded: null,
    sortingRetryCount: null,
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
    branchingDegraded: null,
    branchingRetryCount: null,
    branch: null,
    subCategory: null,
    branchReason: null,
    branchManualOverride: false,
    branchSuggestedFinalFileName: null,
    branchSuggestedSplitFinalNames: null,
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
    identificationDegraded: null,
    identificationRetryCount: null,
    identificationName: null,
    identificationDescription: null,
    identificationTags: null,
    identificationAiSuggestedTagIds: null,
    identificationEffectiveDate: null,
    identificationEffectiveDateManualOverride: false,
    linkingConfidence: null,
    linkingFallback: 'extraction_failed' as const,
    linkingDegraded: null,
    linkingRetryCount: null,
    linkingReason: null,
    linkingBeforeItemId: null,
    linkingAfterItemId: null,
    linkingManualOverride: false,
    linkingFamilyId: null,
    linkingBeforeDocumentId: null,
    linkingAfterDocumentId: null,
    linkingFamilyName: null,
    linkingNeighborDocumentName: null,
    linkingNeighborPosition: null,
    duplicateOfDocumentId: null,
    duplicateOfDocumentName: null,
    duplicateOfBuildingId: null,
    duplicateOfBuildingName: null,
    duplicateOfResidenceLabel: null,
    duplicateOfDocumentType: null,
    duplicateOfDocumentRemoved: false,
    originalPath: null,
  }));

  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: 'linking' as const,
      status: 'active' as const,
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
      if (pathname === '/api/admin/bulk-import/buildings-lite') return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status') return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(buildLinkingSessionPayload());
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      }
    }

    if (method === 'POST') {
      return jsonResponse({ ok: true, session: buildLinkingSessionPayload().session });
    }

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;

beforeEach(async () => {
  await resetSharedQueryClient();
  SESSION_ID = nextSessionId('session-test-1421');
  mockLanguage = 'en';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
});

afterEach(async () => {
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

describe('BulkDocumentImportPage — Linking reset-step dialog copy (Task #1421)', () => {
  describe('EN — Linking-specific copy', () => {
    it('shows preserved-link message (EN) when the Linking reset dialog opens', async () => {
      renderPage();

      const resetBtn = await screen.findByTestId('auto-run-reset-step-linking', undefined, {
        timeout: 4000,
      });

      await act(async () => {
        fireEvent.click(resetBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('reset-step-dialog')).toBeInTheDocument();
      });

      const desc = screen.getByTestId('reset-step-dialog').querySelector('[role="dialog"] [class*="description"], [id*="description"]')
        ?? screen.getByText(/existing platform documents/i, { exact: false });

      expect(desc).toBeTruthy();
      expect(screen.getByText(/existing platform documents/i, { exact: false })).toBeInTheDocument();
      expect(screen.getByText(/preserved/i, { exact: false })).toBeInTheDocument();

      expect(screen.queryByText(/will be wiped/i)).not.toBeInTheDocument();
    });
  });

  describe('FR — Linking-specific copy', () => {
    beforeEach(() => {
      mockLanguage = 'fr';
    });

    it('shows preserved-link message (FR) when the Linking reset dialog opens', async () => {
      renderPage();

      const resetBtn = await screen.findByTestId('auto-run-reset-step-linking', undefined, {
        timeout: 4000,
      });

      await act(async () => {
        fireEvent.click(resetBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('reset-step-dialog')).toBeInTheDocument();
      });

      expect(screen.getByText(/conserv/i, { exact: false })).toBeInTheDocument();
      expect(screen.queryByText(/seront effacées sur chaque fichier non exclu/i)).not.toBeInTheDocument();
    });
  });
});
