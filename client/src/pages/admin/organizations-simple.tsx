import { useAuth } from '@/hooks/use-auth';

export default function OrganizationsSimple() {
  const { user } = useAuth();
  
  console.log('OrganizationsSimple rendering with user:', user?.email);
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#ffffff',
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      overflow: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          color: '#1f2937',
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem'
        }}>
          Organizations Management
        </h1>
        
        <p style={{
          color: '#6b7280',
          marginBottom: '2rem'
        }}>
          Admin user: {user?.email} ({user?.role})
        </p>
        
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{
            color: '#1f2937',
            fontSize: '1.25rem',
            marginBottom: '1rem'
          }}>
            Organizations List
          </h2>
          
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '0.375rem',
            padding: '1rem'
          }}>
            <p style={{ color: '#6b7280' }}>
              Organizations data will be loaded here. This is a simplified version to ensure the page works.
            </p>
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            background: '#dbeafe',
            border: '1px solid #93c5fd',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <h3 style={{ 
              color: '#1e40af',
              margin: '0 0 0.5rem 0',
              fontSize: '1rem'
            }}>
              Total Organizations
            </h3>
            <p style={{ 
              color: '#1e40af',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              margin: 0
            }}>
              Loading...
            </p>
          </div>
          
          <div style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <h3 style={{ 
              color: '#166534',
              margin: '0 0 0.5rem 0',
              fontSize: '1rem'
            }}>
              Active Organizations
            </h3>
            <p style={{ 
              color: '#166534',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              margin: 0
            }}>
              Loading...
            </p>
          </div>
          
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <h3 style={{ 
              color: '#92400e',
              margin: '0 0 0.5rem 0',
              fontSize: '1rem'
            }}>
              Buildings
            </h3>
            <p style={{ 
              color: '#92400e',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              margin: 0
            }}>
              Loading...
            </p>
          </div>
          
          <div style={{
            background: '#fce7f3',
            border: '1px solid #f9a8d4',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <h3 style={{ 
              color: '#9d174d',
              margin: '0 0 0.5rem 0',
              fontSize: '1rem'
            }}>
              Total Users
            </h3>
            <p style={{ 
              color: '#9d174d',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              margin: 0
            }}>
              Loading...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}