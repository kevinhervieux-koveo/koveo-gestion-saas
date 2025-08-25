import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider } from '@/hooks/use-auth';

// Import pages that contain logos
import HomePage from '@/pages/home';
import FeaturesPage from '@/pages/features';
import SecurityPage from '@/pages/security';
import StoryPage from '@/pages/story';
import PrivacyPolicyPage from '@/pages/privacy-policy';
import TermsOfServicePage from '@/pages/terms-of-service';
import LoginPage from '@/pages/auth/login';

/**
 * Logo Visualization Tests for Koveo Gestion.
 *
 * Tests logo presentation across the application including:
 * - Logo presence and visibility on all pages
 * - Responsive logo behavior for different screen sizes
 * - Logo accessibility attributes
 * - Small screen logo optimization.
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
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
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

// Helper function to find Koveo logo
/**
 *
 * @param container
 */
function findKoveoLogo(container: HTMLElement): HTMLImageElement | null {
  // Look for images with Koveo in alt text or src containing logo
  const images = container.querySelectorAll('img') as NodeListOf<HTMLImageElement>;

  for (const img of images) {
    const alt = img.getAttribute('alt') || '';
    const src = img.getAttribute('src') || '';

    if (alt.match(/koveo|gestion/i) || src.includes('logo') || src.includes('koveo')) {
      return img;
    }
  }
  return null;
}

