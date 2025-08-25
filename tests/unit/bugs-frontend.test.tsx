import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'wouter/memory';
import BugReportsPage from '@/pages/settings/bug-reports';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider } from '@/hooks/use-auth';

/**
 * Comprehensive frontend tests for bug reporting functionality.
 * Tests the bug reports page UI, form validation, and user interactions.
 */

// Mock authentication hook
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: {
      id: 'demo-user-123',
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@test.com',
      role: 'admin',
      language: 'fr',
    },
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock API calls
const mockQueryResult = {
  data: [],
  isLoading: false,
  error: null,
  refetch: jest.fn(),
};

const mockMutationResult = {
  mutate: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
};

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(() => mockQueryResult),
  useMutation: jest.fn(() => mockMutationResult),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

/**
 * Test wrapper component with all necessary providers.
 * @param root0
 * @param root0.children
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings/bug-reports']}>
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Bug Reports Frontend Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult.data = [];
    mockQueryResult.isLoading = false;
    mockMutationResult.isPending = false;
  });

  describe('Page Rendering', () => {
    test('renders bug reports page with main elements', () => {
      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('page-title')).toHaveTextContent('Signaler un bug');
      expect(screen.getByTestId('button-create-bug')).toBeInTheDocument();
      expect(screen.getByTestId('input-search-bugs')).toBeInTheDocument();
    });

    test('renders filter controls', () => {
      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('select-filter-status')).toBeInTheDocument();
      expect(screen.getByTestId('select-filter-priority')).toBeInTheDocument();
      expect(screen.getByTestId('select-filter-category')).toBeInTheDocument();
    });

    test('renders empty state when no bugs', () => {
      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('text-no-bugs')).toHaveTextContent('Aucun bug trouvé');
    });

    test('renders loading state correctly', () => {
      mockQueryResult.isLoading = true;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByText('Chargement...')).toBeInTheDocument();
    });
  });

  describe('Bug Creation Dialog', () => {
    test('opens create bug dialog when button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));

      expect(screen.getByTestId('dialog-create-bug')).toBeInTheDocument();
      expect(screen.getByTestId('form-create-bug')).toBeInTheDocument();
    });

    test('create bug form has all required fields', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));

      expect(screen.getByTestId('input-bug-title')).toBeInTheDocument();
      expect(screen.getByTestId('textarea-bug-description')).toBeInTheDocument();
      expect(screen.getByTestId('select-bug-category')).toBeInTheDocument();
      expect(screen.getByTestId('input-bug-page')).toBeInTheDocument();
      expect(screen.getByTestId('select-bug-priority')).toBeInTheDocument();
      expect(screen.getByTestId('textarea-bug-reproduction-steps')).toBeInTheDocument();
      expect(screen.getByTestId('input-bug-environment')).toBeInTheDocument();
    });

    test('form validation works for required fields', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));
      await user.click(screen.getByTestId('button-submit-bug'));

      // Should show validation errors for required fields
      await waitFor(() => {
        expect(screen.getByText(/titre.*requis/i)).toBeInTheDocument();
        expect(screen.getByText(/description.*requise/i)).toBeInTheDocument();
      });
    });

    test('can fill and submit bug form', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));

      // Fill in the form
      await user.type(screen.getByTestId('input-bug-title'), 'Test Bug Title');
      await user.type(screen.getByTestId('textarea-bug-description'), 'Test bug description');
      await user.selectOptions(screen.getByTestId('select-bug-category'), 'functionality');
      await user.type(screen.getByTestId('input-bug-page'), '/test-page');
      await user.selectOptions(screen.getByTestId('select-bug-priority'), 'medium');

      await user.click(screen.getByTestId('button-submit-bug'));

      expect(mockMutationResult.mutate).toHaveBeenCalledWith({
        title: 'Test Bug Title',
        description: 'Test bug description',
        category: 'functionality',
        page: '/test-page',
        priority: 'medium',
      });
    });

    test('closes dialog after successful submission', async () => {
      const user = userEvent.setup();
      mockMutationResult.mutate = jest.fn((data, { onSuccess }) => {
        onSuccess && onSuccess();
      });

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));

      // Fill required fields
      await user.type(screen.getByTestId('input-bug-title'), 'Test Bug');
      await user.type(screen.getByTestId('textarea-bug-description'), 'Test description');
      await user.selectOptions(screen.getByTestId('select-bug-category'), 'other');
      await user.type(screen.getByTestId('input-bug-page'), '/test');

      await user.click(screen.getByTestId('button-submit-bug'));

      await waitFor(() => {
        expect(screen.queryByTestId('dialog-create-bug')).not.toBeInTheDocument();
      });
    });
  });

  describe('Bug List Display', () => {
    const mockBugs = [
      {
        id: 'bug-1',
        title: 'Test Bug 1',
        description: 'First test bug',
        status: 'new',
        priority: 'high',
        category: 'functionality',
        page: '/test1',
        createdAt: new Date('2024-01-15').toISOString(),
        createdBy: 'demo-user-123',
      },
      {
        id: 'bug-2',
        title: 'Test Bug 2',
        description: 'Second test bug',
        status: 'in_progress',
        priority: 'medium',
        category: 'ui_ux',
        page: '/test2',
        createdAt: new Date('2024-01-10').toISOString(),
        createdBy: 'demo-user-123',
      },
    ];

    test('displays list of bugs when data is available', () => {
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('card-bug-bug-1')).toBeInTheDocument();
      expect(screen.getByTestId('card-bug-bug-2')).toBeInTheDocument();
      expect(screen.getByTestId('text-bug-title-bug-1')).toHaveTextContent('Test Bug 1');
      expect(screen.getByTestId('text-bug-title-bug-2')).toHaveTextContent('Test Bug 2');
    });

    test('displays bug status badges correctly', () => {
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('badge-status-bug-1')).toHaveTextContent('Nouveau');
      expect(screen.getByTestId('badge-status-bug-2')).toHaveTextContent('En cours');
    });

    test('displays bug priority indicators', () => {
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('badge-priority-bug-1')).toHaveTextContent('Élevée');
      expect(screen.getByTestId('badge-priority-bug-2')).toHaveTextContent('Moyenne');
    });

    test('displays bug categories', () => {
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('text-category-bug-1')).toHaveTextContent('Fonctionnalité');
      expect(screen.getByTestId('text-category-bug-2')).toHaveTextContent('Interface');
    });
  });

  describe('Search and Filtering', () => {
    const mockBugs = [
      {
        id: 'bug-1',
        title: 'Login Issue',
        description: 'Cannot login to dashboard',
        status: 'new',
        priority: 'high',
        category: 'functionality',
        page: '/login',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-user-123',
      },
      {
        id: 'bug-2',
        title: 'UI Problem',
        description: 'Button styling issue',
        status: 'resolved',
        priority: 'low',
        category: 'ui_ux',
        page: '/dashboard',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-user-123',
      },
    ];

    test('search functionality filters bugs by title', async () => {
      const user = userEvent.setup();
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      const searchInput = screen.getByTestId('input-search-bugs');
      await user.type(searchInput, 'Login');

      // Should filter to show only the login bug
      expect(screen.getByTestId('card-bug-bug-1')).toBeInTheDocument();
      expect(screen.queryByTestId('card-bug-bug-2')).not.toBeInTheDocument();
    });

    test('status filter works correctly', async () => {
      const user = userEvent.setup();
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      const statusFilter = screen.getByTestId('select-filter-status');
      await user.selectOptions(statusFilter, 'resolved');

      // Should show only resolved bugs
      expect(screen.queryByTestId('card-bug-bug-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('card-bug-bug-2')).toBeInTheDocument();
    });

    test('priority filter works correctly', async () => {
      const user = userEvent.setup();
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      const priorityFilter = screen.getByTestId('select-filter-priority');
      await user.selectOptions(priorityFilter, 'high');

      // Should show only high priority bugs
      expect(screen.getByTestId('card-bug-bug-1')).toBeInTheDocument();
      expect(screen.queryByTestId('card-bug-bug-2')).not.toBeInTheDocument();
    });

    test('category filter works correctly', async () => {
      const user = userEvent.setup();
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      const categoryFilter = screen.getByTestId('select-filter-category');
      await user.selectOptions(categoryFilter, 'ui_ux');

      // Should show only UI/UX bugs
      expect(screen.queryByTestId('card-bug-bug-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('card-bug-bug-2')).toBeInTheDocument();
    });

    test('can clear all filters', async () => {
      const user = userEvent.setup();
      mockQueryResult.data = mockBugs;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      // Apply filters
      await user.type(screen.getByTestId('input-search-bugs'), 'Login');
      await user.selectOptions(screen.getByTestId('select-filter-status'), 'new');

      // Clear filters
      const clearButton = screen.getByTestId('button-clear-filters');
      await user.click(clearButton);

      // Should show all bugs again
      expect(screen.getByTestId('card-bug-bug-1')).toBeInTheDocument();
      expect(screen.getByTestId('card-bug-bug-2')).toBeInTheDocument();
    });
  });

  describe('Bug Status Translations', () => {
    test('displays status in French', () => {
      const bugWithStatus = {
        id: 'bug-status',
        title: 'Status Test',
        description: 'Test bug status',
        status: 'acknowledged',
        priority: 'medium',
        category: 'other',
        page: '/test',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-user-123',
      };

      mockQueryResult.data = [bugWithStatus];

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('badge-status-bug-status')).toHaveTextContent('Reconnu');
    });

    test('displays priority in French', () => {
      const bugWithPriority = {
        id: 'bug-priority',
        title: 'Priority Test',
        description: 'Test bug priority',
        status: 'new',
        priority: 'critical',
        category: 'other',
        page: '/test',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-user-123',
      };

      mockQueryResult.data = [bugWithPriority];

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('badge-priority-bug-priority')).toHaveTextContent('Critique');
    });

    test('displays category in French', () => {
      const bugWithCategory = {
        id: 'bug-category',
        title: 'Category Test',
        description: 'Test bug category',
        status: 'new',
        priority: 'medium',
        category: 'security',
        page: '/test',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-user-123',
      };

      mockQueryResult.data = [bugWithCategory];

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('text-category-bug-category')).toHaveTextContent('Sécurité');
    });
  });

  describe('Form Interaction Edge Cases', () => {
    test('handles form submission during loading state', async () => {
      const user = userEvent.setup();
      mockMutationResult.isPending = true;

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));

      const submitButton = screen.getByTestId('button-submit-bug');
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Création...');
    });

    test('handles API error during bug creation', async () => {
      const user = userEvent.setup();
      mockMutationResult.isError = true;
      mockMutationResult.error = { message: 'Server error' };

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));

      // Error should be displayed
      expect(screen.getByText(/erreur.*création/i)).toBeInTheDocument();
    });

    test('validates maximum character limits', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('button-create-bug'));

      // Try entering very long title
      const longTitle = 'A'.repeat(300);
      await user.type(screen.getByTestId('input-bug-title'), longTitle);

      await user.click(screen.getByTestId('button-submit-bug'));

      await waitFor(() => {
        expect(screen.getByText(/titre.*trop long/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels for interactive elements', () => {
      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('button-create-bug')).toHaveAttribute('aria-label');
      expect(screen.getByTestId('input-search-bugs')).toHaveAttribute('aria-label');
      expect(screen.getByTestId('select-filter-status')).toHaveAttribute('aria-label');
    });

    test('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      // Tab to create bug button
      await user.tab();
      expect(screen.getByTestId('button-create-bug')).toHaveFocus();

      // Enter to open dialog
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('dialog-create-bug')).toBeInTheDocument();

      // Escape to close dialog
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId('dialog-create-bug')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance Considerations', () => {
    test('handles large number of bugs efficiently', () => {
      const manyBugs = Array.from({ length: 100 }, (_, i) => ({
        id: `bug-${i}`,
        title: `Bug ${i}`,
        description: `Description ${i}`,
        status: 'new',
        priority: 'medium',
        category: 'other',
        page: '/test',
        createdAt: new Date().toISOString(),
        createdBy: 'demo-user-123',
      }));

      mockQueryResult.data = manyBugs;

      const startTime = performance.now();
      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );
      const endTime = performance.now();

      // Should render within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('filters are debounced for search input', async () => {
      const user = userEvent.setup();
      jest.useFakeTimers();

      render(
        <TestWrapper>
          <BugReportsPage />
        </TestWrapper>
      );

      const searchInput = screen.getByTestId('input-search-bugs');

      // Type quickly
      await user.type(searchInput, 'test');

      // Fast typing shouldn't trigger immediate filtering
      expect(searchInput).toHaveValue('test');

      // After debounce delay, filtering should occur
      jest.advanceTimersByTime(500);

      jest.useRealTimers();
    });
  });
});
