import { components } from '@/styles/inline-styles';
import { CSSProperties, ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

interface StyledBadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: CSSProperties;
}

export function StyledBadge({ 
  children, 
  variant = 'info',
  style = {}
}: StyledBadgeProps) {
  return (
    <span style={{
      ...components.badge.base,
      ...components.badge.variants[variant],
      ...style
    }}>
      {children}
    </span>
  );
}