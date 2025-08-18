import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function DashboardSimple() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  console.log('DashboardSimple rendering with user:', user?.email);
  
  // Redirect based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        // Redirect admin users directly to organizations page
        setLocation('/admin/organizations');
      } else if (user.role === 'manager') {
        // Redirect managers to buildings page
        setLocation('/manager/buildings');
      } else {
        // Redirect residents/tenants to their residence page
        setLocation('/residents/residence');
      }
    }
  }, [user, setLocation]);
  
  // Show a simple loading message while redirecting
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#f9fafb'
    }}>
      <div style={{
        textAlign: 'center'
      }}>
        <h2 style={{
          color: '#374151',
          fontSize: '1.5rem',
          marginBottom: '1rem'
        }}>
          Loading...
        </h2>
        <p style={{
          color: '#6b7280'
        }}>
          Redirecting to your dashboard...
        </p>
      </div>
    </div>
  );
}