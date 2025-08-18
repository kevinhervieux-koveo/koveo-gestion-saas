import { Link } from 'wouter';
import { colors, typography } from '@/styles/inline-styles';

export default function HomeStyled() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: typography.fontFamily,
      overflow: 'auto'
    }}>
      {/* Main Hero Section */}
      <div style={{
        padding: '6rem 2rem 4rem 2rem', // Extra top padding for fixed header
        textAlign: 'center' as const,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: 'bold',
          color: colors.gray[800],
          marginBottom: '1.5rem',
          lineHeight: '1.2'
        }}>
          Quebec Property Management
        </h1>
        
        <p style={{
          fontSize: '1.25rem',
          color: colors.gray[600],
          marginBottom: '3rem',
          maxWidth: '600px',
          margin: '0 auto 3rem auto',
          lineHeight: '1.6'
        }}>
          Comprehensive tools for residential communities in Quebec. 
          Manage properties, track maintenance, and ensure Law 25 compliance.
        </p>
        
        <Link href="/login">
          <div style={{
            background: colors.primary,
            color: colors.white,
            padding: '1rem 2rem',
            borderRadius: '0.5rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'inline-block',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = colors.primaryDark;
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = colors.primary;
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            Get Started
          </div>
        </Link>
      </div>

      {/* Features Section */}
      <div style={{
        padding: '4rem 2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {/* Feature Card 1 */}
          <div style={{
            background: colors.white,
            borderRadius: '0.75rem',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{
              fontSize: '2.5rem',
              marginBottom: '1rem'
            }}>🏢</div>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: colors.gray[800],
              marginBottom: '1rem'
            }}>
              Property Management
            </h3>
            <p style={{
              color: colors.gray[600],
              lineHeight: '1.6'
            }}>
              Manage buildings, units, and residents with comprehensive tools designed for Quebec's regulatory environment.
            </p>
          </div>

          {/* Feature Card 2 */}
          <div style={{
            background: colors.white,
            borderRadius: '0.75rem',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{
              fontSize: '2.5rem',
              marginBottom: '1rem'
            }}>⚖️</div>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: colors.gray[800],
              marginBottom: '1rem'
            }}>
              Law 25 Compliance
            </h3>
            <p style={{
              color: colors.gray[600],
              lineHeight: '1.6'
            }}>
              Built-in compliance tools to ensure your property management meets Quebec's privacy and data protection requirements.
            </p>
          </div>

          {/* Feature Card 3 */}
          <div style={{
            background: colors.white,
            borderRadius: '0.75rem',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{
              fontSize: '2.5rem',
              marginBottom: '1rem'
            }}>🛠️</div>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: colors.gray[800],
              marginBottom: '1rem'
            }}>
              Maintenance Tracking
            </h3>
            <p style={{
              color: colors.gray[600],
              lineHeight: '1.6'
            }}>
              Track maintenance requests, schedule repairs, and manage vendors with comprehensive workflow tools.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center' as const,
        padding: '3rem 2rem',
        color: colors.gray[500],
        borderTop: `1px solid ${colors.gray[200]}`,
        marginTop: '2rem'
      }}>
        <p>&copy; 2024 Koveo Gestion. All rights reserved.</p>
      </div>
    </div>
  );
}