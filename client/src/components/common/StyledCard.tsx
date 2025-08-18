import { components, colors, animations } from '@/styles/inline-styles';
import { CSSProperties, ReactNode } from 'react';

interface StyledCardProps {
  children: ReactNode;
  hover?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function StyledCard({ 
  children, 
  hover = false, 
  style = {}, 
  onClick 
}: StyledCardProps) {
  return (
    <div 
      style={{
        ...components.statsCard.container,
        transition: hover ? 'all 0.3s' : undefined,
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      onClick={onClick}
      onMouseOver={(e) => {
        if (hover) {
          Object.assign(e.currentTarget.style, animations.hover);
        }
      }}
      onMouseOut={(e) => {
        if (hover) {
          Object.assign(e.currentTarget.style, animations.hoverReset);
        }
      }}
    >
      {children}
    </div>
  );
}

interface StyledStatsCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

export function StyledStatsCard({ label, value, icon, color = colors.primary }: StyledStatsCardProps) {
  return (
    <StyledCard>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '0.5rem'
      }}>
        <div style={components.statsCard.label}>
          {label}
        </div>
        <div style={components.statsCard.icon}>
          {icon}
        </div>
      </div>
      <div style={{
        ...components.statsCard.value,
        color
      }}>
        {value}
      </div>
    </StyledCard>
  );
}