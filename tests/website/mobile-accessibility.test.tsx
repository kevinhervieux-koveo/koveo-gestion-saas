import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import FeaturesPage from '@/pages/features';
import SecurityPage from '@/pages/security';
import StoryPage from '@/pages/story';
import PrivacyPolicyPage from '@/pages/privacy-policy';
import TermsOfServicePage from '@/pages/terms-of-service';
import HomePage from '@/pages/home';

/**
 * Mobile Accessibility Tests for Koveo Gestion Website.
 *
 * Tests mobile-specific accessibility features including:
 * - Touch target sizes (minimum 44x44px)
 * - Mobile navigation usability
 * - Screen reader compatibility on mobile
 * - Viewport responsiveness
 * - Mobile form accessibility
 * - Focus management on touch devices.
 */

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.initialLocation
 * @returns Function result.
 */
function TestProviders({
  children,
  initialLocation = '/',
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
        <LanguageProvider>{children}</LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Mock window.matchMedia for responsive testing
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    _value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe('Mobile Accessibility Tests', () => {
  beforeEach(() => {
    // Mock mobile viewport
    mockMatchMedia(true);

    // Mock touch support
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      _value: {},
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Touch Target Accessibility', () => {
    const pages = [
      { component: HomePage, name: 'Home', path: '/' },
      { component: FeaturesPage, name: 'Features', path: '/features' },
      { component: SecurityPage, name: 'Security', path: '/security' },
      { component: StoryPage, name: 'Story', path: '/story' },
    ];

    pages.forEach(({ component: PageComponent, name, path }) => {
      it(`should have adequate touch targets on ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        // Get all interactive elements
        const buttons = screen.getAllByRole('button');
        const links = screen.getAllByRole('link');
        const interactiveElements = [...buttons, ...links];

        // Check minimum touch target size (44x44px recommended)
        interactiveElements.forEach((element, _index) => {
          const styles = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();

          // Elements should be large enough for touch interaction
          // Note: In test environment, we check for CSS classes that indicate proper sizing
          const hasProperSizing =
            element.classList.contains('px-') ||
            element.classList.contains('py-') ||
            element.classList.contains('p-') ||
            element.classList.contains('size-') ||
            element.classList.contains('h-') ||
            element.classList.contains('w-');

          expect(hasProperSizing).toBe(true);

          // Should have proper data-testid for touch testing
          expect(element).toHaveAttribute('data-testid');
        });
      });

      it(`should have proper button spacing on mobile for ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        const buttons = screen.getAllByRole('button');

        // Buttons should have proper spacing for mobile touch
        buttons.forEach((button) => {
          const hasSpacing =
            button.classList.toString().includes('space-') ||
            button.classList.toString().includes('gap-') ||
            button.classList.toString().includes('m-') ||
            button.parentElement?.classList.toString().includes('space-') ||
            button.parentElement?.classList.toString().includes('gap-');

          expect(hasSpacing).toBe(true);
        });
      });
    });
  });

  describe('Mobile Navigation Accessibility', () => {
    const pages = [
      { component: HomePage, name: 'Home', path: '/' },
      { component: FeaturesPage, name: 'Features', path: '/features' },
      { component: SecurityPage, name: 'Security', path: '/security' },
      { component: StoryPage, name: 'Story', path: '/story' },
    ];

    pages.forEach(({ component: PageComponent, name, path }) => {
      it(`should have mobile-friendly navigation on ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        // Should have logo as navigation anchor
        const logo = screen.getByTestId('logo-link');
        expect(logo).toBeInTheDocument();
        expect(logo).toHaveAttribute('href');

        // Should have main navigation elements
        const navElements = screen
          .queryAllByRole('link')
          .filter(
            (link) =>
              link.getAttribute('data-testid')?.startsWith('nav-') ||
              link.textContent?.includes('Accueil') ||
              link.textContent?.includes('Fonctionnalités') ||
              link.textContent?.includes('Sécurité') ||
              link.textContent?.includes('Notre histoire')
          );

        expect(navElements.length).toBeGreaterThan(0);
      });

      it(`should support keyboard navigation on mobile for ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        // Get first focusable element
        const buttons = screen.getAllByRole('button');
        const links = screen.getAllByRole('link');
        const focusableElements = [...buttons, ...links];

        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];

          // Should be focusable
          firstElement.focus();
          expect(document.activeElement).toBe(firstElement);

          // Should respond to keyboard events
          fireEvent.keyDown(firstElement, { _key: 'Tab' });
          fireEvent.keyDown(firstElement, { _key: 'Enter' });

          // Should not crash on keyboard interaction
          expect(firstElement).toBeInTheDocument();
        }
      });
    });
  });

  describe('Mobile Screen Reader Compatibility', () => {
    const pages = [
      { component: FeaturesPage, name: 'Features', path: '/features' },
      { component: SecurityPage, name: 'Security', path: '/security' },
      { component: StoryPage, name: 'Story', path: '/story' },
    ];

    pages.forEach(({ component: PageComponent, name, path }) => {
      it(`should have proper headings hierarchy for screen readers on ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        // Should have proper heading structure
        const h1Elements = screen.getAllByRole('heading', { level: 1 });
        const h2Elements = screen.getAllByRole('heading', { level: 2 });

        expect(h1Elements.length).toBeGreaterThanOrEqual(1);
        expect(h2Elements.length).toBeGreaterThanOrEqual(1);

        // H1 should be descriptive
        h1Elements.forEach((h1) => {
          expect(h1.textContent).toBeTruthy();
          expect(h1.textContent!.length).toBeGreaterThan(10);
        });
      });

      it(`should have proper image alt text for screen readers on ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        const images = screen.getAllByRole('img');

        images.forEach((img) => {
          expect(img).toHaveAttribute('alt');

          const altText = img.getAttribute('alt');
          expect(altText).toBeTruthy();
          expect(altText!.length).toBeGreaterThan(0);
        });
      });

      it(`should have proper aria labels for interactive elements on ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        const buttons = screen.getAllByRole('button');

        buttons.forEach((button) => {
          // Should have accessible name (either text content, aria-label, or aria-labelledby)
          const hasAccessibleName =
            button.textContent?.trim() ||
            button.getAttribute('aria-label') ||
            button.getAttribute('aria-labelledby');

          expect(hasAccessibleName).toBeTruthy();
        });
      });
    });
  });

  describe('Mobile Viewport Responsiveness', () => {
    const mobileViewports = [
      { width: 320, height: 568, name: 'iPhone SE' },
      { width: 375, height: 667, name: 'iPhone 8' },
      { width: 414, height: 896, name: 'iPhone 11' },
    ];

    const pages = [
      { component: HomePage, name: 'Home' },
      { component: FeaturesPage, name: 'Features' },
      { component: SecurityPage, name: 'Security' },
    ];

    pages.forEach(({ component: PageComponent, name }) => {
      mobileViewports.forEach(({ width, height, name: deviceName }) => {
        it(`should be responsive on ${deviceName} viewport for ${name} page`, () => {
          // Mock viewport dimensions
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            _value: width,
          });
          Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            _value: height,
          });

          render(
            <TestProviders>
              <PageComponent />
            </TestProviders>
          );

          // Page should render without breaking
          const mainContent = document.body.firstChild;
          expect(mainContent).toBeInTheDocument();

          // Should have responsive classes
          const elementsWithResponsiveClasses = document.querySelectorAll(
            '[class*="sm:"], [class*="md:"], [class*="lg:"], [class*="xl:"]'
          );
          expect(elementsWithResponsiveClasses.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Mobile Text Readability', () => {
    const pages = [
      { component: FeaturesPage, name: 'Features' },
      { component: SecurityPage, name: 'Security' },
      { component: StoryPage, name: 'Story' },
    ];

    pages.forEach(({ component: PageComponent, name }) => {
      it(`should have readable text sizes on mobile for ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Check for responsive text classes
        const textElements = document.querySelectorAll('h1, h2, h3, p, span, div');
        let hasResponsiveText = false;

        textElements.forEach((element) => {
          const classList = element.classList.toString();
          if (
            classList.includes('text-') &&
            (classList.includes('sm:') || classList.includes('md:') || classList.includes('lg:'))
          ) {
            hasResponsiveText = true;
          }
        });

        // Should have some responsive typography
        expect(hasResponsiveText).toBe(true);
      });

      it(`should have proper contrast for mobile displays on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Check for proper color classes that ensure good contrast
        const textElements = document.querySelectorAll('[class*="text-"]');
        let hasProperContrast = false;

        textElements.forEach((element) => {
          const classList = element.classList.toString();
          // Look for high contrast text colors
          if (
            classList.includes('text-gray-900') ||
            classList.includes('text-black') ||
            classList.includes('text-white') ||
            classList.includes('text-blue-600') ||
            classList.includes('text-blue-700')
          ) {
            hasProperContrast = true;
          }
        });

        expect(hasProperContrast).toBe(true);
      });
    });
  });

  describe('Mobile Form Accessibility', () => {
    it('should handle form inputs properly on mobile', () => {
      // Mock a simple form component for testing
      const FormComponent = () => (
        <div>
          <form>
            <input type='email' placeholder='Courriel' data-testid='email-input' />
            <input type='password' placeholder='Mot de passe' data-testid='password-input' />
            <button type='submit' data-testid='submit-button'>
              Se connecter
            </button>
          </form>
        </div>
      );

      render(
        <TestProviders>
          <FormComponent />
        </TestProviders>
      );

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('submit-button');

      // Should have proper input types for mobile keyboards
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Should have proper touch targets
      expect(submitButton).toHaveAttribute('data-testid');
    });
  });

  describe('Mobile Focus Management', () => {
    const pages = [
      { component: FeaturesPage, name: 'Features' },
      { component: SecurityPage, name: 'Security' },
    ];

    pages.forEach(({ component: PageComponent, name }) => {
      it(`should manage focus properly on mobile for ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Get interactive elements
        const buttons = screen.getAllByRole('button');
        const links = screen.getAllByRole('link');

        if (buttons.length > 0) {
          const firstButton = buttons[0];

          // Should be focusable
          expect(firstButton.tabIndex).not.toBe(-1);

          // Should support focus events
          firstButton.focus();
          expect(document.activeElement).toBe(firstButton);
        }

        if (links.length > 0) {
          const firstLink = links[0];

          // Should be focusable
          expect(firstLink.tabIndex).not.toBe(-1);
        }
      });

      it(`should have visible focus indicators on mobile for ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        const focusableElements = [
          ...screen.getAllByRole('button'),
          ...screen.getAllByRole('link'),
        ];

        focusableElements.forEach((element) => {
          // Should have focus styles or classes
          const hasFocusStyles =
            element.classList.toString().includes('focus:') ||
            element.classList.toString().includes('focus-visible:') ||
            element.classList.toString().includes('ring-');

          expect(hasFocusStyles).toBe(true);
        });
      });
    });
  });

  describe('Mobile Language Switcher', () => {
    const pages = [
      { component: FeaturesPage, name: 'Features' },
      { component: SecurityPage, name: 'Security' },
      { component: StoryPage, name: 'Story' },
    ];

    pages.forEach(({ component: PageComponent, name }) => {
      it(`should have accessible language switcher on mobile for ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Should have language switching capability
        const languageElements = document.querySelectorAll(
          '[class*="language"], [data-testid*="language"]'
        );
        const hasLanguageSupport =
          languageElements.length > 0 ||
          document.body.textContent?.includes('FR') ||
          document.body.textContent?.includes('EN');

        expect(hasLanguageSupport).toBe(true);
      });
    });
  });

  describe('Quebec Mobile Accessibility Compliance', () => {
    const pages = [
      { component: FeaturesPage, name: 'Features', path: '/features' },
      { component: SecurityPage, name: 'Security', path: '/security' },
      { component: StoryPage, name: 'Story', path: '/story' },
      { component: PrivacyPolicyPage, name: 'Privacy Policy', path: '/privacy-policy' },
      { component: TermsOfServicePage, name: 'Terms of Service', path: '/terms-of-service' },
    ];

    pages.forEach(({ component: PageComponent, name, path }) => {
      it(`should display Quebec compliance message on mobile for ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        // Should mention Quebec Law 25 compliance
        const pageContent = document.body.textContent || '';
        expect(pageContent).toMatch(/loi 25|law 25|conforme|québec/i);
      });

      it(`should have French language support on mobile for ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        // Should have French content
        const pageContent = document.body.textContent || '';
        const hasFrenchContent =
          pageContent.includes('Québec') ||
          pageContent.includes('courriel') ||
          pageContent.includes('gestionnaire') ||
          pageContent.includes('confidentialité') ||
          pageContent.includes('conditions');

        expect(hasFrenchContent).toBe(true);
      });

      it(`should have mobile-friendly privacy and terms access for ${name} page`, () => {
        render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        // Should have privacy and terms links accessible on mobile
        const pageHtml = document.body.innerHTML;
        const pageText = document.body.textContent || '';

        const hasPrivacyAccess =
          pageText.includes('confidentialité') ||
          pageText.includes('privacy') ||
          pageHtml.includes('/privacy-policy');

        const hasTermsAccess =
          pageText.includes('conditions') ||
          pageText.includes('terms') ||
          pageHtml.includes('/terms-of-service');

        expect(hasPrivacyAccess).toBe(true);
        expect(hasTermsAccess).toBe(true);
      });
    });
  });

  describe('Mobile Performance and Loading', () => {
    it('should handle loading states properly on mobile', async () => {
      const LoadingComponent = () => {
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
          const timer = setTimeout(() => setLoading(false), 100);
          return () => clearTimeout(timer);
        }, []);

        if (loading) {
          return <div data-testid='loading-spinner'>Chargement...</div>;
        }

        return (
          <div data-testid='main-content'>
            <h1>Contenu principal</h1>
            <button data-testid='action-button'>Action</button>
          </div>
        );
      };

      render(
        <TestProviders>
          <LoadingComponent />
        </TestProviders>
      );

      // Should show loading initially
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Should load content
      await waitFor(
        () => {
          expect(screen.getByTestId('main-content')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Should be interactive after loading
      const actionButton = screen.getByTestId('action-button');
      expect(actionButton).toBeInTheDocument();
      expect(actionButton).toBeEnabled();
    });
  });
});

