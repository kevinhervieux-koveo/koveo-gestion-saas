import { ArrowUp, Home, ShieldCheck, CheckCircle, Settings, User, Building, Users, DollarSign, FileText, AlertCircle, Lightbulb, LogOut, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useLanguage } from '@/hooks/use-language';
import { useState } from 'react';

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['owner']);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    );
  };

  const renderMenuButton = (section: typeof menuSections[0]) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedMenus.includes(section.key);
    
    return (
      <button
        onClick={() => toggleMenu(section.key)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <SectionIcon className="w-5 h-5" />
          <span>{section.name}</span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    );
  };

  const renderMenuItem = (item: any) => {
    const ItemIcon = item.icon;
    const isActive = location === item.href;
    
    return (
      <Link key={item.name} href={item.href}>
        <div
          className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
            isActive
              ? 'bg-koveo-light text-koveo-navy font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ItemIcon className="w-4 h-4" />
          <span>{item.name}</span>
        </div>
      </Link>
    );
  };

  const renderMenuSection = (section: typeof menuSections[0]) => {
    const isExpanded = expandedMenus.includes(section.key);
    
    return (
      <div key={section.key}>
        {renderMenuButton(section)}
        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {section.items.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  const handleLogout = () => {
    // Navigate to home page (external website)
    window.location.href = '/';
  };

  const menuSections = [
    {
      name: 'Residents',
      key: 'residents',
      icon: Users,
      items: [
        { name: 'Dashboard', href: '/residents/dashboard', icon: Home },
        { name: 'My Residence', href: '/residents/residence', icon: Home },
        { name: 'My Building', href: '/residents/building', icon: Building },
        { name: 'My Demands', href: '/residents/demands', icon: AlertCircle },
      ]
    },
    {
      name: 'Manager',
      key: 'manager', 
      icon: Building,
      items: [
        { name: 'Buildings', href: '/manager/buildings', icon: Building },
        { name: 'Residences', href: '/manager/residences', icon: Home },
        { name: 'Budget', href: '/manager/budget', icon: DollarSign },
        { name: 'Bills', href: '/manager/bills', icon: FileText },
        { name: 'Demands', href: '/manager/demands', icon: AlertCircle },
      ]
    },
    {
      name: 'Owner',
      key: 'owner',
      icon: User,
      items: [
        { name: 'Owner Dashboard', href: '/owner/dashboard', icon: Home },
        { name: 'Documentation', href: '/owner/documentation', icon: FileText },
        { name: 'Roadmap', href: '/owner/roadmap', icon: ShieldCheck },
        { name: 'Quality Assurance', href: '/owner/quality', icon: CheckCircle },
        { name: 'Suggestions', href: '/owner/suggestions', icon: Lightbulb },
      ]
    },
    {
      name: 'Settings',
      key: 'settings',
      icon: Settings,
      items: [
        { name: 'Settings', href: '/settings/settings', icon: Settings },
        { name: 'Bug Reports', href: '/settings/bug-reports', icon: AlertCircle },
        { name: 'Idea Box', href: '/settings/idea-box', icon: Lightbulb },
      ]
    },
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
        <div className="space-y-1">
          {menuSections.map(renderMenuSection)}
        </div>
        
        {/* Logout Button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
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
