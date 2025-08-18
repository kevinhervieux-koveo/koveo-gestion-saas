import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

export default function DocumentationStyled() {
  const { user } = useAuth();

  const documentationSections = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of using Koveo Gestion',
      icon: '🚀',
      items: [
        'Quick Start Guide',
        'User Account Setup',
        'Navigation Overview',
        'First Organization'
      ]
    },
    {
      title: 'Property Management',
      description: 'Manage buildings, residents, and operations',
      icon: '🏢',
      items: [
        'Creating Organizations',
        'Building Setup',
        'Resident Management',
        'Maintenance Requests'
      ]
    },
    {
      title: 'Financial Management',
      description: 'Budgeting, billing, and financial reporting',
      icon: '💰',
      items: [
        'Budget Planning',
        'Bill Generation',
        'Payment Tracking',
        'Financial Reports'
      ]
    },
    {
      title: 'Quebec Compliance',
      description: 'Law 25 and regulatory requirements',
      icon: '⚖️',
      items: [
        'Privacy Protection',
        'Data Compliance',
        'Audit Logging',
        'Legal Requirements'
      ]
    },
    {
      title: 'API Reference',
      description: 'Technical documentation for developers',
      icon: '🔧',
      items: [
        'Authentication API',
        'Organizations API',
        'Buildings API',
        'Users API'
      ]
    },
    {
      title: 'Troubleshooting',
      description: 'Common issues and solutions',
      icon: '🔍',
      items: [
        'Login Issues',
        'Permission Errors',
        'Data Import Problems',
        'Performance Issues'
      ]
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#f8fafc',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '280px',
        background: 'white',
        borderRight: '1px solid #e2e8f0',
        padding: '1.5rem',
        overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>
            K
          </div>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937'
          }}>
            KOVEO
          </span>
        </div>

        {/* Navigation */}
        <nav>
          <Link href="/dashboard">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              color: '#4b5563',
              textDecoration: 'none',
              marginBottom: '0.5rem',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
              <span>🏠</span>
              Dashboard
            </div>
          </Link>

          <div style={{
            color: '#9ca3af',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '1rem 0 0.5rem',
            padding: '0 0.75rem'
          }}>
            Admin
          </div>

          {[
            { icon: '🏢', label: 'Organizations', href: '/admin/organizations' },
            { icon: '📚', label: 'Documentation', href: '/admin/documentation', active: true },
            { icon: '🗺️', label: 'Roadmap', href: '/admin/roadmap' },
            { icon: '✅', label: 'Quality Assurance', href: '/admin/quality' },
            { icon: '🔐', label: 'RBAC Permissions', href: '/admin/permissions' }
          ].map((item, index) => (
            <Link key={index} href={item.href}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: item.active ? '#eff6ff' : 'transparent',
                color: item.active ? '#3b82f6' : '#4b5563',
                textDecoration: 'none',
                marginBottom: '0.5rem',
                cursor: 'pointer',
                fontWeight: item.active ? '500' : 'normal'
              }}
              onMouseOver={(e) => !item.active && (e.currentTarget.style.background = '#f1f5f9')}
              onMouseOut={(e) => !item.active && (e.currentTarget.style.background = 'transparent')}>
                <span>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '2rem',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            Documentation
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '1.125rem'
          }}>
            Comprehensive guides and API reference for Koveo Gestion property management platform
          </p>
        </div>

        {/* Search Bar */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '1.25rem' }}>🔍</span>
            <input
              type="text"
              placeholder="Search documentation..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '1rem',
                padding: '0.5rem 0',
                color: '#1f2937'
              }}
            />
          </div>
        </div>

        {/* Documentation Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '1.5rem'
        }}>
          {documentationSections.map((section, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f3f4f6',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '2rem'
                }}>
                  {section.icon}
                </div>
                <div>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '0.25rem'
                  }}>
                    {section.title}
                  </h3>
                  <p style={{
                    color: '#6b7280',
                    fontSize: '0.875rem'
                  }}>
                    {section.description}
                  </p>
                </div>
              </div>
              
              <div style={{
                display: 'grid',
                gap: '0.5rem'
              }}>
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    color: '#4b5563',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#3b82f6';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#4b5563';
                  }}>
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: '#3b82f6'
                    }}></div>
                    <span style={{ fontSize: '0.875rem' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div style={{
          marginTop: '3rem',
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '1rem'
          }}>
            Quick Links
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            {[
              { label: 'API Documentation', icon: '⚡', href: '/api-docs' },
              { label: 'Video Tutorials', icon: '🎥', href: '/tutorials' },
              { label: 'Community Forum', icon: '💬', href: '/forum' },
              { label: 'Support Center', icon: '❓', href: '/support' }
            ].map((link, index) => (
              <a key={index} href={link.href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: '#f8fafc',
                color: '#4b5563',
                textDecoration: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.color = '#3b82f6';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#4b5563';
              }}>
                <span>{link.icon}</span>
                <span style={{ fontWeight: '500' }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}