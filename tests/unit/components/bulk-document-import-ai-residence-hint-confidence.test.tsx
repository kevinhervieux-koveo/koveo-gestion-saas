/**
 * Task #1358 — Component coverage for the AI confidence band that is
 * appended to the violet "AI suggestion" hint text shown inside both
 * the inline reassign panel (testid `reassign-residence-ai-hint-{id}`)
 * and the residence picker panel (testid `residence-picker-ai-hint-{id}`).
 *
 * Task #1320 already shows the High/Medium/Low chip next to the main
 * residence badge row. The hint inside the picker panels still only
 * showed the residence name, forcing admins to look back up to the
 * row to see the confidence. Task #1358 surfaces the same band suffix
 * directly in the hint text, e.g. "AI suggestion: 101 · High".
 *
 * Bands follow `bandForConfidence` thresholds:
 *   - >= 0.80 → "High"
 *   - >= 0.50 → "Medium"
 *   - <  0.50 → "Low"
 *
 * When `residenceConfidence` is null the suffix must be omitted
 * entirely (no trailing " · " separator) so the hint degrades
 * gracefully on legacy rows that never recorded a numeric confidence.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

jest.setTimeout(15000);

// -----------------------------------------------------------------------------
// Module mocks (declared before importing the page under test).
// -----------------------------------------------------------------------------

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

// jsdom shims for radix-select internals.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function () {};
}
if (typeof (HTMLElement.prototype as { hasPointerCapture?: unknown }).hasPointerCapture !== 'function') {
  (HTMLElement.prototype as { hasPointerCapture?: () => boolean }).hasPointerCapture = function () { return false; };
}
if (typeof (HTMLElement.prototype as { releasePointerCapture?: unknown }).releasePointerCapture !== 'function') {
  (HTMLElement.prototype as { releasePointerCapture?: () => void }).releasePointerCapture = function () {};
}

// -----------------------------------------------------------------------------
// Imports under test
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-1358';
const BUILDING_ID = 'building-1';

const RESIDENCES = [
  { id: 'res-101', unitNumber: '101' },
  { id: 'res-202', unitNumber: '202' },
  { id: 'res-303', unitNumber: '303' },
];

interface ItemFixture {
  id: string;
  residenceConfidence: number | null;
  /**
   * When true the item already has a residenceId set (so the
   * branching gate is satisfied and the row's "Reassign" button is
   * available). When false the row stays in the residence-picker
   * needed state and the picker panel is opened by clicking the red
   * "Residence required" badge.
   */
  hasResidence: boolean;
}

function buildItem(overrides: ItemFixture) {
  return {
    id: overrides.id,
    originalName: `${overrides.id}.pdf`,
    mimeType: 'application/pdf',
    status: overrides.hasResidence ? 'branched' : 'sorted',
    preExcludeStatus: null,
    excludeSource: null,
    branch: 'residence_documents',
    subCategory: 'lease',
    branchManualOverride: false,
    branchReason: 'looks like a lease',
    residenceId: overrides.hasResidence ? 'res-101' : null,
    residenceConfidence: overrides.residenceConfidence,
    residenceReason: 'AI guessed unit 101',
    residenceFallbackReason: null,
    residenceManualOverride: false,
    residenceAiSuggestedId: 'res-101',
    residenceAiSuggested: true,
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

function buildPayload(items: ReturnType<typeof buildItem>[]) {
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
          screening: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          sorting: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
          branching: { total: items.length, processed: items.length, failed: 0, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: '2024-01-01T00:01:00.000Z' },
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

function makeFetchMock(items: ReturnType<typeof buildItem>[]) {
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
        return jsonResponse(RESIDENCES);
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({ sessions: [], limit: 20, offset: 0, hasMore: false });
      }
    }
    return jsonResponse({ unmocked: true, url, method }, 404);
  }) as unknown as jest.MockedFunction<typeof fetch>;
}

let originalFetch: typeof fetch | undefined;

