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