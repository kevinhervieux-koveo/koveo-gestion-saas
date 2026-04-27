import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations, Translations } from '@/lib/i18n';

/**
 * Context type definition for the language provider.
 * Provides language state management and translation function.
 */
/**
 * Map of placeholder names to substitution values used by the `t()` helper.
 * Values are coerced to strings before being injected into the translation.
 */
type TranslationValues = Record<string, string | number>;

/**
 * Base keys (without the trailing `_one`/`_other` suffix) for translation
 * entries that have both singular and plural variants. Computed from the
 * `Translations` interface so `tp()` only accepts keys that actually have
 * both forms defined.
 */
type PluralBaseKey = {
  [K in keyof Translations]: K extends `${infer Base}_one`
    ? `${Base}_other` extends keyof Translations
      ? Base
      : never
    : never;
}[keyof Translations];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (_key: keyof typeof translations.en, _values?: TranslationValues) => string;
  tp: (_baseKey: PluralBaseKey, _count: number, _values?: TranslationValues) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Props interface for the LanguageProvider component.
 */
interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Cached `Intl.PluralRules` instances keyed by language. Constructing the
 * rules object is cheap but not free, so we memoize per-language to avoid
 * rebuilding on every `tp()` call.
 */
const pluralRulesCache: Partial<Record<Language, Intl.PluralRules>> = {};
const getPluralRules = (lang: Language): Intl.PluralRules => {
  let rules = pluralRulesCache[lang];
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache[lang] = rules;
  }
  return rules;
};

/**
 * Language provider component that manages application language state.
 * Provides translation functionality and language switching for the entire app.
 * Defaults to French ('fr') for Quebec property management context.
 *
 * @param {LanguageProviderProps} props - Component props.
 * @param {ReactNode} props.children - Child components that will have access to language context.
 * @returns {JSX.Element} Language context provider wrapper.
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
  // Initialize language from URL param (?lang=fr|en), then localStorage,
  // then default to French for Quebec.
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryLang = params.get('lang');
      if (queryLang === 'fr' || queryLang === 'en') {
        return queryLang;
      }
      const savedLanguage = localStorage.getItem('koveo-language') as Language;
      return savedLanguage || 'fr';
    }
    return 'fr';
  });

  // Save language preference to localStorage and sync <html lang> whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('koveo-language', language);
      document.documentElement.lang = language;
    }
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((current) => (current === 'en' ? 'fr' : 'en'));
  };

  /**
   * Look up a translated string by key and optionally substitute named
   * placeholders. Placeholders use the `{name}` syntax and are replaced with
   * the matching entry in `_values`.
   *
   * Example:
   *   t('projectFormCreatedDesc', { name: 'Roof repair' })
   *
   * Use named placeholders rather than splitting a sentence into prefix/suffix
   * keys: word order differs between languages and placeholders let translators
   * keep a single, natural-reading string per language.
   *
   * For strings whose wording changes with a count value (e.g. "1 element" vs
   * "5 elements"), use `tp()` instead so each language can supply its own
   * singular and plural forms.
   */
  const t = (_key: keyof typeof translations.en, _values?: TranslationValues): string => {
    const template = translations[language][_key] || _key;
    if (!_values) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = _values[name];
      return value === undefined || value === null ? match : String(value);
    });
  };

  /**
   * Pluralized translation helper. Picks the right form for `_count` using the
   * active language's CLDR plural rules (via `Intl.PluralRules`) and then
   * delegates to `t()` for `{name}` placeholder substitution. The count is
   * always injected as the `{count}` placeholder; pass any extra placeholders
   * via the third argument (they may override `count` if needed).
   *
   * Plural-aware strings are stored as TWO sibling translation keys with the
   * suffixes `_one` and `_other`. The base key (without the suffix) is what
   * gets passed to `tp()`:
   *
   *   wfElementsBulkRemoveWarning_one:
   *     'This will remove {count} selected element from the project. ...'
   *   wfElementsBulkRemoveWarning_other:
   *     'This will remove {count} selected elements from the project. ...'
   *
   *   tp('wfElementsBulkRemoveWarning', 1) // '... 1 selected element ...'
   *   tp('wfElementsBulkRemoveWarning', 5) // '... 5 selected elements ...'
   *
   * Plural categories per language used in this app:
   *  - English: 1 → `one`, everything else (including 0) → `other`
   *  - French:  0 and 1 → `one`, 2+ → `other`
   *
   * Any plural category other than `one` (e.g. `few`, `many`) maps to
   * `_other`; that is sufficient for English and French.
   */
  const tp = (
    _baseKey: PluralBaseKey,
    _count: number,
    _values?: TranslationValues,
  ): string => {
    const category = getPluralRules(language).select(_count);
    const suffix = category === 'one' ? '_one' : '_other';
    const fullKey = `${_baseKey}${suffix}` as keyof typeof translations.en;
    return t(fullKey, { count: _count, ...(_values ?? {}) });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, tp }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Custom hook to access language context and translation functionality.
 * Must be used within a LanguageProvider component tree.
 *
 * @returns {LanguageContextType} Language context with current language, setter, and translation function.
 * @throws {Error} If used outside of LanguageProvider.
 * @example
 * ```typescript
 * const { language, setLanguage, t } = useLanguage();
 * const title = t('welcome'); // Gets translated text
 * setLanguage('fr'); // Switch to French
 * ```
 */
export function useLanguage() {
  const context = useContext(LanguageContext);

  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
