export default function TestStyling() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          color: 'white',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          Koveo Gestion - Style Test
        </h1>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {/* Card 1 */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: '#1f2937'
            }}>Tailwind Classes Test</h2>
            <div className="bg-blue-500 text-white p-4 rounded">
              This should have blue background (if Tailwind works)
            </div>
            <div style={{
              background: '#3b82f6',
              color: 'white',
              padding: '1rem',
              borderRadius: '0.25rem',
              marginTop: '1rem'
            }}>
              This has inline blue background (always works)
            </div>
          </div>
          
          {/* Card 2 */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: '#1f2937'
            }}>System Status</h2>
            <ul style={{listStyle: 'none', padding: 0}}>
              <li style={{padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb'}}>
                ✓ CSS File Loaded
              </li>
              <li style={{padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb'}}>
                ✓ Inline Styles Working
              </li>
              <li style={{padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb'}}>
                ✓ React Rendering
              </li>
              <li style={{padding: '0.5rem 0'}}>
                ⚠️ Tailwind Classes: Testing...
              </li>
            </ul>
          </div>
          
          {/* Card 3 */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: '#1f2937'
            }}>Navigation</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <a href="/dashboard" style={{
                padding: '0.75rem 1rem',
                background: '#6366f1',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block'
              }}>
                Go to Dashboard
              </a>
              <a href="/" style={{
                padding: '0.75rem 1rem',
                background: '#10b981',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block'
              }}>
                Go to Home
              </a>
            </div>
          </div>
        </div>
        
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          background: 'rgba(255,255,255,0.9)',
          borderRadius: '1rem',
          textAlign: 'center'
        }}>
          <p style={{fontSize: '1.125rem', color: '#4b5563'}}>
            This test page uses inline styles to ensure visibility while diagnosing Tailwind CSS issues.
          </p>
          <p style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
            If you can see this page with purple gradient background and white cards, inline styles are working correctly.
          </p>
        </div>
      </div>
    </div>
  );
}