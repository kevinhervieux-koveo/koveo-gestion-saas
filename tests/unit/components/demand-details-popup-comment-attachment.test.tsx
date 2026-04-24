/**
 * @file Demand Details Popup — Comment Attachment Tests
 * @description Verifies that when GET /api/demands/:id/comments returns a
 * comment with `filePath`/`fileName`/`fileSize` populated, the demand details
 * popup renders the attachment row with View and Download buttons that target
 * the correct file URL. Also verifies that comments without an attachment do
 * not render the row.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Mocks (declared before component import so module evaluation picks them up)
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

jest.mock('@/utils/sanitize', () => ({
  sanitizeFileName: (name: string) => name,
  sanitizeComment: (s: string) => s,
  sanitizeDescription: (s: string) => s,
}));

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

import DemandDetailsPopup from '@/components/demands/demand-details-popup';

// -----------------------------------------------------------------------------
// Fetch helpers
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
    filename,
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
  init?: RequestInit,
) => Response | Promise<Response>;

let fetchResponder: FetchResponder = () => buildFetchResponse();

const fetchSpy = jest.fn((url: RequestInfo | URL, init?: RequestInit) =>
  Promise.resolve(fetchResponder(String(url), init)),
) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let createObjectURLSpy: jest.SpiedFunction<typeof URL.createObjectURL>;
let revokeObjectURLSpy: jest.SpiedFunction<typeof URL.revokeObjectURL>;
let anchorClickSpy: jest.SpiedFunction<HTMLAnchorElement['click']>;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = fetchSpy as unknown as typeof fetch;
  fetchResponder = () => buildFetchResponse();
  fetchSpy.mockClear();

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
  anchorClickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  global.fetch = originalFetch as typeof fetch;
  createObjectURLSpy?.mockRestore();
  revokeObjectURLSpy?.mockRestore();
  anchorClickSpy?.mockRestore();
  mockToast.mockReset();
});

function withQueryClient(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // DemandDetailsPopup uses queries with no explicit queryFn; provide a
        // default that goes through fetch so we can intercept it.
        queryFn: async ({ queryKey }) => {
          const segments = queryKey
            .map((seg) =>
              typeof seg === 'string' && seg.length > 0 ? seg : null,
            )
            .filter(Boolean) as string[];
          const url = segments.join('/');
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

const managerUser = {
  id: 'mgr-1',
  role: 'manager',
  email: 'mgr@example.com',
  firstName: 'Sam',
  lastName: 'Manager',
};

describe('DemandDetailsPopup — comment attachments', () => {
  it('renders the attachment row with View and Download buttons for a comment with a file', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/demands/demand-1/comments')) {
        return buildFetchResponse({
          json: [
            {
              id: 'c-with-file',
              demandId: 'demand-1',
              commentText: 'See attached invoice',
              commenterId: 'mgr-1',
              isInternal: false,
              createdAt: new Date('2025-01-01T10:00:00Z').toISOString(),
              filePath: '/uploads/demands/invoice-123.pdf',
              fileName: 'invoice-123.pdf',
              fileSize: 24680,
              author: {
                id: 'mgr-1',
                firstName: 'Sam',
                lastName: 'Manager',
                email: 'mgr@example.com',
              },
            },
          ],
        });
      }
      if (url.includes('attachedToType=demand')) {
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
          user={managerUser}
        />,
      ),
    );

    // Attachment row appears for the comment that has a file.
    const row = await screen.findByTestId('comment-attachment-c-with-file');
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent('invoice-123.pdf');
    // 24680 bytes -> 24.1 KB via the formatter in the component.
    expect(row).toHaveTextContent('24.1 KB');

    // View and Download buttons exist for this specific comment.
    const viewBtn = screen.getByTestId('button-view-comment-attachment-c-with-file');
    const downloadBtn = screen.getByTestId(
      'button-download-comment-attachment-c-with-file',
    );
    expect(viewBtn).toBeInTheDocument();
    expect(downloadBtn).toBeInTheDocument();
  });

  it('does not render an attachment row for a comment without a file', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/demands/demand-1/comments')) {
        return buildFetchResponse({
          json: [
            {
              id: 'c-plain',
              demandId: 'demand-1',
              commentText: 'No file here',
              commenterId: 'mgr-1',
              isInternal: false,
              createdAt: new Date('2025-01-01T10:00:00Z').toISOString(),
              filePath: null,
              fileName: null,
              fileSize: null,
              author: {
                id: 'mgr-1',
                firstName: 'Sam',
                lastName: 'Manager',
                email: 'mgr@example.com',
              },
            },
          ],
        });
      }
      if (url.includes('attachedToType=demand')) {
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
          user={managerUser}
        />,
      ),
    );

    // Wait for the comment text itself to confirm the comment rendered.
    await screen.findByText('No file here');

    expect(
      screen.queryByTestId('comment-attachment-c-plain'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('button-view-comment-attachment-c-plain'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('button-download-comment-attachment-c-plain'),
    ).not.toBeInTheDocument();
  });

  it('Download button fetches the comment file URL with credentials', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/demands/demand-1/comments')) {
        return buildFetchResponse({
          json: [
            {
              id: 'c-dl',
              demandId: 'demand-1',
              commentText: 'Download me',
              commenterId: 'mgr-1',
              isInternal: false,
              createdAt: new Date('2025-01-01T10:00:00Z').toISOString(),
              filePath: '/uploads/demands/report.pdf',
              fileName: 'report.pdf',
              fileSize: 1024,
              author: {
                id: 'mgr-1',
                firstName: 'Sam',
                lastName: 'Manager',
                email: 'mgr@example.com',
              },
            },
          ],
        });
      }
      if (url.includes('attachedToType=demand')) {
        return buildFetchResponse({ json: [] });
      }
      if (url === '/uploads/demands/report.pdf') {
        return buildFetchResponse({
          blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
        });
      }
      return buildFetchResponse({ json: [] });
    };

    render(
      withQueryClient(
        <DemandDetailsPopup
          demand={baseDemand}
          isOpen
          onClose={jest.fn()}
          user={managerUser}
        />,
      ),
    );

    const downloadBtn = await screen.findByTestId(
      'button-download-comment-attachment-c-dl',
    );

    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(
        ([url, init]) =>
          String(url) === '/uploads/demands/report.pdf' &&
          (init as RequestInit | undefined)?.credentials === 'include' &&
          (init as RequestInit | undefined)?.method === 'GET',
      );
      expect(called).toBe(true);
    });
    expect(anchorClickSpy).toHaveBeenCalled();
  });

  it('View button opens the inline viewer pointed at the comment file URL', async () => {
    fetchResponder = (url) => {
      if (url.includes('/api/demands/demand-1/comments')) {
        return buildFetchResponse({
          json: [
            {
              id: 'c-view',
              demandId: 'demand-1',
              commentText: 'View me',
              commenterId: 'mgr-1',
              isInternal: false,
              createdAt: new Date('2025-01-01T10:00:00Z').toISOString(),
              filePath: '/uploads/demands/preview.pdf',
              fileName: 'preview.pdf',
              fileSize: 2048,
              author: {
                id: 'mgr-1',
                firstName: 'Sam',
                lastName: 'Manager',
                email: 'mgr@example.com',
              },
            },
          ],
        });
      }
      if (url.includes('attachedToType=demand')) {
        return buildFetchResponse({ json: [] });
      }
      // The DocumentInlineViewer fetches the file URL itself when it mounts.
      if (url === '/uploads/demands/preview.pdf') {
        return buildFetchResponse({
          blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
        });
      }
      return buildFetchResponse({ json: [] });
    };

    render(
      withQueryClient(
        <DemandDetailsPopup
          demand={baseDemand}
          isOpen
          onClose={jest.fn()}
          user={managerUser}
        />,
      ),
    );

    const viewBtn = await screen.findByTestId(
      'button-view-comment-attachment-c-view',
    );

    await act(async () => {
      fireEvent.click(viewBtn);
    });

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(
        ([url, init]) =>
          String(url) === '/uploads/demands/preview.pdf' &&
          (init as RequestInit | undefined)?.credentials === 'include',
      );
      expect(called).toBe(true);
    });

    // Inline viewer mounts an iframe rather than calling window.open.
    const iframe = (await screen.findByTestId(
      'iframe-inline-viewer',
    )) as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toBe('blob:mock-url');
  });
});
