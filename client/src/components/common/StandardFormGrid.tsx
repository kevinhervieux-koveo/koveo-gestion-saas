/**
 * Standardized form grid layout component.
 * Provides consistent responsive grid layouts for forms.
 */
import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

interface StandardFormGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  'data-testid'?: string;
}

/**
 * Responsive grid layout for form fields with consistent spacing.
 * Automatically handles breakpoints and accessibility.
 */
export function StandardFormGrid({
  children,
  columns = 2,
  gap = 'md',
  className = '',
  'data-testid': testId = 'form-grid',
}: StandardFormGridProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div 
      className={cn(
        'grid',
        gridClasses[columns],
        gapClasses[gap],
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/**
 * Form section with optional collapsible behavior.
 * Provides consistent section organization for complex forms.
 */
interface FormGridSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function FormGridSection({
  title,
  description,
  children,
  columns = 2,
  gap = 'md',
  collapsible = false,
  defaultOpen = true,
  className = '',
  'data-testid': testId = 'form-grid-section',
}: FormGridSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleSection = () => {
    if (collapsible) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={cn('space-y-4', className)} data-testid={testId}>
      {title && (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
          <div 
            className={cn(
              'flex items-center justify-between',
              collapsible && 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400'
            )}
            onClick={toggleSection}
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
            {collapsible && (
              <svg 
                className={cn('w-5 h-5 transition-transform', isOpen && 'rotate-180')}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
          )}
        </div>
      )}
      
      {(!collapsible || isOpen) && (
        <StandardFormGrid columns={columns} gap={gap}>
          {children}
        </StandardFormGrid>
      )}
    </div>
  );
}