/**
 * Mobile Accessibility Validation Helper.
 * @param element
 */
export function validateMobileAccessibility(element: HTMLElement): {
  isAccessible: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check touch targets
  const buttons = element.querySelectorAll('button');
  const links = element.querySelectorAll('a');
  const interactiveElements = [...Array.from(buttons), ...Array.from(links)];

  interactiveElements.forEach((elem, _index) => {
    if (!elem.getAttribute('data-testid')) {
      issues.push(`Interactive element ${index} missing data-testid for testing`);
    }

    const hasMinSize =
      elem.classList.toString().includes('p-') ||
      elem.classList.toString().includes('px-') ||
      elem.classList.toString().includes('py-');

    if (!hasMinSize) {
      issues.push(`Interactive element ${index} may be too small for touch`);
      recommendations.push('Add padding classes (px-4 py-2 minimum) for better touch targets');
    }
  });

  // Check headings hierarchy
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) {
    issues.push('No heading structure found');
  }

  // Check images
  const images = element.querySelectorAll('img');
  images.forEach((img, _index) => {
    if (!img.getAttribute('alt')) {
      issues.push(`Image ${index} missing alt text`);
    }
  });

  // Check responsive classes
  const hasResponsiveClasses =
    element.innerHTML.includes('sm:') ||
    element.innerHTML.includes('md:') ||
    element.innerHTML.includes('lg:');

  if (!hasResponsiveClasses) {
    issues.push('No responsive design classes found');
    recommendations.push('Add responsive classes (sm:, md:, lg:) for mobile optimization');
  }

  return {
    isAccessible: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Quebec Mobile Standards Validation.
 */
export const QUEBEC_MOBILE_REQUIREMENTS = {
  language: ['français', 'québec', 'courriel'],
  compliance: ['loi 25', 'conformité', 'protection'],
  accessibility: ['aria-label', 'alt=', 'role='],
  navigation: ['data-testid="nav-', 'href='],
};

/**
 *
 * @param content
 */
export function validateQuebecMobileStandards(content: string): {
  meetsStandards: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  // Check language requirements
  const hasQuebecLanguage = QUEBEC_MOBILE_REQUIREMENTS.language.some((term) =>
    content.toLowerCase().includes(term)
  );
  if (!hasQuebecLanguage) {
    missing.push('Quebec French terminology');
  }

  // Check compliance messaging
  const hasComplianceMessage = QUEBEC_MOBILE_REQUIREMENTS.compliance.some((term) =>
    content.toLowerCase().includes(term)
  );
  if (!hasComplianceMessage) {
    missing.push('Quebec compliance messaging');
  }

  // Check basic accessibility
  const hasAccessibilityFeatures = QUEBEC_MOBILE_REQUIREMENTS.accessibility.some((feature) =>
    content.includes(feature)
  );
  if (!hasAccessibilityFeatures) {
    missing.push('Basic accessibility features');
  }

  return {
    meetsStandards: missing.length === 0,
    missing,
  };
}
