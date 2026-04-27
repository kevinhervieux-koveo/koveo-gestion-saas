/**
 * Task #1074 — Frontend coverage for the new "Retry step from scratch"
 * button on the Bulk Document Import wizard. **EN locale only**, plus
 * the cancel-button regression test.
 *
 * The FR-locale variants of these tests live in
 * `bulk-document-import-reset-step-fr.test.tsx`. The two suites are
 * intentionally split into separate test files; see "Task #1535 —
 * Flake fix" below for the why.
 *
 * Task #1068 added an AlertDialog-gated reset action to every AI step
 * (Screening, Sorting, Branching, Identification, Linking). The
 * server-side endpoint POST /api/admin/bulk-import/sessions/:id/reset-step
 * is covered by tests/unit/api/bulk-import-reset-step.test.ts. This
 * suite locks down the wizard-side wiring:
 *
 *   - The "Retry step from scratch" button renders for every AI step.
 *   - Clicking it opens the bilingual confirmation dialog with the
 *     correct step label interpolated in (EN here, FR in the
 *     companion file).
 *   - Cancel closes the dialog without firing the mutation.
 *   - Confirm fires exactly one POST to the new endpoint with the
 *     `{ step }` payload that matches the wizard's current step.
 *
 * A regression in any of these moving parts would silently break the
 * user-facing reset flow without the backend unit test catching it.
 *
 * Task #1535 — Flake fix
 * ----------------------------------------------------------------
 * The original single-file suite had two parameterized tests that
 * each rendered and tore down the wizard 5 times in an in-test loop
 * (once per AI step). Empirically the wizard can be rendered ~9 times
 * in a single jsdom session before something in the accumulated React
 * + React-Query + Radix portal + jsdom state starts silently dropping
 * the wizard's `/lite` query response — the wizard stays stuck on its
 * loading spinner forever (the fetch is made but the data never
 * arrives at the useQuery hook), and the next test's
 * `findByTestId('auto-run-reset-step-…')` blows past the 4 000 ms
 * timeout.
 *
 * The fix has two parts:
 *
 *   1. Split each parameterized loop into 5 independent `it.each`
 *      tests so each AI step gets a fresh `beforeEach` / `afterEach`
 *      cycle (and a fresh unique session id, see `nextSessionId`)
 *      instead of sharing one accumulating in-test loop.
 *
 *   2. Split the EN and FR suites into separate test files so each
 *      jsdom session stays well below the empirical position-10
 *      ceiling (this file: 5 EN + 1 cancel = 6 wizard renders; FR
 *      file: 5 FR renders).
 *
 * No per-step timeout was bumped — the 4 000 ms ceiling is preserved.
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
  fireEvent,
  act,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Variable name MUST start with "mock" so jest's hoisted module factory
// is allowed to reference it. We mutate it from each test before
// rendering so the wizard reads the right language at render time.
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

// jest.config.cjs sets a global testTimeout of 3000ms. Each individual
// test in this file finishes well under 1s on its own, so the global
// timeout is fine after Task #1535's split. We bump it modestly here
// only as a safety net for slower CI runners.
jest.setTimeout(15000);

// Task #1535 — every test gets a fresh session id so a late-resolving
// fetch from the previous test can't poison the current test's cache
// under the same queryKey. Set in `beforeEach`.
let SESSION_ID = 'session-task-1074-init';
const ITEM_ID = 'item-1074';

type AutoStep =
  | 'screening'
  | 'sorting'
  | 'branching'
  | 'identification'
  | 'linking';

// Pre-step status — the wizard reads `STEP_PRE_STATUS[currentStep]` to
// decide whether each item is "still eligible" for the current AI step.
// Seeding the lone item at the pre-step status is enough to render the
// row without it being filtered out of the per-step view.
const PRE_STATUS: Record<AutoStep, string> = {
  screening: 'pending',
  sorting: 'screened',
  branching: 'sorted',
  identification: 'branched',
  linking: 'identified',
};

// Mirrors the EN step label map in
// client/src/pages/admin/bulk-document-import.tsx (~line 495). Kept
// inline here so the test acts as a tripwire: if the wizard's labels
// change, this assertion drift surfaces immediately. The FR map lives
// in `bulk-document-import-reset-step-fr.test.tsx`.
const STEP_LABEL_EN: Record<AutoStep, string> = {
  screening: 'Screening',
  sorting: 'Branching',
  branching: 'Sorting',
  identification: 'Identification',
  linking: 'Linking',
};

const AI_STEPS: AutoStep[] = [
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
];

let scenarioStep: AutoStep = 'screening';

function buildSessionPayload() {
  // Same baseline shape as bulk-document-import-retry-isolation.test.tsx:
  // every nullable/optional column is filled in so the wizard's strict
  // narrowing on item fields doesn't blow up. We only customize
  // `status` per scenario.
  const baseItem = {
    id: ITEM_ID,
    originalName: 'doc-1074.pdf',
    mimeType: 'application/pdf',
    status: PRE_STATUS[scenarioStep],
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
  };

  return {
    session: {
      id: SESSION_ID,
      buildingId: 'building-1',
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      currentStep: scenarioStep,
      status: 'active' as const,
      // Mark the run-all loop as already finished so the
      // "Retry step from scratch" button isn't gated by
      // `runAll.isPending` after the auto-mount mutation resolves.
      progress: {
        runAll: {
          [scenarioStep]: {
            total: 1,
            processed: 1,
            failed: 0,
            startedAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:01:00.000Z',
          },
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    items: [baseItem],
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
      if (pathname === '/api/admin/bulk-import/buildings-lite')
        return jsonResponse([]);
      if (pathname === '/api/admin/bulk-import/ai-status')
        return jsonResponse({ available: true });
      if (pathname === '/api/organizations') return jsonResponse([]);
      if (pathname === `/api/admin/bulk-import/sessions/${SESSION_ID}/lite`) {
        return jsonResponse(buildSessionPayload());
      }
      if (pathname === '/api/admin/bulk-import/sessions') {
        return jsonResponse({
          sessions: [],
          limit: 20,
          offset: 0,
          hasMore: false,
        });
      }
    }

    if (method === 'POST') {
      // Both the auto-mount /run-all POST and the /reset-step POST
      // resolve immediately so the wizard's mutation isPending flips
      // back to false promptly. The reset-step calls are inspected via
      // `getResetStepCalls()` below.
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let originalQueryDefaults: ReturnType<typeof queryClient.getDefaultOptions>;

beforeAll(() => {
  // Task #1535 — Disable React Query retries for the duration of this
  // file. The default queryClient retries 401/404 responses up to two
  // times, which can add ~2 s of delay per failed lite poll. After 9
  // wizard renders in the same jsdom session (5 EN + 4 FR), even one
  // transient retry can push the 10th render's findByTestId past the
  // 4 000 ms limit. With retries off the lite query either resolves on
  // the first request or throws — keeping every test deterministic.
  // The same pattern is used in
  // tests/unit/components/bulk-document-import-linking-overrides-clear.test.tsx.
  originalQueryDefaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...originalQueryDefaults,
    queries: { ...originalQueryDefaults.queries, retry: false },
  });
});

afterAll(() => {
  queryClient.setDefaultOptions(originalQueryDefaults);
});

beforeEach(async () => {
  // Task #1535 — fresh session id per test stops a late-resolving
  // fetch from the previous test from poisoning the cache under the
  // same queryKey. Combined with `resetSharedQueryClient()` (which
  // awaits `cancelQueries()` before clearing) this eliminates the
  // resolve-after-clear race that left the wizard stuck on its
  // loading spinner during the linking iteration.
  SESSION_ID = nextSessionId('session-task-1074');
  scenarioStep = 'screening';
  mockLanguage = 'en';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
  await resetSharedQueryClient();
});

afterEach(async () => {
  // Cancel any in-flight queries so a background refetch from this
  // test cannot leak into the next test's render. The Bulk Document
  // Import wizard polls /lite on a 5s interval — without this the
  // queryClient.clear() below races the next test's first render.
  await queryClient.cancelQueries();
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });

  cleanup();
  // Radix-UI portals (AlertDialog, Dialog) attach to document.body and
  // RTL's `cleanup()` doesn't always reap the orphaned wrappers. After
  // 8+ render/unmount cycles the leftover nodes pile up enough to
  // intercept Radix's focus management and prevent the new dialog from
  // mounting. Explicitly resetting body keeps every test's DOM pristine.
  document.body.innerHTML = '';
  global.fetch = originalFetch as typeof fetch;
  window.localStorage.clear();
  mockToast.mockReset();
  queryClient.clear();
  queryClient.getMutationCache().clear();
  queryClient.getQueryCache().clear();
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function findResetButton(step: AutoStep): Promise<HTMLElement> {
  const button = await screen.findByTestId(
    `auto-run-reset-step-${step}`,
    undefined,
    { timeout: 4000 },
  );
  // Wait for the auto-mount /run-all mutation to settle so the button
  // is no longer disabled by `runAll.isPending`.
  await waitFor(() => expect(button).toBeEnabled(), { timeout: 4000 });
  return button;
}

interface ResetStepCall {
  url: string;
  body: unknown;
}

function getResetStepCalls(): ResetStepCall[] {
  return fetchMock.mock.calls
    .filter(([input, init]) => {
      const u =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      return (
        (init?.method || 'GET').toUpperCase() === 'POST' &&
        u === `/api/admin/bulk-import/sessions/${SESSION_ID}/reset-step`
      );
    })
    .map(([input, init]) => {
      const u =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const raw = init?.body;
      const body =
        typeof raw === 'string'
          ? JSON.parse(raw)
          : raw instanceof Uint8Array
            ? JSON.parse(new TextDecoder().decode(raw))
            : raw;
      return { url: u, body };
    });
}

describe('BulkDocumentImportPage — "Retry step from scratch" button (Task #1074)', () => {
  // Task #1535 — Each AI step is now its own `it.each` test so jsdom
  // state is fully reset between iterations via the file-level
  // `beforeEach`/`afterEach`. Previously a single `it` rendered the
  // wizard 5 times in a loop and the 5th iteration (linking) timed
  // out because accumulated jsdom + Radix portal + queryClient state
  // left the page stuck on its loading spinner.
  it.each(AI_STEPS)(
    'opens the EN dialog at the %s step with the right step name and posts to /reset-step on confirm',
    async (step) => {
      mockLanguage = 'en';
      scenarioStep = step;

      renderPage();
      const resetButton = await findResetButton(step);

      // Pre-condition: dialog hidden, no /reset-step POST yet.
      expect(screen.queryByTestId('reset-step-dialog')).toBeNull();
      expect(getResetStepCalls()).toHaveLength(0);

      await act(async () => {
        fireEvent.click(resetButton);
      });

      const dialog = await screen.findByTestId(
        'reset-step-dialog',
        undefined,
        { timeout: 4000 },
      );

      // EN title — locked by Task #1068.
      expect(
        within(dialog).getByText('Retry this step from scratch?'),
      ).toBeInTheDocument();

      // EN body — Task #1421: Linking uses a different description that
      // explains existing-platform links are preserved. All other steps
      // use the generic template with the step label interpolated.
      if (step === 'linking') {
        const description = within(dialog).getByText(
          /In-session chain groupings will be cleared/,
        );
        expect(description.textContent).toContain('existing platform documents');
        expect(description.textContent).toContain('preserved');
      } else {
        const description = within(dialog).getByText(
          /All AI decisions and manual overrides for the/,
        );
        expect(description.textContent).toContain(`"${STEP_LABEL_EN[step]}"`);
        expect(description.textContent).toContain(
          'Analysis will restart immediately.',
        );
      }

      // EN action label.
      const confirmButton = within(dialog).getByTestId('reset-step-confirm');
      expect(confirmButton).toHaveTextContent('Retry step');

      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Exactly one POST to the new endpoint with the matching step.
      await waitFor(() => {
        expect(getResetStepCalls()).toHaveLength(1);
      });
      expect(getResetStepCalls()[0].body).toEqual({ step });

      // Dialog closes after the success path runs
      // `setPendingResetStep(null)`.
      await waitFor(() => {
        expect(screen.queryByTestId('reset-step-dialog')).toBeNull();
      });
    },
  );

  // FR coverage lives in
  // `bulk-document-import-reset-step-fr.test.tsx` so each jsdom
  // session stays well below the empirical position-10 ceiling
  // (Task #1535).

  it('cancel closes the dialog without firing the reset-step mutation', async () => {
    scenarioStep = 'screening';
    mockLanguage = 'en';

    renderPage();
    const resetButton = await findResetButton('screening');

    await act(async () => {
      fireEvent.click(resetButton);
    });

    const dialog = await screen.findByTestId(
      'reset-step-dialog',
      undefined,
      { timeout: 4000 },
    );
    const cancelButton = within(dialog).getByTestId('reset-step-cancel');

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('reset-step-dialog')).toBeNull();
    });

    // Cancel must be a pure no-op for the network — the only POST that
    // could have been issued by this test is /run-all from the wizard's
    // auto-mount effect.
    expect(getResetStepCalls()).toHaveLength(0);
  });
});
