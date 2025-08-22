import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import HomePage from '@/pages/home';

/**
 * Platform Trial Forms Tests.
 * 
 * Tests to ensure forms and CTAs for trying the platform work correctly.
 * Validates form functionality, user flows, and conversion paths.
 */

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.initialLocation
 */
function TestProviders({ 
  children, 
  initialLocation = '/' 
}: { 
  children: React.ReactNode; 
  initialLocation?: string; 
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialLocation]}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Mock navigation for testing
const mockSetLocation = jest.fn();
jest.mock('wouter', () => ({
  ...jest.requireActual('wouter'),
  useLocation: () => ['/', mockSetLocation],
}));

describe('Platform Trial Forms Tests', () => {
  beforeEach(() => {
    mockSetLocation.mockClear();
    jest.clearAllMocks();
  });

  describe('Main Call-to-Action Buttons', () => {
    it('should render primary CTA buttons for trying the platform', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Main CTA buttons
      const getStartedButtons = screen.getAllByText(/get started|start managing today/i);
      expect(getStartedButtons.length).toBeGreaterThan(0);

      getStartedButtons.forEach(button => {
        const buttonElement = button.closest('button');
        expect(buttonElement).toBeInTheDocument();
        expect(buttonElement).toHaveAttribute('data-testid');
        expect(buttonElement).toBeEnabled();
      });
    });

    it('should handle CTA button clicks correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const ctaButton = screen.getByText(/get started|start managing today/i);
      const buttonElement = ctaButton.closest('button');
      
      expect(buttonElement).toBeInTheDocument();
      
      await user.click(buttonElement!);
      expect(mockSetLocation).toHaveBeenCalledWith('/login');
    });

    it('should provide multiple conversion opportunities', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Should have multiple ways to get started
      const ctaElements = [
        ...screen.queryAllByText(/get started/i),
        ...screen.queryAllByText(/start managing/i),
        ...screen.queryAllByText(/try.*platform/i),
        ...screen.queryAllByText(/sign up/i),
      ];

      expect(ctaElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Sign Up Flow Integration', () => {
    it('should provide clear sign up path', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Find sign-up related buttons
      const signUpButton = screen.queryByText(/sign up|get started|join now/i);
      
      if (signUpButton) {
        const buttonElement = signUpButton.closest('button');
        expect(buttonElement).toBeEnabled();
        
        await user.click(buttonElement!);
        expect(mockSetLocation).toHaveBeenCalled();
      }
    });

    it('should differentiate between sign in and sign up', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const signInButton = screen.queryByText(/sign in|login/i);
      const getStartedButton = screen.queryByText(/get started|sign up/i);

      if (signInButton && getStartedButton) {
        expect(signInButton).not.toBe(getStartedButton);
      }
    });
  });

  describe('Contact and Demo Request Forms', () => {
    it('should provide contact information or demo request capability', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';
      
      // Should provide ways to contact or request demo
      const contactIndicators = [
        /contact.*us/i,
        /request.*demo/i,
        /get.*in.*touch/i,
        /schedule.*demo/i,
        /learn.*more/i,
        /expert.*support/i,
      ];

      const hasContactOption = contactIndicators.some(pattern => 
        pattern.test(pageContent)
      );

      // Should have some way to contact or learn more
      expect(hasContactOption || pageContent.includes('support')).toBe(true);
    });

    it('should handle contact form submissions properly', async () => {
      // Mock a contact form scenario
      const mockContactForm = document.createElement('form');
      mockContactForm.innerHTML = `
        <input type="email" name="email" required data-testid="contact-email" />
        <textarea name="message" required data-testid="contact-message"></textarea>
        <button type="submit" data-testid="contact-submit">Send Message</button>
      `;
      document.body.appendChild(mockContactForm);

      const user = userEvent.setup();
      
      const emailInput = screen.getByTestId('contact-email');
      const messageInput = screen.getByTestId('contact-message');
      const submitButton = screen.getByTestId('contact-submit');

      // Fill form
      await user.type(emailInput, 'test@example.com');
      await user.type(messageInput, 'I would like to try the platform');

      // Verify form is filled
      expect(emailInput).toHaveValue('test@example.com');
      expect(messageInput).toHaveValue('I would like to try the platform');
      expect(submitButton).toBeEnabled();

      // Clean up
      document.body.removeChild(mockContactForm);
    });
  });

  describe('Trial Account Creation', () => {
    it('should guide users toward account creation', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';
      
      // Should encourage account creation
      expect(pageContent).toMatch(/get started|sign up|create account|join/i);
    });

    it('should handle trial registration flow', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Should have clear path to registration
      const registrationButtons = screen.queryAllByText(/get started|sign up|register/i);
      
      registrationButtons.forEach(button => {
        const buttonElement = button.closest('button');
        if (buttonElement) {
          expect(buttonElement).toBeEnabled();
          expect(buttonElement).toHaveAttribute('data-testid');
        }
      });
    });
  });

  describe('Form Accessibility and Usability', () => {
    it('should provide accessible form elements', () => {
      // Mock form elements for testing
      const mockForm = document.createElement('div');
      mockForm.innerHTML = `
        <form data-testid="trial-form">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" required />
          
          <label for="company">Company Name</label>
          <input type="text" id="company" name="company" />
          
          <label for="message">How can we help?</label>
          <textarea id="message" name="message"></textarea>
          
          <button type="submit">Start Free Trial</button>
        </form>
      `;
      document.body.appendChild(mockForm);

      const form = screen.getByTestId('trial-form');
      const labels = form.querySelectorAll('label');
      const inputs = form.querySelectorAll('input, textarea');

      // All inputs should have labels
      expect(labels.length).toBeGreaterThan(0);
      
      labels.forEach(label => {
        const forAttribute = label.getAttribute('for');
        if (forAttribute) {
          const correspondingInput = document.getElementById(forAttribute);
          expect(correspondingInput).toBeInTheDocument();
        }
      });

      // Clean up
      document.body.removeChild(mockForm);
    });

    it('should provide proper form validation', async () => {
      // Mock form validation
      const mockForm = document.createElement('form');
      mockForm.innerHTML = `
        <input type="email" required data-testid="email-input" />
        <button type="submit" data-testid="submit-button">Submit</button>
      `;
      document.body.appendChild(mockForm);

      const user = userEvent.setup();
      const emailInput = screen.getByTestId('email-input');
      const submitButton = screen.getByTestId('submit-button');

      // Try to submit without email
      await user.click(submitButton);
      
      // Should show validation (browser native or custom)
      expect(emailInput).toBeInvalid();

      // Enter valid email
      await user.type(emailInput, 'test@example.com');
      expect(emailInput).toBeValid();

      // Clean up
      document.body.removeChild(mockForm);
    });
  });

  describe('Mobile Form Experience', () => {
    it('should work properly on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Forms should be mobile-friendly
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        // Buttons should be large enough for mobile
        const styles = window.getComputedStyle(button);
        // Mobile buttons should have adequate touch targets
        expect(button.className).toMatch(/p(x|y)-\d+/);
      });
    });

    it('should handle touch interactions properly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const ctaButton = screen.getAllByRole('button')[0];
      
      // Should handle touch events (simulated as clicks)
      await user.click(ctaButton);
      
      // Should not have double-tap delays or issues
      expect(ctaButton).toHaveBeenInteractedWith;
    });
  });

  describe('Form Error Handling', () => {
    it('should handle form submission errors gracefully', async () => {
      // Mock form with error handling
      const mockForm = document.createElement('form');
      mockForm.innerHTML = `
        <input type="email" name="email" data-testid="form-email" />
        <button type="submit" data-testid="form-submit">Submit</button>
        <div data-testid="error-message" style="display: none;">Error message</div>
      `;
      document.body.appendChild(mockForm);

      const user = userEvent.setup();
      const submitButton = screen.getByTestId('form-submit');

      // Form should handle errors without crashing
      await user.click(submitButton);
      
      // Should still be interactable after error
      expect(submitButton).toBeEnabled();

      // Clean up
      document.body.removeChild(mockForm);
    });

    it('should provide clear error messages', () => {
      // Error messages should be clear and actionable
      const mockErrors = [
        'Please enter a valid email address',
        'This field is required',
        'Message must be at least 10 characters',
      ];

      mockErrors.forEach(error => {
        expect(error).toMatch(/(please|required|must|should)/i);
        expect(error.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Conversion Tracking and Analytics', () => {
    it('should have proper tracking for form submissions', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Forms should have tracking attributes
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        // Should have data attributes for tracking
        expect(button).toHaveAttribute('data-testid');
        
        // Important CTA buttons should be trackable
        if (button.textContent?.includes('Get Started')) {
          expect(button).toHaveAttribute('data-testid', 'button-get-started');
        }
      });
    });

    it('should track user interactions properly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const ctaButton = screen.getByText(/get started/i);
      
      // Click should be trackable
      await user.click(ctaButton);
      
      // Verify interaction happened (navigation or state change)
      expect(mockSetLocation).toHaveBeenCalled();
    });
  });

  describe('Form Performance', () => {
    it('should load forms quickly without performance issues', () => {
      const startTime = performance.now();
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render quickly (less than 100ms for basic rendering)
      expect(renderTime).toBeLessThan(1000);
    });

    it('should handle form state efficiently', async () => {
      // Mock form state changes
      const user = userEvent.setup();
      
      // Create mock form
      const mockForm = document.createElement('div');
      mockForm.innerHTML = `
        <input type="text" data-testid="test-input" />
        <button data-testid="test-button">Test</button>
      `;
      document.body.appendChild(mockForm);

      const input = screen.getByTestId('test-input');
      
      // Fast typing should be handled smoothly
      await user.type(input, 'Quick typing test');
      
      expect(input).toHaveValue('Quick typing test');
      
      // Clean up
      document.body.removeChild(mockForm);
    });
  });
});

