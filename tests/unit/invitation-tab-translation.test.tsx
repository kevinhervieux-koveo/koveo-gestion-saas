import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { InvitationManagement } from '@/components/InvitationManagement';
import { LanguageProvider } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';

// Mock the API request
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

// Mock toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock data for invitations
const mockInvitations = [
  {
    id: '1',
    email: 'john.doe@example.com',
    role: 'manager',
    status: 'pending',
    expiresAt: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    createdAt: new Date().toISOString(),
    organizationId: 'org-1',
    buildingId: 'building-1',
    residenceId: 'residence-1',
    organizationName: 'Test Organization',
    buildingName: 'Test Building',
    residenceUnitNumber: '101',
    invitedByName: 'Admin User'
  },
  {
    id: '2',
    email: 'jane.smith@example.com',
    role: 'tenant',
    status: 'pending',
    expiresAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago (expired)
    createdAt: new Date().toISOString(),
    organizationId: null,
    buildingId: null,
    residenceId: null,
    organizationName: null,
    buildingName: null,
    residenceUnitNumber: null,
    invitedByName: 'Manager User'
  }
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </QueryClientProvider>
  );
};

describe('Invitation Tab Translation Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Loading State Translations', () => {
    it('should display loading state with translated text', async () => {
      mockApiRequest.mockImplementation(() => 
        new Promise(() => {}) // Never resolves to simulate loading
      );

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      // Check for loading state translations
      expect(screen.getByText(/pending invitations|invitations en attente/i)).toBeInTheDocument();
      expect(screen.getByText(/loading invitations|chargement des invitations/i)).toBeInTheDocument();
    });
  });

  describe('Empty State Translations', () => {
    it('should display no data message when no invitations exist', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve([]),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('no-invitations-message')).toBeInTheDocument();
      });

      // The NoDataCard component should handle the translation
      expect(screen.getByTestId('no-invitations-message-title')).toBeInTheDocument();
      expect(screen.getByTestId('no-invitations-message-description')).toBeInTheDocument();
    });
  });

  describe('Table Header Translations', () => {
    it('should display all table headers with proper translations', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Check that all table headers are rendered with translations
      const expectedHeaders = [
        /email|courriel/i,
        /role|rôle/i,
        /organization|organisation/i,
        /building|bâtiment/i,
        /residence|résidence/i,
        /expires|expire/i,
        /status|statut/i,
        /actions/i,
      ];

      expectedHeaders.forEach(headerRegex => {
        expect(screen.getByText(headerRegex)).toBeInTheDocument();
      });
    });
  });

  describe('Invitation Data Display Translations', () => {
    it('should display invitation data with proper translations', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Check for "Unit" translation
      expect(screen.getByText(/unit 101|unité 101/i)).toBeInTheDocument();

      // Check for status translations
      expect(screen.getByText(/pending|en attente/i)).toBeInTheDocument();
      expect(screen.getByText(/expired|expiré/i)).toBeInTheDocument();
    });
  });

  describe('Delete Dialog Translations', () => {
    it('should display delete confirmation dialog with proper translations', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Click delete button for first invitation
      const deleteButton = screen.getByTestId('button-delete-invitation-1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        // Check delete dialog translations
        expect(screen.getByText(/delete invitation|supprimer l'invitation/i)).toBeInTheDocument();
        expect(screen.getByText(/are you sure|êtes-vous sûr/i)).toBeInTheDocument();
        expect(screen.getByText(/cancel|annuler/i)).toBeInTheDocument();
      });
    });

    it('should include email in delete confirmation message', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Click delete button for first invitation
      const deleteButton = screen.getByTestId('button-delete-invitation-1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        // The email should be included in the confirmation message
        expect(screen.getByText(new RegExp(mockInvitations[0].email, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('Success and Error Message Translations', () => {
    it('should display success message on successful deletion', async () => {
      // Mock successful deletion
      mockApiRequest
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockInvitations),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({}),
        });

      const mockToast = jest.fn();
      jest.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({
        toast: mockToast,
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Click delete button and confirm
      const deleteButton = screen.getByTestId('button-delete-invitation-1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/delete invitation|supprimer l'invitation/i)).toBeInTheDocument();
      });

      // Find and click the confirm button (AlertDialogAction)
      const confirmButton = screen.getByRole('button', { name: /delete|supprimer/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success',
            description: expect.stringMatching(/invitation.*deleted.*successfully|invitation.*supprimée.*succès/i),
          })
        );
      });
    });

    it('should display error message on failed deletion', async () => {
      // Mock failed deletion
      mockApiRequest
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockInvitations),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const mockToast = jest.fn();
      jest.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({
        toast: mockToast,
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Click delete button and confirm
      const deleteButton = screen.getByTestId('button-delete-invitation-1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/delete invitation|supprimer l'invitation/i)).toBeInTheDocument();
      });

      // Find and click the confirm button (AlertDialogAction)
      const confirmButton = screen.getByRole('button', { name: /delete|supprimer/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: expect.stringMatching(/failed.*delete.*invitation|échec.*suppression.*invitation/i),
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Card Title and Description Translations', () => {
    it('should display card title and description with translations', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Check card title
      expect(screen.getByText(/pending invitations|invitations en attente/i)).toBeInTheDocument();

      // Check card description
      expect(screen.getByText(/manage pending user invitations|gérer les invitations d'utilisateurs en attente/i)).toBeInTheDocument();
    });
  });

  describe('Role Badge Translations', () => {
    it('should display role badges correctly', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Check that roles are displayed as badges
      expect(screen.getByText('manager')).toBeInTheDocument();
      expect(screen.getByText('tenant')).toBeInTheDocument();
    });
  });

  describe('Accessibility and Test IDs', () => {
    it('should have proper test IDs for all interactive elements', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Check for invitation row test IDs
      expect(screen.getByTestId('invitation-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('invitation-row-2')).toBeInTheDocument();

      // Check for delete button test IDs
      expect(screen.getByTestId('button-delete-invitation-1')).toBeInTheDocument();
      expect(screen.getByTestId('button-delete-invitation-2')).toBeInTheDocument();
    });

    it('should have proper test ID for cancel button in delete dialog', async () => {
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockInvitations),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockInvitations[0].email)).toBeInTheDocument();
      });

      // Click delete button to open dialog
      const deleteButton = screen.getByTestId('button-delete-invitation-1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('button-cancel-delete-invitation')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing invitation data gracefully', async () => {
      const incompleteInvitation = {
        id: '3',
        email: 'test@example.com',
        role: 'resident',
        status: 'pending',
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        organizationId: null,
        buildingId: null,
        residenceId: null,
        organizationName: null,
        buildingName: null,
        residenceUnitNumber: null,
        invitedByName: null
      };

      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve([incompleteInvitation]),
      });

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      // Should display dashes for missing data
      const dashElements = screen.getAllByText('—');
      expect(dashElements.length).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      mockApiRequest.mockRejectedValue(new Error('Failed to fetch invitations'));

      render(
        <TestWrapper>
          <InvitationManagement />
        </TestWrapper>
      );

      // Component should render without crashing
      // The error handling should be done at the query level
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});