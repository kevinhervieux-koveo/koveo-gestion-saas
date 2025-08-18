import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { colors, typography } from '@/styles/inline-styles';

export function TopHeader() {
  const { user, logout } = useAuth();

  const handleSignOut = () => {
    logout();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '60px',
      background: colors.white,
      borderBottom: `1px solid ${colors.gray[200]}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      fontFamily: typography.fontFamily
    }}>
      {/* Logo */}
      <Link href="/">
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer'
          }}
          onClick={() => {
            // Scroll to top when logo is clicked
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}>
          <img 
            src="/assets/koveo-logo-full.jpg" 
            alt="Koveo Gestion Inc."
            style={{
              height: '40px',
              width: 'auto'
            }}
            onError={(e) => {
              console.log('Full logo failed to load, trying K logo');
              // Fallback to K logo if main logo fails to load
              const target = e.currentTarget as HTMLImageElement;
              target.src = '/assets/koveo-logo-k.jpg';
              target.style.width = '40px';
              target.onerror = () => {
                console.log('K logo also failed, using fallback K');
                // Final fallback to styled K
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              };
            }}
            onLoad={() => {
              console.log('Logo loaded successfully');
            }}
          />
          {/* Final fallback logo */}
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #334155, #1e293b)',
            borderRadius: '8px',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.white,
            fontWeight: 'bold',
            fontSize: '1.25rem'
          }}>
            K
          </div>
        </div>
      </Link>

      {/* Navigation and Auth */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        {/* Go to Dashboard Button */}
        {user && (
          <Link href="/dashboard">
            <div style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: colors.primary,
              color: colors.white,
              fontSize: '0.875rem',
              fontWeight: '500',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = colors.primaryDark;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = colors.primary;
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              Go to Dashboard
            </div>
          </Link>
        )}

        {/* Authentication Buttons */}
        {user ? (
          <button
            onClick={handleSignOut}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: 'transparent',
              color: colors.gray[600],
              fontSize: '0.875rem',
              fontWeight: '500',
              border: `1px solid ${colors.gray[300]}`,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = colors.gray[50];
              e.currentTarget.style.borderColor = colors.gray[400];
              e.currentTarget.style.color = colors.gray[800];
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = colors.gray[300];
              e.currentTarget.style.color = colors.gray[600];
            }}
          >
            Sign Out
          </button>
        ) : (
          <Link href="/login">
            <div style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: colors.primary,
              color: colors.white,
              fontSize: '0.875rem',
              fontWeight: '500',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = colors.primaryDark;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = colors.primary;
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              Sign In
            </div>
          </Link>
        )}

        {/* User Info */}
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem',
            borderRadius: '0.375rem',
            background: colors.gray[50]
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white,
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {user.firstName?.charAt(0) || user.email?.charAt(0) || 'U'}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column' as const
            }}>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: colors.gray[800]
              }}>
                {user.firstName} {user.lastName}
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: colors.gray[500],
                textTransform: 'capitalize' as const
              }}>
                {user.role}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}