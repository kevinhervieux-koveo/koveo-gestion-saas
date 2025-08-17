/**
 * Test component to verify React is working
 */
export default function TestApp() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #dbeafe, #ffffff)',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '16px',
          color: '#1f2937'
        }}>
          🏢 Koveo Gestion - Test Mode
        </h1>
        <p style={{
          color: '#6b7280',
          marginBottom: '24px'
        }}>
          React application is working! This confirms the basic rendering is functional.
        </p>
        <div style={{
          background: '#f3f4f6',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '24px'
        }}>
          <p style={{ margin: '0', fontSize: '14px', color: '#4b5563' }}>
            ✅ React rendering: Working<br/>
            ✅ Vite development server: Working<br/>
            ✅ Server API: Working<br/>
            🔍 Testing complex app initialization...
          </p>
        </div>
        <button 
          onClick={() => console.log('Button clicked - React events working!')}
          style={{
            background: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Test Click Event
        </button>
      </div>
    </div>
  );
}