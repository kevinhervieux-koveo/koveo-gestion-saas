// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format, formatDistanceToNow, addMonths } from 'date-fns';
import { StandardCard } from '@/components/common/StandardCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PriorityBadge, EvaluationStatusBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn, parseDateOnly, parseDateOnlyLoose } from '@/lib/utils';
import {
  CheckCircle,
  Clock,
  Calendar,
  DollarSign,
  Building,
  AlertTriangle,
  FileText,
  MoreHorizontal,
  Wrench,
  X,
  Eye,
  Edit2,
  Copy,
  AlertCircle,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { SuggestionCardProps, SuggestionWithElement } from './types';
import { useLanguage } from '@/hooks/use-language';

/**
 * SuggestionCard component for displaying individual evaluation suggestions
 * Shows summary, metrics, urgency indicators, and action buttons
 */
export function SuggestionCard({
  suggestion,
  onAccept,
  onDefer,
  onDismiss,
  onCreateProject,
  onSchedule,
  onViewDetails,
  showActions = true,
  compact = false,
  className,
}: SuggestionCardProps) {
  const { t } = useLanguage();
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  // Calculate urgency metrics
  const urgencyMetrics = useMemo(() => {
    const today = new Date();
    const suggestedDate = parseDateOnlyLoose(suggestion.suggestedDate) ?? new Date();
    const daysUntilDue = Math.ceil((suggestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Urgency level based on days until due and priority
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let urgencyColor = 'text-green-600 bg-green-50 border-green-200';
    let urgencyIcon = Clock;
    
    if (daysUntilDue < 0) {
      urgencyLevel = 'critical';
      urgencyColor = 'text-red-600 bg-red-50 border-red-200';
      urgencyIcon = AlertCircle;
    } else if (daysUntilDue <= 30 && suggestion.priority === 'critical') {
      urgencyLevel = 'critical';
      urgencyColor = 'text-red-600 bg-red-50 border-red-200';
      urgencyIcon = Zap;
    } else if (daysUntilDue <= 60 && ['critical', 'high'].includes(suggestion.priority)) {
      urgencyLevel = 'high';
      urgencyColor = 'text-orange-600 bg-orange-50 border-orange-200';
      urgencyIcon = AlertTriangle;
    } else if (daysUntilDue <= 90) {
      urgencyLevel = 'medium';
      urgencyColor = 'text-yellow-600 bg-yellow-50 border-yellow-200';
      urgencyIcon = Clock;
    }

    return {
      level: urgencyLevel,
      daysUntilDue,
      color: urgencyColor,
      icon: urgencyIcon,
      isOverdue: daysUntilDue < 0,
    };
  }, [suggestion.suggestedDate, suggestion.priority]);

  // Calculate element lifespan progress
  const lifespanProgress = useMemo(() => {
    if (!suggestion.element || !suggestion.lifespan) return null;
    
    return {
      current: suggestion.lifespan.current,
      total: suggestion.lifespan.original,
      remaining: suggestion.lifespan.remaining,
      percentage: suggestion.lifespan.percentage,
    };
  }, [suggestion.element, suggestion.lifespan]);

  // Get seasonal factor styling
  const seasonalStyling = useMemo(() => {
    switch (suggestion.seasonalFactor) {
      case 'optimal':
        return 'text-green-600 bg-green-50';
      case 'acceptable':
        return 'text-yellow-600 bg-yellow-50';
      case 'difficult':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  }, [suggestion.seasonalFactor]);

  // Accept suggestion mutation
  const acceptMutation = useCreateUpdateMutation({
    mutationFn: async () => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/${suggestion.id}`, {
        status: 'completed',
        acceptedAt: new Date().toISOString(),
      });
      return response.json();
    },
    successTitle: 'Suggestion Accepted',
    successMessage: 'The suggestion has been accepted and marked as completed.',
    errorTitle: 'Error',
    errorMessage: 'Failed to accept suggestion. Please try again.',
    queryKeysToInvalidate: [['/api/maintenance/suggestions']],
    onSuccessCallback: () => {
      onAccept?.(suggestion);
    },
  });

  // Dismiss suggestion mutation
  const dismissMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: async (reason: string) => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/${suggestion.id}`, {
        status: 'dismissed',
        dismissedAt: new Date().toISOString(),
        dismissalReason: reason,
      });
      return response.json();
    },
    successTitle: 'Suggestion Dismissed',
    successMessage: 'The suggestion has been dismissed.',
    errorTitle: 'Error',
    errorMessage: 'Failed to dismiss suggestion. Please try again.',
    queryKeysToInvalidate: [['/api/maintenance/suggestions']],
    onSuccessCallback: () => {
      onDismiss?.(suggestion, dismissReason);
      setShowDismissDialog(false);
      setDismissReason('');
    },
  });

  const handleAccept = () => {
    acceptMutation.mutate();
  };

  const handleDismiss = () => {
    if (dismissReason.trim()) {
      dismissMutation.mutate(dismissReason);
    } else {
      setShowDismissDialog(true);
    }
  };

  const handleCreateProject = () => {
    onCreateProject?.(suggestion);
  };

  const handleSchedule = () => {
    const defaultDate = addMonths(new Date(), 1);
    onSchedule?.(suggestion, defaultDate);
  };

  const UrgencyIcon = urgencyMetrics.icon;

  // Get urgency/priority based icon
  const getSuggestionIcon = () => {
    return <UrgencyIcon className="w-5 h-5" style={{ color: urgencyMetrics.color.split(' ')[0].replace('text-', '') }} />;
  };

  // Build badges array for StandardCard - only show in non-compact mode
  const badges = !compact ? [
    {
      text: suggestion.suggestedType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      variant: 'outline' as const,
      className: 'text-xs'
    },
    // Priority badge
    suggestion.priority && {
      text: suggestion.priority.charAt(0).toUpperCase() + suggestion.priority.slice(1),
      variant: suggestion.priority === 'critical' ? 'destructive' as const : 
               suggestion.priority === 'high' ? 'outline' as const : 'secondary' as const,
      className: 'text-xs'
    },
    // Status badge
    suggestion.status && {
      text: suggestion.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      variant: suggestion.status === 'completed' ? 'default' as const : 'secondary' as const,
      className: 'text-xs'
    },
    // Urgency indicator as badge
    {
      text: urgencyMetrics.isOverdue ? 'Overdue' : `${urgencyMetrics.daysUntilDue}d`,
      variant: urgencyMetrics.level === 'critical' ? 'destructive' as const : 'outline' as const,
      className: cn('text-xs font-medium', urgencyMetrics.color)
    }
  ].filter(Boolean) : [
    // In compact mode, only show urgency
    {
      text: urgencyMetrics.isOverdue ? 'Overdue' : `${urgencyMetrics.daysUntilDue}d`,
      variant: urgencyMetrics.level === 'critical' ? 'destructive' as const : 'outline' as const,
      className: cn('text-xs font-medium', urgencyMetrics.color)
    }
  ];

  // Build actions array for StandardCard
  const actions = showActions ? [
    hasPermission('canEditMaintenance') && suggestion.status === 'pending' && {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Accept suggestion',
      text: !compact ? 'Accept' : undefined,
      onClick: handleAccept,
      variant: 'default' as const,
      testId: `accept-suggestion-${suggestion.id}`
    },
    hasPermission('canEditMaintenance') && suggestion.status === 'pending' && !compact && {
      icon: <Wrench className="w-4 h-4" />,
      label: 'Create project',
      text: 'Project',
      onClick: handleCreateProject,
      variant: 'outline' as const,
      testId: `create-project-${suggestion.id}`
    },
    {
      icon: <Eye className="w-4 h-4" />,
      label: 'View details',
      text: !compact ? 'Details' : undefined,
      onClick: () => onViewDetails?.(suggestion),
      variant: 'ghost' as const,
      testId: `view-details-${suggestion.id}`
    }
  ].filter(Boolean) : [];

  // Build metadata array for StandardCard
  const metadata = !compact ? [
    suggestion.costEstimate && {
      icon: <DollarSign className="w-3 h-3" />,
      label: 'Est',
      value: `$${suggestion.costEstimate.toLocaleString()}`
    },
    {
      icon: <Calendar className="w-3 h-3" />,
      label: 'Due',
      value: format(parseDateOnlyLoose(suggestion.suggestedDate) ?? new Date(), 'MMM d')
    },
    suggestion.element && {
      icon: <Building className="w-3 h-3" />,
      label: 'Condition',
      value: suggestion.element.currentCondition.charAt(0).toUpperCase() + suggestion.element.currentCondition.slice(1)
    }
  ].filter(Boolean) : [];

  // Children content (detailed metrics and actions)
  const childrenContent = (
    <div className="space-y-3">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {suggestion.costEstimate && (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-sm font-medium">
                ${suggestion.costEstimate.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Estimate</div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <div>
            <div className="text-sm font-medium">
              {format(parseDateOnlyLoose(suggestion.suggestedDate) ?? new Date(), 'MMM d')}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(parseDateOnlyLoose(suggestion.suggestedDate) ?? new Date())}
            </div>
          </div>
        </div>

        {suggestion.element && (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-purple-600" />
            <div>
              <div className="text-sm font-medium capitalize">
                {suggestion.element.currentCondition}
              </div>
              <div className="text-xs text-muted-foreground">Condition</div>
            </div>
          </div>
        )}

        {suggestion.seasonalFactor && (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            <div>
              <div className={cn("text-sm font-medium px-2 py-0.5 rounded", seasonalStyling)}>
                {suggestion.seasonalFactor}
              </div>
              <div className="text-xs text-muted-foreground">Timing</div>
            </div>
          </div>
        )}
      </div>

      {/* Lifespan Progress */}
      {lifespanProgress && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Element Lifespan</span>
            <span>{lifespanProgress.current}/{lifespanProgress.total} years ({lifespanProgress.percentage.toFixed(0)}%)</span>
          </div>
          <Progress 
            value={lifespanProgress.percentage} 
            className="h-2"
            data-testid={`lifespan-progress-${suggestion.id}`}
          />
        </div>
      )}

      {/* More Actions Menu */}
      {hasPermission('canEditMaintenance') && (
        <div className="flex justify-end pt-2 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                data-testid={`more-actions-${suggestion.id}`}
              >
                <MoreHorizontal className="h-3 w-3 mr-1" />
                More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSchedule}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDefer?.(suggestion, addMonths(new Date(), 3))}>
                <Clock className="h-4 w-4 mr-2" />
                Defer 3 Months
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={handleDismiss}
                disabled={dismissMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Project Link */}
      {suggestion.project && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>Linked to project: {suggestion.project.projectNumber}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <StandardCard
        title={suggestion.element?.name || 'Unknown Element'}
        description={!compact ? suggestion.reason : undefined}
        icon={getSuggestionIcon()}
        badges={badges}
        actions={actions}
        metadata={metadata}
        spacing={compact ? 'compact' : 'normal'}
        className={className}
        testId={`suggestion-card-${suggestion.id}`}
      >
        {!compact && childrenContent}
      </StandardCard>

      {/* Dismiss Confirmation Dialog */}
      <AlertDialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
        <AlertDialogContent data-testid="dismiss-suggestion-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Suggestion</AlertDialogTitle>
            <AlertDialogDescription>
              {t('areYouSureYouWantTo7')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <textarea
              className="w-full p-2 border rounded-md resize-none"
              placeholder="Reason for dismissing this suggestion..."
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              rows={3}
              data-testid="dismiss-reason-input"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowDismissDialog(false);
                setDismissReason('');
              }}
              data-testid="cancel-dismiss"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dismissMutation.mutate(dismissReason)}
              disabled={!dismissReason.trim() || dismissMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-dismiss"
            >
              {dismissMutation.isPending ? 'Dismissing...' : 'Dismiss'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}