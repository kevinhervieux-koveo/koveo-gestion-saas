/**
 * Task #1085 — Component coverage for the inline reassign panel's
 * residence dropdown pre-fill behaviour seeded by Task #1083.
 *
 * The inline reassign panel (testid `reassign-picker-{id}`) opens when
 * the per-row "Reassign" button is clicked. When the active destination
 * is `residence_documents`, the panel renders a residence Select whose
 * initial value is seeded as:
 *
 *   `item.residenceId ?? item.residenceAiSuggestedId ?? ''`
 *
 * In addition, when the dropdown's current value still equals the AI's
 * original suggestion AND the admin hasn't explicitly accepted that
 * pick yet, a small violet "AI suggestion" hint is shown above the
 * Select (testid `reassign-residence-ai-hint-{id}`). Switching the
 * Destination away from "Résidences" hides the residence Select and
 * resets `reassignResidenceId` to ''; switching it back restores the
 * `residenceId ?? residenceAiSuggestedId` pre-fill.
 *
 * These three behaviours are wired together by the same handler block
 * in `client/src/pages/admin/bulk-document-import.tsx` (~line 3737),
 * so a small refactor could silently desync them. The tests below pin
 * each branch by mounting the real BulkDocumentImportPage on a session
 * sitting on the branching step and driving the reassign panel UI.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// Mounting BulkDocumentImportPage with all of its lite queries and
// side effects is slow under jsdom. Give every test in this file a
// generous budget so they don't race the global jest timeout.
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
// Imports under test
// -----------------------------------------------------------------------------

import BulkDocumentImportPage from '@/pages/admin/bulk-document-import';
import { queryClient } from '@/lib/queryClient';

// jsdom doesn't implement scrollIntoView, but radix-select calls it
// from useEffect when the listbox opens. Without these shims the
// listbox flushes a sync error and `findByRole('option')` never finds
// the items.
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
// Fixture helpers
// -----------------------------------------------------------------------------

const SESSION_ID = 'session-test-1085';
const BUILDING_ID = 'building-1';

const ITEM_HAS_RESIDENCE = 'item-has-residence';
const ITEM_AI_FALLBACK = 'item-ai-fallback';
const ITEM_DESTINATION_TOGGLE = 'item-destination-toggle';
const ITEM_AI_HINT_OVERRIDE = 'item-ai-hint-override';
const ITEM_SAVE_DISABLED = 'item-save-disabled';
const ITEM_SAVE_NON_RESIDENCE = 'item-save-non-residence';

const RESIDENCES = [
  { id: 'res-101', unitNumber: '101' },
  { id: 'res-202', unitNumber: '202' },
  { id: 'res-303', unitNumber: '303' },
];

interface ItemFixture {
  id: string;
  originalName: string;
  status: string;
  branch: string | null;
  residenceId: string | null;
  residenceAiSuggestedId: string | null;
  residenceAiSuggested: boolean;
  residenceAiConfirmed: boolean;
  residenceManualOverride: boolean;
  residenceReason: string | null;
}

function buildItem(overrides: ItemFixture) {
  return {
    id: overrides.id,
    originalName: overrides.originalName,
    mimeType: 'application/pdf',
    status: overrides.status,
    preExcludeStatus: null,
    excludeSource: null,
    branch: overrides.branch,
    subCategory: 'lease',
    branchManualOverride: false,
    branchReason: 'looks like a lease',
    residenceId: overrides.residenceId,
    residenceConfidence: overrides.residenceId ? 0.8 : null,
    residenceReason: overrides.residenceReason,
    residenceFallbackReason: overrides.residenceId
      ? null
      : 'AI could not determine the residence',
    residenceManualOverride: overrides.residenceManualOverride,
    residenceAiSuggestedId: overrides.residenceAiSuggestedId,
    residenceAiSuggested: overrides.residenceAiSuggested,
    residenceAiConfirmed: overrides.residenceAiConfirmed,
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
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

function makeFetchMock(items: ReturnType<typeof buildItem>[]) {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
  // Pre-warm the lite + residences queries so the rows render
  // synchronously and the picker can be opened without waiting for
  // the async fetch to settle.
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

/**
 * The shadcn Select trigger displays the matched SelectItem's children
 * via <SelectValue />. For the residence Select that means the trigger
 * shows the unit number string of the currently-selected residence (or
 * the placeholder when no value is set). We assert against the
 * trigger's textContent rather than the portal-mounted listbox.
 */
