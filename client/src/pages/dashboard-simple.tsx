import { useAuth } from '@/hooks/use-auth';

export default function DashboardSimple() {
  const { user } = useAuth();
  
  console.log('DashboardSimple rendering with user:', user?.email);
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      overflow: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          color: 'white',
          fontSize: '3rem',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '2rem',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🏢 Koveo Gestion Dashboard
        </h1>
        
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <h2 style={{
            color: '#1f2937',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            Welcome, {user?.firstName || 'User'}!
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1rem'
          }}>
            You are logged in as: <strong>{user?.email}</strong>
          </p>
          <p style={{
            color: '#6b7280'
          }}>
            Role: <span style={{
              background: '#3b82f6',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.375rem',
              fontWeight: 'bold',
              display: 'inline-block'
            }}>{user?.role?.toUpperCase()}</span>
          </p>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          {['Organizations', 'Buildings', 'Settings', 'Documentation'].map((item, index) => (
            <a
              key={index}
              href={`/${item.toLowerCase()}`}
              style={{
                background: 'white',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                textAlign: 'center',
                textDecoration: 'none',
                color: '#1f2937',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'block'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>
                {index === 0 ? '🏢' : index === 1 ? '🏗️' : index === 2 ? '⚙️' : '📚'}
              </div>
              {item}
            </a>
          ))}
        </div>
        
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '1rem',
          padding: '2rem',
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <h3 style={{
            color: '#1f2937',
            marginBottom: '1rem'
          }}>
            System Status
          </h3>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            flexWrap: 'wrap'
          }}>
            {[
              { name: 'Database', status: 'Online', color: '#10b981' },
              { name: 'Auth', status: 'Active', color: '#3b82f6' },
              { name: 'Storage', status: 'Ready', color: '#8b5cf6' }
            ].map((service, index) => (
              <div key={index} style={{
                textAlign: 'center'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: service.color,
                  margin: '0 auto 0.5rem',
                  boxShadow: `0 0 10px ${service.color}`
                }}></div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{service.name}</div>
                <div style={{ color: service.color, fontWeight: 'bold' }}>{service.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}