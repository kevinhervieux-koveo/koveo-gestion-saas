// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useMemo } from 'react';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format, differenceInDays, parseISO, isPast } from 'date-fns';
import { StandardCard } from '@/components/common/StandardCard';
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
import { cn, parseDateOnly } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
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

const getTypeConfig = (type: string, t: (key: string) => string) => {
  const typeConfigs = {
    evaluation: { 
      label: t('pcTypeEvaluation'), 
      icon: Target, 
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      darkColor: 'dark:text-purple-300 dark:bg-purple-950 dark:border-purple-800'
    },
    repair: { 
      label: t('pcTypeRepair'), 
      icon: Building2, 
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      darkColor: 'dark:text-orange-300 dark:bg-orange-950 dark:border-orange-800'
    },
    minor_rehab: { 
      label: t('pcTypeMinorRehab'), 
      icon: Building2, 
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      darkColor: 'dark:text-blue-300 dark:bg-blue-950 dark:border-blue-800'
    },
    major_rehab: { 
      label: t('pcTypeMajorRehab'), 
      icon: Building2, 
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      darkColor: 'dark:text-indigo-300 dark:bg-indigo-950 dark:border-indigo-800'
    },
    replacement: { 
      label: t('pcTypeReplacement'), 
      icon: CheckCircle2, 
      color: 'text-green-600 bg-green-50 border-green-200',
      darkColor: 'dark:text-green-300 dark:bg-green-950 dark:border-green-800'
    },
  };

  return typeConfigs[type as keyof typeof typeConfigs] || typeConfigs.repair;
};

