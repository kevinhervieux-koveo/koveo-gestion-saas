/**
 * Task #598 — DocumentEditForm passes the fetched document text into the
 * tag-suggestion scorer.
 *
 * The edit dialog calls `GET /api/documents/:id/text` (server-side test
 * lives at server/tests/document-text-endpoint.test.ts) and threads the
 * resulting `extractedText` into `suggestTagIds` so legacy text/Office
 * documents pick up the same higher-quality keyword matches the create
 * dialog already gets after extraction.
 *
 * Two regressions to guard against here:
 *   1. When the text endpoint returns content, the form must call the
 *      keyword scorer with that exact `extractedText` so the suggestion
 *      list reflects the document body, not just its filename.
 *   2. When the text endpoint errors (network / 5xx), the form must NOT
 *      crash and must still call the scorer with `extractedText: null`
 *      so the user sees the legacy filename-only fallback instead of an
 *      error state.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Mocks (must be declared before importing the component under test)
// -----------------------------------------------------------------------------

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

// `useStandardForm` pulls in the full react-hook-form + zodResolver +
// useMutation stack and a real submit pipeline. We're not exercising the
// submit path here, so a stub form with stable references (mirroring
// how RHF returns ref-stable handles via internal refs) keeps the render
// fast and avoids unrelated network paths.
jest.mock('@/hooks/use-standard-form', () => {
  const stableForm: any = {
    control: {
      _defaultValues: {
        name: 'sample-doc',
        description: '',
        category: 'other',
        effectiveDate: '',
        isVisible: true,
        isManagerOnly: false,
      },
    },
    watch: (key: string) => stableForm.control._defaultValues[key],
    getValues: () => stableForm.control._defaultValues,
    handleSubmit: (onValid: any) => (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault?.();
      return Promise.resolve(onValid(stableForm.control._defaultValues));
    },
    setValue: () => undefined,
    reset: () => undefined,
    formState: { errors: {}, isSubmitting: false },
    register: () => ({
      name: '',
      onChange: () => undefined,
      onBlur: () => undefined,
      ref: () => undefined,
    }),
  };
  const stableSubmitMutation = { mutate: () => undefined, isPending: false };
  const stableControls = {
    form: stableForm,
    handleSubmit: stableForm.handleSubmit,
    isSubmitting: false,
    submitMutation: stableSubmitMutation,
  };
  return {
    useStandardForm: () => stableControls,
  };
});

// The delete mutation is not exercised here; stub it so the form doesn't
// register a real React Query mutation against `/api/documents/:id`.
jest.mock('@/lib/common-hooks', () => ({
  useCreateUpdateMutation: () => ({
    mutateAsync: jest.fn(),
    mutate: jest.fn(),
    isPending: false,
  }),
}));

// `apiRequest` is touched only when Save / Delete are clicked — a no-op
// stub keeps the form load side-effect free.
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: { invalidateQueries: jest.fn() },
  getQueryFn: () => async () => ({}),
}));

// The Radix-backed shadcn UI primitives (Select/Switch/Tooltip/Form) bring
// in popovers, focus traps, and ref composition that don't play well in
// jsdom. We're not exercising any of those interactions here — only the
// data flow from the text query into `suggestTagIds`. Flatten every
// visual primitive to a plain, ref-free element to sidestep the
// "Maximum update depth exceeded" loop Radix's compose-refs hits in
// React 19's strict commit phase under jsdom.
jest.mock('@/components/ui/select', () => ({
  __esModule: true,
  Select: ({ children }: any) => <div data-testid="mock-select">{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/switch', () => ({
  __esModule: true,
  Switch: ({ checked, onCheckedChange, ...rest }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...rest}
    />
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  __esModule: true,
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/components/ui/form', () => {
  const Slot = ({ children }: any) => <>{children}</>;
  return {
    __esModule: true,
    Form: ({ children }: any) => <div>{children}</div>,
    FormControl: Slot,
    FormDescription: Slot,
    FormField: ({ render, name, control }: any) =>
      render({
        field: {
          name,
          value:
            (control && control._defaultValues && control._defaultValues[name]) ??
            '',
          onChange: () => undefined,
          onBlur: () => undefined,
          ref: () => undefined,
        },
        fieldState: { error: undefined },
        formState: {},
      }),
    FormItem: ({ children }: any) => <div>{children}</div>,
    FormLabel: ({ children }: any) => <label>{children}</label>,
    FormMessage: ({ children }: any) => <span>{children}</span>,
  };
});

jest.mock('@/components/forms/StandardFormField', () => ({
  __esModule: true,
  StandardFormField: ({ label }: any) => (
    <div data-testid="mock-standard-form-field">{label}</div>
  ),
}));

// Render TagPicker as a transparent probe so the test can read whatever
// suggestedTagIds the form computes — that's the observable signal that
// `suggestTagIds` ran with the inputs we expect.
const tagPickerCalls: Array<{ suggestedTagIds: string[] }> = [];
jest.mock('@/components/document-tags/TagPicker', () => ({
  __esModule: true,
  TagPicker: (props: { suggestedTagIds?: string[] }) => {
    tagPickerCalls.push({ suggestedTagIds: props.suggestedTagIds ?? [] });
    return (
      <div
        data-testid="mock-tag-picker"
        data-suggested-ids={(props.suggestedTagIds ?? []).join(',')}
      />
    );
  },
  TagChips: () => null,
}));

// Spy on the keyword scorer. The whole point of this test is to confirm
// the form forwards `extractedText` (or `null` on failure) into it.
const suggestTagIdsMock = jest.fn<
  string[],
  [
    {
      tags: unknown[];
      fileName?: string | null;
      extractedText?: string | null;
      category?: string;
      scope?: 'building' | 'residence';
      max?: number;
    },
  ]
>(() => []);
jest.mock('@/lib/tag-suggestions', () => ({
  suggestTagIds: (args: any) => suggestTagIdsMock(args),
}));

// -----------------------------------------------------------------------------
// Component import (after jest.mock setup)
// -----------------------------------------------------------------------------

import { DocumentEditForm } from '@/components/document-management/DocumentEditForm';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SAMPLE_DOCUMENT = {
  id: 'doc-edit-task598',
  name: 'sample-doc',
  description: '',
  documentType: 'other',
  effectiveDate: null,
  isVisibleToTenants: true,
  isManagerOnly: false,
  mimeType: 'text/plain',
  filePath: '/uploads/sample.txt',
  tags: [],
} as any;

const TAGS_RESPONSE = {
  tags: [
    {
      id: 'tag-budget',
      name: 'Budget',
      description: 'Annual budgets and forecasts',
      scope: 'building',
      importance: 'nice_to_have',
      suggestedProfessionals: [],
      isSystem: true,
      organizationId: null,
    },
    {
      id: 'tag-insurance',
      name: 'Insurance',
      description: 'Insurance policies and renewals',
      scope: 'building',
      importance: 'nice_to_have',
      suggestedProfessionals: [],
      isSystem: true,
      organizationId: null,
    },
  ],
};

type TextResponse = {
  text: string;
  hasText: boolean;
  mimeType: string | null;
  reason?: string;
};

/**
 * Build a fresh QueryClient seeded with stable data for the tags query
 * so `allTags` is reference-stable from render 1 (otherwise the form's
 * AI-suggestion useEffect — whose deps include `allTags` and which calls
 * `setAiSuggestions([])` — re-fires on every render and trips React's
 * "Maximum update depth exceeded" guard against an unresolved tagsData
 * query). The text query's behaviour is configured per test via
 * `textBehaviour`.
 */
