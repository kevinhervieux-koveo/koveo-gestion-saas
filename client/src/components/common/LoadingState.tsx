import { ReactNode } from 'react';

/**
 *
 */
interface LoadingStateProps {
  message?: string;
  children?: ReactNode;
  className?: string;
  center?: boolean;
}

/**
 * Common loading state component for consistent loading displays.
 * @param root0
 * @param root0.message
 * @param root0.children
 * @param root0.className
 * @param root0.center
 */
export function LoadingState({ 
  message = 'Loading...', 
  children, 
  className = '', 
  center = true 
}: LoadingStateProps) {
  const baseClasses = center 
    ? 'flex items-center justify-center h-64' 
    : 'py-6';

  return (
    <div className={`${baseClasses} ${className}`}>
      <div className="text-center">
        {children || <div>{message}</div>}
      </div>
    </div>
  );
}