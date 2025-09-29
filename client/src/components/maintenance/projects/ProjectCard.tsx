import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { format, differenceInDays, parseISO, isPast } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge, PriorityBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  MoreHorizontal,
  Edit2,
  Calendar,
  Clock,
  DollarSign,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
} from 'lucide-react';

export interface ProjectCardProps {
  project: MaintenanceProject;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  onEdit?: (project: MaintenanceProject) => void;
  onViewTimeline?: (project: MaintenanceProject) => void;
  onAddNotes?: (project: MaintenanceProject) => void;
  onUpdateStatus?: (project: MaintenanceProject, status: string) => void;
  showActions?: boolean;
  showProgress?: boolean;
  showMetrics?: boolean;
  interactive?: boolean;
}

interface ProjectMetrics {
  progress: number;
  elementCount: number;
  budgetUtilization: number;
  daysRemaining?: number;
  isOverdue: boolean;
  isOverBudget: boolean;
  lastActivity?: Date;
  nextMilestone?: string;
}

/**
 * ProjectCard component for displaying individual project information
 * Shows project summary, status, progress, metrics, and quick actions
 */
export function ProjectCard({
  project,
  className,
  variant = 'default',
  onEdit,
  onViewTimeline,
  onAddNotes,
  onUpdateStatus,
  showActions = true,
  showProgress = true,
  showMetrics = true,
  interactive = true,
}: ProjectCardProps) {
  const { hasPermission, buildingId } = useBuildingContext();
  const { toast } = useToast();

  // Calculate project metrics
  const metrics: ProjectMetrics = useMemo(() => {
    const totalBudget = project.totalBudget ? parseFloat(project.totalBudget) : 0;
    const actualCost = project.actualCost ? parseFloat(project.actualCost) : 0;
    const budgetUtilization = totalBudget > 0 ? Math.round((actualCost / totalBudget) * 100) : 0;
    
    // Calculate days remaining
    let daysRemaining: number | undefined;
    let isOverdue = false;
    
    if (project.plannedEndDate) {
      const endDate = parseISO(project.plannedEndDate);
      const today = new Date();
      daysRemaining = differenceInDays(endDate, today);
      isOverdue = isPast(endDate) && project.status !== 'completed';
    }

    // Estimate progress based on status
    const statusProgress = {
      planned: 5,
      evaluation: 15,
      submission: 30,
      pre_work: 45,
      in_progress: 75,
      post_work: 90,
      completed: 100,
    };

    const progress = statusProgress[project.status as keyof typeof statusProgress] || 0;

    return {
      progress,
      elementCount: 0, // This would come from API in real implementation
      budgetUtilization,
      daysRemaining,
      isOverdue,
      isOverBudget: budgetUtilization > 100,
      lastActivity: project.updatedAt,
      nextMilestone: undefined, // This would be calculated based on project steps
    };
  }, [project]);

  // Quick status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${project.id}`, {
        status: newStatus,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      toast({
        title: "Status Updated",
        description: `Project status has been updated successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update project status. Please try again.",
        variant: "destructive",
      });
      console.error('Status update failed:', error);
    },
  });

  const handleStatusUpdate = (newStatus: string) => {
    if (onUpdateStatus) {
      onUpdateStatus(project, newStatus);
    } else {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const getTypeConfig = (type: string) => {
    const typeConfigs = {
      evaluation: { 
        label: 'Evaluation', 
        icon: Target, 
        color: 'text-purple-600 bg-purple-50 border-purple-200',
        darkColor: 'dark:text-purple-300 dark:bg-purple-950 dark:border-purple-800'
      },
      repair: { 
        label: 'Repair', 
        icon: Building2, 
        color: 'text-orange-600 bg-orange-50 border-orange-200',
        darkColor: 'dark:text-orange-300 dark:bg-orange-950 dark:border-orange-800'
      },
      minor_rehab: { 
        label: 'Minor Rehab', 
        icon: Building2, 
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        darkColor: 'dark:text-blue-300 dark:bg-blue-950 dark:border-blue-800'
      },
      major_rehab: { 
        label: 'Major Rehab', 
        icon: Building2, 
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        darkColor: 'dark:text-indigo-300 dark:bg-indigo-950 dark:border-indigo-800'
      },
      replacement: { 
        label: 'Replacement', 
        icon: CheckCircle2, 
        color: 'text-green-600 bg-green-50 border-green-200',
        darkColor: 'dark:text-green-300 dark:bg-green-950 dark:border-green-800'
      },
    };

    return typeConfigs[type as keyof typeof typeConfigs] || typeConfigs.repair;
  };

  const typeConfig = getTypeConfig(project.type);
  const TypeIcon = typeConfig.icon;

  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return 'p-4';
      case 'detailed':
        return 'p-6';
      default:
        return 'p-5';
    }
  };

  const shouldShowQuickActions = showActions && hasPermission('canEditMaintenance');

  return (
    <Card 
      className={cn(
        "relative transition-all duration-200",
        interactive && "hover:shadow-md cursor-pointer",
        metrics.isOverdue && "border-red-200 dark:border-red-800",
        className
      )}
      data-testid={`project-card-${project.id}`}
    >
      {/* Priority indicator */}
      {project.priority === 'critical' && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-red-500">
          <Zap className="absolute -top-4 -right-3 h-3 w-3 text-white" />
        </div>
      )}

      <CardHeader className={cn("pb-3", getVariantStyles())}>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn(typeConfig.color, typeConfig.darkColor)}
                data-testid={`project-type-badge-${project.id}`}
              >
                <TypeIcon className="h-3 w-3 mr-1" />
                {typeConfig.label}
              </Badge>
              <PriorityBadge 
                priority={project.priority} 
                size="sm"
                data-testid={`project-priority-badge-${project.id}`}
              />
            </div>
            
            <CardTitle className="text-lg leading-tight truncate" data-testid={`project-title-${project.id}`}>
              {project.title}
            </CardTitle>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span data-testid={`project-number-${project.id}`}>
                #{project.projectNumber}
              </span>
              {metrics.lastActivity && (
                <span data-testid={`project-last-activity-${project.id}`}>
                  Updated {format(new Date(metrics.lastActivity), 'MMM dd')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge 
              status={project.status} 
              size="sm"
              data-testid={`project-status-badge-${project.id}`}
            />
            
            {shouldShowQuickActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    data-testid={`project-card-actions-${project.id}`}
                  >
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={() => onEdit?.(project)}
                    data-testid={`project-card-edit-${project.id}`}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Project
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => onViewTimeline?.(project)}
                    data-testid={`project-card-timeline-${project.id}`}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    View Timeline
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => onAddNotes?.(project)}
                    data-testid={`project-card-notes-${project.id}`}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Add Notes
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  
                  {project.status !== 'in_progress' && (
                    <DropdownMenuItem 
                      onClick={() => handleStatusUpdate('in_progress')}
                      data-testid={`project-card-start-work-${project.id}`}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start Work
                    </DropdownMenuItem>
                  )}
                  
                  {project.status === 'in_progress' && (
                    <DropdownMenuItem 
                      onClick={() => handleStatusUpdate('post_work')}
                      data-testid={`project-card-complete-work-${project.id}`}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Work
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Section */}
        {showProgress && (
          <div className="space-y-2" data-testid={`project-progress-${project.id}`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{metrics.progress}%</span>
            </div>
            <Progress value={metrics.progress} className="h-2" />
          </div>
        )}

        {/* Timeline Section */}
        {(project.plannedStartDate || project.plannedEndDate) && (
          <div className="grid grid-cols-2 gap-4" data-testid={`project-timeline-${project.id}`}>
            {project.plannedStartDate && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Start Date
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(project.plannedStartDate), 'MMM dd, yyyy')}
                </div>
              </div>
            )}
            
            {project.plannedEndDate && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  End Date
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(project.plannedEndDate), 'MMM dd, yyyy')}
                </div>
                {metrics.daysRemaining !== undefined && (
                  <div className={cn(
                    "text-xs",
                    metrics.isOverdue ? "text-red-600" :
                    metrics.daysRemaining <= 7 ? "text-yellow-600" : "text-green-600"
                  )}>
                    {metrics.isOverdue 
                      ? `${Math.abs(metrics.daysRemaining)} days overdue`
                      : `${metrics.daysRemaining} days remaining`
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Metrics Section */}
        {showMetrics && variant !== 'compact' && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t" data-testid={`project-metrics-${project.id}`}>
            {/* Budget Metrics */}
            {project.totalBudget && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  Budget
                </div>
                <div className="text-sm font-medium">
                  ${parseFloat(project.totalBudget).toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className={cn(
                    metrics.isOverBudget ? "text-red-600" : "text-green-600"
                  )}>
                    {metrics.budgetUtilization}% used
                  </span>
                  {metrics.isOverBudget ? (
                    <TrendingUp className="h-3 w-3 text-red-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-green-600" />
                  )}
                </div>
              </div>
            )}

            {/* Element Count */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                Elements
              </div>
              <div className="text-sm font-medium">
                {metrics.elementCount} assigned
              </div>
              <div className="text-xs text-muted-foreground">
                Building components
              </div>
            </div>
          </div>
        )}

        {/* Urgency Indicators */}
        {(metrics.isOverdue || metrics.isOverBudget || project.priority === 'critical') && (
          <div className="flex flex-wrap gap-2 pt-2" data-testid={`project-urgency-${project.id}`}>
            {metrics.isOverdue && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
            {metrics.isOverBudget && (
              <Badge variant="destructive">
                <TrendingUp className="h-3 w-3 mr-1" />
                Over Budget
              </Badge>
            )}
            {project.priority === 'critical' && (
              <Badge variant="destructive">
                <Zap className="h-3 w-3 mr-1" />
                Critical Priority
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}