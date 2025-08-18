import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

export default function SimpleDashboard() {
  const { user, logout } = useAuth();
  
  if (!user) {
    return (
      <div style={{ padding: '20px', background: '#ffffff', minHeight: '100vh' }}>
        <h1>Loading user...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', background: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        borderLeft: '4px solid #007bff'
      }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#212529' }}>Koveo Gestion Dashboard</h1>
        <p style={{ margin: 0, color: '#6c757d' }}>
          Welcome, {user.firstName || user.email} | Role: {user.role}
        </p>
        <button 
          onClick={logout}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      {/* Navigation Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px' 
      }}>
        
        {/* Admin Section */}
        {user.role === 'admin' && (
          <>
            <Link href="/simple-admin-organizations">
              <div style={{
                background: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'box-shadow 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#007bff' }}>🏢 Organizations</h3>
                <p style={{ margin: 0, color: '#6c757d' }}>
                  Manage organizations, buildings, and administrative settings
                </p>
              </div>
            </Link>

            <Link href="/simple-admin-users">
              <div style={{
                background: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#28a745' }}>👥 User Management</h3>
                <p style={{ margin: 0, color: '#6c757d' }}>
                  Manage users, roles, and permissions
                </p>
              </div>
            </Link>

            <Link href="/simple-admin-reports">
              <div style={{
                background: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#ffc107' }}>📊 Reports & Analytics</h3>
                <p style={{ margin: 0, color: '#6c757d' }}>
                  View system reports and analytics
                </p>
              </div>
            </Link>
          </>
        )}

        {/* Manager Section */}
        {(user.role === 'admin' || user.role === 'manager') && (
          <>
            <Link href="/simple-manager-buildings">
              <div style={{
                background: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#17a2b8' }}>🏠 Buildings</h3>
                <p style={{ margin: 0, color: '#6c757d' }}>
                  Manage buildings and properties
                </p>
              </div>
            </Link>

            <Link href="/simple-manager-finances">
              <div style={{
                background: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#20c997' }}>💰 Financial Management</h3>
                <p style={{ margin: 0, color: '#6c757d' }}>
                  Manage budgets, bills, and financial reports
                </p>
              </div>
            </Link>
          </>
        )}

        {/* Common Section */}
        <Link href="/simple-settings">
          <div style={{
            background: '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '20px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
          onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
          >
            <h3 style={{ margin: '0 0 10px 0', color: '#6f42c1' }}>⚙️ Settings</h3>
            <p style={{ margin: 0, color: '#6c757d' }}>
              Configure your account and application settings
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}