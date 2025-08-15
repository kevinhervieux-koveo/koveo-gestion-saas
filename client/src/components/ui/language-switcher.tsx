import { useLanguage } from '@/hooks/use-language';
import { Language } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setLanguage('en')}
        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
          language === 'en'
            ? 'bg-koveo-navy text-white'
            : 'text-koveo-navy hover:bg-gray-200'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('fr')}
        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
          language === 'fr'
            ? 'bg-koveo-navy text-white'
            : 'text-koveo-navy hover:bg-gray-200'
        }`}
      >
        FR
      </button>
    </div>
  );
}
