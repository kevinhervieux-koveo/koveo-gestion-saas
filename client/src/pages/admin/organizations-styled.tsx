import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import { Link } from 'wouter';

export default function OrganizationsStyled() {
  const { user } = useAuth();
  const [refreshCommand] = useState('npm run validate:quick');

  // Mock data for now - in real app this would come from API
  const stats = {
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 4,
    propertyAdmins: 4
  };

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

        {/* Language Toggle */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          borderRadius: '0.5rem',
          padding: '0.25rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: '#334155',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}>
            EN
          </div>
          <div style={{
            color: '#64748b',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}>
            FR
          </div>
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

          <Link href="/admin/organizations">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#eff6ff',
              color: '#3b82f6',
              textDecoration: 'none',
              marginBottom: '0.5rem',
              fontWeight: '500'
            }}>
              <span>🏢</span>
              Organizations
            </div>
          </Link>

          {[
            { icon: '📚', label: 'Documentation', href: '/admin/documentation' },
            { icon: '🗺️', label: 'Roadmap', href: '/admin/roadmap' },
            { icon: '✅', label: 'Quality Assurance', href: '/admin/quality' },
            { icon: '💡', label: 'Suggestions', href: '/admin/suggestions' },
            { icon: '🔐', label: 'RBAC Permissions', href: '/admin/permissions' }
          ].map((item, index) => (
            <Link key={index} href={item.href}>
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
                <span>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          ))}

          <div style={{
            color: '#9ca3af',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '1rem 0 0.5rem',
            padding: '0 0.75rem'
          }}>
            Settings
          </div>

          <Link href="/settings/settings">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              color: '#4b5563',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
              <span>⚙️</span>
              Settings
            </div>
          </Link>
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Admin Dashboard
            </h1>
            <p style={{
              color: '#6b7280',
              marginBottom: '1rem'
            }}>
              Property management overview and insights
            </p>
          </div>
          
          <div style={{
            background: '#dcfce7',
            color: '#166534',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e'
            }}></div>
            Workspace Active
          </div>
        </div>

        {/* Refresh Command */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ color: '#6b7280' }}>⚡ Refresh Command:</span>
          <code style={{
            background: '#e2e8f0',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            color: '#1f2937'
          }}>
            {refreshCommand}
          </code>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {[
            { 
              title: 'Total Organizations', 
              value: stats.totalOrganizations, 
              icon: '🏢',
              color: '#3b82f6'
            },
            { 
              title: 'Active Organizations', 
              value: stats.activeOrganizations, 
              icon: '💰',
              color: '#10b981'
            },
            { 
              title: 'Total Users', 
              value: stats.totalUsers, 
              icon: '👥',
              color: '#6b7280'
            },
            { 
              title: 'Property Admins', 
              value: stats.propertyAdmins, 
              icon: '👨‍💼',
              color: '#3b82f6'
            }
          ].map((stat, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f3f4f6'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.5rem'
              }}>
                <div style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {stat.title}
                </div>
                <div style={{
                  fontSize: '1.5rem'
                }}>
                  {stat.icon}
                </div>
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: stat.color
              }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Organizations Section */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <span style={{ fontSize: '1.25rem' }}>🏢</span>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              Organizations
            </h2>
          </div>
          
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: '#6b7280'
          }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem',
              opacity: 0.3
            }}>
              🏢
            </div>
            <p style={{
              fontSize: '1.125rem',
              marginBottom: '1rem'
            }}>
              No organizations found
            </p>
            <p style={{
              fontSize: '0.875rem'
            }}>
              Create your first organization to get started with property management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}