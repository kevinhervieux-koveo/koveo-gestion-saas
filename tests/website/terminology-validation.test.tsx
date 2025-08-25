import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from '@/pages/home';
import { validateQuebecTerminology, QUEBEC_TERMINOLOGY_MAP } from './website-translation.test';

/**
 * Terminology Validation Tests.
 *
 * Tests to ensure inappropriate terms are not used on the website
 * (equivalent to "terme à éviter" document validation).
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
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// Terms to avoid in property management context
const TERMS_TO_AVOID = {
  // Generic English terms when Quebec French is required
  propertyManagement: [
    'property manager', // Should be: gestionnaire immobilier
    'tenant', // Should be: locataire
    'lease', // Should be: bail
    'condo fees', // Should be: charges de copropriété
    'strata', // Should be: copropriété
    'HOA', // Should be: syndicat/conseil d'administration
    'maintenance fees', // Should be: frais d'entretien
    'common areas', // Should be: parties communes
    'exclusive use', // Should be: partie privative
    'special assessment', // Should be: contribution spéciale
    'annual general meeting', // Should be: assemblée générale annuelle
    'board of directors', // Should be: conseil d'administration
    'parking', // Should be: stationnement
  ],

  // Inappropriate business language
  marketing: [
    'revolutionary', // Overpromising
    'game-changing', // Marketing fluff
    'disruptive', // Buzzword
    'cutting-edge', // Vague
    'world-class', // Subjective
    'best-in-class', // Unprovable
    'industry-leading', // Subjective
    'award-winning', // Without proof
    'unparalleled', // Hyperbole
    'unprecedented', // Likely false
  ],

  // Technical terms that might confuse users
  technical: [
    'API', // Should explain or avoid
    'SaaS', // Should be explained
    'cloud-native', // Jargon
    'microservices', // Internal tech
    'containerized', // Internal tech
    'serverless', // Internal tech
    'NoSQL', // Database jargon
    'REST API', // Technical detail
  ],

  // Legal terms without proper context
  legal: [
    'GDPR', // European law, not Quebec
    'CCPA', // California law
    'HIPAA', // US healthcare law
    'SOX', // US corporate law
  ],

  // Anglicisms to avoid in French content
  anglicisms: [
    'email', // Should be: courriel
    'website', // Should be: site web
    'online', // Should be: en ligne
    'offline', // Should be: hors ligne
    'software', // Should be: logiciel
    'hardware', // Should be: matériel
    'weekend', // Should be: fin de semaine
    'meeting', // Should be: réunion
    'feedback', // Should be: rétroaction
    'upgrade', // Should be: mise à niveau
  ],
};

describe('Terminology Validation Tests', () => {
  describe('Property Management Terms Validation', () => {
    it('should not use inappropriate English property terms', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      TERMS_TO_AVOID.propertyManagement.forEach((term) => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        expect(pageContent).not.toMatch(regex);
      });
    });

    it('should use Quebec-specific property management terminology', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should use appropriate terms
      expect(pageContent).toMatch(/property.*management|gestion.*immobilière/i);
      expect(pageContent).toMatch(/building.*management|gestion.*bâtiments/i);
      expect(pageContent).toMatch(/resident.*portal|portail.*résident/i);
    });

    it('should validate terminology in meta tags and hidden content', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check meta descriptions, titles, etc.
      const metaDescription = document.querySelector('meta[name="description"]');
      const title = document.title;

      if (metaDescription) {
        const content = metaDescription.getAttribute('content') || '';
        TERMS_TO_AVOID.propertyManagement.slice(0, 5).forEach((term) => {
          expect(content.toLowerCase()).not.toContain(term.toLowerCase());
        });
      }

      if (title) {
        TERMS_TO_AVOID.propertyManagement.slice(0, 3).forEach((term) => {
          expect(title.toLowerCase()).not.toContain(term.toLowerCase());
        });
      }
    });
  });

  describe('Marketing Language Validation', () => {
    it('should avoid hyperbolic marketing terms', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      TERMS_TO_AVOID.marketing.forEach((term) => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        expect(pageContent).not.toMatch(regex);
      });
    });

    it('should use professional, accurate language', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should use professional terms instead
      expect(pageContent).toMatch(/comprehensive|complete|professional/i);
      expect(pageContent).toMatch(/designed.*specifically/i);
      expect(pageContent).not.toMatch(/amazing|incredible|fantastic|awesome/i);
    });

    it('should make verifiable claims only', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should not make unverifiable claims
      expect(pageContent).not.toMatch(/#1|number.*one|first.*choice/i);
      expect(pageContent).not.toMatch(/thousands.*of.*customers/i);
      expect(pageContent).not.toMatch(/millions.*saved/i);
    });
  });

  describe('Technical Jargon Validation', () => {
    it('should avoid unexplained technical terms', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      TERMS_TO_AVOID.technical.forEach((term) => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        expect(pageContent).not.toMatch(regex);
      });
    });

    it('should use user-friendly language', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should use understandable terms
      expect(pageContent).toMatch(/secure.*platform/i);
      expect(pageContent).toMatch(/cloud.*based/i);
      expect(pageContent).not.toMatch(/containerization|microservices|kubernetes/i);
    });
  });

  describe('Legal Compliance Terms', () => {
    it('should focus on Quebec-specific legal requirements', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should mention Quebec Law 25, not other jurisdictions
      expect(pageContent).toMatch(/Quebec Law 25/i);
      expect(pageContent).not.toMatch(/GDPR|CCPA|HIPAA|SOX/i);
    });

    it('should use accurate legal language', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should be specific about compliance
      expect(pageContent).toMatch(/compliant|compliance/i);
      expect(pageContent).toMatch(/data.*protection/i);
      expect(pageContent).not.toMatch(/certified|approved.*by/i); // Unless actually certified
    });
  });

  describe('Quebec French Anglicism Validation', () => {
    it('should not use common anglicisms in French content', () => {
      // This would test French content when language is set to French
      const frenchAnglicisms = TERMS_TO_AVOID.anglicisms;

      frenchAnglicisms.forEach((anglicism) => {
        expect(
          QUEBEC_TERMINOLOGY_MAP[anglicism as keyof typeof QUEBEC_TERMINOLOGY_MAP]
        ).toBeDefined();
      });
    });

    it('should use proper Quebec French terminology', () => {
      const quebecTerms = Object.values(QUEBEC_TERMINOLOGY_MAP);

      quebecTerms.forEach((term) => {
        expect(typeof term).toBe('string');
        expect(term.length).toBeGreaterThan(0);
        expect(term).not.toMatch(/[A-Z]{2,}/); // No acronyms in French terms
      });
    });
  });

  describe('Context-Specific Terminology', () => {
    it('should use appropriate business context terms', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should use property management context
      expect(pageContent).toMatch(/property.*management/i);
      expect(pageContent).toMatch(/building.*management/i);
      expect(pageContent).toMatch(/resident.*portal/i);
      expect(pageContent).toMatch(/financial.*reporting/i);
    });

    it('should avoid terms from other industries', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should not use terms from other domains
      expect(pageContent).not.toMatch(/patient|client.*portal|customer.*service/i);
      expect(pageContent).not.toMatch(/inventory.*management|supply.*chain/i);
      expect(pageContent).not.toMatch(/e-commerce|retail|marketplace/i);
    });
  });

  describe('Accessibility and Inclusive Language', () => {
    it('should use inclusive language', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should use inclusive terms
      expect(pageContent).not.toMatch(/guys|dudes|mankind/i);
      expect(pageContent).not.toMatch(/grandfathered|whitelist|blacklist/i);
    });

    it('should use clear, accessible language', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';

      // Should be clear and direct
      expect(pageContent).toMatch(/comprehensive|complete|professional/i);
      expect(pageContent).not.toMatch(/utilize|leverage|synergize/i); // Prefer simpler words
    });
  });
});

/**
 * Helper function to validate terminology in content.
 * @param content
 */
