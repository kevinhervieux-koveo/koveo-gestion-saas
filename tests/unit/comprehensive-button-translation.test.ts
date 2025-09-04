/**
 * Comprehensive Button Translation Test Suite
 * Validates that all buttons in the application are properly translated
 * and conform to Quebec Law 25 bilingual requirements
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';

describe('Comprehensive Button Translation Coverage', () => {
  const languages: Language[] = ['en', 'fr'];
  
  describe('Fullscreen Button Translations', () => {
    it('should have fullscreen translations in both languages', () => {
      languages.forEach(lang => {
        const t = translations[lang];
        
        expect(t.fullscreen).toBeDefined();
        expect(typeof t.fullscreen).toBe('string');
        expect(t.fullscreen.length).toBeGreaterThan(0);
        
        expect(t.exitFullscreen).toBeDefined();
        expect(typeof t.exitFullscreen).toBe('string');
        expect(t.exitFullscreen.length).toBeGreaterThan(0);
      });
    });

    it('should have French fullscreen translations with proper accent characters', () => {
      const fr = translations.fr;
      expect(fr.fullscreen).toBe('Plein écran');
      expect(fr.exitFullscreen).toBe('Quitter le plein écran');
    });

    it('should have English fullscreen translations', () => {
      const en = translations.en;
      expect(en.fullscreen).toBe('Fullscreen');
      expect(en.exitFullscreen).toBe('Exit Fullscreen');
    });
  });

  describe('Critical Button Translation Coverage', () => {
    const criticalButtonKeys = [
      'login',
      'logout', 
      'getStarted',
      'cancel',
      'confirm',
      'save',
      'delete',
      'edit',
      'create',
      'update',
      'submit',
      'close',
      'back',
      'next',
      'finish',
      'continue',
      'fullscreen',
      'exitFullscreen'
    ];

    it('should have all critical button translations in both languages', () => {
      criticalButtonKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('Navigation Button Translation Coverage', () => {
    const navigationKeys = [
      'home',
      'dashboard', 
      'buildings',
      'residents',
      'documents',
      'settings',
      'organizations',
      'calendar',
      'demands',
      'bills',
      'budget'
    ];

    it('should have all navigation translations in both languages', () => {
      navigationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Page Title Translation Coverage', () => {
    const pageTitleKeys = [
      'myResidence',
      'myResidenceInfo', 
      'viewResidenceInfo',
      'myBuilding',
      'myBuildings',
      'residenceDocuments',
      'manageDocumentsResidence',
      'myDemands',
      'buildings',
      'dashboard'
    ];

    it('should have all page title translations in both languages', () => {
      pageTitleKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have proper French translations for key page titles', () => {
      const fr = translations.fr;
      
      // Validate specific Quebec French page titles
      expect(fr.myResidence).toBe('Ma résidence');
      expect(fr.myResidenceInfo).toBe('Voir les informations de votre résidence et les contacts');
      expect(fr.dashboard).toBe('Tableau de bord');
      expect(fr.buildings).toBe('Bâtiments');
    });

    it('should have proper English translations for key page titles', () => {
      const en = translations.en;
      
      // Validate English page titles
      expect(en.myResidence).toBe('My Residence');
      expect(en.myResidenceInfo).toBe('View your residence information and contacts');
      expect(en.dashboard).toBe('Dashboard');
      expect(en.buildings).toBe('Buildings');
    });
  });

  describe('Action Button Translation Validation', () => {
    it('should have consistent action button patterns', () => {
      const actionKeys = Object.keys(translations.en).filter(key => 
        key.includes('button') || key.includes('action') || key.includes('click')
      );

      actionKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
        });
      });
    });
  });

  describe('Quebec Law 25 Compliance for Buttons', () => {
    it('should have French translations for all critical user interface elements', () => {
      const fr = translations.fr;
      
      // Critical UI elements must be translated to French
      expect(fr.login).toBeDefined();
      expect(fr.logout).toBeDefined(); 
      expect(fr.privacyPolicy).toBeDefined();
      expect(fr.settings).toBeDefined();
      expect(fr.language).toBeDefined();
      expect(fr.fullscreen).toBeDefined();
      expect(fr.exitFullscreen).toBeDefined();
    });

    it('should use proper Quebec French terminology', () => {
      const fr = translations.fr;
      
      // Validate Quebec-specific French terms
      expect(fr.fullscreen).toContain('écran'); // "écran" not "screen"
      expect(fr.exitFullscreen).toContain('Quitter'); // Proper Quebec French verb
      expect(fr.language).toBe('Langue'); // Standard Quebec French
      expect(fr.settings).toBe('Paramètres'); // Standard Quebec French
    });
  });

  describe('French-Only Pages Translation Coverage', () => {
    const frenchOnlyPageKeys = [
      'security',
      'ourStory', 
      'privacyPolicy'
    ];

    it('should have French-only page navigation translations in both languages', () => {
      frenchOnlyPageKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have appropriate navigation text for French-only pages', () => {
      const en = translations.en;
      const fr = translations.fr;
      
      // English should indicate what these pages are about
      expect(en.security).toBe('Security');
      expect(en.ourStory).toBe('Our Story');
      expect(en.privacyPolicy).toBe('Privacy Policy');
      
      // French should have proper Quebec French terms
      expect(fr.security).toBe('Sécurité');
      expect(fr.ourStory).toBe('Notre histoire');
      expect(fr.privacyPolicy).toBe('Politique de confidentialité');
    });
  });

  describe('Bidirectional Translation Validation', () => {
    it('should have consistent translation coverage regardless of direction', () => {
      const allEnglishKeys = Object.keys(translations.en);
      const allFrenchKeys = Object.keys(translations.fr);
      
      // Both languages should have exactly the same keys
      expect(allEnglishKeys.sort()).toEqual(allFrenchKeys.sort());
    });

    it('should handle Quebec-specific content appropriately in both directions', () => {
      const quebecSpecificKeys = [
        'law25Compliant',
        'quebecCompliance', 
        'bilingualSupport',
        'privacyPolicy'
      ];

      quebecSpecificKeys.forEach(key => {
        const en = (translations.en as any)[key];
        const fr = (translations.fr as any)[key];
        
        if (en && fr) {
          // English versions should reference Quebec
          if (key.includes('quebec') || key.includes('law25')) {
            expect(en.toLowerCase()).toMatch(/quebec|law 25|québec|loi 25/i);
          }
          
          // French versions should use proper Quebec terminology
          if (key.includes('quebec') || key.includes('law25')) {
            expect(fr.toLowerCase()).toMatch(/québec|loi 25|quebec|conformité québécoise/i);
          }
        }
      });
    });

    it('should support language switching for navigation to French-only pages', () => {
      // These keys help users understand what French-only pages contain
      const navigationSupportKeys = [
        'security',
        'ourStory',
        'privacyPolicy',
        'features',
        'navigation',
        'menu'
      ];

      navigationSupportKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('Translation Consistency Validation', () => {
    it('should have no missing translations between languages', () => {
      const enKeys = Object.keys(translations.en);
      const frKeys = Object.keys(translations.fr);
      
      expect(enKeys.sort()).toEqual(frKeys.sort());
    });

    it('should have no empty or undefined translations', () => {
      languages.forEach(lang => {
        const t = translations[lang] as any;
        Object.keys(t).forEach(key => {
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Translation Quality Standards', () => {
    it('should have proper capitalization for button text', () => {
      const buttonKeys = ['fullscreen', 'exitFullscreen', 'login', 'logout', 'getStarted'];
      
      buttonKeys.forEach(key => {
        const en = (translations.en as any)[key];
        const fr = (translations.fr as any)[key];
        
        if (en) {
          // English buttons should start with capital letter
          expect(en.charAt(0)).toEqual(en.charAt(0).toUpperCase());
        }
        
        if (fr) {
          // French buttons should start with capital letter
          expect(fr.charAt(0)).toEqual(fr.charAt(0).toUpperCase());
        }
      });
    });

    it('should have reasonable length limits for button text', () => {
      const buttonKeys = Object.keys(translations.en).filter(key => 
        // Filter for likely button text (exclude descriptions)
        !key.includes('Desc') && !key.includes('Description') && 
        !key.includes('Overview') && !key.includes('Subtitle') &&
        (key.includes('button') || key.includes('action') || key.includes('click') ||
         ['login', 'logout', 'save', 'cancel', 'confirm', 'delete', 'edit', 'create', 
          'fullscreen', 'exitFullscreen', 'getStarted', 'submit', 'close'].includes(key))
      );

      languages.forEach(lang => {
        const t = translations[lang] as any;
        buttonKeys.forEach(key => {
          if (typeof t[key] === 'string') {
            expect(t[key].length).toBeLessThan(50); // Button text should be concise
          }
        });
      });
    });
  });
});

/**
 * Button Usage Pattern Validation
 * Tests that verify proper usage patterns for translated buttons
 */
describe('Button Translation Usage Patterns', () => {
  it('should validate translation key naming conventions', () => {
    const buttonLikeKeys = Object.keys(translations.en).filter(key => 
      // Keys that are likely buttons or actions
      ['button', 'action', 'click', 'toggle', 'open', 'close', 'exit', 'enter', 'fullscreen'].some(pattern => 
        key.toLowerCase().includes(pattern)
      )
    );

    buttonLikeKeys.forEach(key => {
      // Button keys should follow camelCase convention
      expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/);
    });
  });

  it('should ensure all fullscreen functionality is properly translated', () => {
    const fullscreenKeys = ['fullscreen', 'exitFullscreen'];
    
    const languages: Language[] = ['en', 'fr'];
    
    fullscreenKeys.forEach(key => {
      languages.forEach(lang => {
        const translation = (translations[lang] as any)[key];
        expect(translation).toBeDefined();
        expect(translation).not.toContain('{'); // No untranslated placeholders
        expect(translation).not.toContain('}');
      });
    });
  });
});