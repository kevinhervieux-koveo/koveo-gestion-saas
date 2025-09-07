import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/use-language';

interface NoDataCardProps {
  /**
   * The Lucide icon component to display
   */
  icon: LucideIcon;
  
  /**
   * Translation key for the title/heading
   */
  titleKey: string;
  
  /**
   * Translation key for the description text
   */
  descriptionKey: string;
  
  /**
   * Optional translation key for badge text (e.g., "noData")
   */
  badgeKey?: string;
  
  /**
   * Optional custom content to render below the standard content
   */
  children?: ReactNode;
  
  /**
   * Additional CSS classes for the card
   */
  className?: string;
  
  /**
   * Additional CSS classes for the content area
   */
  contentClassName?: string;
  
  /**
   * Test ID for testing purposes
   */
  testId?: string;
  
  /**
   * Icon size (default: 16 = w-16 h-16)
   */
  iconSize?: number;
}

/**
 * Reusable NoDataCard component for consistent "no data available" states across the application.
 * Supports both English and French translations automatically based on language context.
 * 
 * @example
 * ```tsx
 * <NoDataCard
 *   icon={Building}
 *   titleKey="noBuildingsFound"
 *   descriptionKey="noBuildingsMessage"
 *   badgeKey="noData"
 *   testId="no-buildings-message"
 * />
 * ```
 */
export function NoDataCard({
  icon: Icon,
  titleKey,
  descriptionKey,
  badgeKey,
  children,
  className = '',
  contentClassName = '',
  testId,
  iconSize = 16
}: NoDataCardProps) {
  const { t } = useLanguage();
  
  const iconClasses = `w-${iconSize} h-${iconSize} mx-auto text-gray-400 mb-4`;
  
  return (
    <Card className={className} data-testid={testId}>
      <CardContent className={`p-8 text-center ${contentClassName}`}>
        <Icon className={iconClasses} />
        <h3 className='text-lg font-semibold text-gray-600 mb-2' data-testid={`${testId}-title`}>
          {t(titleKey as any)}
        </h3>
        <p className='text-gray-500 mb-4' data-testid={`${testId}-description`}>
          {t(descriptionKey as any)}
        </p>
        {badgeKey && (
          <Badge variant='secondary' data-testid={`${testId}-badge`}>
            {t(badgeKey as any)}
          </Badge>
        )}
        {children}
      </CardContent>
    </Card>
  );
}