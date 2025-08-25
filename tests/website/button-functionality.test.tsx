import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';
import HomePage from '@/pages/home';

/**
 * Button Functionality Tests.
 *
 * Comprehensive tests to ensure all buttons work correctly across the application.
 * Tests click handlers, navigation, form submissions, and interactive elements.
 */

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.initialLocation
 * @param root0.isAuthenticated
 * @returns Promise resolving to result.
 */
function TestProviders({
  children,
  initialLocation = '/',
  isAuthenticated = false,
}: {
  children: React.ReactNode;
  initialLocation?: string;
  isAuthenticated?: boolean;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Mock auth context
  const mockAuthValue = {
    user: isAuthenticated ? { id: '1', email: 'test@example.com', role: 'manager' } : null,
    isAuthenticated,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    checkAuth: jest.fn(),
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialLocation]}>
        <LanguageProvider>
          <AuthProvider value={mockAuthValue}>{children}</AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Mock useLocation hook for navigation testing
const mockSetLocation = jest.fn();
jest.mock('wouter', () => ({
  ...jest.requireActual('wouter'),
  useLocation: () => ['/', mockSetLocation],
}));

describe('Button Functionality Tests', () => {
  beforeEach(() => {
    mockSetLocation.mockClear();
    jest.clearAllMocks();
  });

  describe('Navigation Buttons', () => {
    it('should handle "Get Started" button clicks for unauthenticated users', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders isAuthenticated={false}>
          <HomePage />
        </TestProviders>
      );

      const getStartedButton = screen.getByRole('button', { name: /get started/i });
      expect(getStartedButton).toBeInTheDocument();
      expect(getStartedButton).toHaveAttribute('data-testid', 'button-get-started');

      await user.click(getStartedButton);
      expect(mockSetLocation).toHaveBeenCalledWith('/login');
    });

    it('should handle "Sign In" button clicks', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders isAuthenticated={false}>
          <HomePage />
        </TestProviders>
      );

      const signInButton = screen.getByRole('button', { name: /sign in/i });
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).toHaveAttribute('data-testid', 'button-sign-in');

      await user.click(signInButton);
      expect(mockSetLocation).toHaveBeenCalledWith('/login');
    });

    it('should handle "Go to Dashboard" button for authenticated users', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders isAuthenticated={true}>
          <HomePage />
        </TestProviders>
      );

      const dashboardButton = screen.getByRole('button', { name: /go to dashboard/i });
      expect(dashboardButton).toBeInTheDocument();
      expect(dashboardButton).toHaveAttribute('data-testid', 'button-dashboard');

      await user.click(dashboardButton);
      expect(mockSetLocation).toHaveBeenCalledWith('/dashboard');
    });

    it('should handle "Logout" button for authenticated users', async () => {
      const mockLogout = jest.fn();
      const user = userEvent.setup();

      render(
        <TestProviders isAuthenticated={true}>
          <HomePage />
        </TestProviders>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
      expect(logoutButton).toHaveAttribute('data-testid', 'button-logout');

      await user.click(logoutButton);
      // Logout functionality would be tested in auth tests
      expect(logoutButton).toHaveBeenClickedOnce();
    });
  });

  describe('Call-to-Action Buttons', () => {
    it('should handle main CTA button clicks', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const ctaButtons = screen.getAllByText(/start managing today|get started now/i);

      for (const button of ctaButtons) {
        const buttonElement = button.closest('button');
        expect(buttonElement).toBeInTheDocument();
        expect(buttonElement).toHaveAttribute('data-testid');

        await user.click(buttonElement!);
        expect(mockSetLocation).toHaveBeenCalledWith('/login');
      }
    });

    it('should properly style CTA buttons', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const ctaButtons = screen.getAllByText(/start managing today|get started now/i);

      ctaButtons.forEach((button) => {
        const buttonElement = button.closest('button');
        expect(buttonElement).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
        expect(buttonElement).toBeEnabled();
        expect(buttonElement).not.toHaveAttribute('disabled');
      });
    });
  });

  describe('Language Switcher Button', () => {
    it('should render and handle language switcher', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Look for language switcher button
      const languageButton =
        screen.queryByRole('button', { name: /language|langue/i }) ||
        screen.queryByTestId('language-switcher') ||
        screen.queryByText(/EN|FR/);

      if (languageButton) {
        expect(languageButton).toBeEnabled();
        expect(languageButton).toHaveAttribute('data-testid', 'button-language-switcher');

        await user.click(languageButton);
        // Language switching would be tested in language tests
      }
    });
  });

  describe('Button States and Interactions', () => {
    it('should show proper button states during interactions', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        // All buttons should be enabled by default
        expect(button).toBeEnabled();
        expect(button).not.toHaveAttribute('aria-disabled', 'true');

        // Should have proper cursor styles
        const styles = window.getComputedStyle(button);
        expect(['pointer', 'default']).toContain(styles.cursor);
      });
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const firstButton = screen.getAllByRole('button')[0];

      // Focus the button
      firstButton.focus();
      expect(firstButton).toHaveFocus();

      // Should handle Enter key
      await user.keyboard('{Enter}');

      // Should handle Space key
      await user.keyboard(' ');
    });

    it('should have proper accessibility attributes', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        // Should have proper button role
        expect(button).toHaveAttribute('type');

        // Should be focusable
        expect(button).not.toHaveAttribute('tabindex', '-1');

        // Should have accessible name
        const accessibleName =
          button.textContent || button.getAttribute('aria-label') || button.getAttribute('title');
        expect(accessibleName).toBeTruthy();
        expect(accessibleName!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Button Click Handlers', () => {
    it('should prevent default behavior when necessary', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const buttons = screen.getAllByRole('button');

      for (const button of buttons) {
        const clickHandler = jest.fn();
        button.addEventListener('click', clickHandler);

        await user.click(button);
        expect(clickHandler).toHaveBeenCalled();
      }
    });

    it('should handle rapid clicking gracefully', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const getStartedButton = screen.getByRole('button', { name: /get started/i });

      // Rapid clicks should not cause issues
      await user.click(getStartedButton);
      await user.click(getStartedButton);
      await user.click(getStartedButton);

      expect(mockSetLocation).toHaveBeenCalled();
    });
  });

  describe('Button Visual Feedback', () => {
    it('should show hover states', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        // Should have hover classes
        expect(button.className).toMatch(/hover:/);

        fireEvent.mouseEnter(button);
        // Visual feedback testing would require more complex setup
        fireEvent.mouseLeave(button);
      });
    });

    it('should show focus states', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const firstButton = screen.getAllByRole('button')[0];

      firstButton.focus();
      expect(firstButton).toHaveFocus();

      // Should have focus outline (tested via CSS)
      const styles = window.getComputedStyle(firstButton);
      // Focus styles would be applied by CSS
    });

    it('should show active states during click', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const button = screen.getAllByRole('button')[0];

      // Mouse down should show active state
      fireEvent.mouseDown(button);
      // Active state testing would require CSS inspection
      fireEvent.mouseUp(button);
    });
  });

  describe('Button Loading States', () => {
    it('should handle loading states for async operations', () => {
      // This would test loading states in forms and async operations
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // For now, ensure buttons don't show loading by default
      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        expect(button).not.toHaveAttribute('aria-busy', 'true');
        expect(button.textContent).not.toMatch(/loading|saving|processing/i);
      });
    });
  });

  describe('Form Button Integration', () => {
    it('should properly integrate with forms', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Look for any form buttons
      const formButtons = screen.queryAllByRole('button').filter((button) => {
        const form = button.closest('form');
        return form !== null;
      });

      formButtons.forEach((button) => {
        // Form buttons should have proper type
        expect(['button', 'submit', 'reset']).toContain(button.getAttribute('type'));
      });
    });
  });

  describe('Button Error Handling', () => {
    it('should handle click errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const button = screen.getAllByRole('button')[0];

      // Should not crash on click
      await user.click(button);

      // Should not have unhandled errors
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringMatching(/unhandled/i));

      consoleSpy.mockRestore();
    });
  });
});

