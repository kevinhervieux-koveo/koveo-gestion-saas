import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations } from '@/lib/i18n';

/**
 * Context type definition for the language provider.
 * Provides language state management and translation function.
 */
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (_key: keyof typeof translations.en) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Props interface for the LanguageProvider component.
 */
interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Language provider component that manages application language state.
 * Provides translation functionality and language switching for the entire app.
 * Defaults to French ('fr') for Quebec property management context.
 *
 * @param {LanguageProviderProps} props - Component props.
 * @param {ReactNode} props.children - Child components that will have access to language context.
 * @returns {JSX.Element} Language context provider wrapper.
 */
/**
 * LanguageProvider function.
 * @param root0
 * @param root0.children
 * @returns Function result.
 */
/**
 * LanguageProvider component.
 * @param props - Component props.
 * @param props.children - React children elements.
 * @returns JSX element.
 */
/**
 * Language provider function.
 * @param { children } - { children } parameter.
 */
export function /**
 * Language provider function.
 * @param { children } - { children } parameter.
 */ /**
 * Language provider function.
 * @param { children } - { children } parameter.
 */

LanguageProvider({ children }: LanguageProviderProps) {
  // Initialize language from localStorage or default to French for Quebec
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('koveo-language') as Language;
      return savedLanguage || 'fr'; // Default to French for Quebec
    }
    return 'fr';
  });

  // Save language preference to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('koveo-language', language);
    }
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((current) => (current === 'en' ? 'fr' : 'en'));
  };

  const t = (_key: keyof typeof translations.en): string => {
    return translations[language][_key] || _key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
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
/**
 * UseLanguage function.
 * @returns Function result.
 */
/**
 * UseLanguage custom hook.
 * @returns Hook return value.
 */
/**
 * Use language function.
 */
export function /**
 * Use language function.
 */ /**
 * Use language function.
 */

useLanguage() {
  const context = useContext(LanguageContext); /**
   * If function.
   * @param context === undefined - context === undefined parameter.
   */ /**
   * If function.
   * @param context === undefined - context === undefined parameter.
   */

  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
