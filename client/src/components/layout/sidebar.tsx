import { LogOut, ChevronDown, ChevronRight, X, Linkedin, ChevronLeft } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { translations } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import koveoLogoK from '@assets/koveo_logo_k_1776982179758.jpg';
import koveoLogoWide from '@assets/koveo_logo_small_1777056266792.jpg';
import {
  getFilteredNavigation,
  type NavigationSection,
  type NavigationItem,
} from '@/config/navigation';

import { useMobileMenu } from '@/hooks/use-mobile-menu';
import { useCommonSpacesAccess } from '@/hooks/use-common-spaces-access';
import { useSidebarState } from '@/hooks/use-sidebar-state';

interface SidebarProps {
  /**
   * When true, the sidebar always renders in expanded mode and never shows the
   * desktop collapse toggle. Used for the mobile drawer instance, where the
   * sidebar is meant to always appear in its full form.
   */
  forceExpanded?: boolean;
}

/**
 * Sidebar navigation component with responsive mobile menu functionality and
 * a collapsible desktop rail.
 */
export function Sidebar({ forceExpanded = false }: SidebarProps) {
  const { isMobileMenuOpen, closeMobileMenu } = useMobileMenu();
  const [location] = useLocation();
  const search = useSearch();
  const { t, language } = useLanguage();
  const { logout, user } = useAuth();
  const { hasCommonSpacesAccess } = useCommonSpacesAccess();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const { isCollapsed, toggleCollapsed: toggleCollapsedShared } = useSidebarState();

  // Effective collapsed state: the mobile drawer instance never collapses.
  const collapsed = forceExpanded ? false : isCollapsed;

  const toggleCollapsed = () => {
    // When collapsing, close any open submenus so the rail stays clean.
    // When expanding, keep the user's previously expanded section state.
    if (!isCollapsed) {
      setExpandedMenus([]);
    }
    toggleCollapsedShared();
  };

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
        return prev.filter((name) => name !== menuName);
      } else {
        return [...prev, menuName];
      }
    });
  };

  // Helper function to determine which pages should preserve query parameters
  const shouldPreserveParams = (href: string): boolean => {
    const managerPages = [
      '/manager/buildings',
      '/manager/residences',
      '/manager/budget',
      '/manager/bills',
      '/manager/demands',
      '/manager/user-management',
      '/manager/common-spaces-stats',
      '/manager/maintenance/inventory',
      '/manager/maintenance/projects',
    ];

    return managerPages.some((page) => href.startsWith(page));
  };

  // Helper function to build URL with preserved query parameters
  const buildHrefWithParams = (href: string): string => {
    if (!shouldPreserveParams(href)) {
      return href;
    }

    const urlParams = new URLSearchParams(search);
    const organizationId = urlParams.get('organization');
    const buildingId = urlParams.get('building');

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

  const getTranslated = (nameKey: string) => t(nameKey as keyof typeof translations.en);

  // Wrap a trigger with a tooltip when the sidebar is collapsed.
  const withTooltip = (label: string, child: React.ReactNode, key?: string) => {
    if (!collapsed) return child;
    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{child}</TooltipTrigger>
        <TooltipContent side='right'>{label}</TooltipContent>
      </Tooltip>
    );
  };

  const renderMenuButton = (section: NavigationSection) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedMenus.includes(section._key);
    const label = getTranslated(section.nameKey);

    if (collapsed) {
      // Collapsed: clicking a section icon expands the sidebar and opens that section.
      const button = (
        <button
          onClick={() => {
            toggleCollapsed();
            setExpandedMenus((prev) =>
              prev.includes(section._key) ? prev : [...prev, section._key]
            );
          }}
          aria-label={label}
          className='w-full flex items-center justify-center px-2 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors'
        >
          <SectionIcon className='w-5 h-5' />
        </button>
      );
      return withTooltip(label, button);
    }

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
          <span>{label}</span>
        </div>
        {isExpanded ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
      </button>
    );
  };

  const renderMenuItem = (item: NavigationItem) => {
    const ItemIcon = item.icon;
    const label = getTranslated(item.nameKey);

    // Nested collapsible item
    if (item.items && item._key) {
      const isExpanded = expandedMenus.includes(item._key);

      if (collapsed) {
        // In collapsed mode, expand the rail and open this submenu on click.
        const button = (
          <button
            onClick={() => {
              toggleCollapsed();
              setExpandedMenus((prev) =>
                prev.includes(item._key!) ? prev : [...prev, item._key!]
              );
            }}
            aria-label={label}
            className='w-full flex items-center justify-center px-2 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors'
          >
            <ItemIcon className='w-4 h-4' />
          </button>
        );
        return <div key={item.nameKey}>{withTooltip(label, button)}</div>;
      }

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
              <span>{label}</span>
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

    // Regular link item
    const hrefWithParams = buildHrefWithParams(item.href!);
    const isActive = location === item.href || location.split('?')[0] === item.href;

    if (collapsed) {
      const link = (
        <Link href={hrefWithParams}>
          <div
            aria-label={label}
            className={`flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-colors ${
              isActive
                ? 'bg-koveo-light text-koveo-navy'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={handleNavItemClick}
          >
            <ItemIcon className='w-4 h-4' />
          </div>
        </Link>
      );
      return <div key={item.nameKey}>{withTooltip(label, link)}</div>;
    }

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
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
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
  const effectiveRole = user?.role || (user ? 'tenant' : undefined);
  const roleLabel = user?.role || 'User';

  // Get filtered navigation based on user role and common spaces access
  const menuSections = getFilteredNavigation(effectiveRole).map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.nameKey === 'commonSpaces' && !hasCommonSpacesAccess) {
        return false;
      }
      return true;
    }),
  }));

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';
  const horizontalPad = collapsed ? 'px-2' : 'px-6';

  return (
    <TooltipProvider delayDuration={150}>
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
          fixed md:static inset-y-0 left-0 z-50 ${sidebarWidth} bg-white shadow-lg border-r border-gray-200 flex flex-col transform transition-all duration-300 ease-in-out
          md:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo Header */}
        <div className={`relative ${collapsed ? 'p-3' : 'p-6'} border-b border-gray-200`}>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <Link href='/dashboard/overview' onClick={handleNavItemClick}>
                {collapsed ? (
                  <div
                    className='h-10 w-10 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity'
                    aria-label='Koveo Gestion'
                  >
                    <img
                      src={koveoLogoK}
                      alt='Koveo Gestion'
                      className='h-10 w-10 object-contain rounded'
                    />
                  </div>
                ) : (
                  <div className='h-12 flex items-center cursor-pointer hover:opacity-80 transition-opacity'>
                    <img
                      src={koveoLogoWide}
                      alt='Koveo Gestion Inc.'
                      className='h-10 w-auto object-contain'
                    />
                  </div>
                )}
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

          {/* Desktop collapse toggle (hidden on mobile and when forceExpanded) */}
          {!forceExpanded && (
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              data-testid='button-toggle-sidebar'
              className='hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-koveo-navy transition-colors'
            >
              {collapsed ? (
                <ChevronRight className='h-3.5 w-3.5' />
              ) : (
                <ChevronLeft className='h-3.5 w-3.5' />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${horizontalPad} py-4 overflow-y-auto`}>
          <div className='space-y-1'>
            {menuSections.map((section) => (
              <div key={section._key}>
                {renderMenuButton(section)}
                {!collapsed && expandedMenus.includes(section._key) && (
                  <div className='ml-6 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200'>
                    {section.items.map((item) => renderMenuItem(item))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Logout Button */}
          <div className='mt-6 pt-4 border-t border-gray-200'>
            {collapsed ? (
              withTooltip(
                t('logout'),
                <button
                  onClick={handleLogout}
                  aria-label={t('logout')}
                  className='w-full flex items-center justify-center px-2 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors'
                >
                  <LogOut className='w-5 h-5' />
                </button>
              )
            ) : (
              <button
                onClick={handleLogout}
                className='w-full flex items-center space-x-3 px-3 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors'
              >
                <LogOut className='w-5 h-5' />
                <span>{t('logout')}</span>
              </button>
            )}
          </div>
        </nav>

        {/* User Profile */}
        <div className={`${collapsed ? 'p-3' : 'p-6'} border-t border-gray-200`}>
          {collapsed ? (
            withTooltip(
              `${displayName} (${roleLabel})`,
              <div className='flex items-center justify-center'>
                <div className='w-8 h-8 bg-koveo-navy rounded-full flex items-center justify-center'>
                  <span className='text-white text-sm font-medium'>{initials}</span>
                </div>
              </div>
            )
          ) : (
            <div className='flex items-center space-x-3'>
              <div className='w-8 h-8 bg-koveo-navy rounded-full flex items-center justify-center'>
                <span className='text-white text-sm font-medium'>{initials}</span>
              </div>
              <div>
                <p className='text-sm font-medium text-gray-900'>{displayName}</p>
                <p className='text-xs text-gray-500'>{roleLabel}</p>
              </div>
            </div>
          )}
        </div>

        {/* Follow Us */}
        <div className={`${collapsed ? 'px-2' : 'px-6'} pb-4 border-t border-gray-200 pt-4`}>
          {!collapsed && (
            <p className='text-xs text-gray-500 mb-2 text-center'>
              {language === 'fr' ? 'Suivez-nous' : 'Follow Us'}
            </p>
          )}
          {collapsed ? (
            withTooltip(
              'LinkedIn',
              <a
                href='https://www.linkedin.com/company/koveo-gestion-inc/'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='LinkedIn'
                className='flex items-center justify-center bg-[#0A66C2] hover:bg-[#004182] text-white p-2 rounded-lg transition-colors w-full'
              >
                <Linkedin className='h-4 w-4' />
              </a>
            )
          ) : (
            <a
              href='https://www.linkedin.com/company/koveo-gestion-inc/'
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-3 py-2 rounded-lg transition-colors text-sm w-full'
            >
              <Linkedin className='h-4 w-4' />
              <span>LinkedIn</span>
            </a>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
