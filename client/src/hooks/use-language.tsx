import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations } from '@/lib/i18n';

/**
 * Context type definition for the language provider.
 * Provides language state management and translation function.
 */
interface LanguageContextType {
  language: Language;
  setLanguage: (_lang: Language) => void;
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
export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: keyof typeof translations.en): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
