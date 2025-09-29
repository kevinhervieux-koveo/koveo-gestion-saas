import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Pause, 
  Play,
  Star,
  AlertCircle,
  Zap,
  Calendar,
  Settings,
  Wrench,
  CheckSquare
} from 'lucide-react';

// Types from maintenance schema
type ProjectStatus = 'planned' | 'submission' | 'pre_work' | 'in_progress' | 'post_work' | 'completed';
type ElementCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
type Priority = 'low' | 'medium' | 'high' | 'critical';
type EvaluationStatus = 'pending' | 'scheduled' | 'postponed' | 'completed' | 'dismissed';

interface StatusBadgeConfig {
  variant: BadgeProps['variant'];
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}

// Project Status configurations
const projectStatusConfig: Record<ProjectStatus, StatusBadgeConfig> = {
  planned: {
    variant: 'outline',
    icon: Calendar,
    label: 'Planned',
    className: 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950',
  },
  submission: {
    variant: 'outline',
    icon: Clock,
    label: 'Submission',
    className: 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:bg-orange-950',
  },
  pre_work: {
    variant: 'secondary',
    icon: Pause,
    label: 'Pre-Work',
    className: 'border-yellow-300 text-yellow-700 bg-yellow-50 dark:border-yellow-700 dark:text-yellow-300 dark:bg-yellow-950',
  },
  in_progress: {
    variant: 'default',
    icon: Wrench,
    label: 'In Progress',
    className: 'border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-950',
  },
  post_work: {
    variant: 'secondary',
    icon: CheckSquare,
    label: 'Post-Work',
    className: 'border-indigo-300 text-indigo-700 bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:bg-indigo-950',
  },
  completed: {
    variant: 'success',
    icon: CheckCircle2,
    label: 'Completed',
    className: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950',
  },
};

// Element Condition configurations
const conditionConfig: Record<ElementCondition, StatusBadgeConfig> = {
  excellent: {
    variant: 'success',
    icon: Star,
    label: 'Excellent',
    className: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950',
  },
  good: {
    variant: 'default',
    icon: CheckCircle2,
    label: 'Good',
    className: 'border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-950',
  },
  fair: {
    variant: 'secondary',
    icon: Clock,
    label: 'Fair',
    className: 'border-yellow-300 text-yellow-700 bg-yellow-50 dark:border-yellow-700 dark:text-yellow-300 dark:bg-yellow-950',
  },
  poor: {
    variant: 'outline',
    icon: AlertTriangle,
    label: 'Poor',
    className: 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:bg-orange-950',
  },
  critical: {
    variant: 'destructive',
    icon: AlertCircle,
    label: 'Critical',
    className: 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-red-950',
  },
};

// Priority configurations
const priorityConfig: Record<Priority, StatusBadgeConfig> = {
  low: {
    variant: 'outline',
    icon: Clock,
    label: 'Low',
    className: 'border-gray-300 text-gray-700 bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:bg-gray-950',
  },
  medium: {
    variant: 'secondary',
    icon: AlertTriangle,
    label: 'Medium',
    className: 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950',
  },
  high: {
    variant: 'outline',
    icon: AlertCircle,
    label: 'High',
    className: 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:bg-orange-950',
  },
  critical: {
    variant: 'destructive',
    icon: Zap,
    label: 'Critical',
    className: 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-red-950',
  },
};

// Evaluation Status configurations
const evaluationStatusConfig: Record<EvaluationStatus, StatusBadgeConfig> = {
  pending: {
    variant: 'outline',
    icon: Clock,
    label: 'Pending',
    className: 'border-gray-300 text-gray-700 bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:bg-gray-950',
  },
  scheduled: {
    variant: 'secondary',
    icon: Calendar,
    label: 'Scheduled',
    className: 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950',
  },
  postponed: {
    variant: 'outline',
    icon: Pause,
    label: 'Postponed',
    className: 'border-yellow-300 text-yellow-700 bg-yellow-50 dark:border-yellow-700 dark:text-yellow-300 dark:bg-yellow-950',
  },
  completed: {
    variant: 'success',
    icon: CheckCircle2,
    label: 'Completed',
    className: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950',
  },
  dismissed: {
    variant: 'secondary',
    icon: XCircle,
    label: 'Dismissed',
    className: 'border-gray-300 text-gray-700 bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:bg-gray-950',
  },
};

// Base badge component with icon support
interface BaseBadgeProps extends Omit<BadgeProps, 'variant'> {
  config: StatusBadgeConfig;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function BaseBadge({ 
  config, 
  showIcon = true, 
  size = 'md',
  className,
  children,
  ...props 
}: BaseBadgeProps) {
  const { variant, icon: Icon, label, className: configClassName } = config;
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        sizeClasses[size],
        configClassName,
        className
      )}
      data-testid={`badge-${label.toLowerCase().replace(/\s+/g, '-')}`}
      {...props}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {children || label}
    </Badge>
  );
}

// Project Status Badge
interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: ProjectStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  const config = projectStatusConfig[status];
  
  // If config is undefined, provide a fallback
  if (!config) {
    return (
      <Badge variant="secondary" className="text-xs" {...props}>
        {status || 'Unknown'}
      </Badge>
    );
  }
  
  return <BaseBadge config={config} {...props} />;
}

// Element Condition Badge
interface ConditionBadgeProps extends Omit<BadgeProps, 'variant'> {
  condition: ElementCondition;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConditionBadge({ condition, ...props }: ConditionBadgeProps) {
  const config = conditionConfig[condition];
  
  // If config is undefined, provide a fallback
  if (!config) {
    return (
      <Badge variant="outline" className="text-xs" {...props}>
        {condition || 'Unknown'}
      </Badge>
    );
  }
  
  return <BaseBadge config={config} {...props} />;
}

// Priority Badge
interface PriorityBadgeProps extends Omit<BadgeProps, 'variant'> {
  priority: Priority;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PriorityBadge({ priority, ...props }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  // If config is undefined, provide a fallback
  if (!config) {
    return (
      <Badge variant="outline" className="text-xs" {...props}>
        {priority || 'Unknown'}
      </Badge>
    );
  }
  
  return <BaseBadge config={config} {...props} />;
}

// Evaluation Status Badge
interface EvaluationStatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: EvaluationStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function EvaluationStatusBadge({ status, ...props }: EvaluationStatusBadgeProps) {
  const config = evaluationStatusConfig[status];
  
  // If config is undefined, provide a fallback
  if (!config) {
    return (
      <Badge variant="secondary" className="text-xs" {...props}>
        {status || 'Unknown'}
      </Badge>
    );
  }
  
  return <BaseBadge config={config} {...props} />;
}

// Export types
export type { 
  ProjectStatus, 
  ElementCondition, 
  Priority, 
  EvaluationStatus,
  StatusBadgeProps,
  ConditionBadgeProps,
  PriorityBadgeProps,
  EvaluationStatusBadgeProps
};

// Export configurations for external use
export {
  projectStatusConfig,
  conditionConfig,
  priorityConfig,
  evaluationStatusConfig,
};