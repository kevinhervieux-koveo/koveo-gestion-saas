/**
 * Minimal test app to isolate rendering issues
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

function TestApp() {
  return (
    <div style={{
      padding: '40px',
      fontFamily: 'Arial, sans-serif',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{fontSize: '3rem', marginBottom: '20px', textAlign: 'center'}}>
        🏢 Koveo Gestion
      </h1>
      <p style={{fontSize: '1.2rem', marginBottom: '30px', textAlign: 'center', maxWidth: '600px'}}>
        Quebec Property Management Platform - Testing Component Rendering
      </p>
      <div style={{
        background: 'rgba(255,255,255,0.1)', 
        padding: '30px', 
        borderRadius: '10px', 
        backdropFilter: 'blur(10px)',
        textAlign: 'center'
      }}>
        <p>✅ React is rendering correctly</p>
        <p>✅ Styles are working</p>
        <p>✅ Component loading successful</p>
        <button 
          style={{
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            marginTop: '20px'
          }}
          onClick={() => alert('Button clicked! React is working properly.')}
        >
          Test Button
        </button>
      </div>
    </div>
  );
}

export default function TestAppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <TestApp />
    </QueryClientProvider>
  );
}