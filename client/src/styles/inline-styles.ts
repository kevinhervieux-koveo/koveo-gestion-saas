/**
 * Centralized inline styling system for Koveo Gestion
 * This provides a single source of truth for all inline styles
 * to ensure consistency across the application
 */

export const colors = {
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
  secondary: '#10b981',
  secondaryDark: '#059669',
  secondaryLight: '#ecfdf5',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },
  background: '#f8fafc',
  white: '#ffffff'
};

export const typography = {
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  heading1: {
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    color: colors.gray[800]
  },
  heading2: {
    fontSize: '1.5rem',
    fontWeight: '600' as const,
    color: colors.gray[800]
  },
  heading3: {
    fontSize: '1.25rem',
    fontWeight: '600' as const,
    color: colors.gray[800]
  },
  body: {
    fontSize: '1rem',
    color: colors.gray[600]
  },
  small: {
    fontSize: '0.875rem',
    color: colors.gray[500]
  }
};

export const layout = {
  container: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: colors.background,
    fontFamily: typography.fontFamily,
    display: 'flex' as const
  },
  sidebar: {
    width: '280px',
    background: colors.white,
    borderRight: `1px solid ${colors.gray[200]}`,
    padding: '1.5rem',
    overflowY: 'auto' as const
  },
  main: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto' as const
  },
  card: {
    background: colors.white,
    borderRadius: '0.75rem',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${colors.gray[100]}`
  }
};

export const components = {
  button: {
    base: {
      padding: '0.75rem 1.5rem',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: '500' as const,
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.2s',
      display: 'inline-flex' as const,
      alignItems: 'center' as const,
      gap: '0.5rem',
      textDecoration: 'none'
    },
    variants: {
      primary: {
        background: colors.primary,
        color: colors.white
      },
      secondary: {
        background: colors.secondary,
        color: colors.white
      },
      outline: {
        background: 'transparent',
        color: colors.primary,
        border: `1px solid ${colors.primary}`
      },
      ghost: {
        background: 'transparent',
        color: colors.gray[600]
      }
    },
    sizes: {
      sm: {
        padding: '0.5rem 1rem',
        fontSize: '0.75rem'
      },
      md: {
        padding: '0.75rem 1.5rem',
        fontSize: '0.875rem'
      },
      lg: {
        padding: '1rem 2rem',
        fontSize: '1rem'
      }
    }
  },
  navItem: {
    base: {
      display: 'flex',
      alignItems: 'center' as const,
      gap: '0.75rem',
      padding: '0.75rem',
      borderRadius: '0.5rem',
      textDecoration: 'none',
      marginBottom: '0.5rem',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    default: {
      color: colors.gray[600],
      background: 'transparent'
    },
    active: {
      background: colors.primaryLight,
      color: colors.primary,
      fontWeight: '500' as const
    },
    hover: {
      background: colors.gray[100]
    }
  },
  statsCard: {
    container: {
      background: colors.white,
      borderRadius: '0.75rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: `1px solid ${colors.gray[100]}`
    },
    label: {
      color: colors.gray[500],
      fontSize: '0.875rem',
      fontWeight: '500' as const,
      marginBottom: '0.5rem'
    },
    value: {
      fontSize: '2rem',
      fontWeight: 'bold' as const
    },
    icon: {
      fontSize: '1.5rem'
    }
  },
  badge: {
    base: {
      padding: '0.25rem 0.75rem',
      borderRadius: '1rem',
      fontSize: '0.75rem',
      fontWeight: '600' as const,
      display: 'inline-block' as const
    },
    variants: {
      success: {
        background: colors.secondaryLight,
        color: colors.secondaryDark
      },
      warning: {
        background: colors.warningLight,
        color: colors.warning
      },
      danger: {
        background: colors.dangerLight,
        color: colors.danger
      },
      info: {
        background: colors.primaryLight,
        color: colors.primary
      }
    }
  }
};

// Utility functions for common patterns
export const getButtonStyle = (variant: keyof typeof components.button.variants = 'primary', size: keyof typeof components.button.sizes = 'md') => ({
  ...components.button.base,
  ...components.button.variants[variant],
  ...components.button.sizes[size]
});

export const getNavItemStyle = (isActive: boolean = false) => ({
  ...components.navItem.base,
  ...(isActive ? components.navItem.active : components.navItem.default)
});

export const gradients = {
  primary: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
  success: `linear-gradient(135deg, ${colors.secondary}, ${colors.secondaryDark})`,
  purple: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  gray: `linear-gradient(135deg, ${colors.background}, ${colors.gray[200]})`
};

// Logo component style
export const logoStyle = {
  container: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '0.5rem',
    marginBottom: '2rem'
  },
  icon: {
    width: '32px',
    height: '32px',
    background: gradients.primary,
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    color: colors.white,
    fontWeight: 'bold' as const
  },
  text: {
    fontSize: '1.25rem',
    fontWeight: 'bold' as const,
    color: colors.gray[800]
  }
};

// Animation utilities
export const animations = {
  hover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  },
  hoverReset: {
    transform: 'translateY(0)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  }
};