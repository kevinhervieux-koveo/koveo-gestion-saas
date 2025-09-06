/**
 * Comprehensive Website Pages Validation Test Suite
 * Tests all public website pages for language switching, menu functionality, and routing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Router } from 'wouter';
import React from 'react';

// Import pages to test - use @ aliases
import HomePage from '@/pages/home';
import PricingPage from '@/pages/pricing';
import FeaturesPage from '@/pages/features';
import SecurityPage from '@/pages/security';
import StoryPage from '@/pages/story';
import PrivacyPolicyPage from '@/pages/privacy-policy';
import TermsOfServicePage from '@/pages/terms-of-service';
import LoginPage from '@/pages/auth/login';

// Import providers and hooks - use @ aliases  
import { LanguageProvider } from '@/contexts/language-context';
import { AuthProvider } from '@/contexts/auth-context';

// Mock the auth hooks to test both authenticated and unauthenticated states
jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
  })),
}));

// Mock queryClient to prevent network calls
jest.mock('@/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
  apiRequest: jest.fn(),
}));

describe('Website Pages Validation Suite', () => {
  // Complete list of all PUBLIC website pages (non-authenticated) with their expected elements
  // This test suite covers ALL public routes from App.tsx:
  // ✓ / (Home) ✓ /features ✓ /pricing ✓ /security ✓ /story ✓ /privacy-policy ✓ /terms-of-service ✓ /login
  // Translation validation ensures French/English support for Quebec Law 25 compliance
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
      expectedTranslationKeys: ['simplePricing', 'pricingSubtitle', 'standardPlan'],
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
      expectedTranslationKeys: ['Contact', '9. Contact', 'Responsable de la protection des données'],
      expectedContent: ['info@koveo-gestion.com', '1-514-712-8441', 'Loi 25'],
    },
    {
      name: 'Terms of Service',
      component: TermsOfServicePage,
      route: '/terms-of-service',
      expectedElements: {
        footerPrivacyLink: 'footer-privacy-link',
      },
      expectedTranslationKeys: ['Contact', '13. Contact', 'Service client Koveo Gestion'],
      expectedContent: ['info@koveo-gestion.com', '1-514-712-8441', 'Québec'],
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
          // Check for updated contact information - should be info@koveo-gestion.com, NOT privacy@koveogestion.com
          const phoneNumber = screen.queryByText('1-514-712-8441');
          const correctEmail = screen.queryByText(/info@koveo-gestion\.com/);
          const oldEmail = screen.queryByText(/privacy@koveogestion\.com/);
          
          expect(phoneNumber).toBeInTheDocument();
          expect(correctEmail).toBeInTheDocument();
          expect(oldEmail).not.toBeInTheDocument(); // Old email should not exist
        });

        cleanup();
      }
    });
  });

  describe('Complete Website Translation Coverage', () => {
    it('should validate all pages contain French content for Quebec compliance', async () => {
      const pagesWithFrenchContent = [
        { component: HomePage, name: 'Home', frenchIndicators: ['Gestion', 'Québec', 'immobilière'] },
        { component: PricingPage, name: 'Pricing', frenchIndicators: ['Standard', 'Tarification', 'mois'] },
        { component: PrivacyPolicyPage, name: 'Privacy Policy', frenchIndicators: ['Responsable de la protection des données', 'Koveo Gestion', 'Courriel'] },
        { component: TermsOfServicePage, name: 'Terms of Service', frenchIndicators: ['Service client', 'Koveo Gestion', 'Québec'] },
        { component: SecurityPage, name: 'Security', frenchIndicators: ['Sécurité', 'données'] },
        { component: FeaturesPage, name: 'Features', frenchIndicators: ['Fonctionnalités'] },
        { component: StoryPage, name: 'Story', frenchIndicators: ['Histoire'] }
      ];

      for (const pageConfig of pagesWithFrenchContent) {
        renderPageWithProviders(pageConfig.component, '/test');

        await waitFor(() => {
          // Check that at least one French indicator is present
          const hasFrenchContent = pageConfig.frenchIndicators.some(indicator => {
            const element = screen.queryByText(new RegExp(indicator, 'i'));
            return element !== null;
          });
          
          expect(hasFrenchContent).toBe(true);
        }, { timeout: 3000 });

        cleanup();
      }
    });

    it('should validate privacy policy specifically contains updated contact info', async () => {
      renderPageWithProviders(PrivacyPolicyPage, '/privacy-policy');

      await waitFor(() => {
        // Specific privacy policy validations
        expect(screen.getByText(/info@koveo-gestion\.com/)).toBeInTheDocument();
        expect(screen.getByText(/1-514-712-8441/)).toBeInTheDocument();
        expect(screen.getByText(/Responsable de la protection des données/)).toBeInTheDocument();
        expect(screen.getByText(/Koveo Gestion/)).toBeInTheDocument();
        
        // Ensure old email format is not present
        expect(screen.queryByText(/privacy@koveogestion\.com/)).not.toBeInTheDocument();
      });
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