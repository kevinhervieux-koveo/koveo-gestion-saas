import { useLanguage } from '@/hooks/use-language';

interface HeaderProps {
  title: string;
  subtitle: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
          <p className="text-gray-600">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>{t('workspaceActive')}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