function setupTest(items: ReturnType<typeof buildItem>[]) {
  const payload = buildPayload(items);
  global.fetch = makeFetchMock(items);
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    payload,
  );
  queryClient.setQueryData(
    ['/api/buildings', BUILDING_ID, 'residences'],
    RESIDENCES,
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

// -----------------------------------------------------------------------------
// Reassign panel — hint text includes the band suffix
// -----------------------------------------------------------------------------

describe('Reassign panel AI residence hint — confidence band suffix (Task #1358)', () => {
  async function openReassignPanel(itemId: string) {
    const reassignBtn = await screen.findByTestId(
      `button-reassign-${itemId}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(reassignBtn);
    });
    await screen.findByTestId(`reassign-picker-${itemId}`);
  }

  it('shows "High" suffix when residenceConfidence is >= 0.80', async () => {
    const itemId = 'reassign-high';
    setupTest([buildItem({ id: itemId, residenceConfidence: 0.91, hasResidence: true })]);
    renderPage();
    await openReassignPanel(itemId);

    const hint = screen.getByTestId(`reassign-residence-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101 · High');
  });

  it('shows "Medium" suffix when residenceConfidence is in [0.50, 0.80)', async () => {
    const itemId = 'reassign-medium';
    setupTest([buildItem({ id: itemId, residenceConfidence: 0.62, hasResidence: true })]);
    renderPage();
    await openReassignPanel(itemId);

    const hint = screen.getByTestId(`reassign-residence-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101 · Medium');
  });

  it('shows "Low" suffix when residenceConfidence is < 0.50', async () => {
    const itemId = 'reassign-low';
    setupTest([buildItem({ id: itemId, residenceConfidence: 0.21, hasResidence: true })]);
    renderPage();
    await openReassignPanel(itemId);

    const hint = screen.getByTestId(`reassign-residence-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101 · Low');
  });

  it('omits the band suffix when residenceConfidence is null', async () => {
    const itemId = 'reassign-null';
    setupTest([buildItem({ id: itemId, residenceConfidence: null, hasResidence: true })]);
    renderPage();
    await openReassignPanel(itemId);

    const hint = screen.getByTestId(`reassign-residence-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101');
    // No trailing " · " separator and none of the band labels leaked in.
    expect(hint.textContent ?? '').not.toMatch(/·/);
    expect(hint.textContent ?? '').not.toMatch(/High|Medium|Low/);
  });
});

// -----------------------------------------------------------------------------
// Residence picker — hint text includes the band suffix
// -----------------------------------------------------------------------------

describe('Residence picker AI hint — confidence band suffix (Task #1358)', () => {
  async function openResidencePicker(itemId: string) {
    // The "Residence required" badge opens the picker panel and seeds
    // it with the AI suggestion (Task #803), which is the only state
    // where the residence-picker AI hint can render.
    const badge = await screen.findByTestId(
      `badge-residence-needed-${itemId}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(badge);
    });
    await screen.findByTestId(`residence-picker-${itemId}`);
  }

  it('shows "High" suffix when residenceConfidence is >= 0.80', async () => {
    const itemId = 'picker-high';
    setupTest([buildItem({ id: itemId, residenceConfidence: 0.95, hasResidence: false })]);
    renderPage();
    await openResidencePicker(itemId);

    const hint = screen.getByTestId(`residence-picker-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101 · High');
  });

  it('shows "Medium" suffix when residenceConfidence is in [0.50, 0.80)', async () => {
    const itemId = 'picker-medium';
    setupTest([buildItem({ id: itemId, residenceConfidence: 0.55, hasResidence: false })]);
    renderPage();
    await openResidencePicker(itemId);

    const hint = screen.getByTestId(`residence-picker-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101 · Medium');
  });

  it('shows "Low" suffix when residenceConfidence is < 0.50', async () => {
    const itemId = 'picker-low';
    setupTest([buildItem({ id: itemId, residenceConfidence: 0.1, hasResidence: false })]);
    renderPage();
    await openResidencePicker(itemId);

    const hint = screen.getByTestId(`residence-picker-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101 · Low');
  });

  it('omits the band suffix when residenceConfidence is null', async () => {
    const itemId = 'picker-null';
    setupTest([buildItem({ id: itemId, residenceConfidence: null, hasResidence: false })]);
    renderPage();
    await openResidencePicker(itemId);

    const hint = screen.getByTestId(`residence-picker-ai-hint-${itemId}`);
    expect(hint).toHaveTextContent('AI suggestion: 101');
    expect(hint.textContent ?? '').not.toMatch(/·/);
    expect(hint.textContent ?? '').not.toMatch(/High|Medium|Low/);
  });
});
