import { getButtonStyle, colors } from '@/styles/inline-styles';
import { CSSProperties, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface StyledButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  style?: CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function StyledButton({ 
  children, 
  variant = 'primary', 
  size = 'md',
  onClick,
  style = {},
  disabled = false,
  type = 'button'
}: StyledButtonProps) {
  const baseStyle = getButtonStyle(variant, size);
  
  const hoverColors = {
    primary: colors.primaryDark,
    secondary: colors.secondaryDark,
    outline: colors.primaryLight,
    ghost: colors.gray[100]
  };

  return (
    <button
      type={type}
      style={{
        ...baseStyle,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseOver={(e) => {
        if (!disabled) {
          if (variant === 'outline' || variant === 'ghost') {
            e.currentTarget.style.background = hoverColors[variant];
          } else {
            e.currentTarget.style.background = hoverColors[variant];
          }
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseOut={(e) => {
        if (!disabled) {
          if (variant === 'outline' || variant === 'ghost') {
            e.currentTarget.style.background = 'transparent';
          } else {
            e.currentTarget.style.background = baseStyle.background;
          }
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {children}
    </button>
  );
}