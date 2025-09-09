import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StandardCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  'data-testid'?: string;
}

/**
 * Standardized card component that consolidates the common Card + CardHeader + CardTitle pattern.
 * Replaces repetitive card boilerplate across 64+ components in the app.
 * 
 * @param props - Card configuration with optional title, description, footer, and styling
 * @returns Consistently styled card with proper structure
 */
export function StandardCard({
  title,
  description,
  children,
  footer,
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  'data-testid': testId,
}: StandardCardProps) {
  return (
    <Card className={cn('w-full', className)} data-testid={testId}>
      {(title || description) && (
        <CardHeader className={cn(headerClassName)}>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
      {footer && <CardFooter className={cn(footerClassName)}>{footer}</CardFooter>}
    </Card>
  );
}