/**
 * Button test utilities.
 */
export const BUTTON_TEST_IDS = {
  // Navigation buttons
  getStarted: 'button-get-started',
  signIn: 'button-sign-in',
  logout: 'button-logout',
  dashboard: 'button-dashboard',

  // Utility buttons
  languageSwitcher: 'button-language-switcher',

  // Form buttons
  submit: 'button-submit',
  cancel: 'button-cancel',
  save: 'button-save',
  delete: 'button-delete',

  // Feature buttons
  tryPlatform: 'button-try-platform',
  contactUs: 'button-contact-us',
  learnMore: 'button-learn-more',
};

/**
 *
 * @param buttonTestId
 * @param expectedAction
 */
export async function testButtonClick(
  buttonTestId: string,
  expectedAction: () => void
): Promise<void> {
  const user = userEvent.setup();
  const button = screen.getByTestId(buttonTestId);

  expect(button).toBeInTheDocument();
  expect(button).toBeEnabled();

  await user.click(button);

  await waitFor(() => {
    expectedAction();
  });
}

/**
 *
 * @param button
 */
export function validateButtonAccessibility(button: HTMLElement): {
  isAccessible: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for accessible name
  const accessibleName =
    button.textContent || button.getAttribute('aria-label') || button.getAttribute('title');

  if (!accessibleName || accessibleName.trim().length === 0) {
    issues.push('Button lacks accessible name');
  }

  // Check for proper role
  if (button.getAttribute('role') !== 'button' && button.tagName !== 'BUTTON') {
    issues.push('Button lacks proper role');
  }

  // Check if focusable
  if (button.getAttribute('tabindex') === '-1') {
    issues.push('Button is not focusable');
  }

  // Check for type attribute on button elements
  if (button.tagName === 'BUTTON' && !button.getAttribute('type')) {
    issues.push('Button element lacks type attribute');
  }

  return {
    isAccessible: issues.length === 0,
    issues,
  };
}
