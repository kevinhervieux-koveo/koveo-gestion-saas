import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { X, Menu, Home, Wrench, Shield, BookOpen, FileText, Scale, Building2, Users, LogOut, User, Settings, Globe, UserPlus } from 'lucide-react';

interface HamburgerMenuProps {
  className?: string;
}

/**
 * Hamburger menu component for mobile navigation.
 */
export function HamburgerMenu({ className = '' }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();

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

  // Navigation items for public pages
  const publicNavItems = [
    { icon: Home, label: t('home'), path: '/', testId: 'nav-home' },
    { icon: Wrench, label: t('features'), path: '/features', testId: 'nav-features' },
    { icon: Shield, label: t('security'), path: '/security', testId: 'nav-security' },
    { icon: BookOpen, label: t('ourStory'), path: '/story', testId: 'nav-story' },
    { icon: FileText, label: t('privacyPolicy'), path: '/privacy-policy', testId: 'nav-privacy' },
    { icon: Scale, label: t('termsOfService'), path: '/terms-of-service', testId: 'nav-terms' },
  ];

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
          zIndex: '1000',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
        }}
        data-testid="menu-panel"
      >
        <div className="p-6 h-full flex flex-col" style={{ backgroundColor: '#ffffff', width: '100%', height: '100%' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold">Menu</h2>
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

          {/* Navigation Items */}
          <nav className="flex-1" style={{ backgroundColor: '#ffffff' }}>
            <ul className="space-y-2">
              {publicNavItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.path}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-12"
                      onClick={() => handleNavigation(item.path)}
                      data-testid={item.testId}
                    >
                      <IconComponent className="mr-3 h-5 w-5" />
                      {item.label}
                    </Button>
                  </li>
                );
              })}
            </ul>
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
          
          {/* User Section */}
          {user && (
            <div className="mt-auto border-t pt-4" style={{ backgroundColor: '#ffffff' }}>
              <div className="flex items-center mb-4 p-3 bg-muted/50 rounded-lg">
                <User className="h-8 w-8 text-muted-foreground mr-3" />
                <div>
                  <p className="font-medium text-sm">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-10"
                  onClick={() => handleNavigation('/profile')}
                  data-testid="nav-profile"
                >
                  <Settings className="mr-3 h-4 w-4" />
                  Profile Settings
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full justify-start h-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  data-testid="nav-logout"
                >
                  {isLoggingOut ? (
                    <>
                      <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Logging out...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-3 h-4 w-4" />
                      Logout
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}