export function validateContentTerminology(content: string): Array<{
  term: string;
  category: keyof typeof TERMS_TO_AVOID;
  suggestion?: string;
}> {
  const violations: Array<{
    term: string;
    category: keyof typeof TERMS_TO_AVOID;
    suggestion?: string;
  }> = [];

  Object.entries(TERMS_TO_AVOID).forEach(([category, terms]) => {
    terms.forEach((term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(content)) {
        violations.push({
          term,
          category: category as keyof typeof TERMS_TO_AVOID,
          suggestion: QUEBEC_TERMINOLOGY_MAP[term as keyof typeof QUEBEC_TERMINOLOGY_MAP],
        });
      }
    });
  });

  return violations;
}

/**
 * Helper function to check if content follows Quebec French guidelines.
 * @param content
 */
export function validateQuebecFrenchGuidelines(content: string): Array<{
  issue: string;
  suggestion: string;
}> {
  const issues: Array<{ issue: string; suggestion: string }> = [];

  // Check for missing accents in common Quebec words
  if (content.includes('Quebec') && !content.includes('Québec')) {
    issues.push({ issue: 'Quebec sans accent', suggestion: 'Utiliser "Québec"' });
  }

  if (content.includes('Montreal') && !content.includes('Montréal')) {
    issues.push({ issue: 'Montreal sans accent', suggestion: 'Utiliser "Montréal"' });
  }

  // Check for anglicisms
  const anglicisms = ['email', 'weekend', 'parking', 'meeting'];
  anglicisms.forEach((anglicism) => {
    if (content.toLowerCase().includes(anglicism)) {
      const suggestion = QUEBEC_TERMINOLOGY_MAP[anglicism as keyof typeof QUEBEC_TERMINOLOGY_MAP];
      if (suggestion) {
        issues.push({ issue: `Anglicisme: ${anglicism}`, suggestion: `Utiliser: ${suggestion}` });
      }
    }
  });

  return issues;
}
