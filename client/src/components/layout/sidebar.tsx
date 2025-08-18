import {
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import koveoLogo from '@/assets/koveo-logo.jpg';
import { getFilteredNavigation, type NavigationSection } from '@/config/navigation';
import { colors } from '@/styles/inline-styles';

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

/**
 * Sidebar navigation component with responsive mobile menu functionality.
 */
export function Sidebar({ isMobileMenuOpen = false, onMobileMenuClose }: SidebarProps = {}) {
  const [location] = useLocation();
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

  const getNavItemStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    background: isActive ? colors.primaryLight : 'transparent',
    color: isActive ? colors.primary : colors.gray[600],
    textDecoration: 'none',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    fontWeight: isActive ? '500' : 'normal',
    transition: 'all 0.2s'
  });

  const renderMenuButton = (section: NavigationSection) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedMenus.includes(section.key);

    return (
      <button
        onClick={() => toggleMenu(section.key)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: colors.gray[700],
          marginBottom: '0.5rem',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = colors.gray[100];
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <SectionIcon style={{ width: '16px', height: '16px', color: colors.gray[500] }} />
          <span>{section.label}</span>
        </div>
        {isExpanded ? (
          <ChevronDown style={{ width: '16px', height: '16px', color: colors.gray[400] }} />
        ) : (
          <ChevronRight style={{ width: '16px', height: '16px', color: colors.gray[400] }} />
        )}
      </button>
    );
  };

  const renderMenuItem = (item: any) => {
    const isActive = location === item.href;
    const ItemIcon = item.icon;

    return (
      <Link key={item.href} href={item.href}>
        <div
          style={getNavItemStyle(isActive)}
          onClick={handleNavItemClick}
          onMouseOver={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = colors.gray[100];
            }
          }}
          onMouseOut={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <ItemIcon style={{ width: '16px', height: '16px' }} />
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
          <div style={{ marginLeft: '1.5rem', marginTop: '0.25rem', marginBottom: '1rem' }}>
            {section.items.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40
          }}
          className="md:hidden"
          onClick={onMobileMenuClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          background: colors.white,
          borderRight: `1px solid ${colors.gray[200]}`,
          padding: '1.5rem',
          overflowY: 'auto',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out',
          zIndex: 50,
          boxShadow: isMobileMenuOpen ? '0 10px 25px rgba(0,0,0,0.15)' : 'none',
          display: 'flex',
          flexDirection: 'column'
        }}
        className="md:translate-x-0"
      >
        {/* Mobile close button */}
        {isMobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem'
          }} className="md:hidden">
            <Button variant="ghost" size="sm" onClick={onMobileMenuClose}>
              <X size={20} />
            </Button>
          </div>
        )}

        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2rem'
        }}>
          <Link href="/dashboard" onClick={handleNavItemClick}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              textDecoration: 'none'
            }}>
              <img 
                src={koveoLogo} 
                alt="Koveo"
                style={{
                  height: '32px',
                  width: '32px',
                  borderRadius: '6px'
                }}
                onLoad={() => console.log('Logo loaded successfully')}
                onError={(e) => {
                  console.error('Logo failed to load:', e);
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                borderRadius: '6px',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>K</div>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: colors.gray[800]
              }}>KOVEO</span>
            </div>
          </Link>
        </div>

        {/* Language Toggle */}
        <div style={{
          display: 'flex',
          background: colors.gray[100],
          borderRadius: '0.5rem',
          padding: '0.25rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: colors.gray[700],
            color: colors.white,
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}>
            EN
          </div>
          <div style={{
            color: colors.gray[400],
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}>
            FR
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1 }}>
          {/* Dashboard Link */}
          <Link href="/dashboard">
            <div 
              style={getNavItemStyle(location === '/dashboard')}
              onClick={handleNavItemClick}
              onMouseOver={(e) => {
                if (location !== '/dashboard') {
                  e.currentTarget.style.background = colors.gray[100];
                }
              }}
              onMouseOut={(e) => {
                if (location !== '/dashboard') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span>🏠</span>
              Dashboard
            </div>
          </Link>

          {/* Navigation sections */}
          <div style={{ marginTop: '1rem' }}>
            {menuSections.map(renderMenuSection)}
          </div>
        </nav>

        {/* Logout Button */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: `1px solid ${colors.gray[200]}`
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: colors.danger,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = colors.dangerLight;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut style={{ width: '16px', height: '16px' }} />
            <span>Logout</span>
          </button>
        </div>

        {/* User Profile */}
        <div style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: colors.primary,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: '500' }}>
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </span>
            </div>
            <div>
              <p style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: colors.gray[900],
                margin: 0
              }}>
                {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
              </p>
              <p style={{
                fontSize: '0.75rem',
                color: colors.gray[500],
                margin: 0
              }}>
                {user?.role || 'User'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}