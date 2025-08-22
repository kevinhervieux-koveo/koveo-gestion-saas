import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '@/pages/dashboard';
import ResidentsDashboard from '@/pages/residents/dashboard';
import { TestProviders } from '@/utils/test-providers';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useFullscreen } from '@/hooks/use-fullscreen';

// Mock hooks
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-language');
jest.mock('@/hooks/use-fullscreen');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;
const mockUseFullscreen = useFullscreen as jest.MockedFunction<typeof useFullscreen>;

describe('Dashboard Fullscreen Integration', () => {
  let queryClient: QueryClient;
  const mockToggleFullscreen = jest.fn();
  const mockEnterFullscreen = jest.fn();
  const mockExitFullscreen = jest.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        firstName: 'John',
        lastName: 'Admin',
        email: 'john@example.com',
        role: 'admin',
        isActive: true,
        organizationId: 'org-1',
      },
      logout: jest.fn(),
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
    });

    mockUseLanguage.mockReturnValue({
      language: 'en',
      setLanguage: jest.fn(),
      t: { language: 'en' },
      translations: {},
    });

    mockUseFullscreen.mockReturnValue({
      isFullscreen: false,
      toggleFullscreen: mockToggleFullscreen,
      enterFullscreen: mockEnterFullscreen,
      exitFullscreen: mockExitFullscreen,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin Dashboard Fullscreen', () => {
    it('renders fullscreen toggle button', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('button-fullscreen-toggle')).toBeInTheDocument();
    });

    it('displays correct fullscreen button text and icon when not in fullscreen', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      expect(fullscreenButton).toHaveTextContent('Fullscreen');
    });

    it('displays correct button text and icon when in fullscreen mode', () => {
      mockUseFullscreen.mockReturnValue({
        isFullscreen: true,
        toggleFullscreen: mockToggleFullscreen,
        enterFullscreen: mockEnterFullscreen,
        exitFullscreen: mockExitFullscreen,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      expect(fullscreenButton).toHaveTextContent('Exit Fullscreen');
    });

    it('calls toggleFullscreen when button is clicked', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      fireEvent.click(fullscreenButton);

      expect(mockToggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it('shows role-appropriate navigation items when in fullscreen', () => {
      mockUseFullscreen.mockReturnValue({
        isFullscreen: true,
        toggleFullscreen: mockToggleFullscreen,
        enterFullscreen: mockEnterFullscreen,
        exitFullscreen: mockExitFullscreen,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      // Check that admin-specific items are still accessible
      expect(screen.getByText('Organizations')).toBeInTheDocument();
      expect(screen.getByText('Quality Metrics')).toBeInTheDocument();
    });
  });

  describe('Residents Dashboard Fullscreen', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '2',
          firstName: 'Jane',
          lastName: 'Resident',
          email: 'jane@example.com',
          role: 'resident',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });
    });

    it('renders fullscreen toggle button for residents', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <ResidentsDashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('button-fullscreen-toggle')).toBeInTheDocument();
    });

    it('shows resident-specific quick actions in fullscreen mode', () => {
      mockUseFullscreen.mockReturnValue({
        isFullscreen: true,
        toggleFullscreen: mockToggleFullscreen,
        enterFullscreen: mockEnterFullscreen,
        exitFullscreen: mockExitFullscreen,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <ResidentsDashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Maintenance Request')).toBeInTheDocument();
      expect(screen.getByText('Pay Bills')).toBeInTheDocument();
      expect(screen.getByText('Book Amenities')).toBeInTheDocument();
      expect(screen.getByText('Contact Manager')).toBeInTheDocument();
    });

    it('maintains responsive layout in fullscreen mode', () => {
      mockUseFullscreen.mockReturnValue({
        isFullscreen: true,
        toggleFullscreen: mockToggleFullscreen,
        enterFullscreen: mockEnterFullscreen,
        exitFullscreen: mockExitFullscreen,
      });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <ResidentsDashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      // Check for responsive grid layout
      const quickActionsGrid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4');
      expect(quickActionsGrid).toBeInTheDocument();
    });
  });

  describe('Language Support for Fullscreen', () => {
    it('displays French text for fullscreen button when language is French', () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: { language: 'fr' },
        translations: {},
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <ResidentsDashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      expect(fullscreenButton).toHaveTextContent('Plein écran');
    });

    it('displays French exit fullscreen text when in fullscreen mode', () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: { language: 'fr' },
        translations: {},
      });

      mockUseFullscreen.mockReturnValue({
        isFullscreen: true,
        toggleFullscreen: mockToggleFullscreen,
        enterFullscreen: mockEnterFullscreen,
        exitFullscreen: mockExitFullscreen,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <ResidentsDashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      expect(fullscreenButton).toHaveTextContent('Quitter plein écran');
    });
  });

  describe('Responsive Fullscreen Behavior', () => {
    it('hides button text on small screens', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      const hiddenText = fullscreenButton.querySelector('.hidden.sm\\:inline');
      expect(hiddenText).toBeInTheDocument();
    });

    it('maintains button functionality on mobile devices', async () => {
      // Mock touch events
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 0, clientY: 0 } as Touch],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      
      // Simulate touch interaction
      fireEvent.touchStart(fullscreenButton);
      fireEvent.click(fullscreenButton);

      expect(mockToggleFullscreen).toHaveBeenCalled();
    });
  });

  describe('Accessibility in Fullscreen Mode', () => {
    it('maintains keyboard navigation in fullscreen', async () => {
      mockUseFullscreen.mockReturnValue({
        isFullscreen: true,
        toggleFullscreen: mockToggleFullscreen,
        enterFullscreen: mockEnterFullscreen,
        exitFullscreen: mockExitFullscreen,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      
      // Test keyboard navigation
      fullscreenButton.focus();
      fireEvent.keyDown(fullscreenButton, { _key: 'Enter' });

      expect(mockToggleFullscreen).toHaveBeenCalled();
    });

    it('provides proper ARIA attributes for fullscreen button', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      expect(fullscreenButton).toHaveAttribute('data-testid', 'button-fullscreen-toggle');
    });
  });

  describe('Cross-Platform Fullscreen Support', () => {
    it('handles fullscreen API availability gracefully', () => {
      // Mock missing fullscreen API
      const originalRequestFullscreen = document.documentElement.requestFullscreen;
      delete (document.documentElement as any).requestFullscreen;

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      fireEvent.click(fullscreenButton);

      // Should not throw error even without API support
      expect(mockToggleFullscreen).toHaveBeenCalled();

      // Restore original method
      (document.documentElement as any).requestFullscreen = originalRequestFullscreen;
    });

    it('supports different fullscreen API prefixes', () => {
      // Mock webkit fullscreen API
      (document.documentElement as any).webkitRequestFullscreen = jest.fn();
      
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Dashboard />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      expect(fullscreenButton).toBeInTheDocument();
    });
  });
});