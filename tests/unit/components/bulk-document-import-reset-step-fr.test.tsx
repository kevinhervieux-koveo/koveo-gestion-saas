/**
 * Task #1074 — Frontend coverage for the new "Retry step from scratch"
 * button on the Bulk Document Import wizard. **FR locale only.**
 *
 * The EN-locale variant of this suite (and the cancel-button test) live
 * in `bulk-document-import-reset-step.test.tsx`. The two suites are
 * intentionally split into separate test files; see "Task #1535 — Flake
 * fix" below for the why.
 *
 * Coverage in this file:
 *   - For each AI step (Screening, Sorting, Branching, Identification,
 *     Linking) clicking the "Retry step from scratch" button opens the
 *     bilingual confirmation dialog with the correct **French** copy
 *     and step label interpolated.
 *   - The Linking step uses a different FR description (Task #1421)
 *     that explains existing-platform links are preserved.
 *
 * Task #1535 — Flake fix
 * ----------------------------------------------------------------
 * The original suite combined the EN and FR loops in a single file and
 * iterated through 5 AI steps in each. Empirically the wizard can be
 * rendered ~9 times in a single jsdom session before something in the
 * accumulated React + React-Query + Radix portal + jsdom state starts
 * silently dropping the wizard's `/lite` query response — the wizard
 * stays stuck on its loading spinner forever (the fetch is made but
 * the data never arrives at the useQuery hook), and the next test's
 * `findByTestId('auto-run-reset-step-…')` blows past the 4 000 ms
 * timeout.
 *
 * The split into two files keeps each jsdom session at ≤ 6 wizard
 * renders, well below the empirical position-10 ceiling, and makes
 * every test deterministic without bumping any per-step timeout.
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

// All tests in this file run under FR. Kept as a `let` (with a "mock"
// prefix that satisfies jest's hoisted-factory rule) for symmetry with
// the EN-side file in case a future reviewer wants to add a per-test
// override.
let mockLanguage: 'en' | 'fr' = 'fr';
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

// Safety net for slower CI runners; per-step `findBy*` calls still
// honour the 4 000 ms ceiling enforced by the task spec.
jest.setTimeout(15000);

let SESSION_ID = 'session-task-1074-fr-init';
const ITEM_ID = 'item-1074-fr';

type AutoStep =
  | 'screening'
  | 'sorting'
  | 'branching'
  | 'identification'
  | 'linking';

const PRE_STATUS: Record<AutoStep, string> = {
  screening: 'pending',
  sorting: 'screened',
  branching: 'sorted',
  identification: 'branched',
  linking: 'identified',
};

// Mirror of the FR step label map in
// client/src/pages/admin/bulk-document-import.tsx (~line 495). Inlined
// so a typo in the wizard's labels surfaces as an immediate test
// failure here.
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
      // back to false promptly.
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ unmocked: true, url, method }, 404);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let originalQueryDefaults: ReturnType<typeof queryClient.getDefaultOptions>;

beforeAll(() => {
  // Disable React Query retries so a transient 401/404 on a `/lite`
  // poll cannot tack on a 2 s retry delay that would push the next
  // test's `findByTestId` past its 4 000 ms ceiling. Mirrors
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
  // Fresh session id per test prevents a late-resolving fetch from
  // the previous test from poisoning the cache under the same
  // queryKey. Combined with `resetSharedQueryClient()` (which awaits
  // `cancelQueries()` before clearing) this eliminates the
  // resolve-after-clear race.
  SESSION_ID = nextSessionId('session-task-1074-fr');
  scenarioStep = 'screening';
  mockLanguage = 'fr';
  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  window.localStorage.setItem('bulkImportActiveSessionId', SESSION_ID);
  await resetSharedQueryClient();
});

afterEach(async () => {
  await queryClient.cancelQueries();
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });

  cleanup();
  // Reap any orphaned Radix portal wrappers so the next test's DOM
  // starts pristine (RTL's `cleanup()` doesn't always catch them).
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

describe('BulkDocumentImportPage — "Retry step from scratch" button (Task #1074, FR)', () => {
  // Each AI step is its own `it.each` test so jsdom state is fully
  // reset between iterations via the file-level `beforeEach`/
  // `afterEach`. Previously a single parameterized loop rendered the
  // wizard 5 times back-to-back and the 5th iteration (linking) timed
  // out because accumulated jsdom + Radix + queryClient state left
  // the page stuck on its loading spinner.
  it.each(AI_STEPS)(
    'opens the FR dialog at the %s step with the right step name',
    async (step) => {
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
        // Linking-specific FR copy: in-session groupings cleared,
        // existing platform doc links preserved.
        expect(descText).toMatch(/famille et voisin/);
        expect(descText).toMatch(/conserv/);
      } else {
        expect(descText).toMatch(/Toutes les d/);
        expect(descText).toContain(`« ${STEP_LABEL_FR[step]} »`);
        expect(descText).toContain("L'analyse red");
      }

      const confirmButton = within(dialog).getByTestId('reset-step-confirm');
      expect(confirmButton).toHaveTextContent("Reprendre l'étape");
    },
  );
});
