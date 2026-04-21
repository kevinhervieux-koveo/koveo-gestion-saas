/**
 * Task #171 — InvitationManagement "View history" dialog.
 *
 * Verifies the new per-row "View history" button:
 *   - is rendered for each pending invitation row,
 *   - opens a dialog that calls GET /api/invitations/:id/history,
 *   - renders the audit-log rows it gets back (action, status transition,
 *     performer, source, timestamp),
 *   - shows the empty-state message when the endpoint returns no items,
 *   - shows an error message when the endpoint fails.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvitationManagement } from '@/components/InvitationManagement';
import { apiRequest } from '@/lib/queryClient';

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        pendingInvitations: 'Pending Invitations',
        managePendingInvitations: 'Manage pending invitations',
        loadingInvitations: 'Loading invitations...',
        noInvitationsFound: 'No pending invitations found',
        email: 'Email',
        role: 'Role',
        organization: 'Organization',
        building: 'Building',
        residence: 'Residence',
        expires: 'Expires',
        status: 'Status',
        actions: 'Actions',
        unit: 'Unit',
        expired: 'Expired',
        pending: 'Pending',
        deleteInvitation: 'Delete Invitation',
        deleteInvitationConfirm: 'Delete?',
        cancel: 'Cancel',
        invitationDeletedSuccess: 'OK',
        invitationDeletedError: 'KO',
        viewInvitationHistory: 'View history',
        invitationHistory: 'Invitation history',
        invitationHistoryDescription: 'Lifecycle events for {email}',
        invitationHistoryEmpty: 'No history yet for this invitation.',
        invitationHistoryLoadError: 'Failed to load invitation history',
        invitationHistoryAction: 'Action',
        invitationHistoryPerformedBy: 'Performed by',
        invitationHistoryWhen: 'When',
        invitationHistoryStatusChange: 'Status change',
        invitationHistorySource: 'Source',
        invitationHistorySystem: 'System',
      };
      return translations[key] || key;
    },
    language: 'en',
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const invitation = {
  id: 'inv-1',
  email: 'jane@example.com',
  role: 'manager',
  status: 'pending',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  organizationId: 'org-1',
  buildingId: null,
  residenceId: null,
  organizationName: 'Acme',
  invitedByName: 'Bob Boss',
};

const historyPage = {
  items: [
    {
      id: 'a1',
      invitationId: 'inv-1',
      action: 'create',
      previousStatus: null,
      newStatus: 'pending',
      performedBy: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      details: { source: 'rest' },
      createdAt: new Date('2026-04-19T10:00:00Z').toISOString(),
      performedByName: 'Bob Boss',
      performedByEmail: 'bob@example.com',
    },
    {
      id: 'a2',
      invitationId: 'inv-1',
      action: 'resend',
      previousStatus: 'pending',
      newStatus: 'pending',
      performedBy: null,
      ipAddress: null,
      userAgent: null,
      details: { source: 'mcp' },
      createdAt: new Date('2026-04-20T10:00:00Z').toISOString(),
      performedByName: null,
      performedByEmail: null,
    },
  ],
  total: 2,
  limit: 25,
  offset: 0,
  hasMore: false,
};

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <InvitationManagement />
    </QueryClientProvider>,
  );
}

function jsonResponse(payload: unknown): Response {
  return {
    json: async () => payload,
  } as unknown as Response;
}

describe('InvitationManagement — View history dialog', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  it('renders a "View history" button for each invitation row', async () => {
    mockApiRequest.mockImplementation(async (_method, url) => {
      if (url === '/api/invitations/pending') {
        return jsonResponse([invitation]);
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    renderWithClient();

    await waitFor(() =>
      expect(screen.getByTestId('button-view-history-inv-1')).toBeInTheDocument(),
    );
  });

  it('fetches and renders the audit log when the button is clicked', async () => {
    mockApiRequest.mockImplementation(async (_method, url) => {
      if (url === '/api/invitations/pending') {
        return jsonResponse([invitation]);
      }
      if (url === '/api/invitations/inv-1/history') {
        return jsonResponse(historyPage);
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    renderWithClient();

    fireEvent.click(await screen.findByTestId('button-view-history-inv-1'));

    await waitFor(() =>
      expect(screen.getByTestId('invitation-history-row-a1')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('invitation-history-row-a2')).toBeInTheDocument();
    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('resend')).toBeInTheDocument();
    // status transition is rendered
    expect(screen.getByText(/pending\s*→\s*pending/)).toBeInTheDocument();
    // performer name is rendered for the row that has one
    expect(screen.getByText('Bob Boss')).toBeInTheDocument();
    // and falls back to "System" when there is no performer
    expect(screen.getByText('System')).toBeInTheDocument();
    // sources are surfaced as badges
    expect(screen.getByText('rest')).toBeInTheDocument();
    expect(screen.getByText('mcp')).toBeInTheDocument();
    // and the dialog calls the right endpoint
    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/invitations/inv-1/history');
  });

  it('shows the empty state when there is no history yet', async () => {
    mockApiRequest.mockImplementation(async (_method, url) => {
      if (url === '/api/invitations/pending') {
        return jsonResponse([invitation]);
      }
      if (url === '/api/invitations/inv-1/history') {
        return jsonResponse({ items: [], total: 0, limit: 25, offset: 0, hasMore: false });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    renderWithClient();

    fireEvent.click(await screen.findByTestId('button-view-history-inv-1'));

    await waitFor(() =>
      expect(screen.getByTestId('invitation-history-empty')).toBeInTheDocument(),
    );
  });

  it('surfaces an error message when the history endpoint fails', async () => {
    mockApiRequest.mockImplementation(async (_method, url) => {
      if (url === '/api/invitations/pending') {
        return jsonResponse([invitation]);
      }
      if (url === '/api/invitations/inv-1/history') {
        throw new Error('boom');
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    renderWithClient();

    fireEvent.click(await screen.findByTestId('button-view-history-inv-1'));

    await waitFor(() =>
      expect(screen.getByTestId('invitation-history-error')).toBeInTheDocument(),
    );
  });
});
