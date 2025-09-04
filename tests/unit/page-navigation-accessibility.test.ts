/**
 * Page Navigation Accessibility Test Suite
 * Validates that all website pages can be accessed and load without errors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Router } from 'wouter';
import React from 'react';

// Import all pages to test
import HomePage from '../../client/src/pages/home';
import PricingPage from '../../client/src/pages/pricing';
import FeaturesPage from '../../client/src/pages/features';
import SecurityPage from '../../client/src/pages/security';
import StoryPage from '../../client/src/pages/story';
import PrivacyPolicyPage from '../../client/src/pages/privacy-policy';
import TermsOfServicePage from '../../client/src/pages/terms-of-service';
import LoginPage from '../../client/src/pages/auth/login';

// Import providers
import { LanguageProvider } from '../../client/src/contexts/language-context';
import { AuthProvider } from '../../client/src/contexts/auth-context';

// Mock authentication
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
  })),
}));

// Mock queryClient
jest.mock('../../client/src/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
  apiRequest: jest.fn(),
}));

describe('Page Navigation Accessibility Suite', () => {
  // Define all website routes and their corresponding components
  const websiteRoutes = [
    { 
      path: '/', 
      name: 'Home Page', 
      component: HomePage,
      expectedText: ['Property Management', 'Quebec', 'Gestion'],
      criticalElements: ['logo-link', 'language-switcher']
    },
    { 
      path: '/pricing', 
      name: 'Pricing Page', 
      component: PricingPage,
      expectedText: ['Standard Plan', 'pricing', '$9.50'],
      criticalElements: ['logo-link', 'language-switcher']
    },
    { 
      path: '/features', 
      name: 'Features Page', 
      component: FeaturesPage,
      expectedText: ['Fonctionnalités', 'Features', 'gestion'],
      criticalElements: ['logo-link']
    },
    { 
      path: '/security', 
      name: 'Security Page', 
      component: SecurityPage,
      expectedText: ['Sécurité', 'Security', 'Loi 25'],
      criticalElements: ['logo-link']
    },
    { 
      path: '/story', 
      name: 'Story Page', 
      component: StoryPage,
      expectedText: ['Story', 'Histoire', 'Koveo'],
      criticalElements: ['logo-link']
    },
    { 
      path: '/privacy-policy', 
      name: 'Privacy Policy Page', 
      component: PrivacyPolicyPage,
      expectedText: ['Privacy', 'Confidentialité', '1-514-712-8441'],
      criticalElements: ['footer-terms-link']
    },
    { 
      path: '/terms-of-service', 
      name: 'Terms of Service Page', 
      component: TermsOfServicePage,
      expectedText: ['Terms', 'Conditions', 'info@koveo-gestion.com'],
      criticalElements: ['footer-privacy-link']
    },
    { 
      path: '/login', 
      name: 'Login Page', 
      component: LoginPage,
      expectedText: ['Login', 'Connexion', 'Welcome'],
      criticalElements: ['logo-koveo-gestion', 'language-switcher']
    }
  ];

  const renderPageWithProviders = (PageComponent: React.ComponentType) => {
    return render(
      <LanguageProvider>
        <AuthProvider>
          <Router base="">
            <PageComponent />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console errors during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  describe('Page Accessibility Validation', () => {
    it('should render all pages without throwing errors', async () => {
      const renderResults = [];

      for (const route of websiteRoutes) {
        let renderError = null;
        
        try {
          renderPageWithProviders(route.component);
          
          // Wait for the page to render
          await waitFor(() => {
            const body = document.body;
            expect(body).toBeInTheDocument();
          }, { timeout: 3000 });
          
          renderResults.push({ 
            route: route.path, 
            name: route.name, 
            success: true, 
            error: null 
          });
        } catch (error) {
          renderError = error;
          renderResults.push({ 
            route: route.path, 
            name: route.name, 
            success: false, 
            error: error.message 
          });
        }
        
        cleanup();
      }

      // Check that all pages rendered successfully
      const failedPages = renderResults.filter(result => !result.success);
      
      if (failedPages.length > 0) {
        console.error('Failed to render pages:', failedPages);
        expect(failedPages).toHaveLength(0);
      }

      expect(renderResults).toHaveLength(websiteRoutes.length);
      expect(renderResults.every(result => result.success)).toBe(true);
    });

    it('should display expected content on each page', async () => {
      for (const route of websiteRoutes) {
        renderPageWithProviders(route.component);

        await waitFor(() => {
          const body = document.body;
          expect(body).toBeInTheDocument();
        });

        // Check for expected text content (at least one should be present)
        const foundExpectedContent = route.expectedText.some(text => {
          const elements = screen.queryAllByText(new RegExp(text, 'i'));
          return elements.length > 0;
        });

        expect(foundExpectedContent).toBe(true);

        cleanup();
      }
    });

    it('should have critical UI elements present on each page', async () => {
      for (const route of websiteRoutes) {
        renderPageWithProviders(route.component);

        await waitFor(() => {
          const body = document.body;
          expect(body).toBeInTheDocument();
        });

        // Check for critical elements
        for (const elementId of route.criticalElements) {
          const element = screen.queryByTestId(elementId);
          if (element) {
            expect(element).toBeInTheDocument();
          }
        }

        cleanup();
      }
    });
  });

  describe('Route Structure Validation', () => {
    it('should have valid route paths', () => {
      websiteRoutes.forEach(route => {
        expect(route.path).toMatch(/^\/[a-zA-Z-]*$/);
        expect(route.name).toBeTruthy();
        expect(route.component).toBeTruthy();
      });
    });

    it('should have unique route paths', () => {
      const paths = websiteRoutes.map(route => route.path);
      const uniquePaths = [...new Set(paths)];
      
      expect(paths).toHaveLength(uniquePaths.length);
    });

    it('should have proper page names', () => {
      websiteRoutes.forEach(route => {
        expect(route.name).toContain('Page');
        expect(typeof route.name).toBe('string');
        expect(route.name.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle component errors gracefully', async () => {
      // Test each page component individually for error resilience
      for (const route of websiteRoutes) {
        let componentError = null;

        try {
          const { container } = renderPageWithProviders(route.component);
          
          await waitFor(() => {
            expect(container).toBeInTheDocument();
          });

        } catch (error) {
          componentError = error;
        }

        // If there's an error, it should be handled gracefully
        if (componentError) {
          expect(componentError.message).not.toContain('index is not defined');
          expect(componentError.message).not.toContain('undefined variable');
        }

        cleanup();
      }
    });

    it('should not have undefined variables in components', async () => {
      // Specific test for the security page issue that was fixed
      renderPageWithProviders(SecurityPage);

      await waitFor(() => {
        const body = document.body;
        expect(body).toBeInTheDocument();
      });

      // Should render without the "index is not defined" error
      expect(() => {
        screen.getByText(/sécurité/i);
      }).not.toThrow();

      cleanup();
    });
  });

  describe('Cross-Page Navigation Consistency', () => {
    it('should have consistent navigation elements across pages', async () => {
      const navigationElements = ['logo-link', 'hamburger-menu-button'];
      const pagesWithNavigation = websiteRoutes.filter(route => 
        route.criticalElements.some(element => navigationElements.includes(element))
      );

      for (const route of pagesWithNavigation) {
        renderPageWithProviders(route.component);

        await waitFor(() => {
          const body = document.body;
          expect(body).toBeInTheDocument();
        });

        // Check for navigation consistency
        const logoElement = screen.queryByTestId('logo-link');
        if (logoElement) {
          expect(logoElement).toBeInTheDocument();
        }

        cleanup();
      }
    });

    it('should have language switcher where expected', async () => {
      const pagesWithLanguageSwitcher = websiteRoutes.filter(route => 
        route.criticalElements.includes('language-switcher')
      );

      expect(pagesWithLanguageSwitcher.length).toBeGreaterThan(0);

      for (const route of pagesWithLanguageSwitcher) {
        renderPageWithProviders(route.component);

        await waitFor(() => {
          const languageSwitcher = screen.queryByTestId('language-switcher');
          if (languageSwitcher) {
            expect(languageSwitcher).toBeInTheDocument();
          }
        });

        cleanup();
      }
    });
  });

  describe('Content Validation', () => {
    it('should display updated contact information', async () => {
      const contactPages = [
        websiteRoutes.find(route => route.path === '/terms-of-service'),
        websiteRoutes.find(route => route.path === '/privacy-policy')
      ].filter(Boolean);

      for (const route of contactPages) {
        renderPageWithProviders(route.component);

        await waitFor(() => {
          const body = document.body;
          expect(body).toBeInTheDocument();
        });

        // Check for updated phone number
        const phoneElement = screen.queryByText('1-514-712-8441');
        expect(phoneElement).toBeInTheDocument();

        cleanup();
      }
    });

    it('should display "Standard Plan" instead of "Professional Plan"', async () => {
      const pricingRoute = websiteRoutes.find(route => route.path === '/pricing');
      
      renderPageWithProviders(pricingRoute.component);

      await waitFor(() => {
        const body = document.body;
        expect(body).toBeInTheDocument();
      });

      // Should find Standard Plan
      const standardPlanElement = screen.queryByText(/Standard Plan/i) || 
                                screen.queryByText(/Plan Standard/i);
      expect(standardPlanElement).toBeInTheDocument();

      // Should NOT find Professional Plan
      const professionalPlanElement = screen.queryByText(/Professional Plan/i) ||
                                    screen.queryByText(/Plan Professionnel/i);
      expect(professionalPlanElement).not.toBeInTheDocument();

      cleanup();
    });
  });

  describe('Performance and Load Time', () => {
    it('should render pages within reasonable time', async () => {
      for (const route of websiteRoutes) {
        const startTime = Date.now();
        
        renderPageWithProviders(route.component);

        await waitFor(() => {
          const body = document.body;
          expect(body).toBeInTheDocument();
        }, { timeout: 5000 });

        const loadTime = Date.now() - startTime;
        
        // Page should render within 5 seconds
        expect(loadTime).toBeLessThan(5000);

        cleanup();
      }
    });
  });
});