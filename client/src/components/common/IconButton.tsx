import { ReactNode } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { COMMON_STYLES, ICON_SIZES } from '@/lib/style-constants';

interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: LucideIcon;
  children: ReactNode;
  iconSize?: keyof typeof ICON_SIZES;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export function IconButton({
  icon: Icon,
  children,
  iconSize = 'SM',
  iconPosition = 'left',
  loading = false,
  className = '',
  disabled,
  ...props
}: IconButtonProps) {
  const iconClass = ICON_SIZES[iconSize];
  const isDisabled = disabled || loading;

  return (
    <Button
      {...props}
      disabled={isDisabled}
      className={`${COMMON_STYLES.BUTTON_ICON} ${loading ? COMMON_STYLES.BUTTON_LOADING : ''} ${className}`}
    >
      {iconPosition === 'left' && <Icon className={iconClass} />}
      {children}
      {iconPosition === 'right' && <Icon className={iconClass} />}
    </Button>
  );
}