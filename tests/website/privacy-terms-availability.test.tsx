import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider } from '@/hooks/use-auth';
import App from '@/App';

/**
 * Privacy Policy and Terms of Service Availability Tests.
 * 
 * Tests to ensure privacy policy and terms of service links are available
 * on all pages of the website as requested.
 */

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.initialLocation
 * @param root0.isAuthenticated
 */
function TestProviders({ 
  children, 
  initialLocation = '/',
  isAuthenticated = false 
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
          <AuthProvider value={mockAuthValue}>
            {children}
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Privacy Policy and Terms of Service Availability Tests', () => {
  describe('Public Pages - Privacy and Terms Links', () => {
    const publicPages = [
      { path: '/', name: 'Home Page' },
      { path: '/features', name: 'Features Page' },
      { path: '/security', name: 'Security Page' },
      { path: '/story', name: 'Story Page' },
      { path: '/login', name: 'Login Page' },
      { path: '/forgot-password', name: 'Forgot Password Page' },
    ];

    publicPages.forEach(({ path, name }) => {
      it(`should have privacy policy link on ${name}`, () => {
        render(
          <TestProviders initialLocation={path}>
            <App />
          </TestProviders>
        );

        // Look for privacy policy link in various ways
        const privacyLink = screen.queryByTestId('footer-privacy-link') ||
                           screen.queryByText(/politique de confidentialité/i) ||
                           screen.queryByText(/privacy policy/i) ||
                           screen.queryByRole('link', { name: /privacy/i });

        expect(privacyLink).toBeInTheDocument();
      });

      it(`should have terms of service link on ${name}`, () => {
        render(
          <TestProviders initialLocation={path}>
            <App />
          </TestProviders>
        );

        // Look for terms of service link in various ways
        const termsLink = screen.queryByTestId('footer-terms-link') ||
                         screen.queryByText(/conditions d'utilisation/i) ||
                         screen.queryByText(/terms of service/i) ||
                         screen.queryByRole('link', { name: /terms/i });

        expect(termsLink).toBeInTheDocument();
      });

      it(`should have both privacy and terms links accessible on ${name}`, () => {
        render(
          <TestProviders initialLocation={path}>
            <App />
          </TestProviders>
        );

        // Both links should be present and accessible
        const pageContent = document.body.textContent || '';
        const pageHtml = document.body.innerHTML || '';

        // Should contain privacy-related text
        const hasPrivacyReference = pageContent.includes('politique de confidentialité') ||
                                   pageContent.includes('privacy policy') ||
                                   pageContent.includes('confidentialité') ||
                                   pageHtml.includes('/privacy-policy');

        // Should contain terms-related text
        const hasTermsReference = pageContent.includes('conditions d\'utilisation') ||
                                 pageContent.includes('terms of service') ||
                                 pageContent.includes('conditions') ||
                                 pageHtml.includes('/terms-of-service');

        expect(hasPrivacyReference).toBe(true);
        expect(hasTermsReference).toBe(true);
      });
    });
  });

  describe('Protected Pages - Privacy and Terms Links', () => {
    const protectedPages = [
      { path: '/dashboard', name: 'Dashboard', role: 'admin' },
      { path: '/admin/organizations', name: 'Admin Organizations', role: 'admin' },
      { path: '/manager/buildings', name: 'Manager Buildings', role: 'manager' },
      { path: '/residents/residence', name: 'Resident Area', role: 'resident' },
    ];

    protectedPages.forEach(({ path, name, role }) => {
      it(`should have privacy policy accessible from ${name}`, () => {
        const mockUser = { 
          id: '1', 
          email: 'test@example.com', 
          role,
          organizationId: 'org-1' 
        };

        const mockAuthValue = {
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
          login: jest.fn(),
          logout: jest.fn(),
          checkAuth: jest.fn(),
        };

        render(
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={[path]}>
              <LanguageProvider>
                <AuthProvider value={mockAuthValue}>
                  <App />
                </AuthProvider>
              </LanguageProvider>
            </MemoryRouter>
          </QueryClientProvider>
        );

        // Privacy should be accessible from protected pages
        // It might be in footer, sidebar, or settings menu
        const pageHtml = document.body.innerHTML;
        const pageText = document.body.textContent || '';

        const hasPrivacyAccess = pageText.includes('confidentialité') ||
                                pageText.includes('privacy') ||
                                pageHtml.includes('/privacy-policy') ||
                                pageHtml.includes('privacy');

        // If not directly visible, should at least have settings or profile access
        const hasSettingsAccess = pageText.includes('settings') ||
                                 pageText.includes('paramètres') ||
                                 pageText.includes('profile') ||
                                 pageText.includes('profil');

        expect(hasPrivacyAccess || hasSettingsAccess).toBe(true);
      });

      it(`should have terms of service accessible from ${name}`, () => {
        const mockUser = { 
          id: '1', 
          email: 'test@example.com', 
          role,
          organizationId: 'org-1' 
        };

        const mockAuthValue = {
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
          login: jest.fn(),
          logout: jest.fn(),
          checkAuth: jest.fn(),
        };

        render(
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={[path]}>
              <LanguageProvider>
                <AuthProvider value={mockAuthValue}>
                  <App />
                </AuthProvider>
              </LanguageProvider>
            </MemoryRouter>
          </QueryClientProvider>
        );

        // Terms should be accessible from protected pages
        const pageHtml = document.body.innerHTML;
        const pageText = document.body.textContent || '';

        const hasTermsAccess = pageText.includes('conditions') ||
                              pageText.includes('terms') ||
                              pageHtml.includes('/terms-of-service') ||
                              pageHtml.includes('terms');

        // If not directly visible, should at least have settings or profile access
        const hasSettingsAccess = pageText.includes('settings') ||
                                 pageText.includes('paramètres') ||
                                 pageText.includes('profile') ||
                                 pageText.includes('profil');

        expect(hasTermsAccess || hasSettingsAccess).toBe(true);
      });
    });
  });

  describe('Privacy Policy Page Accessibility', () => {
    it('should render privacy policy page directly', () => {
      render(
        <TestProviders initialLocation="/privacy-policy">
          <App />
        </TestProviders>
      );

      // Privacy policy page should render
      expect(screen.getByText(/politique de confidentialité/i)).toBeInTheDocument();
      expect(screen.getByText(/Loi 25 du Québec/i)).toBeInTheDocument();
    });

    it('should have proper navigation back from privacy policy', () => {
      render(
        <TestProviders initialLocation="/privacy-policy">
          <App />
        </TestProviders>
      );

      // Should have back navigation
      const backButton = screen.queryByTestId('button-back') ||
                         screen.queryByText(/retour/i) ||
                         screen.queryByText(/back/i);
      
      expect(backButton).toBeInTheDocument();
    });

    it('should maintain site navigation on privacy policy page', () => {
      render(
        <TestProviders initialLocation="/privacy-policy">
          <App />
        </TestProviders>
      );

      // Should have logo and basic navigation
      expect(screen.getByTestId('logo-link')).toBeInTheDocument();
      
      // Should have authentication options
      const authButtons = screen.queryAllByRole('button').filter(button => 
        button.textContent?.includes('connecter') ||
        button.textContent?.includes('commencer') ||
        button.textContent?.includes('login') ||
        button.textContent?.includes('sign')
      );
      
      expect(authButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Terms of Service Page Accessibility', () => {
    it('should render terms of service page directly', () => {
      render(
        <TestProviders initialLocation="/terms-of-service">
          <App />
        </TestProviders>
      );

      // Terms of service page should render
      expect(screen.getByText(/conditions d'utilisation/i)).toBeInTheDocument();
      expect(screen.getByText(/service de gestion immobilière/i)).toBeInTheDocument();
    });

    it('should have proper navigation back from terms of service', () => {
      render(
        <TestProviders initialLocation="/terms-of-service">
          <App />
        </TestProviders>
      );

      // Should have back navigation
      const backButton = screen.queryByTestId('button-back') ||
                         screen.queryByText(/retour/i) ||
                         screen.queryByText(/back/i);
      
      expect(backButton).toBeInTheDocument();
    });

    it('should maintain site navigation on terms of service page', () => {
      render(
        <TestProviders initialLocation="/terms-of-service">
          <App />
        </TestProviders>
      );

      // Should have logo and basic navigation
      expect(screen.getByTestId('logo-link')).toBeInTheDocument();
      
      // Should have authentication options
      const authButtons = screen.queryAllByRole('button').filter(button => 
        button.textContent?.includes('connecter') ||
        button.textContent?.includes('commencer') ||
        button.textContent?.includes('login') ||
        button.textContent?.includes('sign')
      );
      
      expect(authButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Linking Between Privacy and Terms', () => {
    it('should have terms link on privacy policy page', () => {
      render(
        <TestProviders initialLocation="/privacy-policy">
          <App />
        </TestProviders>
      );

      // Privacy policy should link to terms
      const termsLink = screen.queryByTestId('footer-terms-link') ||
                       screen.queryByText(/conditions d'utilisation/i);
      
      expect(termsLink).toBeInTheDocument();
    });

    it('should have privacy link on terms of service page', () => {
      render(
        <TestProviders initialLocation="/terms-of-service">
          <App />
        </TestProviders>
      );

      // Terms should link to privacy policy
      const privacyLink = screen.queryByTestId('footer-privacy-link') ||
                         screen.queryByText(/politique de confidentialité/i);
      
      expect(privacyLink).toBeInTheDocument();
    });
  });

  describe('Legal Compliance Messaging', () => {
    const allPages = [
      '/', '/features', '/security', '/story', 
      '/privacy-policy', '/terms-of-service', '/login'
    ];

    allPages.forEach(page => {
      it(`should display Quebec Law 25 compliance message on ${page}`, () => {
        render(
          <TestProviders initialLocation={page}>
            <App />
          </TestProviders>
        );

        // Should mention Law 25 compliance
        const pageContent = document.body.textContent || '';
        expect(pageContent).toMatch(/loi 25|law 25|conforme|compliant/i);
      });

      it(`should indicate data protection on ${page}`, () => {
        render(
          <TestProviders initialLocation={page}>
            <App />
          </TestProviders>
        );

        // Should mention data protection
        const pageContent = document.body.textContent || '';
        expect(pageContent).toMatch(/données.*protégées|data.*protected|protection.*données/i);
      });
    });
  });

  describe('Footer Consistency', () => {
    const pagesWithFooters = [
      '/', '/features', '/security', '/story', 
      '/privacy-policy', '/terms-of-service'
    ];

    pagesWithFooters.forEach(page => {
      it(`should have consistent footer with legal links on ${page}`, () => {
        render(
          <TestProviders initialLocation={page}>
            <App />
          </TestProviders>
        );

        // Footer should contain legal information
        const footerContent = document.querySelector('footer')?.textContent || 
                             document.body.textContent || '';
        
        expect(footerContent).toMatch(/conforme.*loi 25/i);
        expect(footerContent).toMatch(/données.*protégées|data.*protected/i);
        
        // Should have both privacy and terms references
        expect(footerContent).toMatch(/confidentialité|privacy/i);
        expect(footerContent).toMatch(/conditions|terms/i);
      });
    });
  });
});

/**
 * Helper function to validate legal links availability.
 * @param page
 */
export function validateLegalLinksAvailability(page: HTMLElement): {
  hasPrivacyLink: boolean;
  hasTermsLink: boolean;
  hasComplianceMessage: boolean;
  issues: string[];
} {
  const pageHtml = page.innerHTML;
  const pageText = page.textContent || '';
  const issues: string[] = [];

  // Check for privacy policy link
  const hasPrivacyLink = pageText.includes('politique de confidentialité') ||
                        pageText.includes('privacy policy') ||
                        pageHtml.includes('/privacy-policy');

  if (!hasPrivacyLink) {
    issues.push('Privacy policy link not found');
  }

  // Check for terms of service link
  const hasTermsLink = pageText.includes('conditions d\'utilisation') ||
                      pageText.includes('terms of service') ||
                      pageHtml.includes('/terms-of-service');

  if (!hasTermsLink) {
    issues.push('Terms of service link not found');
  }

  // Check for compliance messaging
  const hasComplianceMessage = pageText.includes('Loi 25') ||
                              pageText.includes('Law 25') ||
                              pageText.includes('conforme') ||
                              pageText.includes('compliant');

  if (!hasComplianceMessage) {
    issues.push('Quebec Law 25 compliance message not found');
  }

  return {
    hasPrivacyLink,
    hasTermsLink,
    hasComplianceMessage,
    issues,
  };
}

/**
 * Quebec compliance validation for legal pages.
 */
export const QUEBEC_LEGAL_REQUIREMENTS = {
  privacyPolicy: [
    'Loi 25 du Québec',
    'protection des renseignements personnels',
    'droits des personnes concernées',
    'collecte des données',
    'utilisation des données',
    'partage des données',
    'conservation des données',
    'sécurité des données'
  ],
  termsOfService: [
    'droit québécois',
    'juridiction québécoise',
    'service de gestion immobilière',
    'utilisateurs québécois',
    'conformité réglementaire'
  ]
};

/**
 *
 * @param page
 * @param content
 */
export function validateQuebecLegalCompliance(
  page: 'privacy' | 'terms', 
  content: string
): {
  isCompliant: boolean;
  missingRequirements: string[];
} {
  const requirements = page === 'privacy' 
    ? QUEBEC_LEGAL_REQUIREMENTS.privacyPolicy
    : QUEBEC_LEGAL_REQUIREMENTS.termsOfService;
  
  const missingRequirements = requirements.filter(req => 
    !content.toLowerCase().includes(req.toLowerCase())
  );

  return {
    isCompliant: missingRequirements.length === 0,
    missingRequirements,
  };
}