describe('Logo Visualization Tests', () => {
  beforeEach(() => {
    mockMatchMedia(false); // Default to desktop

    // Mock image loading to prevent console warnings
    Object.defineProperty(Image.prototype, 'src', {
      set() {
        setTimeout(() => this.onload?.(new Event('load')), 0);
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Logo Presence Across Pages', () => {
    const pages = [
      { component: HomePage, name: 'Home', path: '/' },
      { component: FeaturesPage, name: 'Features', path: '/features' },
      { component: SecurityPage, name: 'Security', path: '/security' },
      { component: StoryPage, name: 'Story', path: '/story' },
      { component: PrivacyPolicyPage, name: 'Privacy Policy', path: '/privacy-policy' },
      { component: TermsOfServicePage, name: 'Terms of Service', path: '/terms-of-service' },
      { component: LoginPage, name: 'Login', path: '/login' },
    ];

    pages.forEach(({ component: PageComponent, name, path }) => {
      it(`should display Koveo logo correctly on ${name} page`, () => {
        const { container } = render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        const logoImg = findKoveoLogo(container);

        expect(logoImg).toBeTruthy();

        if (logoImg) {
          // Validate logo has required attributes
          expect(logoImg).toHaveAttribute('src');
          expect(logoImg).toHaveAttribute('alt');

          const altText = logoImg.getAttribute('alt');
          expect(altText).toMatch(/koveo|gestion/i);

          // Check if logo has proper sizing classes
          expect(logoImg.className).toMatch(/h-\d+/);
          expect(logoImg.className).toMatch(/w-\d+/);

          // Should have proper object-fit for image scaling
          expect(logoImg.className).toMatch(/object-(cover|contain|fill)/);
        }
      });

      it(`should have clickable logo on ${name} page (when applicable)`, () => {
        const { container } = render(
          <TestProviders initialLocation={path}>
            <PageComponent />
          </TestProviders>
        );

        const logoImg = findKoveoLogo(container);
        expect(logoImg).toBeTruthy();

        if (logoImg) {
          // Check if logo is wrapped in a link
          const logoLink = logoImg.closest('a');

          if (logoLink) {
            // Should be a proper navigation link
            expect(logoLink).toHaveAttribute('href');
            const href = logoLink.getAttribute('href');
            expect(href).toBe('/');
          }
        }
      });
    });
  });

  describe('Logo Responsive Behavior', () => {
    const responsiveTests = [
      {
        name: 'Small Mobile',
        width: 320,
        height: 568,
        expectSmallLogo: true,
        description: 'should use compact logo sizing for small mobile devices',
      },
      {
        name: 'Mobile',
        width: 375,
        height: 667,
        expectSmallLogo: true,
        description: 'should use compact logo sizing for mobile devices',
      },
      {
        name: 'Tablet',
        width: 768,
        height: 1024,
        expectSmallLogo: false,
        description: 'should use standard logo sizing for tablets',
      },
      {
        name: 'Desktop',
        width: 1024,
        height: 768,
        expectSmallLogo: false,
        description: 'should use standard logo sizing for desktop',
      },
    ];

    const testPages = [
      { component: HomePage, name: 'Home' },
      { component: FeaturesPage, name: 'Features' },
      { component: SecurityPage, name: 'Security' },
    ];

    testPages.forEach(({ component: PageComponent, name: pageName }) => {
      responsiveTests.forEach(
        ({ name: screenName, width, height, expectSmallLogo, description }) => {
          it(`${description} on ${pageName} page (${screenName} - ${width}x${height})`, () => {
            // Mock window dimensions
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

            // Mock media query for mobile detection
            mockMatchMedia(expectSmallLogo);

            const { container } = render(
              <TestProviders>
                <PageComponent />
              </TestProviders>
            );

            const logoImg = findKoveoLogo(container);
            expect(logoImg).toBeTruthy();

            if (logoImg) {
              const classNames = logoImg.className;

              // Extract height class (e.g., h-8, h-10, h-12)
              const heightMatch = classNames.match(/h-(\d+)/);
              const heightValue = heightMatch ? parseInt(heightMatch[1]) : 0;

              if (expectSmallLogo) {
                // Small screens should use compact logo sizes (h-10 or smaller)
                expect(heightValue).toBeLessThanOrEqual(10);

                // Should not use very large logo sizes on small screens
                expect(classNames).not.toContain('h-16');
                expect(classNames).not.toContain('h-20');
                expect(classNames).not.toContain('h-24');
              } else {
                // Larger screens can use bigger logos, but should still be reasonable
                expect(heightValue).toBeGreaterThan(0);
                expect(heightValue).toBeLessThanOrEqual(20); // Maximum reasonable size
              }

              // All logos should have both height and width classes
              expect(classNames).toMatch(/h-\d+/);
              expect(classNames).toMatch(/w-\d+/);
            }
          });
        }
      );
    });
  });

  describe('Logo Accessibility and Standards', () => {
    it('should have proper accessibility attributes', () => {
      const { container } = render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const logoImg = findKoveoLogo(container);
      expect(logoImg).toBeTruthy();

      if (logoImg) {
        // Should have meaningful alt text
        expect(logoImg).toHaveAttribute('alt');
        const altText = logoImg.getAttribute('alt');
        expect(altText).toBeTruthy();
        expect(altText!.trim()).not.toBe('');
        expect(altText).toMatch(/koveo|gestion/i);

        // Should have a source
        expect(logoImg).toHaveAttribute('src');
        const src = logoImg.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src!.trim()).not.toBe('');

        // Should have proper styling classes
        expect(logoImg.className).toMatch(/h-\d+/);
        expect(logoImg.className).toMatch(/w-\d+/);
      }
    });

    it('should support keyboard navigation when clickable', () => {
      const { container } = render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const logoImg = findKoveoLogo(container);
      expect(logoImg).toBeTruthy();

      if (logoImg) {
        const logoLink = logoImg.closest('a');

        if (logoLink) {
          // Should be focusable
          logoLink.focus();
          expect(document.activeElement).toBe(logoLink);

          // Should respond to keyboard events
          fireEvent.keyDown(logoLink, { _key: 'Enter' });
          fireEvent.keyDown(logoLink, { _key: ' ' });

          // Should not throw errors
          expect(logoLink).toBeInTheDocument();
        }
      }
    });

    it('should have consistent branding across pages', () => {
      const pages = [HomePage, FeaturesPage, SecurityPage];
      const logoData: Array<{ alt: string; src: string; className: string }> = [];

      pages.forEach((PageComponent) => {
        const { container } = render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        const logoImg = findKoveoLogo(container);

        if (logoImg) {
          logoData.push({
            alt: logoImg.getAttribute('alt') || '',
            src: logoImg.getAttribute('src') || '',
            className: logoImg.className,
          });
        }

        // Clean up for next iteration
        container.remove();
      });

      // All logos should reference Koveo
      logoData.forEach((logo) => {
        expect(logo.alt).toMatch(/koveo|gestion/i);
        expect(logo.src).toBeTruthy();
        expect(logo.className).toMatch(/h-\d+.*w-\d+/);
      });

      // Should have consistent alt text patterns
      expect(logoData.length).toBeGreaterThan(0);
    });
  });

  describe('Mobile-Specific Logo Behavior', () => {
    beforeEach(() => {
      // Set mobile environment
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        _value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        _value: 667,
      });
    });

    it('should display appropriately sized logo on mobile', () => {
      const { container } = render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const logoImg = findKoveoLogo(container);
      expect(logoImg).toBeTruthy();

      if (logoImg) {
        const classNames = logoImg.className;

        // Extract height for mobile validation
        const heightMatch = classNames.match(/h-(\d+)/);
        const heightValue = heightMatch ? parseInt(heightMatch[1]) : 0;

        // Mobile logos should be compact but still visible
        expect(heightValue).toBeGreaterThan(0);
        expect(heightValue).toBeLessThanOrEqual(12); // h-12 is reasonable max for mobile

        // Should not use very large sizes that would dominate mobile layout
        expect(classNames).not.toContain('h-16');
        expect(classNames).not.toContain('h-20');
        expect(classNames).not.toContain('h-24');
        expect(classNames).not.toContain('h-32');
      }
    });

    it('should maintain touch-friendly interaction area', () => {
      const { container } = render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const logoImg = findKoveoLogo(container);
      expect(logoImg).toBeTruthy();

      if (logoImg) {
        const logoLink = logoImg.closest('a');

        if (logoLink) {
          // Should be large enough for touch interaction
          // Check if parent has padding or if logo itself is reasonably sized
          const hasProperTouchSize =
            logoLink.className.includes('p-') ||
            logoImg.className.includes('h-8') ||
            logoImg.className.includes('h-10') ||
            logoImg.className.includes('h-12');

          expect(hasProperTouchSize).toBe(true);

          // Should respond to touch events
          fireEvent.touchStart(logoLink);
          fireEvent.touchEnd(logoLink);

          expect(logoLink).toBeInTheDocument();
        }
      }
    });
  });

  describe('Logo Loading and Error Handling', () => {
    it('should handle logo image loading gracefully', () => {
      const { container } = render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const logoImg = findKoveoLogo(container);
      expect(logoImg).toBeTruthy();

      if (logoImg) {
        // Should have src that can be loaded
        const src = logoImg.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src!.length).toBeGreaterThan(0);

        // Simulate successful image load
        fireEvent.load(logoImg);
        expect(logoImg).toBeInTheDocument();

        // Should maintain alt text for accessibility even if image fails
        expect(logoImg).toHaveAttribute('alt');
      }
    });

    it('should provide meaningful fallback if logo fails', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { container } = render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const logoImg = findKoveoLogo(container);

      if (logoImg) {
        // Simulate image error
        fireEvent.error(logoImg);

        // Should still have alt text for fallback
        expect(logoImg).toHaveAttribute('alt');
        const altText = logoImg.getAttribute('alt');
        expect(altText).toMatch(/koveo|gestion/i);

        // Should not crash the application
        expect(logoImg).toBeInTheDocument();
      }

      consoleSpy.mockRestore();
    });
  });
});

