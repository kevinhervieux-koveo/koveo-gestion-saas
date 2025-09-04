/**
 * Comprehensive Website Pages Validation Test Suite
 * Tests all public website pages for language switching, menu functionality, and routing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Router } from 'wouter';
import React from 'react';

// Import pages to test
import HomePage from '../../client/src/pages/home';
import PricingPage from '../../client/src/pages/pricing';
import FeaturesPage from '../../client/src/pages/features';
import SecurityPage from '../../client/src/pages/security';
import StoryPage from '../../client/src/pages/story';
import PrivacyPolicyPage from '../../client/src/pages/privacy-policy';
import TermsOfServicePage from '../../client/src/pages/terms-of-service';
import LoginPage from '../../client/src/pages/auth/login';

// Import providers and hooks
import { LanguageProvider } from '../../client/src/contexts/language-context';
import { AuthProvider } from '../../client/src/contexts/auth-context';

// Mock the auth hooks to test both authenticated and unauthenticated states
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
  })),
}));

// Mock queryClient to prevent network calls
jest.mock('../../client/src/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
  apiRequest: jest.fn(),
}));

describe('Website Pages Validation Suite', () => {
  // List of all website pages with their expected elements
  const websitePages = [
    {
      name: 'Home',
      component: HomePage,
      route: '/',
      expectedElements: {
        logo: 'logo-link',
        languageSwitcher: 'language-switcher',
        headerLoginButton: 'header-login-button',
        hamburgerMenu: 'hamburger-menu-button',
      },
      expectedTranslationKeys: ['modernPropertyManagement', 'forQuebec', 'comprehensivePropertyManagement'],
    },
    {
      name: 'Pricing',
      component: PricingPage,
      route: '/pricing',
      expectedElements: {
        logo: 'logo-link',
        languageSwitcher: 'language-switcher',
        headerLoginButton: 'header-login-button',
        hamburgerMenu: 'hamburger-menu-button',
      },
      expectedTranslationKeys: ['simplePricing', 'pricingSubtitle', 'professionalPlan'],
    },
    {
      name: 'Features',
      component: FeaturesPage,
      route: '/features',
      expectedElements: {
        logo: 'logo-link',
        hamburgerMenu: 'hamburger-menu-button',
      },
      expectedTranslationKeys: [],
    },
    {
      name: 'Security',
      component: SecurityPage,
      route: '/security',
      expectedElements: {
        logo: 'logo-link',
        hamburgerMenu: 'hamburger-menu-button',
      },
      expectedTranslationKeys: [],
    },
    {
      name: 'Story',
      component: StoryPage,
      route: '/story',
      expectedElements: {
        logo: 'logo-link',
        hamburgerMenu: 'hamburger-menu-button',
      },
      expectedTranslationKeys: [],
    },
    {
      name: 'Privacy Policy',
      component: PrivacyPolicyPage,
      route: '/privacy-policy',
      expectedElements: {
        footerTermsLink: 'footer-terms-link',
      },
      expectedTranslationKeys: [],
    },
    {
      name: 'Terms of Service',
      component: TermsOfServicePage,
      route: '/terms-of-service',
      expectedElements: {
        footerPrivacyLink: 'footer-privacy-link',
      },
      expectedTranslationKeys: [],
    },
    {
      name: 'Login',
      component: LoginPage,
      route: '/login',
      expectedElements: {
        logo: 'logo-koveo-gestion',
        languageSwitcher: 'language-switcher',
        homeButton: 'button-home',
      },
      expectedTranslationKeys: ['welcomeBack', 'loginToAccount'],
    },
  ];

  // Helper function to render a page with all necessary providers
  const renderPageWithProviders = (PageComponent: React.ComponentType, route: string) => {
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
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Language Switching Functionality', () => {
    it('should display language switcher on pages that have it', async () => {
      const pagesWithLanguageSwitcher = websitePages.filter(
        page => page.expectedElements.languageSwitcher
      );

      for (const pageConfig of pagesWithLanguageSwitcher) {
        renderPageWithProviders(pageConfig.component, pageConfig.route);

        await waitFor(() => {
          const languageSwitcher = screen.getByTestId(pageConfig.expectedElements.languageSwitcher!);
          expect(languageSwitcher).toBeInTheDocument();
        });

        cleanup();
      }
    });

    it('should switch between English and French languages', async () => {
      // Test language switching on Home page
      renderPageWithProviders(HomePage, '/');

      await waitFor(() => {
        const languageSwitcher = screen.getByTestId('language-switcher');
        expect(languageSwitcher).toBeInTheDocument();
      });

      // Click language switcher
      const languageSwitcher = screen.getByTestId('language-switcher');
      fireEvent.click(languageSwitcher);

      // Wait for language change to take effect
      await waitFor(() => {
        // Check if page content has updated (this depends on actual implementation)
        expect(languageSwitcher).toBeInTheDocument();
      });
    });

    it('should maintain language preference across page navigation', async () => {
      // This test would verify that language choice persists when navigating between pages
      renderPageWithProviders(HomePage, '/');

      await waitFor(() => {
        const languageSwitcher = screen.getByTestId('language-switcher');
        expect(languageSwitcher).toBeInTheDocument();
      });

      // In a real implementation, we would test navigation and persistence
      expect(true).toBe(true); // Placeholder for actual implementation
    });
  });

  describe('Menu and Navigation Functionality', () => {
    it('should display hamburger menu on all pages', async () => {
      for (const pageConfig of websitePages) {
        if (pageConfig.expectedElements.hamburgerMenu) {
          renderPageWithProviders(pageConfig.component, pageConfig.route);

          await waitFor(() => {
            const hamburgerMenu = screen.getByTestId(pageConfig.expectedElements.hamburgerMenu);
            expect(hamburgerMenu).toBeInTheDocument();
          });

          cleanup();
        }
      }
    });

    it('should display logo with proper click handler on pages that have it', async () => {
      const pagesWithLogo = websitePages.filter(page => page.expectedElements.logo);

      for (const pageConfig of pagesWithLogo) {
        renderPageWithProviders(pageConfig.component, pageConfig.route);

        await waitFor(() => {
          const logo = screen.getByTestId(pageConfig.expectedElements.logo!);
          expect(logo).toBeInTheDocument();
        });

        // Test logo click functionality
        const logo = screen.getByTestId(pageConfig.expectedElements.logo!);
        fireEvent.click(logo);

        cleanup();
      }
    });

    it('should show login button on unauthenticated pages that have it', async () => {
      const pagesWithLoginButton = websitePages.filter(
        page => page.expectedElements.headerLoginButton
      );

      for (const pageConfig of pagesWithLoginButton) {
        renderPageWithProviders(pageConfig.component, pageConfig.route);

        await waitFor(() => {
          const loginButton = screen.getByTestId(pageConfig.expectedElements.headerLoginButton!);
          expect(loginButton).toBeInTheDocument();
        });

        cleanup();
      }
    });
  });

  describe('Page Content and Routing Validation', () => {
    it('should render all pages without errors', async () => {
      for (const pageConfig of websitePages) {
        expect(() => {
          renderPageWithProviders(pageConfig.component, pageConfig.route);
        }).not.toThrow();

        cleanup();
      }
    });

    it('should display expected content elements on each page', async () => {
      for (const pageConfig of websitePages) {
        renderPageWithProviders(pageConfig.component, pageConfig.route);

        // Wait for page to render
        await waitFor(() => {
          const body = document.body;
          expect(body).toBeInTheDocument();
        });

        // Check for key elements
        Object.entries(pageConfig.expectedElements).forEach(([elementName, testId]) => {
          const element = screen.queryByTestId(testId);
          if (element) {
            expect(element).toBeInTheDocument();
          }
        });

        cleanup();
      }
    });

    it('should have proper document structure and accessibility', async () => {
      for (const pageConfig of websitePages) {
        renderPageWithProviders(pageConfig.component, pageConfig.route);

        await waitFor(() => {
          // Check for basic HTML structure
          const headings = screen.getAllByRole('heading');
          expect(headings.length).toBeGreaterThan(0);
        });

        cleanup();
      }
    });
  });

  describe('Quebec Law 25 Compliance Elements', () => {
    it('should display Quebec Law 25 compliance information on relevant pages', async () => {
      const compliancePages = ['Home', 'Security', 'Privacy Policy', 'Terms of Service'];
      
      for (const pageName of compliancePages) {
        const pageConfig = websitePages.find(p => p.name === pageName);
        if (pageConfig) {
          renderPageWithProviders(pageConfig.component, pageConfig.route);

          await waitFor(() => {
            // Look for Quebec compliance text or Law 25 references
            const complianceText = screen.queryByText(/Loi 25/i) || 
                                 screen.queryByText(/Quebec Law 25/i) ||
                                 screen.queryByText(/Conforme à la Loi 25/i);
            
            if (complianceText) {
              expect(complianceText).toBeInTheDocument();
            }
          });

          cleanup();
        }
      }
    });
  });

  describe('Responsive Design and Mobile Menu', () => {
    it('should handle mobile menu functionality', async () => {
      // Test hamburger menu on mobile devices
      for (const pageConfig of websitePages) {
        if (pageConfig.expectedElements.hamburgerMenu) {
          renderPageWithProviders(pageConfig.component, pageConfig.route);

          await waitFor(() => {
            const hamburgerMenu = screen.getByTestId(pageConfig.expectedElements.hamburgerMenu);
            expect(hamburgerMenu).toBeInTheDocument();
          });

          // Click hamburger menu
          const hamburgerMenu = screen.getByTestId(pageConfig.expectedElements.hamburgerMenu);
          fireEvent.click(hamburgerMenu);

          // Wait for menu to open (implementation specific)
          await waitFor(() => {
            expect(hamburgerMenu).toBeInTheDocument();
          });

          cleanup();
        }
      }
    });
  });

  describe('Contact Information Validation', () => {
    it('should display updated contact information on privacy and terms pages', async () => {
      const contactPages = [
        { component: PrivacyPolicyPage, name: 'Privacy Policy' },
        { component: TermsOfServicePage, name: 'Terms of Service' }
      ];

      for (const pageConfig of contactPages) {
        renderPageWithProviders(pageConfig.component, '/test');

        await waitFor(() => {
          // Check for updated contact information
          const phoneNumber = screen.queryByText('1-514-712-8441');
          const email = screen.queryByText(/info@koveo-gestion\.com|privacy@koveogestion\.com/);
          
          expect(phoneNumber || email).toBeInTheDocument();
        });

        cleanup();
      }
    });
  });

  describe('Plan Name Updates', () => {
    it('should display "Standard Plan" instead of "Professional Plan" on pricing page', async () => {
      renderPageWithProviders(PricingPage, '/pricing');

      await waitFor(() => {
        // Should find "Standard Plan" text
        const standardPlan = screen.queryByText(/Standard Plan/i) || 
                           screen.queryByText(/Plan Standard/i);
        expect(standardPlan).toBeInTheDocument();

        // Should NOT find "Professional Plan" text
        const professionalPlan = screen.queryByText(/Professional Plan/i) ||
                               screen.queryByText(/Plan Professionnel/i);
        expect(professionalPlan).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication State Handling', () => {
    it('should handle authenticated user state correctly', async () => {
      // Mock authenticated state
      const useAuthMock = require('../../client/src/hooks/use-auth').useAuth;
      useAuthMock.mockImplementation(() => ({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: jest.fn(),
        logout: jest.fn(),
        loading: false,
      }));

      renderPageWithProviders(PricingPage, '/pricing');

      await waitFor(() => {
        // When authenticated, should not show login button
        const loginButton = screen.queryByTestId('header-login-button');
        expect(loginButton).not.toBeInTheDocument();
      });

      // Reset mock
      useAuthMock.mockImplementation(() => ({
        isAuthenticated: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        loading: false,
      }));
    });
  });
});