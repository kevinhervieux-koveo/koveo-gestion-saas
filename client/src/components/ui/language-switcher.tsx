import { useLanguage } from '@/hooks/use-language';
import { Language } from '@/lib/i18n';

/**
 * Language toggle component for switching between English and French.
 * Provides bilingual support as required by Quebec property management regulations.
 *
 * @returns {JSX.Element} Toggle buttons for English/French language selection.
 * @example
 * ```typescript
 * function AppHeader() {
 *   return (
 *     <header>
 *       <div className="flex items-center gap-4">
 *         <h1>Koveo Gestion</h1>
 *         <LanguageSwitcher />
 *       </div>
 *     </header>
 *   );
 * }
 * ```
 */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className='flex bg-gray-100 rounded-lg p-1'>
      <button
        data-testid="button-language-en"
        onClick={() => setLanguage('en')}
        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
          language === 'en' ? 'bg-koveo-navy text-white' : 'text-koveo-navy hover:bg-gray-200'
        }`}
      >
        EN
      </button>
      <button
        data-testid="button-language-fr"
        onClick={() => setLanguage('fr')}
        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
          language === 'fr' ? 'bg-koveo-navy text-white' : 'text-koveo-navy hover:bg-gray-200'
        }`}
      >
        FR
      </button>
    </div>
  );
}