function buildClient(textBehaviour: {
  mode: 'success' | 'error';
  data?: TextResponse;
}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
        queryFn: async ({ queryKey }) => {
          const url = Array.isArray(queryKey)
            ? queryKey
                .map((seg) =>
                  typeof seg === 'string' ? seg : JSON.stringify(seg),
                )
                .join('/')
                .replace(/\/+/g, '/')
            : String(queryKey);
          if (url.endsWith(`/api/documents/${SAMPLE_DOCUMENT.id}/text`)) {
            if (textBehaviour.mode === 'error') {
              throw new Error('HTTP 500');
            }
            return textBehaviour.data ?? {
              text: '',
              hasText: false,
              mimeType: null,
            };
          }
          if (url.endsWith('/api/document-tags')) {
            return TAGS_RESPONSE;
          }
          return {};
        },
      },
      mutations: { retry: false },
    },
  });
  // Pre-seed the tags cache so `allTags` resolves to a stable reference
  // on the very first render — the form's AI-suggest effect cannot start
  // looping before the query promise even has a chance to resolve.
  client.setQueryData(['/api/document-tags'], TAGS_RESPONSE);
  return client;
}

function withQueryClient(
  node: React.ReactElement,
  client: QueryClient,
) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

// -----------------------------------------------------------------------------
// Test lifecycle
// -----------------------------------------------------------------------------

