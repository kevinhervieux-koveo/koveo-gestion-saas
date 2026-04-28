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
// test in this file finishes well under 1s on its own, but the wizard
// is large and rendering+unmounting it 11 times accumulates jsdom
// slowness — the last EN test pushes past the 3s ceiling on slower CI
// runners. Bump the per-file timeout so the suite stays deterministic.
//
// Task #1545 — Previously this file ran the EN/FR step matrix as two
// `it` blocks that each looped over all five AI steps, sharing a single
// jsdom + queryClient across the loop. The 5th iteration (linking)
// drifted past the 4 s `findByTestId` timeout in two ways:
//   (a) Radix AlertDialog portals leaked between iterations (the FR
//       loop in particular never closed the dialog before tearing
//       down), so portal-cleanup time piled up across iterations.
//   (b) Each render had to wait for the `/lite` query (`isLoading`
//       gates the page-level spinner at line 4746 of the wizard) to
//       resolve through fetchMock + jsdom + TanStack's microtask
//       chain. By the 10th render that round-trip was still finishing
//       *just* past the 4 s deadline on slower CI runners — only when
//       FR linking happened to land at the back of the test file.
//
// Two changes pin the suite down:
//   1. `describe.each` splits the matrix into one `it` per step so
//      every test starts from a freshly-reset queryClient, jsdom DOM,
//      and Radix portal scope (the file-level afterEach handles the
//      cleanup).
//   2. `renderPage()` pre-seeds the `/lite` query cache via
//      `queryClient.setQueryData` so `loadingSession` is `false` on
//      first render and the page-level spinner never shows up. This
//      makes the wizard's auto-mount and reset-step UI available on
//      the very first commit instead of waiting for fetchMock to
//      resolve through TanStack's pending → fetching → success state
//      machine.
// Combined, every step renders against a pristine, already-hydrated
// wizard and the 15 s per-step budget below is the true safety net
// rather than the actual measured budget.
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
// client/src/pages/admin/bulk-document-import.tsx (~line 716). Kept
// inline here so the test acts as a tripwire: if the wizard's labels
// change, this assertion drift surfaces immediately. The FR map is
// declared just below for the same reason — Task #1545 added
// FR-locale assertions to this file that reference STEP_LABEL_FR.
const STEP_LABEL_EN: Record<AutoStep, string> = {
  screening: 'Screening',
  sorting: 'Branching',
  branching: 'Sorting',
  identification: 'Identification',
  linking: 'Linking',
};

// Mirrors the FR step label map in
// client/src/pages/admin/bulk-document-import.tsx (~line 725). Same
// tripwire intent as STEP_LABEL_EN above: if the wizard's French
// labels drift, the FR-locale assertions in this file surface the
// mismatch immediately.
const STEP_LABEL_FR: Record<AutoStep, string> = {
  screening: 'Filtrage',
  sorting: 'Aiguillage',
  branching: 'Tri',
  identification: 'Identification',
  linking: 'Liaison',
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
  // Task #1545 — Pre-seed the lite session query before mounting so the
  // wizard's `loadingSession` flag is `false` on first render and the
  // page-level loading spinner never shows. Without this, TanStack
  // Query has to walk the pending → fetching → success state machine
  // off the fetchMock promise, and on slower CI runners that round
  // trip can still be in flight when `findResetButton`'s 4s deadline
  // fires (especially for the last test in the file).
  queryClient.setQueryData(
    ['/api/admin/bulk-import/sessions', SESSION_ID, 'lite'],
    buildSessionPayload(),
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>,
  );
}

async function findResetButton(step: AutoStep): Promise<HTMLElement> {
  // Wait for the button to both exist AND be enabled. We re-query the
  // node inside `waitFor` rather than holding a reference from the
  // initial `findByTestId` because the wizard's auto-mount run-all
  // mutation may flip the button between disabled (`runAll.isPending`
  // true) and enabled across several React commits, and React can
  // unmount/remount the surrounding row while the row's loading state
  // changes — which leaves a stale DOM reference whose `disabled`
  // attribute will never update.
  let button: HTMLElement | null = null;
  await waitFor(
    () => {
      button = screen.getByTestId(`auto-run-reset-step-${step}`);
      expect(button).toBeEnabled();
    },
    { timeout: 8000 },
  );
  return button!;
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
  // Task #1545 — One `it` per AI step instead of a single test that
  // loops over the whole matrix. Each step now starts from a freshly
  // reset queryClient, jsdom DOM, and Radix portal scope (the file-
  // level afterEach handles the cleanup), which keeps the 5th
  // (`linking`) iteration from inheriting the slowness/leaked nodes
  // that previously made `findByTestId('auto-run-reset-step-linking')`
  // miss its 4 s deadline.
  describe.each(AI_STEPS)('EN — step "%s"', (step) => {
    it('opens the dialog with the right step name and posts to /reset-step on confirm', async () => {
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
    });
  });

  describe.each(AI_STEPS)('FR — step "%s"', (step) => {
    it('opens the FR dialog with the right step name', async () => {
      mockLanguage = 'fr';
      scenarioStep = step;

      renderPage();
      const resetButton = await findResetButton(step);

      await act(async () => {
        fireEvent.click(resetButton);
      });

      const dialog = await screen.findByTestId(
        'reset-step-dialog',
        undefined,
        { timeout: 4000 },
      );

      expect(
        within(dialog).getByText("Reprendre l'étape à zéro ?"),
      ).toBeInTheDocument();

      // FR body — Task #1421: Linking uses a different description (FR)
      // that explains existing-platform links are preserved. We check
      // the body text via the aria-describedby paragraph rather than
      // within(dialog) to side-step Radix portal scope edge-cases.
      const descId = dialog.getAttribute('aria-describedby');
      const descEl = descId ? document.getElementById(descId) : null;
      const descText = descEl?.textContent ?? '';
      if (step === 'linking') {
        // Linking-specific FR copy: in-session groupings cleared, existing
        // platform doc links preserved.
        expect(descText).toMatch(/famille et voisin/);
        expect(descText).toMatch(/conserv/);
      } else {
        expect(descText).toMatch(/Toutes les d/);
        expect(descText).toContain(`« ${STEP_LABEL_FR[step]} »`);
        expect(descText).toContain("L'analyse red");
      }

      const confirmButton = within(dialog).getByTestId('reset-step-confirm');
      expect(confirmButton).toHaveTextContent("Reprendre l'étape");

      // Task #1545 — Close the dialog before the file-level afterEach
      // runs so the Radix portal nodes are reaped via the normal
      // unmount path rather than via the document.body.innerHTML reset.
      // (Confirm-then-close is the EN test's job; FR only verifies copy.)
      const cancelButton = within(dialog).getByTestId('reset-step-cancel');
      await act(async () => {
        fireEvent.click(cancelButton);
      });
      await waitFor(() => {
        expect(screen.queryByTestId('reset-step-dialog')).toBeNull();
      });
    });
  });

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
