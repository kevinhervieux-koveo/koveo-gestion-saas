import { ReactNode } from 'react';

/**
 *
 */
interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: 'default' | 'wide' | 'full';
  className?: string;
}

const maxWidthClasses = {
  default: 'container mx-auto',
  wide: 'max-w-7xl mx-auto',
  full: 'w-full'
};

/**
 * Common page layout component for consistent spacing and container styling.
 * @param root0
 * @param root0.children
 * @param root0.maxWidth
 * @param root0.className
 */
export function PageLayout({ children, maxWidth = 'default', className = '' }: PageLayoutProps) {
  return (
    <div className={`${maxWidthClasses[maxWidth]} py-6 space-y-6 ${className}`}>
      {children}
    </div>
  );
}