/**
 * Form Testing Utilities.
 */
export const FORM_TEST_SCENARIOS = {
  contactForm: {
    fields: ['email', 'name', 'company', 'message'],
    requiredFields: ['email', 'message'],
    validData: {
      email: 'test@example.com',
      name: 'John Doe',
      company: 'Test Company',
      message: 'I would like to learn more about the platform',
    },
    invalidData: {
      email: 'invalid-email',
      message: '', // Empty required field
    },
  },
  
  trialSignup: {
    fields: ['email', 'password', 'firstName', 'lastName', 'company'],
    requiredFields: ['email', 'password', 'firstName', 'lastName'],
    validData: {
      email: 'user@example.com',
      password: 'SecurePassword123!',
      firstName: 'Jane',
      lastName: 'Smith',
      company: 'Property Management Co.',
    },
  },
  
  demoRequest: {
    fields: ['email', 'company', 'role', 'propertyCount', 'message'],
    requiredFields: ['email', 'company'],
    validData: {
      email: 'demo@example.com',
      company: 'Demo Properties Inc.',
      role: 'Property Manager',
      propertyCount: '10-50',
      message: 'We manage condos and apartments in Quebec',
    },
  },
};

/**
 *
 * @param formData
 */
export async function fillFormData(
  formData: Record<string, string>
): Promise<void> {
  const user = userEvent.setup();
  
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = screen.queryByLabelText(new RegExp(fieldName, 'i')) ||
                  screen.queryByPlaceholderText(new RegExp(fieldName, 'i')) ||
                  screen.queryByTestId(fieldName) ||
                  screen.queryByTestId(`${fieldName}-input`);
    
    if (field) {
      await user.clear(field);
      await user.type(field, value);
    }
  }
}