function getResidenceTrigger(itemId: string): HTMLElement {
  return screen.getByTestId(`reassign-residence-select-${itemId}`);
}

// =============================================================================
// 1. Pre-fill from item.residenceId when one is already saved
// =============================================================================

describe('BulkDocumentImportPage — reassign residence dropdown pre-fill (Task #1085)', () => {
  it('pre-selects the saved residenceId when the reassign panel opens on an item that already has a residence', async () => {
    setupTest([
      buildItem({
        id: ITEM_HAS_RESIDENCE,
        originalName: 'lease-303.pdf',
        status: 'branched',
        branch: 'residence_documents',
        residenceId: 'res-303',
        // The AI happened to pick a different residence; the saved
        // residenceId must still win the seed.
        residenceAiSuggestedId: 'res-101',
        residenceAiSuggested: false,
        residenceAiConfirmed: false,
        residenceManualOverride: false,
        residenceReason: 'unit 303 in filename',
      }),
    ]);
    renderPage();

    const reassignBtn = await screen.findByTestId(
      `button-reassign-${ITEM_HAS_RESIDENCE}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(reassignBtn);
    });

    // The picker panel must be open and the residence Select must
    // render the unit number for res-303 (NOT res-101).
    await screen.findByTestId(`reassign-picker-${ITEM_HAS_RESIDENCE}`);
    const trigger = getResidenceTrigger(ITEM_HAS_RESIDENCE);
    expect(trigger).toHaveTextContent('303');
    expect(trigger).not.toHaveTextContent('101');

    // The violet "AI suggestion" hint must NOT be shown because the
    // current pick (res-303) is the saved residenceId, not the AI's
    // suggestion (res-101).
    expect(
      screen.queryByTestId(`reassign-residence-ai-hint-${ITEM_HAS_RESIDENCE}`),
    ).not.toBeInTheDocument();
  });

  // ===========================================================================
  // 2. Fall back to residenceAiSuggestedId when no residenceId is set
  // ===========================================================================

  it('falls back to residenceAiSuggestedId and shows the violet AI hint when no residenceId is set', async () => {
    setupTest([
      buildItem({
        id: ITEM_AI_FALLBACK,
        originalName: 'lease-ai.pdf',
        // The branching step gate keeps these rows on `sorted` until
        // a residence is picked. The reassign panel should still open
        // and seed from the AI suggestion.
        status: 'sorted',
        branch: 'residence_documents',
        residenceId: null,
        residenceAiSuggestedId: 'res-202',
        residenceAiSuggested: true,
        residenceAiConfirmed: false,
        residenceManualOverride: false,
        residenceReason: 'AI guessed unit 202',
      }),
    ]);
    renderPage();

    const reassignBtn = await screen.findByTestId(
      `button-reassign-${ITEM_AI_FALLBACK}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(reassignBtn);
    });

    await screen.findByTestId(`reassign-picker-${ITEM_AI_FALLBACK}`);
    const trigger = getResidenceTrigger(ITEM_AI_FALLBACK);
    // Trigger text must reflect the AI's pick (unit 202).
    expect(trigger).toHaveTextContent('202');

    // The violet hint is shown because the picker value still equals
    // the AI suggestion AND residenceAiConfirmed is false.
    const hint = screen.getByTestId(
      `reassign-residence-ai-hint-${ITEM_AI_FALLBACK}`,
    );
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent(/AI suggestion: 202/);
  });

  // ===========================================================================
  // 3. Switching destination away and back resets / restores the AI pre-fill
  // ===========================================================================

  it('resets the residence picker when destination switches away from Residences and restores the AI pre-fill on switch back', async () => {
    setupTest([
      buildItem({
        id: ITEM_DESTINATION_TOGGLE,
        originalName: 'lease-toggle.pdf',
        status: 'sorted',
        branch: 'residence_documents',
        residenceId: null,
        residenceAiSuggestedId: 'res-101',
        residenceAiSuggested: true,
        residenceAiConfirmed: false,
        residenceManualOverride: false,
        residenceReason: 'AI guessed unit 101',
      }),
    ]);
    renderPage();

    const reassignBtn = await screen.findByTestId(
      `button-reassign-${ITEM_DESTINATION_TOGGLE}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(reassignBtn);
    });

    await screen.findByTestId(`reassign-picker-${ITEM_DESTINATION_TOGGLE}`);

    // Sanity check: the panel opens with the AI suggestion pre-filled
    // and the violet hint visible.
    let trigger = getResidenceTrigger(ITEM_DESTINATION_TOGGLE);
    expect(trigger).toHaveTextContent('101');
    expect(
      screen.getByTestId(`reassign-residence-ai-hint-${ITEM_DESTINATION_TOGGLE}`),
    ).toBeInTheDocument();

    // Override the AI pick by selecting a different residence (303).
    // Doing this *before* toggling the destination is what makes the
    // round-trip a real reset/restore proof: if the destination
    // switch did NOT reset reassignResidenceId, the final value
    // would still be `res-303`, not the AI's `res-101`. Without this
    // step, the trailing assertion can't tell "correctly reset and
    // re-seeded from AI" apart from "value just persisted".
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0 });
      fireEvent.click(trigger);
    });
    const overrideOption = await screen.findByRole(
      'option',
      { name: /^303$/ },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(overrideOption);
    });
    await waitFor(() => {
      expect(getResidenceTrigger(ITEM_DESTINATION_TOGGLE)).toHaveTextContent('303');
    });
    // Selecting a non-AI residence must immediately hide the violet
    // hint (its gating condition `reassignResidenceId === item.residenceAiSuggestedId`
    // no longer holds).
    expect(
      screen.queryByTestId(`reassign-residence-ai-hint-${ITEM_DESTINATION_TOGGLE}`),
    ).not.toBeInTheDocument();

    // Switch the destination dropdown to Building documents. The
    // residence Select must disappear (the whole conditional block is
    // gated on `reassignBranch === 'residence_documents'`) AND the
    // underlying picker value must be cleared so a future switch
    // back re-runs the AI fall-back.
    const branchTrigger = screen.getByTestId(
      `reassign-branch-select-${ITEM_DESTINATION_TOGGLE}`,
    );
    await act(async () => {
      fireEvent.pointerDown(branchTrigger, { button: 0 });
      fireEvent.click(branchTrigger);
    });
    const buildingOption = await screen.findByRole(
      'option',
      { name: /Building documents/i },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(buildingOption);
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId(`reassign-residence-select-${ITEM_DESTINATION_TOGGLE}`),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByTestId(`reassign-residence-ai-hint-${ITEM_DESTINATION_TOGGLE}`),
    ).not.toBeInTheDocument();

    // Switch destination back to Residences. Because the round-trip
    // re-seeds via `item.residenceId ?? item.residenceAiSuggestedId`,
    // the picker must show the AI's `res-101` (unit 101) again — NOT
    // the admin's earlier `res-303` override. This is the assertion
    // that distinguishes a correct reset+restore from a no-op.
    await act(async () => {
      fireEvent.pointerDown(branchTrigger, { button: 0 });
      fireEvent.click(branchTrigger);
    });
    const residenceOption = await screen.findByRole(
      'option',
      { name: /^Residences$/i },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(residenceOption);
    });

    trigger = await screen.findByTestId(
      `reassign-residence-select-${ITEM_DESTINATION_TOGGLE}`,
    );
    expect(trigger).toHaveTextContent('101');
    expect(trigger).not.toHaveTextContent('303');
    expect(
      screen.getByTestId(`reassign-residence-ai-hint-${ITEM_DESTINATION_TOGGLE}`),
    ).toBeInTheDocument();
  });

  // ===========================================================================
  // 4. Picking a residence other than the AI suggestion hides the violet hint;
  //    re-selecting the AI's pick brings it back. (Task #1090)
  // ===========================================================================
  //
  // Task #1085 covers the AI hint *appearing* when the panel pre-fills with
  // the AI suggestion, but does not exercise the override path. The hint's
  // gating condition is
  //
  //   item.residenceAiSuggestedId
  //     && reassignResidenceId === item.residenceAiSuggestedId
  //     && !item.residenceAiConfirmed
  //
  // (see ~line 3809 of `client/src/pages/admin/bulk-document-import.tsx`).
  // A refactor that drops the equality guard would silently leave the hint
  // pinned to every row regardless of what the admin picks. This test pins
  // the round-trip: shown → hidden on override → shown again on re-select.

  it('hides the violet AI hint when the admin picks a different residence and shows it again when the AI pick is re-selected', async () => {
    setupTest([
      buildItem({
        id: ITEM_AI_HINT_OVERRIDE,
        originalName: 'lease-hint-override.pdf',
        // Branching gate keeps these on `sorted` until a residence is
        // chosen. Only `residenceAiSuggestedId` is set so the panel
        // opens pre-filled with the AI's pick and the hint visible.
        status: 'sorted',
        branch: 'residence_documents',
        residenceId: null,
        residenceAiSuggestedId: 'res-202',
        residenceAiSuggested: true,
        residenceAiConfirmed: false,
        residenceManualOverride: false,
        residenceReason: 'AI guessed unit 202',
      }),
    ]);
    renderPage();

    const reassignBtn = await screen.findByTestId(
      `button-reassign-${ITEM_AI_HINT_OVERRIDE}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(reassignBtn);
    });

    await screen.findByTestId(`reassign-picker-${ITEM_AI_HINT_OVERRIDE}`);

    // 1. Initial state — the panel pre-fills with the AI suggestion
    //    (unit 202) and the violet hint is visible.
    let trigger = getResidenceTrigger(ITEM_AI_HINT_OVERRIDE);
    expect(trigger).toHaveTextContent('202');
    expect(
      screen.getByTestId(`reassign-residence-ai-hint-${ITEM_AI_HINT_OVERRIDE}`),
    ).toBeInTheDocument();

    // 2. Admin overrides the AI pick by choosing a different residence
    //    (unit 303). The equality guard
    //    `reassignResidenceId === item.residenceAiSuggestedId` no longer
    //    holds, so the violet hint must disappear immediately.
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0 });
      fireEvent.click(trigger);
    });
    const overrideOption = await screen.findByRole(
      'option',
      { name: /^303$/ },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(overrideOption);
    });
    await waitFor(() => {
      expect(getResidenceTrigger(ITEM_AI_HINT_OVERRIDE)).toHaveTextContent('303');
    });
    expect(
      screen.queryByTestId(`reassign-residence-ai-hint-${ITEM_AI_HINT_OVERRIDE}`),
    ).not.toBeInTheDocument();

    // 3. Admin re-selects the AI's original pick (unit 202). The
    //    equality guard holds again — and `residenceAiConfirmed` is
    //    still false on the underlying item — so the violet hint must
    //    reappear.
    trigger = getResidenceTrigger(ITEM_AI_HINT_OVERRIDE);
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0 });
      fireEvent.click(trigger);
    });
    const aiOption = await screen.findByRole(
      'option',
      { name: /^202$/ },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(aiOption);
    });
    await waitFor(() => {
      expect(getResidenceTrigger(ITEM_AI_HINT_OVERRIDE)).toHaveTextContent('202');
    });
    expect(
      screen.getByTestId(`reassign-residence-ai-hint-${ITEM_AI_HINT_OVERRIDE}`),
    ).toBeInTheDocument();
  });

  // ===========================================================================
  // 5. Save button is disabled when destination is Residences and no residence
  //    is picked; it becomes enabled once a residence is selected. (Task #1101)
  // ===========================================================================

  it('disables Save when destination is Residences and no residence is picked, then re-enables it after a residence is selected', async () => {
    setupTest([
      buildItem({
        id: ITEM_SAVE_DISABLED,
        originalName: 'lease-no-residence.pdf',
        status: 'sorted',
        branch: 'residence_documents',
        residenceId: null,
        residenceAiSuggestedId: null,
        residenceAiSuggested: false,
        residenceAiConfirmed: false,
        residenceManualOverride: false,
        residenceReason: null,
      }),
    ]);
    renderPage();

    const reassignBtn = await screen.findByTestId(
      `button-reassign-${ITEM_SAVE_DISABLED}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(reassignBtn);
    });

    await screen.findByTestId(`reassign-picker-${ITEM_SAVE_DISABLED}`);

    // Save must be disabled because destination is residence_documents
    // and no residence is selected yet.
    const saveBtn = screen.getByTestId(`button-reassign-save-${ITEM_SAVE_DISABLED}`);
    expect(saveBtn).toBeDisabled();

    // The amber "residence required" hint must be visible so the admin
    // understands why Save is blocked.
    expect(
      screen.getByTestId(`reassign-residence-required-hint-${ITEM_SAVE_DISABLED}`),
    ).toBeInTheDocument();

    // Admin picks a residence — Save must become enabled.
    const residenceTrigger = getResidenceTrigger(ITEM_SAVE_DISABLED);
    await act(async () => {
      fireEvent.pointerDown(residenceTrigger, { button: 0 });
      fireEvent.click(residenceTrigger);
    });
    const option101 = await screen.findByRole(
      'option',
      { name: /^101$/ },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(option101);
    });

    await waitFor(() => {
      expect(screen.getByTestId(`button-reassign-save-${ITEM_SAVE_DISABLED}`)).not.toBeDisabled();
    });

    // The amber hint must also disappear once a residence is chosen.
    expect(
      screen.queryByTestId(`reassign-residence-required-hint-${ITEM_SAVE_DISABLED}`),
    ).not.toBeInTheDocument();
  });

  // ===========================================================================
  // 6. Save button stays enabled when destination is not Residences. (Task #1101)
  // ===========================================================================

  it('keeps Save enabled when destination is not Residences, regardless of the residence dropdown', async () => {
    setupTest([
      buildItem({
        id: ITEM_SAVE_NON_RESIDENCE,
        originalName: 'building-doc.pdf',
        status: 'branched',
        branch: 'building_documents',
        residenceId: null,
        residenceAiSuggestedId: null,
        residenceAiSuggested: false,
        residenceAiConfirmed: false,
        residenceManualOverride: false,
        residenceReason: null,
      }),
    ]);
    renderPage();

    const reassignBtn = await screen.findByTestId(
      `button-reassign-${ITEM_SAVE_NON_RESIDENCE}`,
      undefined,
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(reassignBtn);
    });

    await screen.findByTestId(`reassign-picker-${ITEM_SAVE_NON_RESIDENCE}`);

    // The residence Select must not be rendered for non-residence branches.
    expect(
      screen.queryByTestId(`reassign-residence-select-${ITEM_SAVE_NON_RESIDENCE}`),
    ).not.toBeInTheDocument();

    // Save must be enabled even though no residence is selected.
    const saveBtn = screen.getByTestId(`button-reassign-save-${ITEM_SAVE_NON_RESIDENCE}`);
    expect(saveBtn).not.toBeDisabled();
  });
});
