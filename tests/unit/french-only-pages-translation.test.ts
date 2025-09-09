/**
 * French-Only Pages Translation Test Suite
 * Validates that French-only pages (/security, /story, /privacy-policy) 
 * handle language switching appropriately and provide proper navigation support
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';

describe('French-Only Pages Translation Support', () => {
  const languages: Language[] = ['en', 'fr'];
  const frenchOnlyPages = [
    { page: 'security', route: '/security' },
    { page: 'story', route: '/story' },  
    { page: 'privacy-policy', route: '/privacy-policy' }
  ];

  describe('Navigation Translation Support', () => {
    it('should have navigation translations for French-only pages in both languages', () => {
      const requiredNavigationKeys = [
        'security',
        'ourStory',
        'privacyPolicy',
        'menu',
        'navigation'
      ];

      requiredNavigationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should provide clear navigation labels for English users accessing French pages', () => {
      const en = translations.en;
      
      // English navigation should clearly indicate what these pages contain
      expect(en.security).toBe('Security');
      expect(en.ourStory).toBe('Our Story');  
      expect(en.privacyPolicy).toBe('Privacy Policy');
      
      // Should have helpful navigation context
      expect(en.menu).toBe('Menu');
      expect(en.navigation).toBe('Navigation');
    });

    it('should provide proper French navigation labels', () => {
      const fr = translations.fr;
      
      // French navigation should use proper Quebec French terminology
      expect(fr.security).toBe('Sécurité');
      expect(fr.ourStory).toBe('Notre histoire');
      expect(fr.privacyPolicy).toBe('Politique de confidentialité');
    });
  });

  describe('Language Support for French-Only Content', () => {
    it('should have consistent language switching support keys', () => {
      const languageSupportKeys = [
        'language',
        'openMenu', 
        'closeMenu',
        'home',
        'features'
      ];

      languageSupportKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should support returning to homepage from French-only pages', () => {
      languages.forEach(lang => {
        const t = translations[lang] as any;
        expect(t.home).toBeDefined();
        expect(t.home.length).toBeGreaterThan(0);
      });

      // Validate specific home translations
      expect(translations.en.home).toBe('Home');
      expect(translations.fr.home).toBe('Accueil');
    });
  });

  describe('User Experience for Language Switching', () => {
    it('should have Quebec Law 25 related translations for privacy policy navigation', () => {
      const quebecKeys = [
        'law25Compliant',
        'quebecCompliance',
        'privacyPolicy'
      ];

      quebecKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should provide bilingual support indicators', () => {
      languages.forEach(lang => {
        const t = translations[lang] as any;
        expect(t.bilingualSupport).toBeDefined();
        expect(t.language).toBeDefined();
      });

      // Validate bilingual support translations
      expect(translations.en.bilingualSupport).toBe('Bilingual Support');
      expect(translations.fr.bilingualSupport).toBe('Support bilingue');
    });
  });

  describe('Accessibility and Navigation Flow', () => {
    it('should support breadcrumb navigation translations', () => {
      const navigationFlowKeys = [
        'home',
        'features',
        'security',
        'ourStory',
        'privacyPolicy'
      ];

      navigationFlowKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
        });
      });
    });

    it('should have menu control translations for both languages', () => {
      const menuKeys = ['menu', 'openMenu', 'closeMenu'];

      menuKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
        });
      });
    });
  });

  describe('Content Understanding Support', () => {
    it('should help users understand French-only page content through navigation', () => {
      // English navigation should clearly indicate page purpose
      const en = translations.en;
      
      expect(en.security).toMatch(/security/i);
      expect(en.ourStory).toMatch(/story/i);
      expect(en.privacyPolicy).toMatch(/privacy/i);
    });

    it('should have Quebec compliance related translations', () => {
      const quebecKeys = ['quebecCompliance', 'law25Compliant'];

      quebecKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });

      // Validate specific Quebec compliance translations exist
      expect(translations.en.quebecCompliance).toBeDefined();
      expect(translations.fr.quebecCompliance).toBeDefined();
    });
  });
});

/**
 * French-Only Pages Integration Test
 * Tests the actual user experience of navigating between languages
 * when accessing French-only content
 */
describe('French-Only Pages Integration', () => {
  it('should provide consistent translation structure for navigation', () => {
    const enKeys = Object.keys(translations.en);
    const frKeys = Object.keys(translations.fr);
    
    // Check that languages have similar number of keys (allow for small differences)
    const keyDifference = Math.abs(enKeys.length - frKeys.length);
    expect(keyDifference).toBeLessThanOrEqual(5); // Allow up to 5 key differences
    
    // Most keys should be present in both languages
    const commonKeys = enKeys.filter(key => frKeys.includes(key));
    const coverage = commonKeys.length / Math.max(enKeys.length, frKeys.length);
    expect(coverage).toBeGreaterThan(0.95); // 95% coverage minimum
  });

  it('should support Quebec-specific terminology consistently', () => {
    const quebecTerms = [
      'privacyPolicy',
      'law25Compliant', 
      'quebecCompliance',
      'bilingualSupport'
    ];

    quebecTerms.forEach(key => {
      const en = (translations.en as any)[key];
      const fr = (translations.fr as any)[key];
      
      if (en && fr) {
        // Both should exist and be non-empty
        expect(en.length).toBeGreaterThan(0);
        expect(fr.length).toBeGreaterThan(0);
        
        // Should contain relevant Quebec terminology
        expect(en.toLowerCase()).toMatch(/quebec|privacy|bilingual|law 25|support/i);
        expect(fr.toLowerCase()).toMatch(/québec|confidentialité|bilingue|loi 25|conformité québécoise|support/i);
      }
    });
  });
});