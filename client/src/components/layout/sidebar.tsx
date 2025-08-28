import { LogOut, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import koveoLogo from '@/assets/koveo-logo.jpg';
import {
  getFilteredNavigation,
  type NavigationSection,
  type NavigationItem,
} from '@/config/navigation';

import { useMobileMenu } from '@/hooks/use-mobile-menu';

/**
 * Sidebar navigation component with responsive mobile menu functionality.
 */
/**
 * Sidebar function.
 * @returns Function result.
 */
export function Sidebar() {
  const { isMobileMenuOpen, closeMobileMenu } = useMobileMenu();
  const [location] = useLocation();
  const { t, language } = useLanguage();
  const { logout, user } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Close mobile menu when clicking on navigation items
  const handleNavItemClick = () => {
    if (closeMobileMenu) {
      closeMobileMenu();
    }
  };

  // Close mobile menu on escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen && closeMobileMenu) {
        closeMobileMenu();
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen, closeMobileMenu]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) => {
      const isCurrentlyExpanded = prev.includes(menuName);
      if (isCurrentlyExpanded) {
        // Collapse this menu - remove it from expanded menus
        return prev.filter((name) => name !== menuName);
      } else {
        // Expand this menu - add it to expanded menus
        return [...prev, menuName];
      }
    });
  };

  const renderMenuButton = (section: NavigationSection) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedMenus.includes(section._key);

    // Use translation keys from i18n system
    const getTranslatedSectionName = (nameKey: string) => {
      return t(nameKey);
    };

    return (
      <button
        onClick={() => toggleMenu(section._key)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
          isExpanded
            ? 'bg-koveo-light text-koveo-navy shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <div className='flex items-center space-x-3'>
          <SectionIcon className='w-5 h-5' />
          <span>{getTranslatedSectionName(section.nameKey)}</span>
        </div>
        {isExpanded ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
      </button>
    );
  };

  const renderMenuItem = (item: NavigationItem) => {
    const ItemIcon = item.icon;
    const isActive = location === item.href;

    // Use translation keys from i18n system
    const getTranslatedName = (nameKey: string) => {
      return t(nameKey);
    };

    return (
      <Link key={item.nameKey} href={item.href}>
        <div
          className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
            isActive
              ? 'bg-koveo-light text-koveo-navy font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          onClick={handleNavItemClick}
        >
          <ItemIcon className='w-4 h-4' />
          <span>{getTranslatedName(item.nameKey)}</span>
        </div>
      </Link>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_error) {
      console.error('Logout failed:', _error);
      // Fallback: still redirect to login page
      window.location.href = '/login';
    }
  };

  // Get filtered navigation based on user role
  const menuSections = getFilteredNavigation(user?.role);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden'
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        {/* Logo Header */}
        <div className='p-6 border-b border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <Link href='/dashboard/quick-actions' onClick={handleNavItemClick}>
                <div className='h-12 flex items-center cursor-pointer hover:opacity-80 transition-opacity'>
                  <img src={koveoLogo} alt='Koveo Gestion' className='h-10 w-auto object-contain' />
                </div>
              </Link>
            </div>
            {/* Mobile close button */}
            <Button
              variant='ghost'
              size='sm'
              className='md:hidden'
              onClick={closeMobileMenu}
              aria-label='Close navigation menu'
            >
              <X className='h-6 w-6' />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className='flex-1 px-6 py-4'>
          {/* Navigation sections */}
          <div className='space-y-1'>
            {menuSections.map((section) => (
              <div key={section._key}>
                {renderMenuButton(section)}
                {expandedMenus.includes(section._key) && (
                  <div className='ml-6 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200'>
                    {section.items.map((item) => renderMenuItem(item))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Logout Button */}
          <div className='mt-6 pt-4 border-t border-gray-200'>
            <button
              onClick={handleLogout}
              className='w-full flex items-center space-x-3 px-3 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors'
            >
              <LogOut className='w-5 h-5' />
              <span>{t('logout')}</span>
            </button>
          </div>
        </nav>

        {/* User Profile */}
        <div className='p-6 border-t border-gray-200'>
          <div className='flex items-center space-x-3'>
            <div className='w-8 h-8 bg-koveo-navy rounded-full flex items-center justify-center'>
              <span className='text-white text-sm font-medium'>
                {user?.firstName?.charAt(0).toUpperCase()}
                {user?.lastName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className='text-sm font-medium text-gray-900'>
                {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
              </p>
              <p className='text-xs text-gray-500'>{user?.role || 'User'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
