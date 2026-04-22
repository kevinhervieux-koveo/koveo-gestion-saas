import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject, ProjectStep } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Settings,
  Clock,
  Pause,
  Wrench,
  CheckSquare,
  CheckCircle2,
  Play,
  FastForward,
  AlertTriangle,
  Info,
  User,
  FileText,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

export interface StatusStepperProps {
  project: MaintenanceProject;
  steps?: ProjectStep[];
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showTimestamps?: boolean;
  showActions?: boolean;
  onStatusChange?: (newStatus: string) => void;
  interactive?: boolean;
}

interface StatusConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  allowedTransitions: string[];
  requiresConfirmation?: boolean;
  isOptional?: boolean;
}

// Status workflow configuration
const statusConfigs: Record<string, StatusConfig> = {
  planned: {
    key: 'planned',
    label: 'Planning',
    description: 'Project is in planning phase',
    icon: Calendar,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    allowedTransitions: ['evaluation', 'submission'],
  },
  evaluation: {
    key: 'evaluation',
    label: 'Evaluation',
    description: 'Under technical evaluation',
    icon: Settings,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    allowedTransitions: ['planned', 'submission', 'pre_work'],
    isOptional: true,
  },
  submission: {
    key: 'submission',
    label: 'Submission',
    description: 'Submitted for approval',
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    allowedTransitions: ['evaluation', 'pre_work'],
  },
  pre_work: {
    key: 'pre_work',
    label: 'Pre-Work',
    description: 'Preparing for work execution',
    icon: Pause,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    allowedTransitions: ['submission', 'work'],
  },
  work: {
    key: 'work',
    label: 'In Progress',
    description: 'Work is being executed',
    icon: Wrench,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    allowedTransitions: ['pre_work', 'post_work'],
    requiresConfirmation: true,
  },
  post_work: {
    key: 'post_work',
    label: 'Post-Work',
    description: 'Work completed, cleanup phase',
    icon: CheckSquare,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 border-indigo-200',
    allowedTransitions: ['work', 'completed'],
  },
  completed: {
    key: 'completed',
    label: 'Completed',
    description: 'Project fully completed',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    allowedTransitions: ['post_work'], // Can only go back to post_work if needed
    requiresConfirmation: true,
  },
};

// Define the standard workflow order
const workflowOrder = ['planned', 'evaluation', 'submission', 'pre_work', 'work', 'post_work', 'completed'];

/**
 * StatusStepper component for visualizing and managing project workflow status
 * Shows interactive stepper with status transitions and conditional workflows
 */