/**
 * Logo validation utility functions for use in other tests.
 */
export const LogoTestUtils = {
  /**
   * Find the Koveo logo in a container.
   */
  findLogo: findKoveoLogo,

  /**
   * Validate logo properties.
   * @param logoImg
   */
  validateLogo(logoImg: HTMLImageElement): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check required attributes
    if (!logoImg.getAttribute('src')) {
      issues.push('Missing src attribute');
    }

    if (!logoImg.getAttribute('alt')) {
      issues.push('Missing alt attribute');
    } else {
      const alt = logoImg.getAttribute('alt')!;
      if (alt.trim() === '') {
        issues.push('Empty alt text');
      } else if (!alt.match(/koveo|gestion/i)) {
        recommendations.push('Alt text should reference Koveo branding');
      }
    }

    // Check styling
    if (!logoImg.className.match(/h-\d+/)) {
      issues.push('Missing height class');
    }
    if (!logoImg.className.match(/w-\d+/)) {
      issues.push('Missing width class');
    }
    if (!logoImg.className.match(/object-(cover|contain|fill)/)) {
      recommendations.push('Consider adding object-fit class for better scaling');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  },

  /**
   * Check if logo size is appropriate for screen size.
   * @param logoImg
   * @param isMobile
   */
  validateResponsiveSize(logoImg: HTMLImageElement, isMobile: boolean): boolean {
    const heightMatch = logoImg.className.match(/h-(\d+)/);
    const heightValue = heightMatch ? parseInt(heightMatch[1]) : 0;

    if (isMobile) {
      // Mobile: should be compact but visible (h-12 or smaller)
      return heightValue > 0 && heightValue <= 12;
    } else {
      // Desktop: can be larger but still reasonable (h-20 or smaller)
      return heightValue > 0 && heightValue <= 20;
    }
  },

  /**
   * Responsive size standards for different screen types.
   */
  RESPONSIVE_STANDARDS: {
    mobile: { maxHeight: 12, minHeight: 6, recommended: [8, 10] },
    tablet: { maxHeight: 16, minHeight: 8, recommended: [10, 12] },
    desktop: { maxHeight: 20, minHeight: 10, recommended: [10, 12, 16] },
  } as const,
};
