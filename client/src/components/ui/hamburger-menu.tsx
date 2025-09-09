import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import {
  X,
  Menu,
  Home,
  Wrench,
  Shield,
  BookOpen,
  FileText,
  Scale,
  Building2,
  Users,
  LogOut,
  User,
  Settings,
  Globe,
  UserPlus,
  DollarSign,
} from 'lucide-react';

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
      
      // Add document click listener to close menu when clicking outside
      const handleDocumentClick = (event: MouseEvent) => {
        const target = event.target as Element;
        const menuPanel = document.querySelector('[data-testid="menu-panel"]');
        const hamburgerButton = document.querySelector('[data-testid="hamburger-button"]');
        
        // Don't close if clicking on the hamburger button or inside the menu panel
        if (
          hamburgerButton?.contains(target) || 
          menuPanel?.contains(target)
        ) {
          return;
        }
        
        // Close menu for any other clicks
        closeMenu();
      };
      
      // Add listener with a small delay to avoid immediate closure
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleDocumentClick);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleDocumentClick);
      };
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
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Navigation items for public pages
  const publicNavItems = [
    { icon: Home, label: t('home'), path: '/', testId: 'nav-home' },
    { icon: Wrench, label: t('features'), path: '/features', testId: 'nav-features' },
    { icon: DollarSign, label: t('pricing'), path: '/pricing', testId: 'nav-pricing' },
    { icon: Shield, label: t('security'), path: '/security', testId: 'nav-security' },
    { icon: BookOpen, label: t('ourStory'), path: '/story', testId: 'nav-story' },
    { icon: FileText, label: t('privacyPolicy'), path: '/privacy-policy', testId: 'nav-privacy' },
    { icon: Scale, label: t('termsOfService'), path: '/terms-of-service', testId: 'nav-terms' },
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Hamburger Button */}
      <Button
        variant='ghost'
        size='icon'
        onClick={toggleMenu}
        className='relative z-50'
        data-testid='hamburger-button'
        aria-label={isOpen ? t('closeMenu') : t('openMenu')}
      >
        {isOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
      </Button>

      {/* Invisible Overlay for Click Outside */}
      {isOpen && (
        <div
          className='fixed inset-0'
          style={{ zIndex: 999 }}
          onClick={closeMenu}
          data-testid='menu-overlay'
        />
      )}

      {/* Menu Panel */}
      <div
        className={`fixed top-0 right-0 w-80 max-w-[80vw] shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: '#f9fafb',
          borderLeft: '1px solid #e5e7eb',
          zIndex: '1000',
          position: 'fixed',
          height: '100dvh', // Use dynamic viewport height for better mobile support
          maxHeight: '100vh', // Fallback for browsers that don't support dvh
        }}
        data-testid='menu-panel'
      >
        <div
          className='p-6 flex flex-col bg-gray-50 overflow-y-auto'
          style={{
            backgroundColor: '#f9fafb !important',
            width: '100%',
            height: '100%',
            position: 'relative',
            zIndex: '1001',
          }}
        >
          {/* Header */}
          <div className='flex items-center justify-between mb-8'>
            <h2 className='text-xl font-semibold'>Menu</h2>
            <Button
              variant='ghost'
              size='icon'
              onClick={closeMenu}
              className='h-8 w-8'
              data-testid='menu-close-button'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className='flex-1 bg-gray-50' style={{ backgroundColor: '#f9fafb !important' }}>
            <ul className='space-y-2'>
              {publicNavItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.path}>
                    <Button
                      variant='ghost'
                      className='w-full justify-start h-12 bg-transparent hover:bg-gray-100'
                      onClick={() => handleNavigation(item.path)}
                      data-testid={item.testId}
                    >
                      <IconComponent className='mr-3 h-5 w-5' />
                      {item.label}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Language and Auth Section */}
          {!user && (
            <div
              className='mt-auto border-t border-gray-300 pt-4 space-y-3 bg-gray-50'
              style={{ backgroundColor: '#f9fafb !important' }}
            >
              {/* Language Switcher */}
              <div className='flex items-center justify-center space-x-2'>
                <Globe className='h-4 w-4 text-gray-500' />
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-sm'
                  onClick={() => {
                    toggleLanguage();
                    closeMenu();
                  }}
                  data-testid='language-toggle'
                >
                  {language === 'en' ? 'Français' : 'English'}
                </Button>
              </div>

              {/* Authentication Buttons */}
              <div className='space-y-2'>
                <Button
                  variant='default'
                  className='w-full'
                  onClick={() => handleNavigation('/login')}
                  data-testid='nav-login'
                >
                  <UserPlus className='mr-2 h-4 w-4' />
                  {t('login')}
                </Button>
              </div>
            </div>
          )}

          {/* User Section */}
          {user && (
            <div className='mt-auto border-t pt-4'>
              <div className='flex items-center mb-4 p-3 bg-gray-100 rounded-lg'>
                <User className='h-8 w-8 text-gray-500 mr-3' />
                <div>
                  <p className='font-medium text-sm'>
                    {user.firstName} {user.lastName}
                  </p>
                  <p className='text-xs text-gray-500'>{user.email}</p>
                </div>
              </div>

              <div className='space-y-1'>
                <Button
                  variant='ghost'
                  className='w-full justify-start h-10'
                  onClick={() => handleNavigation('/settings/settings')}
                  data-testid='nav-profile'
                >
                  <Settings className='mr-3 h-4 w-4' />
                  Profile Settings
                </Button>

                <Button
                  variant='ghost'
                  className='w-full justify-start h-10 text-red-600 hover:text-red-700 hover:bg-red-50'
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  data-testid='nav-logout'
                >
                  {isLoggingOut ? (
                    <>
                      <div className='mr-3 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                      Logging out...
                    </>
                  ) : (
                    <>
                      <LogOut className='mr-3 h-4 w-4' />
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