export function StatusStepper({
  project,
  steps = [],
  className,
  variant = 'default',
  showTimestamps = true,
  showActions = true,
  onStatusChange,
  interactive = true,
}: StatusStepperProps) {
  // Simplified placeholder - no context for now
  const hasPermission = () => true;
  const buildingId = 'placeholder-building-id';
  const { toast } = useToast();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${project.id}`, {
        status: newStatus,
      });
      return response.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] 
      });
      
      toast({
        title: "Status Updated",
        description: `Project status has been updated to ${statusConfigs[response.project.status]?.label}.`,
      });
      
      onStatusChange?.(response.project.status);
      setPendingStatus(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update status';
      toast({
        title: "Update Failed",
        description: message,
        variant: "destructive",
      });
      setPendingStatus(null);
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (!hasPermission('canEditMaintenance')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to update project status.",
        variant: "destructive",
      });
      return;
    }

    const statusConfig = statusConfigs[newStatus];
    if (statusConfig?.requiresConfirmation) {
      setPendingStatus(newStatus);
    } else {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      updateStatusMutation.mutate(pendingStatus);
    }
  };

  const getCurrentStepIndex = () => {
    return workflowOrder.indexOf(project.status);
  };

  const getStepProgress = () => {
    const currentIndex = getCurrentStepIndex();
    return ((currentIndex + 1) / workflowOrder.length) * 100;
  };

  const isStepCompleted = (stepStatus: string) => {
    const stepIndex = workflowOrder.indexOf(stepStatus);
    const currentIndex = getCurrentStepIndex();
    return stepIndex < currentIndex;
  };

  const isStepCurrent = (stepStatus: string) => {
    return stepStatus === project.status;
  };

  const isStepAvailable = (stepStatus: string) => {
    const currentConfig = statusConfigs[project.status];
    return currentConfig?.allowedTransitions.includes(stepStatus);
  };

  const getStepTimestamp = (stepStatus: string) => {
    // In a real implementation, this would come from project steps or history
    // For now, we'll use the project dates or creation time
    if (stepStatus === 'planned') return project.createdAt;
    if (stepStatus === 'work' && project.actualStartDate) return project.actualStartDate;
    if (stepStatus === 'completed' && project.actualEndDate) return project.actualEndDate;
    return null;
  };

  const StepIcon = ({ status, isActive, isCompleted }: { 
    status: string; 
    isActive: boolean; 
    isCompleted: boolean;
  }) => {
    const config = statusConfigs[status];
    const IconComponent = config.icon;
    
    return (
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
        isCompleted && "bg-green-500 border-green-500 text-white",
        isActive && !isCompleted && `border-current ${config.color} ${config.bgColor}`,
        !isActive && !isCompleted && "border-gray-300 bg-gray-50 text-gray-400"
      )}>
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <IconComponent className="h-5 w-5" />
        )}
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div className={cn("space-y-2", className)} data-testid={`status-stepper-${project.id}`}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Project Status</h4>
          <Badge variant="outline" className={statusConfigs[project.status]?.bgColor}>
            {statusConfigs[project.status]?.label}
          </Badge>
        </div>
        <Progress value={getStepProgress()} className="h-2" />
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)} data-testid={`status-stepper-${project.id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Project Status</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {Math.round(getStepProgress())}% Complete
            </span>
            <Progress value={getStepProgress()} className="w-20 h-2" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Visual Stepper */}
        <div className="relative">
          <div className="flex items-center justify-between">
            {workflowOrder.map((stepStatus, index) => {
              const config = statusConfigs[stepStatus];
              const isCompleted = isStepCompleted(stepStatus);
              const isCurrent = isStepCurrent(stepStatus);
              const isAvailable = isStepAvailable(stepStatus);
              const timestamp = getStepTimestamp(stepStatus);
              
              return (
                <div key={stepStatus} className="flex flex-col items-center space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <StepIcon 
                            status={stepStatus}
                            isActive={isCurrent}
                            isCompleted={isCompleted}
                          />
                          
                          {/* Action button for available transitions */}
                          {interactive && showActions && isAvailable && !isCurrent && hasPermission('canEditMaintenance') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 p-1 h-6 w-6"
                              onClick={() => handleStatusChange(stepStatus)}
                              data-testid={`status-action-${stepStatus}-${project.id}`}
                            >
                              <FastForward className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">{config.label}</p>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                          {timestamp && showTimestamps && (
                            <p className="text-xs">
                              {format(new Date(timestamp), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                          {isAvailable && !isCurrent && (
                            <p className="text-xs text-blue-600">Click to advance</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Step Label */}
                  <div className="text-center">
                    <p className={cn(
                      "text-xs font-medium",
                      isCurrent && config.color,
                      isCompleted && "text-green-600",
                      !isCurrent && !isCompleted && "text-gray-500"
                    )}>
                      {config.label}
                    </p>
                    {timestamp && showTimestamps && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(timestamp), 'MMM dd')}
                      </p>
                    )}
                  </div>

                  {/* Connection line */}
                  {index < workflowOrder.length - 1 && (
                    <div className="absolute top-5 left-1/2 w-full h-0.5 bg-gray-200 -z-10">
                      <div 
                        className="h-full bg-green-500 transition-all"
                        style={{ 
                          width: `${isCompleted ? 100 : isCurrent ? 50 : 0}%` 
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Status Details */}
        <Separator />
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              statusConfigs[project.status]?.bgColor
            )}>
              {React.createElement(statusConfigs[project.status]?.icon, {
                className: cn("h-5 w-5", statusConfigs[project.status]?.color)
              })}
            </div>
            
            <div className="flex-1 space-y-1">
              <h4 className="font-medium text-sm">
                {statusConfigs[project.status]?.label}
              </h4>
              <p className="text-sm text-muted-foreground">
                {statusConfigs[project.status]?.description}
              </p>
              
              {showTimestamps && project.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {format(new Date(project.updatedAt), 'MMM dd, yyyy HH:mm')}
                </p>
              )}
            </div>
          </div>

          {/* Available Actions */}
          {interactive && showActions && hasPermission('canEditMaintenance') && (
            <div className="flex flex-wrap gap-2">
              {statusConfigs[project.status]?.allowedTransitions.map((targetStatus) => {
                const targetConfig = statusConfigs[targetStatus];
                const isForward = workflowOrder.indexOf(targetStatus) > getCurrentStepIndex();
                const isBackward = workflowOrder.indexOf(targetStatus) < getCurrentStepIndex();
                
                return (
                  <Button
                    key={targetStatus}
                    size="sm"
                    variant={isForward ? "default" : "outline"}
                    onClick={() => handleStatusChange(targetStatus)}
                    disabled={updateStatusMutation.isPending}
                    data-testid={`status-transition-${targetStatus}-${project.id}`}
                  >
                    {isBackward ? (
                      <RotateCcw className="h-4 w-4 mr-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-1" />
                    )}
                    {isForward ? 'Advance to' : 'Return to'} {targetConfig.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={!!pendingStatus} onOpenChange={() => setPendingStatus(null)}>
          <AlertDialogContent data-testid={`status-confirmation-${project.id}`}>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to change the project status to{' '}
                <strong>{pendingStatus && statusConfigs[pendingStatus]?.label}</strong>?
                {pendingStatus === 'completed' && (
                  <span className="block mt-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    This will mark the project as fully completed.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmStatusChange}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

