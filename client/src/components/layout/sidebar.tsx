import { ArrowUp, Home, ShieldCheck, CheckCircle, GitBranch, Settings, User } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useLanguage } from '@/hooks/use-language';

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();

  const navigation = [
    { name: t('dashboard'), href: '/', icon: Home, current: location === '/' },
    { name: t('pillarFramework'), href: '/pillars', icon: ShieldCheck, current: location === '/pillars' },
    { name: t('qualityAssurance'), href: '/quality', icon: CheckCircle, current: location === '/quality' },
    { name: t('workflowSetup'), href: '/workflow', icon: GitBranch, current: location === '/workflow' },
    { name: t('configuration'), href: '/config', icon: Settings, current: location === '/config' },
  ];

  return (
    <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      {/* Logo Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-koveo-navy rounded-lg flex items-center justify-center">
            <ArrowUp className="text-white text-lg" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-koveo-navy">Koveo Gestion</h1>
            <p className="text-sm text-koveo-silver">Development Framework</p>
          </div>
        </div>
      </div>

      {/* Language Switcher */}
      <div className="px-6 py-4 border-b border-gray-200">
        <LanguageSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-6 py-4">
        <div className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                    item.current
                      ? 'bg-koveo-light text-koveo-navy'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-6 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-koveo-navy rounded-full flex items-center justify-center">
            <User className="text-white text-sm" size={16} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{t('developer')}</p>
            <p className="text-xs text-gray-500">{t('frameworkAdmin')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
