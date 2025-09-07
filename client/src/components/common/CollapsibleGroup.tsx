import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleGroupProps {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
    className?: string;
  };
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

/**
 * CollapsibleGroup - A clean grouping component following the idea-box pattern
 * Used for organizing lists of items with collapsible sections
 */
export function CollapsibleGroup({
  title,
  icon,
  count,
  badge,
  children,
  defaultExpanded = true,
  className,
  headerClassName,
  contentClassName,
}: CollapsibleGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Group Header */}
      <Button
        variant="ghost"
        onClick={toggleExpanded}
        className={cn(
          "w-full justify-start h-auto p-3 hover:bg-gray-50 dark:hover:bg-gray-800",
          "border-b border-gray-200 dark:border-gray-700 rounded-none",
          headerClassName
        )}
      >
        <div className="flex items-center gap-2 w-full">
          {/* Collapse/Expand Icon */}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          
          {/* Category Icon */}
          {icon && (
            <div className="flex-shrink-0">
              {icon}
            </div>
          )}
          
          {/* Title */}
          <h3 className="font-medium text-left flex-1">
            {title}
          </h3>
          
          {/* Count */}
          {count !== undefined && (
            <span className="text-sm text-gray-500 font-normal">
              ({count})
            </span>
          )}
          
          {/* Badge */}
          {badge && (
            <Badge
              variant={badge.variant || "secondary"}
              className={cn("text-xs", badge.className)}
            >
              {badge.text}
            </Badge>
          )}
        </div>
      </Button>

      {/* Group Content */}
      {isExpanded && (
        <div className={cn("space-y-2 pl-6", contentClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

interface CollapsibleGroupContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CollapsibleGroupContainer - Container for multiple collapsible groups
 * Provides consistent spacing and layout
 */
export function CollapsibleGroupContainer({
  children,
  className,
}: CollapsibleGroupContainerProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  );
}