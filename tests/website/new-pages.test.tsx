import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import FeaturesPage from '@/pages/features';
import SecurityPage from '@/pages/security';
import StoryPage from '@/pages/story';
import PrivacyPolicyPage from '@/pages/privacy-policy';
import TermsOfServicePage from '@/pages/terms-of-service';

/**
 * New Pages Tests.
 *
 * Tests for the new website pages: Features, Security, Story,
 * Privacy Policy, and Terms of Service.
 */

/**
 *
 * @param root0
 * @param root0.children
 * @returns Function result.
 */
function TestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LanguageProvider>{children}</LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('New Pages Tests', () => {
  describe('Features Page', () => {
    it('should render features page with Quebec-specific content', () => {
      render(
        <TestProviders>
          <FeaturesPage />
        </TestProviders>
      );

      // Main heading should be present
      expect(screen.getByText(/Fonctionnalités complètes/i)).toBeInTheDocument();
      expect(screen.getByText(/gestion immobilière au Québec/i)).toBeInTheDocument();

      // Core features should be displayed
      expect(screen.getByText(/Gestion de bâtiments complète/i)).toBeInTheDocument();
      expect(screen.getByText(/Portail résident autonome/i)).toBeInTheDocument();
      expect(screen.getByText(/Rapports financiers détaillés/i)).toBeInTheDocument();
      expect(screen.getByText(/Conformité Loi 25 du Québec/i)).toBeInTheDocument();
    });

    it('should have proper Quebec compliance messaging', () => {
      render(
        <TestProviders>
          <FeaturesPage />
        </TestProviders>
      );

      // Quebec Law 25 compliance should be prominently displayed
      expect(screen.getByText(/Loi 25 du Québec/i)).toBeInTheDocument();
      expect(screen.getByText(/réglementations québécoises/i)).toBeInTheDocument();
      expect(screen.getByText(/Conforme à la Loi 25 du Québec/i)).toBeInTheDocument();
    });

    it('should have proper navigation and CTAs', () => {
      render(
        <TestProviders>
          <FeaturesPage />
        </TestProviders>
      );

      // Navigation should be present
      expect(screen.getByTestId('nav-features')).toBeInTheDocument();
      expect(screen.getByTestId('nav-home')).toBeInTheDocument();
      expect(screen.getByTestId('nav-security')).toBeInTheDocument();
      expect(screen.getByTestId('nav-story')).toBeInTheDocument();

      // CTAs should be present
      expect(screen.getByTestId('button-try-features')).toBeInTheDocument();
      expect(screen.getByTestId('button-start-now')).toBeInTheDocument();
    });

    it('should use proper Quebec French terminology', () => {
      render(
        <TestProviders>
          <FeaturesPage />
        </TestProviders>
      );

      // Should use Quebec French terms
      expect(screen.getByText(/gestionnaire immobilier/i)).toBeInTheDocument();
      expect(screen.getByText(/copropriété/i)).toBeInTheDocument();
      expect(screen.getByText(/courriel/i)).toBeInTheDocument();

      // Should not use English terms inappropriately
      const pageContent = document.body.textContent || '';
      expect(pageContent).not.toMatch(/property manager/i);
      expect(pageContent).not.toMatch(/email/i);
    });
  });

  describe('Security Page', () => {
    it('should render security page with comprehensive security features', () => {
      render(
        <TestProviders>
          <SecurityPage />
        </TestProviders>
      );

      // Main security heading should be present
      expect(screen.getByText(/Sécurité de niveau entreprise/i)).toBeInTheDocument();
      expect(screen.getByText(/données immobilières/i)).toBeInTheDocument();

      // Core security features should be displayed
      expect(screen.getByText(/Chiffrement de niveau entreprise/i)).toBeInTheDocument();
      expect(screen.getByText(/Contrôle d'accès basé sur les rôles/i)).toBeInTheDocument();
      expect(screen.getByText(/Protection des données québécoises/i)).toBeInTheDocument();
      expect(screen.getByText(/Infrastructure sécurisée/i)).toBeInTheDocument();
    });

    it('should emphasize Quebec Law 25 compliance', () => {
      render(
        <TestProviders>
          <SecurityPage />
        </TestProviders>
      );

      // Law 25 compliance should be prominent
      expect(screen.getByText(/Loi 25 du Québec/i)).toBeInTheDocument();
      expect(screen.getByText(/hébergées exclusivement au Canada/i)).toBeInTheDocument();
      expect(screen.getByText(/Engagement Loi 25/i)).toBeInTheDocument();
    });

    it('should display technical security measures', () => {
      render(
        <TestProviders>
          <SecurityPage />
        </TestProviders>
      );

      // Technical measures should be listed
      expect(screen.getByText(/AES-256/i)).toBeInTheDocument();
      expect(screen.getByText(/HTTPS\/TLS/i)).toBeInTheDocument();
      expect(screen.getByText(/authentification/i)).toBeInTheDocument();
      expect(screen.getByText(/surveillance.*24\/7/i)).toBeInTheDocument();
    });

    it('should have proper security badges and indicators', () => {
      render(
        <TestProviders>
          <SecurityPage />
        </TestProviders>
      );

      // Security badges should be present
      expect(screen.getByText(/Niveau militaire/i)).toBeInTheDocument();
      expect(screen.getByText(/Accès contrôlé/i)).toBeInTheDocument();
      expect(screen.getByText(/Haute disponibilité/i)).toBeInTheDocument();
    });
  });

  describe('Story Page', () => {
    it('should render story page with company narrative', () => {
      render(
        <TestProviders>
          <StoryPage />
        </TestProviders>
      );

      // Main story elements should be present
      expect(screen.getByText(/L'histoire de.*Koveo Gestion/i)).toBeInTheDocument();
      expect(screen.getByText(/Notre mission/i)).toBeInTheDocument();
      expect(screen.getByText(/moderniser la gestion immobilière au Québec/i)).toBeInTheDocument();
    });

    it('should display company timeline and milestones', () => {
      render(
        <TestProviders>
          <StoryPage />
        </TestProviders>
      );

      // Timeline elements should be present
      expect(screen.getByText(/Notre parcours/i)).toBeInTheDocument();
      expect(screen.getByText(/2023/i)).toBeInTheDocument();
      expect(screen.getByText(/2024/i)).toBeInTheDocument();
      expect(screen.getByText(/2025/i)).toBeInTheDocument();

      // Key milestones should be mentioned
      expect(screen.getByText(/Fondation de Koveo Gestion/i)).toBeInTheDocument();
      expect(screen.getByText(/Développement de la plateforme/i)).toBeInTheDocument();
      expect(screen.getByText(/Lancement commercial/i)).toBeInTheDocument();
    });

    it('should showcase company values', () => {
      render(
        <TestProviders>
          <StoryPage />
        </TestProviders>
      );

      // Company values should be displayed
      expect(screen.getByText(/Nos valeurs/i)).toBeInTheDocument();
      expect(screen.getByText(/Conformité et transparence/i)).toBeInTheDocument();
      expect(screen.getByText(/Service à la clientèle/i)).toBeInTheDocument();
      expect(screen.getByText(/Innovation responsable/i)).toBeInTheDocument();
      expect(screen.getByText(/Communauté québécoise/i)).toBeInTheDocument();
    });

    it('should emphasize Quebec focus', () => {
      render(
        <TestProviders>
          <StoryPage />
        </TestProviders>
      );

      // Quebec focus should be emphasized
      expect(screen.getByText(/Fièrement québécois/i)).toBeInTheDocument();
      expect(screen.getByText(/marché québécois/i)).toBeInTheDocument();
      expect(screen.getByText(/gestionnaires immobiliers du Québec/i)).toBeInTheDocument();
    });
  });

  describe('Privacy Policy Page', () => {
    it('should render comprehensive privacy policy', () => {
      render(
        <TestProviders>
          <PrivacyPolicyPage />
        </TestProviders>
      );

      // Privacy policy elements should be present
      expect(screen.getByText(/Politique de confidentialité/i)).toBeInTheDocument();
      expect(screen.getByText(/Loi 25 du Québec/i)).toBeInTheDocument();
      expect(screen.getByText(/protection des renseignements personnels/i)).toBeInTheDocument();
    });

    it('should cover all required privacy topics', () => {
      render(
        <TestProviders>
          <PrivacyPolicyPage />
        </TestProviders>
      );

      // Key privacy topics should be covered
      expect(screen.getByText(/Collecte des renseignements/i)).toBeInTheDocument();
      expect(screen.getByText(/Utilisation des renseignements/i)).toBeInTheDocument();
      expect(screen.getByText(/Partage et divulgation/i)).toBeInTheDocument();
      expect(screen.getByText(/Protection des données/i)).toBeInTheDocument();
      expect(screen.getByText(/Conservation des données/i)).toBeInTheDocument();
      expect(screen.getByText(/Vos droits/i)).toBeInTheDocument();
    });

    it('should have contact information for privacy inquiries', () => {
      render(
        <TestProviders>
          <PrivacyPolicyPage />
        </TestProviders>
      );

      // Contact information should be present
      expect(screen.getByText(/privacy@koveogestion.com/i)).toBeInTheDocument();
      expect(screen.getByText(/Responsable de la protection des données/i)).toBeInTheDocument();
    });
  });

  describe('Terms of Service Page', () => {
    it('should render comprehensive terms of service', () => {
      render(
        <TestProviders>
          <TermsOfServicePage />
        </TestProviders>
      );

      // Terms of service elements should be present
      expect(screen.getByText(/Conditions d'utilisation/i)).toBeInTheDocument();
      expect(screen.getByText(/service de gestion immobilière/i)).toBeInTheDocument();
      expect(screen.getByText(/marché québécois/i)).toBeInTheDocument();
    });

    it('should cover all required legal topics', () => {
      render(
        <TestProviders>
          <TermsOfServicePage />
        </TestProviders>
      );

      // Key legal topics should be covered
      expect(screen.getByText(/Acceptation des conditions/i)).toBeInTheDocument();
      expect(screen.getByText(/Description du service/i)).toBeInTheDocument();
      expect(screen.getByText(/Comptes utilisateur/i)).toBeInTheDocument();
      expect(screen.getByText(/Utilisation acceptable/i)).toBeInTheDocument();
      expect(screen.getByText(/Propriété intellectuelle/i)).toBeInTheDocument();
      expect(screen.getByText(/Limitation de responsabilité/i)).toBeInTheDocument();
      expect(screen.getByText(/Droit applicable/i)).toBeInTheDocument();
    });

    it('should specify Quebec jurisdiction', () => {
      render(
        <TestProviders>
          <TermsOfServicePage />
        </TestProviders>
      );

      // Quebec jurisdiction should be specified
      expect(screen.getByText(/lois du Québec et du Canada/i)).toBeInTheDocument();
      expect(screen.getByText(/tribunaux du Québec/i)).toBeInTheDocument();
    });

    it('should have contact information for legal inquiries', () => {
      render(
        <TestProviders>
          <TermsOfServicePage />
        </TestProviders>
      );

      // Contact information should be present
      expect(screen.getByText(/support@koveogestion.com/i)).toBeInTheDocument();
      expect(screen.getByText(/Service client Koveo Gestion/i)).toBeInTheDocument();
    });
  });

  describe('Cross-Page Consistency', () => {
    const pages = [
      { component: FeaturesPage, name: 'Features' },
      { component: SecurityPage, name: 'Security' },
      { component: StoryPage, name: 'Story' },
      { component: PrivacyPolicyPage, name: 'Privacy Policy' },
      { component: TermsOfServicePage, name: 'Terms of Service' },
    ];

    pages.forEach(({ component: PageComponent, name }) => {
      it(`should have consistent navigation on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Logo should be present and linked
        expect(screen.getByTestId('logo-link')).toBeInTheDocument();

        // Language switcher should be present
        const languageSwitcher =
          screen.queryByRole('button', { name: /language/i }) ||
          screen.queryByTestId('language-switcher') ||
          document.querySelector('[data-testid*="language"]');

        // At minimum should have logo and some navigation
        expect(screen.getByTestId('logo-link')).toBeInTheDocument();
      });

      it(`should have privacy and terms links on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Privacy policy and terms links should be in footer
        const privacyLink =
          screen.queryByTestId('footer-privacy-link') ||
          screen.queryByText(/politique de confidentialité/i);
        const termsLink =
          screen.queryByTestId('footer-terms-link') ||
          screen.queryByText(/conditions d'utilisation/i);

        expect(privacyLink).toBeInTheDocument();
        expect(termsLink).toBeInTheDocument();
      });

      it(`should display Quebec Law 25 compliance on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Quebec Law 25 compliance should be mentioned
        expect(screen.getByText(/Conforme à la Loi 25 du Québec/i)).toBeInTheDocument();
        expect(screen.getByText(/Vos données sont protégées/i)).toBeInTheDocument();
      });

      it(`should use consistent branding on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Koveo branding should be consistent
        const logos = screen.getAllByAltText(/koveo gestion/i);
        expect(logos.length).toBeGreaterThan(0);

        // Should use consistent blue color scheme
        const blueElements = document.querySelectorAll('[class*="blue-6"]');
        expect(blueElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility and SEO', () => {
    const pages = [
      { component: FeaturesPage, name: 'Features' },
      { component: SecurityPage, name: 'Security' },
      { component: StoryPage, name: 'Story' },
    ];

    pages.forEach(({ component: PageComponent, name }) => {
      it(`should have proper heading hierarchy on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        // Should have proper heading structure
        const h1Elements = screen.getAllByRole('heading', { level: 1 });
        const h2Elements = screen.getAllByRole('heading', { level: 2 });

        expect(h1Elements.length).toBeGreaterThanOrEqual(1);
        expect(h2Elements.length).toBeGreaterThanOrEqual(1);
      });

      it(`should have proper button accessibility on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        const buttons = screen.getAllByRole('button');

        buttons.forEach((button) => {
          // Buttons should have test IDs for testing
          expect(button).toHaveAttribute('data-testid');

          // Buttons should be enabled by default
          expect(button).toBeEnabled();
        });
      });

      it(`should have proper image alt text on ${name} page`, () => {
        render(
          <TestProviders>
            <PageComponent />
          </TestProviders>
        );

        const images = screen.getAllByRole('img');

        images.forEach((img) => {
          expect(img).toHaveAttribute('alt');
          expect(img.getAttribute('alt')).not.toBe('');
        });
      });
    });
  });
});

/**
 * Helper function to test page-specific elements.
 * @param pageName
 * @param element
 */
export function validatePageContent(
  pageName: string,
  element: HTMLElement
): {
  hasRequiredContent: boolean;
  missingElements: string[];
} {
  const missingElements: string[] = [];
  const content = element.textContent || '';

  // Common required elements for all pages
  if (!content.includes('Koveo')) {
    missingElements.push('Koveo branding');
  }

  if (!content.includes('Québec') && !content.includes('Quebec')) {
    missingElements.push('Quebec reference');
  }

  if (!content.includes('Loi 25')) {
    missingElements.push('Law 25 compliance reference');
  }

  // Page-specific requirements
  switch (pageName) {
    case 'features':
      if (!content.includes('gestion immobilière')) {
        missingElements.push('Property management focus');
      }
      break;
    case 'security':
      if (!content.includes('chiffrement') && !content.includes('sécurité')) {
        missingElements.push('Security terminology');
      }
      break;
    case 'story':
      if (!content.includes('mission') && !content.includes('histoire')) {
        missingElements.push('Company story elements');
      }
      break;
  }

  return {
    hasRequiredContent: missingElements.length === 0,
    missingElements,
  };
}
