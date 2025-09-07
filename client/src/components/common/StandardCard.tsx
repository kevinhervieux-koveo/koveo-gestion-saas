import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface BadgeConfig {
  text: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
}

interface ActionConfig {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  testId?: string;
}

interface StandardCardProps {
  // Core content
  title: string;
  description?: string;
  children?: React.ReactNode;
  
  // Visual elements
  icon?: React.ReactNode;
  badges?: BadgeConfig[];
  actions?: ActionConfig[];
  
  // Interaction
  onClick?: () => void;
  onToggleExpanded?: () => void;
  isExpanded?: boolean;
  isCollapsible?: boolean;
  
  // Styling
  className?: string;
  compact?: boolean;
  hover?: boolean;
  
  // Accessibility
  testId?: string;
  
  // Metadata
  metadata?: Array<{
    label?: string;
    value: string;
    icon?: React.ReactNode;
  }>;
}

/**
 * StandardCard - A unified card component following the clean idea-box styling
 * Used consistently across the application for all card-based content
 */
export function StandardCard({
  title,
  description,
  children,
  icon,
  badges = [],
  actions = [],
  onClick,
  onToggleExpanded,
  isExpanded = false,
  isCollapsible = false,
  className,
  compact = false,
  hover = true,
  testId,
  metadata = [],
}: StandardCardProps) {
  
  const handleCardClick = () => {
    if (onClick && !isCollapsible) {
      onClick();
    }
  };
  
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleExpanded) {
      onToggleExpanded();
    }
  };
  
  return (
    <Card 
      className={cn(
        "group transition-all duration-200",
        hover && "cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700",
        "active:scale-[0.98] transform", // Touch feedback like idea-box
        compact && "p-2",
        className
      )}
      onClick={handleCardClick}
      data-testid={testId}
    >
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Collapsible toggle */}
            {isCollapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleClick}
                className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}
            
            {/* Icon */}
            {icon && (
              <div className="flex-shrink-0">
                {icon}
              </div>
            )}
            
            {/* Title and description */}
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 break-words",
                compact ? "text-sm" : "text-base"
              )}>
                {title}
              </h3>
              {description && !compact && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          {actions.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || "ghost"}
                  size={action.size || "sm"}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  className={cn(
                    "h-7 w-7 p-0",
                    action.className
                  )}
                  data-testid={action.testId}
                  title={action.label}
                >
                  {action.icon}
                  <span className="sr-only">{action.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
        
        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant={badge.variant || "secondary"}
                className={cn("text-xs", badge.className)}
              >
                {badge.text}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Metadata */}
        {metadata.length > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <div className="flex items-center space-x-4">
              {metadata.map((item, index) => (
                <div key={index} className="flex items-center space-x-1">
                  {item.icon}
                  {item.label && <span className="font-medium">{item.label}:</span>}
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      
      {/* Expandable content */}
      {children && ((!isCollapsible) || (isCollapsible && isExpanded)) && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}