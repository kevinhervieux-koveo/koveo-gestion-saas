import { LogOut, ChevronDown, ChevronRight, X } from 'lucide-react';
import { SiLinkedin } from 'react-icons/si';
import { Link, useLocation, useSearch } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { translations } from '@/lib/i18n';
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
import { useCommonSpacesAccess } from '@/hooks/use-common-spaces-access';

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
  const search = useSearch();
  const { t, language } = useLanguage();
  const { logout, user } = useAuth();
  const { hasCommonSpacesAccess } = useCommonSpacesAccess();
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

  // Helper function to determine which pages should preserve query parameters
  const shouldPreserveParams = (href: string): boolean => {
    // Preserve params for manager pages that use hierarchical selection
    const managerPages = [
      '/manager/buildings',
      '/manager/residences',
      '/manager/budget',
      '/manager/bills',
      '/manager/demands',
      '/manager/user-management',
      '/manager/common-spaces-stats',
      '/manager/maintenance/inventory',
      '/manager/maintenance/projects'
    ];
    
    return managerPages.some(page => href.startsWith(page));
  };

  // Helper function to build URL with preserved query parameters
  const buildHrefWithParams = (href: string): string => {
    if (!shouldPreserveParams(href)) {
      return href;
    }

    // Parse current URL parameters
    const urlParams = new URLSearchParams(search);
    const organizationId = urlParams.get('organization');
    const buildingId = urlParams.get('building');
    
    // If we have organization or building parameters, preserve them
    if (organizationId || buildingId) {
      const newParams = new URLSearchParams();
      
      if (organizationId) {
        newParams.set('organization', organizationId);
      }
      
      if (buildingId) {
        newParams.set('building', buildingId);
      }
      
      const queryString = newParams.toString();
      return queryString ? `${href}?${queryString}` : href;
    }
    
    return href;
  };

  const renderMenuButton = (section: NavigationSection) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedMenus.includes(section._key);

    // Use translation keys from i18n system
    const getTranslatedSectionName = (nameKey: string) => {
      return t(nameKey as keyof typeof translations.en);
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

    // Use translation keys from i18n system
    const getTranslatedName = (nameKey: string) => {
      return t(nameKey as keyof typeof translations.en);
    };

    // Check if this item has sub-items (is a nested collapsible item)
    if (item.items && item._key) {
      const isExpanded = expandedMenus.includes(item._key);
      
      return (
        <div key={item.nameKey}>
          <button
            onClick={() => toggleMenu(item._key!)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isExpanded
                ? 'bg-koveo-light text-koveo-navy shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className='flex items-center space-x-3'>
              <ItemIcon className='w-4 h-4' />
              <span>{getTranslatedName(item.nameKey)}</span>
            </div>
            {isExpanded ? <ChevronDown className='w-3 h-3' /> : <ChevronRight className='w-3 h-3' />}
          </button>
          {isExpanded && (
            <div className='ml-6 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200'>
              {item.items.map((subItem) => renderMenuItem(subItem))}
            </div>
          )}
        </div>
      );
    }

    // Regular navigation item with href
    const hrefWithParams = buildHrefWithParams(item.href!);
    const isActive = location === item.href || location.split('?')[0] === item.href;
    
    return (
      <Link key={item.nameKey} href={hrefWithParams}>
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
      // Fallback: still redirect to login page
      window.location.href = '/login';
    } catch (error) {
      // Logout error
      // Still redirect on error
      window.location.href = '/login';
    }
  };

  // Derive safe display values so the UI never renders the literal "undefined".
  const displayName = (() => {
    if (!user) return 'Guest';
    const first = (user.firstName || '').trim();
    const last = (user.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    return full || (user as any).username || (user as any).email || 'User';
  })();
  const initials = (() => {
    if (!user) return '?';
    const f = (user.firstName || '').trim().charAt(0);
    const l = (user.lastName || '').trim().charAt(0);
    const combined = `${f}${l}`;
    if (combined) return combined.toUpperCase();
    const fallback = ((user as any).username || (user as any).email || '').trim().charAt(0);
    return (fallback || '?').toUpperCase();
  })();
  // Fall back to the lowest-privilege role so authenticated users always see
  // at least the resident/tenant navigation instead of an empty list.
  const effectiveRole = user?.role || (user ? 'tenant' : undefined);
  const roleLabel = user?.role || 'User';

  // Get filtered navigation based on user role and common spaces access
  const menuSections = getFilteredNavigation(effectiveRole).map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      // Filter out common spaces item if user has no access to buildings with common spaces
      if (item.nameKey === 'commonSpaces' && !hasCommonSpacesAccess) {
        return false;
      }
      return true;
    }),
  }));

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
              <Link href='/dashboard/overview' onClick={handleNavItemClick}>
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
              <span className='text-white text-sm font-medium'>{initials}</span>
            </div>
            <div>
              <p className='text-sm font-medium text-gray-900'>{displayName}</p>
              <p className='text-xs text-gray-500'>{roleLabel}</p>
            </div>
          </div>
        </div>

        {/* Follow Us */}
        <div className='px-6 pb-4 border-t border-gray-200 pt-4'>
          <p className='text-xs text-gray-500 mb-2 text-center'>
            {language === 'fr' ? 'Suivez-nous' : 'Follow Us'}
          </p>
          <a
            href='https://www.linkedin.com/company/koveo-gestion-inc/'
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-3 py-2 rounded-lg transition-colors text-sm w-full'
          >
            <SiLinkedin className='h-4 w-4' />
            <span>LinkedIn</span>
          </a>
        </div>
      </aside>
    </>
  );
}