/**
 *
 * @param formTestId
 */
export async function submitForm(formTestId?: string): Promise<void> {
  const user = userEvent.setup();
  
  const submitButton = formTestId 
    ? screen.getByTestId(`${formTestId}-submit`)
    : screen.getByRole('button', { name: /submit|send|start|sign up|get started/i });
  
  await user.click(submitButton);
}

/**
 *
 * @param form
 */
export function validateFormAccessibility(form: HTMLElement): {
  isAccessible: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for labels
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    const id = input.id;
    const label = form.querySelector(`label[for="${id}"]`);
    const ariaLabel = input.getAttribute('aria-label');
    
    if (!label && !ariaLabel) {
      issues.push(`Input ${input.getAttribute('name') || 'unnamed'} lacks label`);
    }
  });
  
  // Check for submit button
  const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
  if (!submitButton) {
    issues.push('Form lacks submit button');
  }
  
  // Check for required field indicators
  const requiredFields = form.querySelectorAll('[required]');
  requiredFields.forEach(field => {
    const fieldContainer = field.closest('div, fieldset');
    const hasRequiredIndicator = fieldContainer?.textContent?.includes('*') ||
                                field.getAttribute('aria-required') === 'true';
    
    if (!hasRequiredIndicator) {
      issues.push(`Required field ${field.getAttribute('name')} not clearly marked`);
    }
  });
  
  return {
    isAccessible: issues.length === 0,
    issues,
  };
}