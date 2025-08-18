import { Link } from 'wouter';

export default function HomeStyled() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1rem 0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.25rem'
            }}>
              K
            </div>
            <span style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              Koveo Gestion
            </span>
          </div>
          
          <Link href="/dashboard">
            <div style={{
              background: '#3b82f6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'inline-block'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#2563eb';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              Go to Dashboard
            </div>
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{
        padding: '6rem 2rem',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '2rem',
          lineHeight: '1.1'
        }}>
          Modern Property Management
          <br />
          <span style={{ color: '#3b82f6' }}>for Quebec</span>
        </h1>
        
        <p style={{
          fontSize: '1.25rem',
          color: '#6b7280',
          maxWidth: '800px',
          margin: '0 auto 3rem',
          lineHeight: '1.6'
        }}>
          Comprehensive property management solution designed specifically for 
          Quebec's regulatory environment. Manage buildings, residents, finances, 
          and compliance all in one secure platform.
        </p>
        
        <Link href="/dashboard">
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white',
            padding: '1rem 2rem',
            borderRadius: '0.75rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }}>
            Start Managing Today
            <span style={{ fontSize: '1.25rem' }}>→</span>
          </div>
        </Link>
      </div>

      {/* Features Grid */}
      <div style={{
        background: 'white',
        padding: '6rem 2rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <h2 style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            color: '#1f2937',
            textAlign: 'center',
            marginBottom: '4rem'
          }}>
            Everything You Need
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {[
              {
                icon: '🏢',
                title: 'Building Management',
                description: 'Complete oversight of all your properties with detailed building profiles and maintenance tracking.'
              },
              {
                icon: '👥',
                title: 'Resident Portal',
                description: 'Streamlined communication and service requests for all residents and tenants.'
              },
              {
                icon: '💰',
                title: 'Financial Planning',
                description: 'Budgeting, billing, and financial reporting designed for Quebec property management.'
              },
              {
                icon: '⚖️',
                title: 'Law 25 Compliance',
                description: 'Built-in privacy protection and data compliance features for Quebec regulations.'
              },
              {
                icon: '📊',
                title: 'Analytics & Insights',
                description: 'Comprehensive reporting and analytics to optimize your property operations.'
              },
              {
                icon: '🔒',
                title: 'Enterprise Security',
                description: 'Bank-level security with role-based access control and audit logging.'
              }
            ].map((feature, index) => (
              <div key={index} style={{
                background: '#f8fafc',
                borderRadius: '1rem',
                padding: '2rem',
                border: '1px solid #e2e8f0',
                transition: 'all 0.3s',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
                e.currentTarget.style.background = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.background = '#f8fafc';
              }}>
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  color: '#6b7280',
                  lineHeight: '1.6',
                  textAlign: 'center'
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #334155)',
        color: 'white',
        padding: '6rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem'
          }}>
            Ready to Transform Your Property Management?
          </h2>
          <p style={{
            fontSize: '1.25rem',
            color: '#cbd5e1',
            marginBottom: '2rem'
          }}>
            Join Quebec property managers who trust Koveo Gestion for their operations.
          </p>
          <Link href="/dashboard">
            <div style={{
              background: 'white',
              color: '#1f2937',
              padding: '1rem 2rem',
              borderRadius: '0.75rem',
              fontSize: '1.125rem',
              fontWeight: '600',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'inline-block'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(255,255,255,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              Get Started Today
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}