beforeEach(() => {
  tagPickerCalls.length = 0;
  suggestTagIdsMock.mockReset();
  suggestTagIdsMock.mockReturnValue([]);
});

afterEach(() => {
  cleanup();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('DocumentEditForm — text endpoint integration with tag suggestions', () => {
  it('threads the fetched extractedText into suggestTagIds for the keyword scorer', async () => {
    const EXTRACTED =
      'This is the extracted plain-text body of the document. ' +
      'It mentions the building budget and insurance renewal explicitly.';

    suggestTagIdsMock.mockImplementation(({ extractedText }) =>
      // Fingerprint the call: only return tag-budget when the
      // extractor's text actually reached us. The test fails if the
      // form drops `extractedText` on its way to the scorer, even
      // before we inspect the spy directly.
      typeof extractedText === 'string' && extractedText.includes('budget')
        ? ['tag-budget']
        : [],
    );

    const client = buildClient({
      mode: 'success',
      data: {
        text: EXTRACTED,
        hasText: true,
        mimeType: 'text/plain',
      },
    });

    render(
      withQueryClient(
        <DocumentEditForm
          document={SAMPLE_DOCUMENT}
          buildingId="building-task598"
        />,
        client,
      ),
    );

    // Wait until at least one suggestTagIds call carries the resolved
    // extracted text — i.e. the text query has settled and the form
    // re-rendered with `extractedText` in hand.
    await waitFor(() => {
      const sawExtractedText = suggestTagIdsMock.mock.calls.some(
        ([args]) =>
          args &&
          typeof args.extractedText === 'string' &&
          args.extractedText.includes('insurance renewal'),
      );
      expect(sawExtractedText).toBe(true);
    });

    // The most recent call (after the text resolves) must carry the
    // exact extractor output, the document filename, the watched
    // category, and the tag scope derived from `buildingId`.
    const lastArgs =
      suggestTagIdsMock.mock.calls[suggestTagIdsMock.mock.calls.length - 1][0];
    expect(lastArgs).toMatchObject({
      extractedText: EXTRACTED,
      fileName: SAMPLE_DOCUMENT.name,
      category: 'other',
      scope: 'building',
      max: 3,
    });
    expect(Array.isArray(lastArgs.tags)).toBe(true);
    expect(lastArgs.tags).toHaveLength(TAGS_RESPONSE.tags.length);

    // The TagPicker probe should also have received the suggested IDs
    // — proving the chain runs end-to-end through the rendered UI.
    await waitFor(() => {
      const lastPickerCall = tagPickerCalls[tagPickerCalls.length - 1];
      expect(lastPickerCall.suggestedTagIds).toEqual(['tag-budget']);
    });
  });

  it('falls back gracefully when the text request errors — no crash, suggestTagIds called with extractedText: null', async () => {
    // The text endpoint throws (simulating a 5xx). The form must NOT
    // crash and must keep calling the scorer with `extractedText: null`
    // — which is the heuristic-only path the dialog relied on before
    // this endpoint existed.
    const client = buildClient({ mode: 'error' });

    render(
      withQueryClient(
        <DocumentEditForm
          document={SAMPLE_DOCUMENT}
          buildingId="building-task598"
        />,
        client,
      ),
    );

    // Wait until the failed query has been processed at least once
    // (status moves to "error" inside the QueryClient cache).
    await waitFor(() => {
      const queryState = client
        .getQueryCache()
        .find({ queryKey: ['/api/documents', SAMPLE_DOCUMENT.id, 'text'] })
        ?.state;
      expect(queryState?.status).toBe('error');
    });

    // And the scorer must have been called at least once for the form
    // to have produced any suggestions at all.
    await waitFor(() => {
      expect(suggestTagIdsMock).toHaveBeenCalled();
    });

    // The dialog must still be in the DOM — i.e. the failed text fetch
    // did not unmount or throw out of render.
    expect(screen.getByTestId('document-edit-form')).toBeInTheDocument();
    expect(screen.getByTestId('mock-tag-picker')).toBeInTheDocument();

    // EVERY scorer call must have null/empty extractedText — we never
    // want a failed fetch to leak partial / stale text into the
    // suggestion pipeline.
    for (const [args] of suggestTagIdsMock.mock.calls) {
      expect(args.extractedText == null || args.extractedText === '').toBe(true);
    }
  });
});
