import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, isAfter, isBefore, addMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { cn } from '@/lib/utils';
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
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  // Calculate urgency metrics
  const urgencyMetrics = useMemo(() => {
    const today = new Date();
    const suggestedDate = new Date(suggestion.suggestedDate);
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
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/${suggestion.id}`, {
        status: 'completed',
        acceptedAt: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/suggestions'] });
      toast({
        title: "Suggestion Accepted",
        description: "The suggestion has been accepted and marked as completed.",
      });
      onAccept?.(suggestion);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept suggestion. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Dismiss suggestion mutation
  const dismissMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/${suggestion.id}`, {
        status: 'dismissed',
        dismissedAt: new Date().toISOString(),
        dismissalReason: reason,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/suggestions'] });
      toast({
        title: "Suggestion Dismissed",
        description: "The suggestion has been dismissed.",
      });
      onDismiss?.(suggestion, dismissReason);
      setShowDismissDialog(false);
      setDismissReason('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss suggestion. Please try again.",
        variant: "destructive",
      });
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

  return (
    <>
      <Card 
        className={cn(
          "transition-shadow hover:shadow-md",
          compact && "p-2",
          className
        )}
        data-testid={`suggestion-card-${suggestion.id}`}
      >
        <CardHeader className={cn("pb-3", compact && "pb-2 px-3 pt-3")}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className={cn(
                "text-base leading-tight",
                compact && "text-sm"
              )}>
                {suggestion.element?.name || 'Unknown Element'}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {suggestion.suggestedType.replace('_', ' ')}
                </Badge>
                <PriorityBadge priority={suggestion.priority} size="sm" />
                <EvaluationStatusBadge status={suggestion.status} size="sm" />
              </div>
            </div>

            {/* Urgency Indicator */}
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium",
              urgencyMetrics.color
            )}>
              <UrgencyIcon className="h-3 w-3" />
              {urgencyMetrics.isOverdue ? 'Overdue' : `${urgencyMetrics.daysUntilDue}d`}
            </div>
          </div>
        </CardHeader>

        <CardContent className={cn("pt-0", compact && "px-3 pb-3")}>
          {/* Suggestion Reason */}
          <p className={cn(
            "text-sm text-muted-foreground mb-3 line-clamp-2",
            compact && "text-xs mb-2"
          )}>
            {suggestion.reason}
          </p>

          {/* Key Metrics */}
          {!compact && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Cost Estimate */}
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

              {/* Due Date */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-sm font-medium">
                    {format(new Date(suggestion.suggestedDate), 'MMM d')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(suggestion.suggestedDate))}
                  </div>
                </div>
              </div>

              {/* Element Condition */}
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

              {/* Seasonal Factor */}
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
          )}

          {/* Lifespan Progress */}
          {lifespanProgress && !compact && (
            <div className="mb-3">
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

          {/* Actions */}
          {showActions && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1">
                {hasPermission('canEditMaintenance') && suggestion.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleAccept}
                      disabled={acceptMutation.isPending}
                      className="text-xs"
                      data-testid={`accept-suggestion-${suggestion.id}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Accept
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCreateProject}
                      className="text-xs"
                      data-testid={`create-project-${suggestion.id}`}
                    >
                      <Wrench className="h-3 w-3 mr-1" />
                      Project
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewDetails?.(suggestion)}
                  className="text-xs"
                  data-testid={`view-details-${suggestion.id}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Details
                </Button>
              </div>

              {/* More Actions Menu */}
              {hasPermission('canEditMaintenance') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      data-testid={`more-actions-${suggestion.id}`}
                    >
                      <MoreHorizontal className="h-3 w-3" />
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
              )}
            </div>
          )}

          {/* Project Link */}
          {suggestion.project && (
            <div className="mt-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span>Linked to project: {suggestion.project.projectNumber}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dismiss Confirmation Dialog */}
      <AlertDialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
        <AlertDialogContent data-testid="dismiss-suggestion-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Suggestion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dismiss this suggestion? Please provide a reason for future reference.
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