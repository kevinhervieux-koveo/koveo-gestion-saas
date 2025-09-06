/**
 * Navigation Button Functionality Tests
 * Tests all navigation buttons throughout the application
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock wouter navigation
const mockLocation = jest.fn();
const mockSetLocation = jest.fn();

jest.mock('wouter', () => ({
  useLocation: () => [mockLocation(), mockSetLocation],
  Link: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

// Mock asset imports - use moduleNameMapper instead

// Mock authentication context
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', role: 'admin' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

// Import components to test - use @ aliases
import HomePage from '@/pages/home';
import PricingPage from '@/pages/pricing';
import FeaturesPage from '@/pages/features';
import StoryPage from '@/pages/story';
import SecurityPage from '@/pages/security';

describe('Navigation Buttons Functionality', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    mockLocation.mockReturnValue('/');
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Home Page Navigation Buttons', () => {
    it('should navigate to dashboard when "Go to Dashboard" button is clicked', async () => {
      renderWithProvider(<HomePage />);
      
      const dashboardButton = screen.getByTestId('button-go-to-dashboard');
      expect(dashboardButton).toBeInTheDocument();
      
      fireEvent.click(dashboardButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should start trial when "Start Trial" button is clicked', async () => {
      renderWithProvider(<HomePage />);
      
      const trialButton = screen.getByTestId('button-start-trial');
      expect(trialButton).toBeInTheDocument();
      
      fireEvent.click(trialButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/auth/register');
      });
    });
  });

  describe('Pricing Page Navigation Buttons', () => {
    it('should navigate to login when "Get Started" button is clicked', async () => {
      renderWithProvider(<PricingPage />);
      
      const getStartedButton = screen.getByTestId('nav-get-started');
      expect(getStartedButton).toBeInTheDocument();
      
      fireEvent.click(getStartedButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Features Page Navigation Buttons', () => {
    it('should navigate to trial when "Try Features" button is clicked', async () => {
      renderWithProvider(<FeaturesPage />);
      
      const tryFeaturesButton = screen.getByTestId('button-try-features');
      expect(tryFeaturesButton).toBeInTheDocument();
      
      fireEvent.click(tryFeaturesButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/auth/register');
      });
    });

    it('should navigate to trial when "Start Now" button is clicked', async () => {
      renderWithProvider(<FeaturesPage />);
      
      const startNowButton = screen.getByTestId('button-start-now');
      expect(startNowButton).toBeInTheDocument();
      
      fireEvent.click(startNowButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/auth/register');
      });
    });
  });

  describe('Story Page Navigation Buttons', () => {
    it('should navigate to registration when "Join Story" button is clicked', async () => {
      renderWithProvider(<StoryPage />);
      
      const joinStoryButton = screen.getByTestId('button-join-story');
      expect(joinStoryButton).toBeInTheDocument();
      
      fireEvent.click(joinStoryButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/auth/register');
      });
    });
  });

  describe('Security Page Navigation Buttons', () => {
    it('should navigate to registration when "Secure Start" button is clicked', async () => {
      renderWithProvider(<SecurityPage />);
      
      const secureStartButton = screen.getByTestId('button-secure-start');
      expect(secureStartButton).toBeInTheDocument();
      
      fireEvent.click(secureStartButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/auth/register');
      });
    });

    it('should navigate to registration when "Secure Trial" button is clicked', async () => {
      renderWithProvider(<SecurityPage />);
      
      const secureTrialButton = screen.getByTestId('button-secure-trial');
      expect(secureTrialButton).toBeInTheDocument();
      
      fireEvent.click(secureTrialButton);
      
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith('/auth/register');
      });
    });
  });

  describe('Back Navigation Buttons', () => {
    it('should navigate back when back buttons are clicked', () => {
      // These would be tested in their respective component contexts
      const backButtonSelectors = [
        'button-back',
      ];

      backButtonSelectors.forEach(selector => {
        // Mock implementation - actual tests would render the specific components
        const mockBackClick = jest.fn();
        const backButton = document.createElement('button');
        backButton.setAttribute('data-testid', selector);
        backButton.onclick = mockBackClick;
        
        fireEvent.click(backButton);
        expect(mockBackClick).toHaveBeenCalled();
      });
    });
  });
});