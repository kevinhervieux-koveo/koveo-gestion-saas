import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge, PriorityBadge } from '@/components/maintenance/StatusBadges';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn, parseDateOnly } from '@/lib/utils';
import {
  translateProjectStatus,
  translateProjectPriority,
  translateProjectType,
} from './projectEnumLabels';
import {
  Calendar,
  Clock,
  DollarSign,
  Edit2,
  FileText,
  Folder,
  Play,
  Settings,
  Target,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Paperclip,
  Zap,
  ChevronRight,
} from 'lucide-react';

export interface ProjectDetailsPanelProps {
  project: MaintenanceProject | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (project: MaintenanceProject) => void;
  onManageElements?: (project: MaintenanceProject) => void;
  onManageTimeline?: (project: MaintenanceProject) => void;
  onManageNotes?: (project: MaintenanceProject) => void;
  onManageBudget?: (project: MaintenanceProject) => void;
  onUpdateStatus?: (project: MaintenanceProject) => void;
  buildingId?: string;
  organizationId?: string;
}

/**
 * ProjectDetailsPanel component for displaying comprehensive project information
 * Provides detailed view with tabbed interface and quick actions
 */
export function ProjectDetailsPanel({
  project,
  isOpen,
  onClose,
  onEdit,
  onManageElements,
  onManageTimeline,
  onManageNotes,
  onManageBudget,
  onUpdateStatus,
  buildingId,
  organizationId,
}: ProjectDetailsPanelProps) {
  // Simplified placeholder - no context for now
  const hasPermission = () => true;
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch detailed project data when panel is open
  const {
    data: projectDetailsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project?.id],
    queryFn: async () => {
      if (!project?.id) throw new Error('Project ID is required');
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}`);
      return await response.json();
    },
    enabled: !!project?.id && isOpen,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const projectDetails = projectDetailsResponse?.project || project;

  // Calculate project metrics
  const metrics = useMemo(() => {
    if (!projectDetails) return null;

    const startDate = parseDateOnly(projectDetails.plannedStartDate);
    const endDate = parseDateOnly(projectDetails.plannedEndDate);
    const actualStart = parseDateOnly(projectDetails.actualStartDate);
    const actualEnd = parseDateOnly(projectDetails.actualEndDate);
    const now = new Date();

    const totalBudget = projectDetails.totalBudget ? parseFloat(projectDetails.totalBudget) : 0;
    const actualCost = projectDetails.actualCost ? parseFloat(projectDetails.actualCost) : 0;
    const budgetUtilization = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;

    // Calculate progress based on status
    const statusProgress = {
      planned: 10,
      evaluation: 20,
      submission: 35,
      pre_work: 50,
      work: 75,
      post_work: 90,
      completed: 100,
    };

    const progress = statusProgress[projectDetails.status as keyof typeof statusProgress] || 0;

    // Calculate duration
    const plannedDuration = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const actualDuration = actualStart && actualEnd ? Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Check if overdue
    const isOverdue = endDate && endDate < now && projectDetails.status !== 'completed';

    // Days remaining
    const daysRemaining = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    return {
      progress,
      budgetUtilization,
      isOverdue,
      daysRemaining,
      plannedDuration,
      actualDuration,
      isOverBudget: budgetUtilization > 100,
    };
  }, [projectDetails]);

  if (!project) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[700px] max-h-[100vh] overflow-y-auto" data-testid="project-details-panel">
        <SheetHeader className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <SheetTitle className="text-xl" data-testid="project-title">
                {project.title}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  #{project.projectNumber}
                </Badge>
                <StatusBadge status={project.status} size="sm" />
                <PriorityBadge priority={project.priority} size="sm" />
              </div>
            </div>
          </div>
          
          <SheetDescription className="text-sm">
            {t('pvDetailsPanelDesc')}
          </SheetDescription>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {hasPermission() && onEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit(project)}
                data-testid="edit-project-action"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t('pvEditProjectAction')}
              </Button>
            )}
            
            {hasPermission() && onUpdateStatus && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onUpdateStatus(project)}
                data-testid="update-status-action"
              >
                <Play className="h-4 w-4 mr-2" />
                {t('pvUpdateStatusAction')}
              </Button>
            )}
            
            {onManageTimeline && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onManageTimeline(project)}
                data-testid="manage-timeline-action"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {t('pvTimelineAction')}
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('pvFailedToLoadDetails')}
            </AlertDescription>
          </Alert>
        )}

        {/* Project Content */}
        {!isLoading && !error && projectDetails && metrics && (
          <div className="mt-6 space-y-6">
            {/* Progress Overview */}
            <Card data-testid="progress-overview-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {t('pvProjectProgressTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('pvOverallProgressLabel')}</span>
                    <span className="font-medium">{metrics.progress}%</span>
                  </div>
                  <Progress value={metrics.progress} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">{t('status')}</span>
                    <div className="font-medium">
                      {translateProjectStatus(projectDetails.status, t)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">{t('priority')}</span>
                    <div className="font-medium">
                      {translateProjectPriority(projectDetails.priority, t)}
                    </div>
                  </div>
                  {metrics.daysRemaining !== null && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">{t('pvTimeRemaining')}</span>
                      <div className={cn(
                        "font-medium",
                        metrics.isOverdue ? "text-red-600" : 
                        metrics.daysRemaining <= 7 ? "text-yellow-600" : "text-green-600"
                      )}>
                        {metrics.isOverdue 
                          ? t('pvDaysOverdue').replace('{days}', String(Math.abs(metrics.daysRemaining)))
                          : t('pvDaysLeft').replace('{days}', String(metrics.daysRemaining))
                        }
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <span className="text-muted-foreground">{t('pvBudgetUsage')}</span>
                    <div className={cn(
                      "font-medium",
                      metrics.isOverBudget ? "text-red-600" : "text-green-600"
                    )}>
                      {metrics.budgetUtilization.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {(metrics.isOverdue || metrics.isOverBudget) && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {metrics.isOverdue && `${t('pvProjectIsOverdue')} `}
                      {metrics.isOverBudget && `${t('pvProjectIsOverBudget')} `}
                      {t('pvImmediateAttention')}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Tabbed Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="project-details-tabs">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">{t('pvOverviewTab')}</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">{t('pvTimelineTab')}</TabsTrigger>
                <TabsTrigger value="budget" className="text-xs">{t('pvBudgetTab')}</TabsTrigger>
                <TabsTrigger value="elements" className="text-xs">{t('pvElementsTab')}</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t('pvProjectInformation')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <span className="text-muted-foreground">{t('pvTypeColon')}</span>
                        <span className="ml-2 font-medium">
                          {translateProjectType(projectDetails.type, t)}
                        </span>
                      </div>
                      
                      {projectDetails.suggestionId && (
                        <div>
                          <span className="text-muted-foreground">{t('pvCreatedFromSuggestion')}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            {t('pvAutoGenerated')}
                          </Badge>
                        </div>
                      )}

                      <div>
                        <span className="text-muted-foreground">{t('pvCreatedColon')}</span>
                        <span className="ml-2 font-medium">
                          {format(new Date(projectDetails.createdAt), 'MMM dd, yyyy')}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground">{t('pvLastUpdatedColon')}</span>
                        <span className="ml-2 font-medium">
                          {format(new Date(projectDetails.updatedAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">{t('pvDurationCaps')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {metrics.plannedDuration ? t('pvNDays').replace('{count}', String(metrics.plannedDuration)) : t('notSet')}
                      </div>
                      {metrics.actualDuration && (
                        <div className="text-xs text-muted-foreground">
                          {t('pvActualNDays').replace('{count}', String(metrics.actualDuration))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">{t('pvBudgetCaps')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {projectDetails.totalBudget ? `$${parseFloat(projectDetails.totalBudget).toLocaleString()}` : t('notSet')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('pvAmountSpentSuffix').replace('{amount}', `$${projectDetails.actualCost ? parseFloat(projectDetails.actualCost).toLocaleString() : '0'}`)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Management Actions */}
                <div className="grid grid-cols-1 gap-2">
                  {onManageElements && (
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={() => onManageElements(project)}
                      data-testid="manage-elements-button"
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      {t('pvManageProjectElements')}
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  )}
                  
                  {onManageNotes && (
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={() => onManageNotes(project)}
                      data-testid="manage-notes-button"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {t('pvProjectNotesAndComm')}
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  )}
                  
                  {onManageBudget && (
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={() => onManageBudget(project)}
                      data-testid="manage-budget-button"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      {t('pvBudgetCostTracking')}
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  )}
                </div>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t('pvProjectTimelineTitle')}</CardTitle>
                    <CardDescription>{t('pvKeyDatesAndMilestones')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t('pvPlannedStartColon')}</span>
                        <span className="font-medium">
                          {projectDetails.plannedStartDate 
                            ? format(parseDateOnly(projectDetails.plannedStartDate)!, 'MMM dd, yyyy')
                            : t('notSet')
                          }
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t('pvPlannedEndColon')}</span>
                        <span className="font-medium">
                          {projectDetails.plannedEndDate 
                            ? format(parseDateOnly(projectDetails.plannedEndDate)!, 'MMM dd, yyyy')
                            : t('notSet')
                          }
                        </span>
                      </div>

                      {projectDetails.actualStartDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">{t('pvActualStartColon')}</span>
                          <span className="font-medium">
                            {format(parseDateOnly(projectDetails.actualStartDate)!, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}

                      {projectDetails.actualEndDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">{t('pvActualEndColon')}</span>
                          <span className="font-medium">
                            {format(parseDateOnly(projectDetails.actualEndDate)!, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>

                    {onManageTimeline && (
                      <Button 
                        className="w-full" 
                        onClick={() => onManageTimeline(project)}
                        data-testid="open-timeline-button"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {t('pvOpenFullTimelineView')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Budget Tab */}
              <TabsContent value="budget" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t('pvBudgetAnalysisCardTitle')}</CardTitle>
                    <CardDescription>{t('pvFinancialTrackingDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t('pvBudgetUtilizationCardLabel')}</span>
                        <span className="font-medium">{metrics.budgetUtilization.toFixed(1)}%</span>
                      </div>
                      <Progress value={Math.min(metrics.budgetUtilization, 100)} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-muted-foreground">{t('pvTotalBudgetLabel')}</span>
                        <div className="font-bold text-lg">
                          ${projectDetails.totalBudget ? parseFloat(projectDetails.totalBudget).toLocaleString() : '—'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">{t('pvAmountSpentLabel')}</span>
                        <div className="font-bold text-lg">
                          ${projectDetails.actualCost ? parseFloat(projectDetails.actualCost).toLocaleString() : '0'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">{t('pvRemainingLabel')}</span>
                        <div className={cn(
                          "font-bold text-lg",
                          metrics.isOverBudget ? "text-red-600" : "text-green-600"
                        )}>
                          ${projectDetails.totalBudget 
                            ? (parseFloat(projectDetails.totalBudget) - (projectDetails.actualCost ? parseFloat(projectDetails.actualCost) : 0)).toLocaleString()
                            : '—'
                          }
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">{t('pvVarianceLabel')}</span>
                        <div className={cn(
                          "font-bold text-lg",
                          metrics.isOverBudget ? "text-red-600" : "text-green-600"
                        )}>
                          {metrics.isOverBudget ? '+' : ''}{(metrics.budgetUtilization - 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {onManageBudget && (
                      <Button 
                        className="w-full" 
                        onClick={() => onManageBudget(project)}
                        data-testid="open-budget-button"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        {t('pvOpenBudgetManagement')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Elements Tab */}
              <TabsContent value="elements" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t('pvProjectElementsTitle')}</CardTitle>
                    <CardDescription>{t('pvElementsAssociatedDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-6 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('pvElementsAvailableInFullView')}</p>
                    </div>
                    
                    {onManageElements && (
                      <Button 
                        className="w-full" 
                        onClick={() => onManageElements(project)}
                        data-testid="open-elements-button"
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        {t('pvManageProjectElements')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

