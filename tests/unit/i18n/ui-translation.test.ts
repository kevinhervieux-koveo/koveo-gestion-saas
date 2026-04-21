import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../../client/src/lib/i18n.ts';

const languages: Language[] = ['en', 'fr'];

describe('UI Translation Coverage', () => {
  describe('Key Completeness', () => {
    it('should have French translations for all English keys', () => {
      const enKeys = Object.keys(translations.en);
      const frKeys = Object.keys(translations.fr);
      const missingInFr = enKeys.filter(key => !frKeys.includes(key));
      expect(missingInFr).toEqual([]);
    });

    it('should have English translations for all French keys', () => {
      const enKeys = Object.keys(translations.en);
      const frKeys = Object.keys(translations.fr);
      const missingInEn = frKeys.filter(key => !enKeys.includes(key));
      expect(missingInEn).toEqual([]);
    });

    it('should have non-empty string values for all keys in both languages', () => {
      const emptyKeys: string[] = [];
      for (const lang of languages) {
        const t = translations[lang];
        for (const [key, value] of Object.entries(t)) {
          if (typeof value !== 'string' || value.length === 0) {
            emptyKeys.push(`${key} (${lang})`);
          }
        }
      }
      expect(emptyKeys).toEqual([]);
    });
  });

  describe('Quebec French Terminology', () => {
    it('should use "Courriel" for email', () => {
      expect(translations.fr.email).toBe('Courriel');
    });

    it('should use "Connexion" for login', () => {
      expect(translations.fr.login).toBe('Connexion');
    });

    it('should use "Déconnexion" for logout', () => {
      expect(translations.fr.logout).toBe('Déconnexion');
    });
  });

  describe('Translation Length Ratios', () => {
    it('should maintain reasonable French-to-English length ratios', () => {
      const extremeRatios: string[] = [];
      for (const key of Object.keys(translations.en)) {
        const en = (translations.en as Record<string, string>)[key];
        const fr = (translations.fr as Record<string, string>)[key];
        if (en && fr && en.length > 3 && fr.length > 3) {
          const ratio = fr.length / en.length;
          if (ratio < 0.2 || ratio > 5.0) {
            extremeRatios.push(`${key}: en="${en}" fr="${fr}" ratio=${ratio.toFixed(2)}`);
          }
        }
      }
      expect(extremeRatios).toEqual([]);
    });
  });

  describe('Key Existence for Critical UI Elements', () => {
    const criticalKeys = [
      'login', 'logout', 'dashboard', 'buildings', 'residences',
      'demands', 'documents', 'users', 'loading', 'error',
      'cancel', 'confirm', 'status', 'role', 'email',
    ];

    it('should have all critical UI keys defined', () => {
      for (const key of criticalKeys) {
        for (const lang of languages) {
          const value = (translations[lang] as Record<string, string>)[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
        }
      }
    });
  });

  describe('Coverage Metrics', () => {
    it('should have a reasonable number of translation keys', () => {
      const enCount = Object.keys(translations.en).length;
      const frCount = Object.keys(translations.fr).length;
      expect(enCount).toBeGreaterThan(100);
      expect(frCount).toBeGreaterThan(100);
      expect(enCount).toBe(frCount);
    });
  });
});
