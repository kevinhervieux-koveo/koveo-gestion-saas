import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { colors, layout, logoStyle, getNavItemStyle } from '@/styles/inline-styles';

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

interface StyledLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export function StyledLayout({ children, currentPath }: StyledLayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const activePath = currentPath || location;

  // Navigation items based on user role
  const adminNavItems: NavItem[] = [
    { icon: '🏢', label: 'Organizations', href: '/admin/organizations' },
    { icon: '📚', label: 'Documentation', href: '/admin/documentation' },
    { icon: '🗺️', label: 'Roadmap', href: '/admin/roadmap' },
    { icon: '✅', label: 'Quality Assurance', href: '/admin/quality' },
    { icon: '💡', label: 'Suggestions', href: '/admin/suggestions' },
    { icon: '🔐', label: 'RBAC Permissions', href: '/admin/permissions' }
  ];

  const managerNavItems: NavItem[] = [
    { icon: '🏢', label: 'Buildings', href: '/manager/buildings' },
    { icon: '🏠', label: 'Residences', href: '/manager/residences' },
    { icon: '💰', label: 'Budget', href: '/manager/budget' },
    { icon: '📋', label: 'Bills', href: '/manager/bills' },
    { icon: '📨', label: 'Demands', href: '/manager/demands' }
  ];

  const settingsNavItems: NavItem[] = [
    { icon: '⚙️', label: 'Settings', href: '/settings/settings' },
    { icon: '🐛', label: 'Bug Reports', href: '/settings/bug-reports' }
  ];

  return (
    <div style={layout.container}>
      {/* Sidebar */}
      <div style={layout.sidebar}>
        {/* Logo */}
        <div style={logoStyle.container}>
          <img 
            src="/assets/koveo-logo-k.jpg" 
            alt="Koveo"
            style={{
              height: '32px',
              width: '32px',
              borderRadius: '6px'
            }}
            onError={(e) => {
              // Fallback to styled K if logo fails to load
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div style={{
            ...logoStyle.icon,
            display: 'none'
          }}>K</div>
          <span style={logoStyle.text}>KOVEO</span>
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
        <nav>
          {/* Dashboard Link */}
          <Link href="/dashboard">
            <div 
              style={getNavItemStyle(activePath === '/dashboard')}
              onMouseOver={(e) => {
                if (activePath !== '/dashboard') {
                  e.currentTarget.style.background = colors.gray[100];
                }
              }}
              onMouseOut={(e) => {
                if (activePath !== '/dashboard') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span>🏠</span>
              Dashboard
            </div>
          </Link>

          {/* Admin Section */}
          {user?.role === 'admin' && (
            <>
              <div style={{
                color: colors.gray[400],
                fontSize: '0.75rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '1rem 0 0.5rem',
                padding: '0 0.75rem'
              }}>
                Admin
              </div>
              {adminNavItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div 
                    style={getNavItemStyle(activePath === item.href)}
                    onMouseOver={(e) => {
                      if (activePath !== item.href) {
                        e.currentTarget.style.background = colors.gray[100];
                      }
                    }}
                    onMouseOut={(e) => {
                      if (activePath !== item.href) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              ))}
            </>
          )}

          {/* Manager Section */}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <>
              <div style={{
                color: colors.gray[400],
                fontSize: '0.75rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '1rem 0 0.5rem',
                padding: '0 0.75rem'
              }}>
                Manager
              </div>
              {managerNavItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div 
                    style={getNavItemStyle(activePath === item.href)}
                    onMouseOver={(e) => {
                      if (activePath !== item.href) {
                        e.currentTarget.style.background = colors.gray[100];
                      }
                    }}
                    onMouseOut={(e) => {
                      if (activePath !== item.href) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              ))}
            </>
          )}

          {/* Settings Section */}
          <div style={{
            color: colors.gray[400],
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '1rem 0 0.5rem',
            padding: '0 0.75rem'
          }}>
            Settings
          </div>
          {settingsNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div 
                style={getNavItemStyle(activePath === item.href)}
                onMouseOver={(e) => {
                  if (activePath !== item.href) {
                    e.currentTarget.style.background = colors.gray[100];
                  }
                }}
                onMouseOut={(e) => {
                  if (activePath !== item.href) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={layout.main}>
        {children}
      </div>
    </div>
  );
}