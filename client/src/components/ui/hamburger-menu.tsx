import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { X, Menu, Home, Wrench, Shield, BookOpen, FileText, Scale, Building2, Users, LogOut, User, Settings, Globe, UserPlus, ChevronDown, ChevronRight } from 'lucide-react';

interface HamburgerMenuProps {
  className?: string;
}

/**
 * Hamburger menu component for mobile navigation.
 */
export function HamburgerMenu({ className = '' }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionKey) 
        ? prev.filter(key => key !== sectionKey)
        : [...prev, sectionKey]
    );
  };

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  // Close menu when clicking outside or on navigation
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavigation = (path: string) => {
    setLocation(path);
    closeMenu();
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      closeMenu();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Navigation sections for public pages
  const publicSections = [
    {
      key: 'main',
      name: 'Main Navigation',
      icon: Home,
      items: [
        { icon: Home, label: t('home'), path: '/', testId: 'nav-home' },
        { icon: Wrench, label: t('features'), path: '/features', testId: 'nav-features' },
        { icon: Shield, label: t('security'), path: '/security', testId: 'nav-security' },
        { icon: BookOpen, label: t('ourStory'), path: '/story', testId: 'nav-story' }
      ]
    },
    {
      key: 'legal',
      name: 'Legal Pages',
      icon: FileText,
      items: [
        { icon: FileText, label: t('privacyPolicy'), path: '/privacy-policy', testId: 'nav-privacy' },
        { icon: Scale, label: t('termsOfService'), path: '/terms-of-service', testId: 'nav-terms' }
      ]
    }
  ];
  
  const renderSection = (section: any) => {
    const isExpanded = expandedSections.includes(section.key);
    const SectionIcon = section.icon;
    
    return (
      <div key={section.key}>
        <button
          onClick={() => toggleSection(section.key)}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          data-testid={`section-${section.key}`}
        >
          <div className="flex items-center space-x-3">
            <SectionIcon className="w-5 h-5" />
            <span>{section.name}</span>
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {section.items.map((item: any) => {
              const ItemIcon = item.icon;
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  className="w-full justify-start h-10 text-sm"
                  onClick={() => handleNavigation(item.path)}
                  data-testid={item.testId}
                >
                  <ItemIcon className="mr-3 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hamburger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMenu}
        className="relative z-50"
        data-testid="hamburger-button"
        aria-label={isOpen ? t('closeMenu') : t('openMenu')}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeMenu}
          data-testid="menu-overlay"
        />
      )}

      {/* Menu Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[80vw] shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e5e7eb',
          opacity: '1',
          zIndex: '1000'
        }}
        data-testid="menu-panel"
      >
        <div className="p-6 h-full flex flex-col" style={{ backgroundColor: '#ffffff', width: '100%', height: '100%' }}>
          {/* Logo Header */}
          <div className="pb-6 mb-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src="/favicon.ico" 
                  alt="Koveo Gestion" 
                  className="h-8 w-8 rounded object-cover"
                />
                <span className="text-lg font-semibold text-gray-900">Menu</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMenu}
                className="h-8 w-8"
                data-testid="menu-close-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation Sections */}
          <nav className="flex-1" style={{ backgroundColor: '#ffffff' }}>
            <div className="space-y-2">
              {publicSections.map(renderSection)}
            </div>
          </nav>

          {/* Language and Auth Section */}
          {!user && (
            <div className="mt-auto border-t pt-4 space-y-3" style={{ backgroundColor: '#ffffff' }}>
              {/* Language Switcher */}
              <div className="flex items-center justify-center space-x-2">
                <Globe className="h-4 w-4 text-gray-500" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm"
                  onClick={() => {
                    toggleLanguage();
                    closeMenu();
                  }}
                  data-testid="language-toggle"
                >
                  {language === 'en' ? 'Français' : 'English'}
                </Button>
              </div>
              
              {/* Authentication Buttons */}
              <div className="space-y-2">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => handleNavigation('/login')}
                  data-testid="nav-login"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t('signIn')}
                </Button>
              </div>
            </div>
          )}
          
          {/* Logout Section */}
          {user && (
            <div className="mt-6 pt-4 border-t border-gray-200" style={{ backgroundColor: '#ffffff' }}>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center space-x-3 px-3 py-3 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors"
                data-testid="nav-logout"
              >
                {isLoggingOut ? (
                  <>
                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>{language === 'fr' ? 'Déconnexion...' : 'Logging out...'}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-5 h-5" />
                    <span>{language === 'fr' ? 'Déconnexion' : 'Logout'}</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* User Profile */}
          {user && (
            <div className="mt-4 pt-4 border-t border-gray-200" style={{ backgroundColor: '#ffffff' }}>
              <div className="flex items-center space-x-3 px-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.first_name?.charAt(0).toUpperCase()}{user.last_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user.role || 'User'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}