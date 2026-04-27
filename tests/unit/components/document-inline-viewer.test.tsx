/**
 * Tests for the inline document viewer dialog and every callsite that opens it.
 *
 * These tests guard against two regressions called out in the task:
 *   1. The inline viewer dialog must render an iframe (no popup / no
 *      window.open) for view actions on documents and bills.
 *   2. The Download button inside the viewer must fetch the file with
 *      credentials and trigger a programmatic <a download> click.
 *
 * Callsites covered by real interaction tests:
 *   - DocumentInlineViewer (the dialog itself)
 *   - AttachedFileSection            (attached file sections)
 *   - StandardDocumentAttachments    (document upload forms)
 *   - DocumentViewDialog             (document pages, in ModularDocumentPageWrapper)
 *   - UnifiedDocumentViewer          (document management)
 *   - DemandDetailsPopup             (demand details popup)
 *   - BillDetail                     (bill detail dialog, in manager/bills page)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Shared mocks (must be declared before importing components under test)
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

// Heavy upload/extractor pipeline isn't relevant here.
jest.mock('@/components/document-management', () => ({
  SharedUploader: () => null,
  DocumentCard: ({
    title,
    documentId,
    onViewClick,
  }: {
    title: string;
    documentId: string;
    onViewClick: (id: string) => void;
  }) =>
    React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': `document-card-${documentId}`,
        onClick: () => onViewClick(documentId),
      },
      title
    ),
  DocumentEditForm: () => null,
}));
jest.mock('@/components/document-management/DocumentCreateForm', () => ({
  DocumentCreateForm: () => null,
}));
jest.mock('@/components/bill-management/GeminiBillExtractor', () => ({
  GeminiBillExtractor: () => null,
}));
jest.mock('@/utils/sanitize', () => ({
  sanitizeFileName: (name: string) => name,
  sanitizeComment: (s: string) => s,
  sanitizeDescription: (s: string) => s,
}));

// DocumentContext used by UnifiedDocumentViewer.
jest.mock('@/components/document-management/DocumentContext', () => ({
  useDocumentPermissions: () => ({
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  }),
}));

// DocumentSequencePanel is rendered as a child of the inline viewer when the
// sequence panel is open. The keyboard-navigation tests need a real <input>
// inside the dialog tree to verify that arrow keys are ignored when focus is
// inside an input. We replace the panel with a simple input element for that
// purpose; tests that don't open the panel are unaffected.
jest.mock('@/components/documents/DocumentSequencePanel', () => ({
  DocumentSequencePanel: () =>
    React.createElement('input', {
      'data-testid': 'seq-panel-input',
      type: 'text',
    }),
}));

// queryClient module is referenced indirectly through invalidateQueries.
jest.mock('@/lib/queryClient', () => {
  const apiRequest = jest.fn(async (_method: string, url: string) => {
    const res = await (global.fetch as typeof fetch)(url, { credentials: 'include' });
    return res;
  });
  return {
    apiRequest,
    queryClient: { invalidateQueries: jest.fn() },
    getQueryFn: () => async () => ({}),
  };
});

// -----------------------------------------------------------------------------
// Imports under test (after jest.mock setup)
// -----------------------------------------------------------------------------

import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';
import { AttachedFileSection } from '@/components/common/AttachedFileSection';
import {
  StandardDocumentAttachments,
  AttachedFile,
} from '@/components/common/StandardDocumentAttachments';
import { DocumentViewDialog } from '@/components/common/ModularDocumentPageWrapper';
import { UnifiedDocumentViewer } from '@/components/document-management/UnifiedDocumentViewer';
import DemandDetailsPopup from '@/components/demands/demand-details-popup';
import { BillDetail } from '@/pages/manager/bills';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type FetchResponseInit = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  blob?: Blob;
  filename?: string;
};

function buildFetchResponse(init: FetchResponseInit = {}): Response {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    json = {},
    blob = new Blob(['file-bytes'], { type: 'application/pdf' }),
    filename = 'sample.pdf',
  } = init;

  const headers = new Headers();
  if (filename) {
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  }

  return {
    ok,
    status,
    statusText,
    headers,
    blob: async () => blob,
    json: async () => json,
    text: async () => '',
  } as unknown as Response;
}

type FetchResponder = (
  url: string,
  init?: RequestInit
) => Response | Promise<Response>;

let fetchResponder: FetchResponder = () => buildFetchResponse();

const fetchSpy = jest.fn((url: RequestInfo | URL, init?: RequestInit) =>
  Promise.resolve(fetchResponder(String(url), init))
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let createObjectURLSpy: jest.SpiedFunction<typeof URL.createObjectURL>;
let revokeObjectURLSpy: jest.SpiedFunction<typeof URL.revokeObjectURL>;
let windowOpenSpy: jest.SpiedFunction<typeof window.open>;
let anchorClickSpy: jest.SpiedFunction<HTMLAnchorElement['click']>;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = fetchSpy as unknown as typeof fetch;
  fetchResponder = () => buildFetchResponse();
  fetchSpy.mockClear();

  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL.
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () =>
      'blob:mock-url';
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () =>
      undefined;
  }

  createObjectURLSpy = jest
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:mock-url');
  revokeObjectURLSpy = jest
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => undefined);
  windowOpenSpy = jest
    .spyOn(window, 'open')
    .mockImplementation(() => null);
  // Stub <a>.click so jsdom doesn't try to navigate.
  anchorClickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  global.fetch = originalFetch as typeof fetch;
  createObjectURLSpy?.mockRestore();
  revokeObjectURLSpy?.mockRestore();
  windowOpenSpy?.mockRestore();
  anchorClickSpy?.mockRestore();
  mockToast.mockReset();
});

function withQueryClient(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Some components rely on the default queryFn (no explicit queryFn).
        queryFn: async ({ queryKey }) => {
          const url = String(queryKey[0]);
          const res = await (global.fetch as typeof fetch)(url, {
            credentials: 'include',
          });
          return res.json();
        },
      },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

async function clickAndWait(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
}

// The viewer fetches files with credentials and only mounts the iframe after
// resolving the response into a blob URL. The async chain spans several
// microtask hops (fetch -> response.blob -> createObjectURL -> setState), so
// we explicitly flush microtasks inside act() before asserting on the DOM.
async function flushAsyncEffects() {
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  });
}

async function settlePreviewAndClearSpies(previewUrl: string) {
  await flushAsyncEffects();
  await waitFor(() => {
    expect(
      fetchSpy.mock.calls.some(([u]) => String(u) === previewUrl),
    ).toBe(true);
  });
  await screen.findByTestId('iframe-inline-viewer');
  fetchSpy.mockClear();
  createObjectURLSpy.mockClear();
  anchorClickSpy.mockClear();
  revokeObjectURLSpy.mockClear();
}

async function expectInlineViewerOpenedFor(expectedSrc: string) {
  await flushAsyncEffects();
  await waitFor(() => {
    const calledForSrc = fetchSpy.mock.calls.some(
      ([url, init]) =>
        String(url) === expectedSrc &&
        (init as RequestInit | undefined)?.credentials === 'include',
    );
    expect(calledForSrc).toBe(true);
  });
  const iframe = (await screen.findByTestId(
    'iframe-inline-viewer',
  )) as HTMLIFrameElement;
  expect(iframe).toBeInTheDocument();
  expect(iframe.getAttribute('src')).toBe('blob:mock-url');
  expect(windowOpenSpy).not.toHaveBeenCalled();
}

// =============================================================================
// DocumentInlineViewer (the dialog itself)
// =============================================================================

describe('DocumentInlineViewer', () => {
  it('does not render the iframe when closed and never opens a popup', () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen={false}
          onClose={jest.fn()}
          fileUrl="/api/documents/abc/file"
          fileName="sample.pdf"
        />
      )
    );
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('renders an iframe pointing at fileUrl when open (no new browser tab)', async () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/abc/file"
          fileName="sample.pdf"
        />
      )
    );
    await expectInlineViewerOpenedFor('/api/documents/abc/file');
  });

  it('Download button fetches the file with credentials and triggers a save', async () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/abc/file"
          downloadUrl="/api/documents/abc/file?download=true"
          fileName="sample.pdf"
        />
      )
    );

    await settlePreviewAndClearSpies('/api/documents/abc/file');
    await clickAndWait('button-inline-viewer-download');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/documents/abc/file?download=true',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('falls back to fileUrl with ?download=true when no downloadUrl is provided', async () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/abc/file"
          fileName="sample.pdf"
        />
      )
    );
    await settlePreviewAndClearSpies('/api/documents/abc/file');
    await clickAndWait('button-inline-viewer-download');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/documents/abc/file?download=true');
  });

  it('preserves existing query string when appending download flag', async () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/abc/file?inline=true"
          fileName="sample.pdf"
        />
      )
    );
    await settlePreviewAndClearSpies('/api/documents/abc/file?inline=true');
    await clickAndWait('button-inline-viewer-download');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).toBe(
      '/api/documents/abc/file?inline=true&download=true'
    );
  });

  it('shows an error toast when the download request fails', async () => {
    fetchResponder = () =>
      buildFetchResponse({ ok: false, status: 500, statusText: 'Server Error' });

    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/abc/file"
          fileName="sample.pdf"
        />
      )
    );
    await clickAndWait('button-inline-viewer-download');
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatchObject({ variant: 'destructive' });
  });

  it('renders an <img> (not an iframe) for image filenames', () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/img-1/file"
          fileName="photo.png"
        />
      )
    );
    const img = screen.getByTestId('img-inline-viewer') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/api/documents/img-1/file');
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inline-viewer-unsupported')).not.toBeInTheDocument();
  });

  it('renders an <img> when only an image MIME type is provided (no extension)', () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/img-2/file"
          fileName="screenshot"
          mimeType="image/jpeg"
        />
      )
    );
    expect(screen.getByTestId('img-inline-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
  });

  it('renders the unsupported fallback for .docx files with a working download button', async () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/doc-1/file"
          fileName="contract.docx"
        />
      )
    );

    expect(screen.getByTestId('inline-viewer-unsupported')).toBeInTheDocument();
    expect(screen.queryByTestId('img-inline-viewer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();

    await clickAndWait('button-inline-viewer-download-fallback');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/documents/doc-1/file?download=true',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the unsupported fallback for an Office Word MIME type', () => {
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/doc-2/file"
          fileName="memo"
          mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      )
    );
    expect(screen.getByTestId('inline-viewer-unsupported')).toBeInTheDocument();
    expect(screen.queryByTestId('img-inline-viewer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
  });

  it('falls back to the unsupported panel when the preview fetch fails', async () => {
    fetchResponder = () =>
      buildFetchResponse({ ok: false, status: 404, statusText: 'Not Found' });

    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/missing/file"
          fileName="missing.pdf"
        />
      )
    );

    await flushAsyncEffects();
    expect(await screen.findByTestId('inline-viewer-error')).toBeInTheDocument();
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('button-inline-viewer-download-fallback'),
    ).toBeInTheDocument();
  });

  it('shows a loading indicator while the preview fetch is in flight', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchResponder = () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/slow/file"
          fileName="slow.pdf"
        />
      )
    );

    await flushAsyncEffects();
    expect(await screen.findByTestId('inline-viewer-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();

    resolveFetch(buildFetchResponse({}));
    await flushAsyncEffects();
    await screen.findByTestId('iframe-inline-viewer');
  });

  it('Close button invokes onClose', () => {
    const onClose = jest.fn();
    render(
      withQueryClient(
        <DocumentInlineViewer
          isOpen
          onClose={onClose}
          fileUrl="/api/documents/abc/file"
          fileName="sample.pdf"
        />
      )
    );
    fireEvent.click(screen.getByTestId('button-inline-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// DocumentInlineViewer — multi-family viewer keyboard navigation
// =============================================================================

describe('DocumentInlineViewer keyboard navigation', () => {
  const baseNeighbor = {
    source: 'date' as const,
    effectiveDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    documentType: null,
  };

  const families = [
    {
      familyId: 'fam-1',
      familyName: 'Family 1',
      familyDescription: null,
      previous: { id: 'prev-1', name: 'Prev 1', ...baseNeighbor },
      previousIsChainEnd: false,
      next: { id: 'next-1', name: 'Next 1', ...baseNeighbor },
      nextIsChainEnd: false,
    },
    {
      familyId: 'fam-2',
      familyName: 'Family 2',
      familyDescription: null,
      previous: { id: 'prev-2', name: 'Prev 2', ...baseNeighbor },
      previousIsChainEnd: false,
      next: { id: 'next-2', name: 'Next 2', ...baseNeighbor },
      nextIsChainEnd: false,
    },
  ];

  function renderWithFamilies() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Pre-populate the neighbors query so the viewer renders both family rows
    // immediately, without depending on the default test fetcher.
    client.setQueryData(['/api/documents', 'doc-key', 'neighbors'], {
      currentId: 'doc-key',
      families,
    });
    const onNavigate = jest.fn();
    render(
      <QueryClientProvider client={client}>
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/doc-key/file"
          fileName="photo.png"
          documentId="doc-key"
          onNavigate={onNavigate}
        />
      </QueryClientProvider>
    );
    return { onNavigate };
  }

  it('ArrowRight calls onNavigate with the next document of the active family', () => {
    const { onNavigate } = renderWithFamilies();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('next-1');
  });

  it('ArrowLeft calls onNavigate with the previous document of the active family', () => {
    const { onNavigate } = renderWithFamilies();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('prev-1');
  });

  it('ArrowDown increments the active family index (next row is highlighted)', () => {
    const { onNavigate } = renderWithFamilies();
    expect(screen.getByTestId('family-nav-row-fam-1')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'false'
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' });

    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('family-nav-row-fam-1')).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(onNavigate).not.toHaveBeenCalled();

    // After the active family switched, ArrowRight should now navigate within
    // the second family's neighbors.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('next-2');
  });

  it('ArrowUp decrements the active family index', () => {
    const { onNavigate } = renderWithFamilies();
    // Move down first so we have somewhere to come back up from.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' });
    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowUp' });

    expect(screen.getByTestId('family-nav-row-fam-1')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ArrowUp while the first family is active leaves the first family active', () => {
    const { onNavigate } = renderWithFamilies();
    expect(screen.getByTestId('family-nav-row-fam-1')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowUp' });

    expect(screen.getByTestId('family-nav-row-fam-1')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(onNavigate).not.toHaveBeenCalled();

    // After clamping, ArrowRight should still navigate within the first family.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('next-1');
  });

  it('ArrowDown while the last family is active leaves the last family active', () => {
    const { onNavigate } = renderWithFamilies();
    // Move to the last (second) family first.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' });
    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // ArrowDown again must clamp at the last family, not crash the row lookup.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' });

    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('family-nav-row-fam-1')).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(onNavigate).not.toHaveBeenCalled();

    // After clamping, ArrowRight should still navigate within the last family.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('next-2');
  });

  it('ArrowLeft/Right do nothing when the active family has no previous/next neighbor', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(['/api/documents', 'doc-key', 'neighbors'], {
      currentId: 'doc-key',
      families: [
        {
          familyId: 'fam-only',
          familyName: 'Only Family',
          familyDescription: null,
          previous: null,
          previousIsChainEnd: true,
          next: null,
          nextIsChainEnd: true,
        },
      ],
    });
    const onNavigate = jest.fn();
    render(
      <QueryClientProvider client={client}>
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl="/api/documents/doc-key/file"
          fileName="photo.png"
          documentId="doc-key"
          onNavigate={onNavigate}
        />
      </QueryClientProvider>
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when the keydown originates from an input element', () => {
    const { onNavigate } = renderWithFamilies();

    // Open the sequence panel — our jest.mock above renders an <input> in its
    // place, giving us a real input inside the dialog's React tree.
    fireEvent.click(screen.getByTestId('button-toggle-sequence-fam-1'));
    const input = screen.getByTestId('seq-panel-input');
    expect(input.tagName).toBe('INPUT');

    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onNavigate).not.toHaveBeenCalled();
    // Active family must remain the first one (ArrowDown was suppressed).
    expect(screen.getByTestId('family-nav-row-fam-1')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('family-nav-row-fam-2')).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });
});

// =============================================================================
// AttachedFileSection (attached file sections callsite)
// =============================================================================

describe('AttachedFileSection', () => {
  it('opens the inline viewer dialog with iframe when View is clicked (no popup)', async () => {
    render(
      withQueryClient(
        <AttachedFileSection
          entityType="document"
          entityId="doc-123"
          filePath="/api/documents/doc-123/file"
          fileName="lease.pdf"
        />
      )
    );

    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
    await clickAndWait('button-view-file');
    await expectInlineViewerOpenedFor('/api/documents/doc-123/file');
  });

  it.each<{ entityType: 'document' | 'bill'; id: string; url: string }>([
    { entityType: 'document', id: 'd1', url: '/api/documents/d1/file' },
    { entityType: 'bill', id: 'b1', url: '/api/bills/b1/file' },
  ])(
    'wires the iframe to the $entityType entity endpoint',
    async ({ entityType, id, url }) => {
      render(
        withQueryClient(
          <AttachedFileSection
            entityType={entityType}
            entityId={id}
            filePath={`/uploads/${id}.pdf`}
            fileName="x.pdf"
          />
        )
      );
      await clickAndWait('button-view-file');
      await expectInlineViewerOpenedFor(url);
    }
  );

  it('Download button inside the viewer fetches the file with credentials', async () => {
    render(
      withQueryClient(
        <AttachedFileSection
          entityType="bill"
          entityId="bill-7"
          filePath="/uploads/bill-7.pdf"
          fileName="bill-7.pdf"
        />
      )
    );
    await clickAndWait('button-view-file');
    await settlePreviewAndClearSpies('/api/bills/bill-7/file');
    await clickAndWait('button-inline-viewer-download');

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [calledUrl, opts] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe('/api/bills/bill-7/file?download=true');
    expect(opts).toMatchObject({ credentials: 'include' });
  });
});

// =============================================================================
// StandardDocumentAttachments (existing attachment preview opens inline viewer)
// =============================================================================

describe('StandardDocumentAttachments', () => {
  it('opens the inline viewer for an existing attached document (no popup)', async () => {
    const attachedFiles: AttachedFile[] = [
      {
        id: 'att-1',
        isExisting: true,
        name: 'minutes.pdf',
        url: '/api/documents/att-1/file',
        category: 'document',
      },
    ];

    render(
      withQueryClient(
        <StandardDocumentAttachments
          onDocumentChange={jest.fn()}
          attachedFiles={attachedFiles}
          onRemoveFile={jest.fn()}
          uploadProgress={{}}
          uploadContext={{ type: 'documents' }}
        />
      )
    );

    await clickAndWait('button-view-att-1');
    await expectInlineViewerOpenedFor('/api/documents/att-1/file');
  });
});

// =============================================================================
// DocumentViewDialog (document pages, ModularDocumentPageWrapper)
// =============================================================================

describe('DocumentViewDialog (document pages)', () => {
  it('clicking View opens the inline viewer iframe for the document (no popup)', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/documents/doc-9') && !url.includes('/file')) {
        return buildFetchResponse({
          json: {
            id: 'doc-9',
            name: 'lease.pdf',
            fileName: 'lease.pdf',
            filePath: '/uploads/doc-9.pdf',
          },
        });
      }
      return buildFetchResponse();
    };

    render(
      withQueryClient(
        <DocumentViewDialog
          documentId="doc-9"
          isOpen
          onClose={jest.fn()}
          onEdit={jest.fn()}
          canEdit
        />
      )
    );

    const viewBtn = await screen.findByTestId('button-view-document-file');
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    await expectInlineViewerOpenedFor('/api/documents/doc-9/file');
  });

  it('routes to the image branch when the document record has an image mimeType', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/documents/doc-img') && !url.includes('/file')) {
        return buildFetchResponse({
          json: {
            id: 'doc-img',
            name: 'screenshot',
            fileName: 'screenshot',
            filePath: '/uploads/doc-img.bin',
            mimeType: 'image/png',
          },
        });
      }
      return buildFetchResponse();
    };

    render(
      withQueryClient(
        <DocumentViewDialog
          documentId="doc-img"
          isOpen
          onClose={jest.fn()}
          onEdit={jest.fn()}
          canEdit
        />
      )
    );

    const viewBtn = await screen.findByTestId('button-view-document-file');
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    const img = await screen.findByTestId('img-inline-viewer') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/documents/doc-img/file');
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inline-viewer-unsupported')).not.toBeInTheDocument();
  });

  it('routes to the unsupported fallback for an Office mimeType from the document record', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/documents/doc-office') && !url.includes('/file')) {
        return buildFetchResponse({
          json: {
            id: 'doc-office',
            name: 'contract.docx',
            fileName: 'contract.docx',
            filePath: '/uploads/doc-office.docx',
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        });
      }
      return buildFetchResponse();
    };

    render(
      withQueryClient(
        <DocumentViewDialog
          documentId="doc-office"
          isOpen
          onClose={jest.fn()}
          onEdit={jest.fn()}
          canEdit
        />
      )
    );

    const viewBtn = await screen.findByTestId('button-view-document-file');
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    expect(await screen.findByTestId('inline-viewer-unsupported')).toBeInTheDocument();
    expect(screen.queryByTestId('img-inline-viewer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('iframe-inline-viewer')).not.toBeInTheDocument();
  });
});

// =============================================================================
// UnifiedDocumentViewer (document management)
// =============================================================================

describe('UnifiedDocumentViewer (document management)', () => {
  it('clicking a document card opens the inline viewer (no popup)', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/documents')) {
        return buildFetchResponse({
          json: {
            documents: [
              { id: 'd-42', name: 'budget.pdf', documentType: 'financial' },
            ],
            total: 1,
          },
        });
      }
      return buildFetchResponse();
    };

    render(
      withQueryClient(
        <UnifiedDocumentViewer
          config={{
            entityType: 'building',
            entityId: 'bld-1',
            canView: true,
          }}
        />
      )
    );

    const card = await screen.findByTestId('document-card-d-42');
    await act(async () => {
      fireEvent.click(card);
    });

    await expectInlineViewerOpenedFor('/api/documents/d-42/file');
  });
});

// =============================================================================
// DemandDetailsPopup (demand details popup)
// =============================================================================

describe('DemandDetailsPopup (demand details popup)', () => {
  const baseDemand = {
    id: 'demand-1',
    type: 'maintenance' as const,
    description: 'Broken sink',
    status: 'submitted' as const,
    submitterId: 'user-1',
    buildingId: 'bld-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submitter: {
      id: 'user-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    },
    building: { id: 'bld-1', name: 'Maple', address: '1 St' },
  };

  it('clicking the view button on an attached document opens the inline viewer (no popup)', async () => {
    fetchResponder = (url) => {
      if (url.includes('attachedToType=demand')) {
        return buildFetchResponse({
          json: [
            {
              id: 'doc-77',
              name: 'invoice.pdf',
              fileName: 'invoice.pdf',
              description: '',
            },
          ],
        });
      }
      if (url.includes('/comments')) {
        return buildFetchResponse({ json: [] });
      }
      return buildFetchResponse({ json: [] });
    };

    render(
      withQueryClient(
        <DemandDetailsPopup
          demand={baseDemand}
          isOpen
          onClose={jest.fn()}
          user={{ id: 'mgr', role: 'manager', email: 'm@example.com' }}
        />
      )
    );

    const viewBtn = await screen.findByTestId('button-view-document-doc-77');
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    await expectInlineViewerOpenedFor('/api/documents/doc-77/file');
  });
});

// =============================================================================
// BillDetail (bill detail dialog inside manager/bills)
// =============================================================================

describe('BillDetail (bill detail dialog)', () => {
  // Bill type from @shared/schema is large — use a partial that satisfies what
  // BillDetail actually reads. Cast through unknown to avoid `as any`.
  const baseBill = {
    id: 'bill-1',
    billNumber: 'B-001',
    title: 'Heating',
    status: 'pending',
    category: 'utilities',
    totalAmount: '100.00',
    startDate: '2025-01-01',
    paymentType: 'one_time',
    costs: ['100.00'],
    filePath: '/uploads/bill-1.pdf',
    fileName: 'bill-1.pdf',
    isAiAnalyzed: false,
  } as const;

  it('clicking the view button on the attached bill document opens the inline viewer (no popup)', async () => {
    fetchResponder = (url) => {
      if (url === '/api/bills/bill-1') {
        return buildFetchResponse({ json: baseBill });
      }
      if (url.includes('attachedToType=bill')) {
        return buildFetchResponse({ json: { documents: [] } });
      }
      return buildFetchResponse({ json: {} });
    };

    render(
      withQueryClient(
        <BillDetail
          bill={baseBill as unknown as React.ComponentProps<typeof BillDetail>['bill']}
          onSuccess={jest.fn()}
          onCancel={jest.fn()}
          onEditBill={jest.fn()}
        />
      )
    );

    const viewBtn = await screen.findByTestId('button-view-document-bill-1');
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    await expectInlineViewerOpenedFor(
      '/api/bills/bill-1/download-document?inline=true'
    );
  });

  it('clicking view on an attached document opens the inline viewer (no popup)', async () => {
    fetchResponder = (url) => {
      if (url === '/api/bills/bill-1') {
        return buildFetchResponse({
          json: { ...baseBill, filePath: null, fileName: null },
        });
      }
      if (url.includes('attachedToType=bill')) {
        return buildFetchResponse({
          json: {
            documents: [
              { id: 'doc-99', name: 'extra.pdf', fileName: 'extra.pdf', documentType: 'invoice' },
            ],
          },
        });
      }
      return buildFetchResponse({ json: {} });
    };

    render(
      withQueryClient(
        <BillDetail
          bill={baseBill as unknown as React.ComponentProps<typeof BillDetail>['bill']}
          onSuccess={jest.fn()}
          onCancel={jest.fn()}
          onEditBill={jest.fn()}
        />
      )
    );

    const viewBtn = await screen.findByTestId('button-view-document-doc-99');
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    await expectInlineViewerOpenedFor('/api/documents/doc-99/file');
  });
});