const calculateMetrics = (project: MaintenanceProject): ProjectMetrics => {
  const totalBudget = project.totalBudget ? parseFloat(project.totalBudget) : 0;
  const actualCost = project.actualCost ? parseFloat(project.actualCost) : 0;
  const budgetUtilization = totalBudget > 0 ? Math.round((actualCost / totalBudget) * 100) : 0;
  
  let daysRemaining: number | undefined;
  let isOverdue = false;
  
  if (project.plannedEndDate) {
    const endDate = parseISO(project.plannedEndDate);
    const today = new Date();
    daysRemaining = differenceInDays(endDate, today);
    isOverdue = isPast(endDate) && project.status !== 'completed';
  }

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
    elementCount: project.projectElements?.length || 0,
    budgetUtilization,
    daysRemaining,
    isOverdue,
    isOverBudget: budgetUtilization > 100,
    lastActivity: project.updatedAt,
    nextMilestone: undefined,
  };
};

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
  const { t } = useLanguage();
  const { hasPermission, buildingId } = useBuildingContext();
  const { toast } = useToast();

  const metrics = useMemo(() => calculateMetrics(project), [project]);

  const updateStatusMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${project.id}`, {
        status: newStatus,
      });
      return response.json();
    },
    successTitle: t('pcStatusUpdatedTitle'),
    successMessage: t('pcStatusUpdatedDesc'),
    errorTitle: t('pcUpdateFailedTitle'),
    errorMessage: t('pcUpdateFailedDesc'),
    queryKeysToInvalidate: [['/api/maintenance/buildings', buildingId, 'projects']],
    onErrorCallback: (error) => {
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

  const typeConfig = getTypeConfig(project.type, t);
  const TypeIcon = typeConfig.icon;
  const compact = variant === 'compact';

  const badges = compact 
    ? []
    : [
        {
          text: (
            <span className="flex items-center gap-1">
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </span>
          ),
          variant: 'outline' as const,
          className: cn(typeConfig.color, typeConfig.darkColor),
        },
        ...(metrics.isOverdue ? [{
          text: (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('pcOverdueBadge')}
            </span>
          ),
          variant: 'destructive' as const,
        }] : []),
        ...(metrics.isOverBudget ? [{
          text: (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {t('pcOverBudgetBadge')}
            </span>
          ),
          variant: 'destructive' as const,
        }] : []),
        ...(project.priority === 'critical' ? [{
          text: (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {t('pcCriticalPriorityBadge')}
            </span>
          ),
          variant: 'destructive' as const,
        }] : []),
      ];

  const metadata = compact
    ? [
        {
          value: `#${project.projectNumber}`,
        },
      ]
    : [
        {
          value: `#${project.projectNumber}`,
        },
        ...(metrics.lastActivity ? [{
          value: `${t('pcUpdatedPrefix')} ${format(new Date(metrics.lastActivity), 'MMM dd')}`,
        }] : []),
        ...(project.totalBudget ? [{
          icon: <DollarSign className="w-3 h-3" />,
          value: `$${parseFloat(project.totalBudget).toLocaleString()}`,
        }] : []),
        ...(metrics.daysRemaining !== undefined ? [{
          icon: <Clock className="w-3 h-3" />,
          value: metrics.isOverdue 
            ? `${Math.abs(metrics.daysRemaining)} ${t('pcDaysOverdueSuffix')}`
            : `${metrics.daysRemaining} ${t('pcDaysRemainingSuffix')}`,
        }] : []),
      ];

  const shouldShowQuickActions = showActions && hasPermission('canEditMaintenance');

  const ActionsDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          data-testid={`project-card-actions-${project.id}`}
        >
          <span className="sr-only">{t('pcOpenMenu')}</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('pcQuickActionsLabel')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => onEdit?.(project)}
          data-testid={`project-card-edit-${project.id}`}
        >
          <Edit2 className="mr-2 h-4 w-4" />
          {t('pcEditProject')}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => onViewTimeline?.(project)}
          data-testid={`project-card-timeline-${project.id}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {t('pcViewTimeline')}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => onAddNotes?.(project)}
          data-testid={`project-card-notes-${project.id}`}
        >
          <FileText className="mr-2 h-4 w-4" />
          {t('pcAddNotes')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        {project.status !== 'in_progress' && (
          <DropdownMenuItem 
            onClick={() => handleStatusUpdate('in_progress')}
            data-testid={`project-card-start-work-${project.id}`}
          >
            <Play className="mr-2 h-4 w-4" />
            {t('pcStartWork')}
          </DropdownMenuItem>
        )}
        
        {project.status === 'in_progress' && (
          <DropdownMenuItem 
            onClick={() => handleStatusUpdate('post_work')}
            data-testid={`project-card-complete-work-${project.id}`}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t('pcCompleteWork')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const cardIcon = (
    <div className="relative">
      <TypeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      {project.priority === 'critical' && (
        <Zap className="absolute -top-1 -right-1 h-3 w-3 text-red-500" />
      )}
    </div>
  );

  return (
    <StandardCard
      title={project.title}
      description={`#${project.projectNumber}`}
      icon={cardIcon}
      badges={badges}
      metadata={metadata}
      compact={compact}
      className={cn(
        metrics.isOverdue && "border-red-200 dark:border-red-800",
        className
      )}
      hover={interactive}
      actions={shouldShowQuickActions ? [
        {
          icon: <ActionsDropdown />,
          label: t('pcQuickActionsLabel'),
          onClick: () => {},
        },
      ] : []}
      testId={`project-card-${project.id}`}
    >
      {!compact && (
        <div className="space-y-4">
          {/* Priority and Status Badges */}
          <div className="flex items-center gap-2">
            <PriorityBadge 
              priority={project.priority} 
              size="sm"
              data-testid={`project-priority-badge-${project.id}`}
            />
            <StatusBadge 
              status={project.status} 
              size="sm"
              data-testid={`project-status-badge-${project.id}`}
            />
          </div>

          {/* Progress Section */}
          {showProgress && (
            <div className="space-y-2" data-testid={`project-progress-${project.id}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t('pcProgressLabel')}</span>
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
                    {t('pcStartDateLabel')}
                  </div>
                  <div className="text-sm font-medium">
                    {format(parseDateOnly(project.plannedStartDate)!, 'MMM dd, yyyy')}
                  </div>
                </div>
              )}
              
              {project.plannedEndDate && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {t('pcEndDateLabel')}
                  </div>
                  <div className="text-sm font-medium">
                    {format(parseDateOnly(project.plannedEndDate)!, 'MMM dd, yyyy')}
                  </div>
                  {metrics.daysRemaining !== undefined && (
                    <div className={cn(
                      "text-xs",
                      metrics.isOverdue ? "text-red-600" :
                      metrics.daysRemaining <= 7 ? "text-yellow-600" : "text-green-600"
                    )}>
                      {metrics.isOverdue 
                        ? `${Math.abs(metrics.daysRemaining)} ${t('pcDaysOverdueSuffix')}`
                        : `${metrics.daysRemaining} ${t('pcDaysRemainingSuffix')}`
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
              {project.totalBudget && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    {t('pcBudgetLabel')}
                  </div>
                  <div className="text-sm font-medium">
                    ${parseFloat(project.totalBudget).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className={cn(
                      metrics.isOverBudget ? "text-red-600" : "text-green-600"
                    )}>
                      {metrics.budgetUtilization}{t('pcBudgetUsedSuffix')}
                    </span>
                    {metrics.isOverBudget ? (
                      <TrendingUp className="h-3 w-3 text-red-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-green-600" />
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {t('pcElementsLabel')}
                </div>
                <div className="text-sm font-medium">
                  {metrics.elementCount} {t('pcElementsAssignedSuffix')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('pcBuildingComponents')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </StandardCard>
  );
}