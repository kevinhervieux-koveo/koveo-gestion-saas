import {
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import koveoLogo from '@assets/Koveo_logo (1)_1755288554223.jpg';
import { getFilteredNavigation, type NavigationSection } from '@/config/navigation';

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

/**
 * Sidebar navigation component with responsive mobile menu functionality.
 * @param root0
 * @param root0.isMobileMenuOpen
 * @param root0.onMobileMenuClose
 */
export function Sidebar({ isMobileMenuOpen = false, onMobileMenuClose }: SidebarProps = {}) {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { logout, user } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['admin', 'manager']);

  // Close mobile menu when clicking on navigation items
  const handleNavItemClick = () => {
    if (onMobileMenuClose) {
      onMobileMenuClose();
    }
  };

  // Close mobile menu on escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen && onMobileMenuClose) {
        onMobileMenuClose();
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
  }, [isMobileMenuOpen, onMobileMenuClose]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuName) ? prev.filter((name) => name !== menuName) : [...prev, menuName]
    );
  };

  const renderMenuButton = (section: NavigationSection) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedMenus.includes(section.key);

    return (
      <button
        onClick={() => toggleMenu(section.key)}
        className='w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors'
      >
        <div className='flex items-center space-x-3'>
          <SectionIcon className='w-5 h-5' />
          <span>{section.name}</span>
        </div>
        {isExpanded ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
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
          onClick={handleNavItemClick}
        >
          <ItemIcon className='w-4 h-4' />
          <span>{item.name}</span>
        </div>
      </Link>
    );
  };



  const renderMenuSection = (section: NavigationSection) => {
    const isExpanded = expandedMenus.includes(section.key);

    return (
      <div key={section.key}>
        {renderMenuButton(section)}
        {isExpanded && (
          <div className='ml-6 mt-1 space-y-1'>{section.items.map(renderMenuItem)}</div>
        )}
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onMobileMenuClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      {/* Logo Header */}
      <div className='p-6 border-b border-gray-200'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <Link href="/residents/residence" onClick={handleNavItemClick}>
              <img 
                src={koveoLogo} 
                alt="Koveo Gestion Logo" 
                className="h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          {/* Mobile close button */}
          {onMobileMenuClose && (
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={onMobileMenuClose}
              aria-label="Close navigation menu"
            >
              <X className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>

      {/* Language Switcher */}
      <div className='px-6 py-4 border-b border-gray-200'>
        <LanguageSwitcher />
      </div>

      {/* Navigation */}
      <nav className='flex-1 px-6 py-4'>
        {/* Navigation sections */}
        <div className='space-y-1'>{menuSections.map(renderMenuSection)}</div>

        {/* Logout Button */}
        <div className='mt-6 pt-4 border-t border-gray-200'>
          <button
            onClick={handleLogout}
            className='w-full flex items-center space-x-3 px-3 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors'
          >
            <LogOut className='w-5 h-5' />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* User Profile */}
      <div className='p-6 border-t border-gray-200'>
        <div className='flex items-center space-x-3'>
          <div className='w-8 h-8 bg-koveo-navy rounded-full flex items-center justify-center'>
            <span className="text-white text-sm font-medium">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </span>
          </div>
          <div>
            <p className='text-sm font-medium text-gray-900'>
              {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
            </p>
            <p className='text-xs text-gray-500'>
              {user?.role || 'User'}
            </p>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
