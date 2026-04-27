// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBuildingPermissions } from '@/hooks/use-building-context';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import {
  Folder,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Archive,
  Lightbulb,
  Users,
  BarChart3,
  Target,
  Zap,
} from 'lucide-react';

export interface ProjectsOverviewProps {
  className?: string;
  buildingId?: string;
  organizationId?: string;
}

interface ProjectMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  plannedProjects: number;
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
  budgetUtilization: number;
  averageDuration: number;
  completionRate: number;
  onTimeCompletion: number;
  pendingSuggestions: number;
  costEfficiency: number;
  projectsByStatus: Record<string, number>;
  projectsByPriority: Record<string, number>;
  upcomingDeadlines: number;
  resourceUtilization: number;
}

/**
 * ProjectsOverview component displaying key metrics and summary cards
 * Provides comprehensive project portfolio overview
 */
export function ProjectsOverview({ className, buildingId, organizationId }: ProjectsOverviewProps) {
  // Task #1271: route through the real permission hook so the
  // reports section is hidden for users without `canViewReports`. The
  // previous placeholder `() => true` rendered the gated UI for every
  // role, including tenants.
  const { hasPermission } = useBuildingPermissions();
  const { t } = useLanguage();

  // Fetch projects metrics for current building
  const {
    data: metricsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'projects', 'metrics'],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/projects/metrics`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const metrics: ProjectMetrics = metricsResponse?.metrics || {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    overdueProjects: 0,
    plannedProjects: 0,
    totalBudget: 0,
    spentBudget: 0,
    remainingBudget: 0,
    budgetUtilization: 0,
    averageDuration: 0,
    completionRate: 0,
    onTimeCompletion: 0,
    pendingSuggestions: 0,
    costEfficiency: 0,
    projectsByStatus: {},
    projectsByPriority: {},
    upcomingDeadlines: 0,
    resourceUtilization: 0,
  };

  // Calculate performance indicators
  const performanceMetrics = useMemo(() => {
    const budgetHealthy = metrics.budgetUtilization <= 90;
    const scheduleHealthy = metrics.onTimeCompletion >= 80;
    const efficiencyHealthy = metrics.completionRate >= 85;
    
    return {
      budgetHealth: budgetHealthy ? 'healthy' : metrics.budgetUtilization > 110 ? 'critical' : 'warning',
      scheduleHealth: scheduleHealthy ? 'healthy' : metrics.onTimeCompletion < 60 ? 'critical' : 'warning',
      efficiencyHealth: efficiencyHealthy ? 'healthy' : metrics.completionRate < 70 ? 'critical' : 'warning',
      overallHealth: budgetHealthy && scheduleHealthy && efficiencyHealthy ? 'healthy' : 'warning',
    };
  }, [metrics]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {t('pvFailedToLoadMetrics')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('space-y-6', className)} data-testid="projects-overview">
      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <Card data-testid="total-projects-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvTotalProjectsTitle')}</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-projects-count">
              {metrics.totalProjects}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="flex items-center">
                <Play className="h-3 w-3 mr-1 text-blue-500" />
                {t('pvNActive').replace('{count}', String(metrics.activeProjects))}
              </span>
              <span className="mx-2">•</span>
              <span className="flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                {t('pvNCompleted').replace('{count}', String(metrics.completedProjects))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Budget Overview */}
        <Card data-testid="budget-overview-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvBudgetOverviewTitle')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-budget">
              ${metrics.totalBudget.toLocaleString()}
            </div>
            <div className="space-y-2">
              <Progress value={metrics.budgetUtilization} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('pvAmountSpentText').replace('{amount}', `$${metrics.spentBudget.toLocaleString()}`)}</span>
                <span className={cn(
                  "font-medium",
                  performanceMetrics.budgetHealth === 'healthy' ? 'text-green-600' :
                  performanceMetrics.budgetHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {metrics.budgetUtilization}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Status */}
        <Card data-testid="schedule-status-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvScheduleStatusTitle')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="overdue-projects">
              {metrics.overdueProjects}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.overdueProjects > 0 ? (
                <span className="flex items-center text-red-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t('pvOverdueProjectsText')}
                </span>
              ) : (
                <span className="flex items-center text-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t('pvNoOverdueProjects')}
                </span>
              )}
              {metrics.upcomingDeadlines > 0 && (
                <>
                  <span className="mx-2">•</span>
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {t('pvNDueSoon').replace('{count}', String(metrics.upcomingDeadlines))}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card data-testid="performance-metrics-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvPerformanceTitle')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="completion-rate">
              {metrics.completionRate}%
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="flex items-center">
                {metrics.completionRate >= 85 ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                )}
                {t('pvCompletionRateText')}
              </span>
              <span className="mx-2">•</span>
              <span>{t('pvNPercentOnTime').replace('{percent}', String(metrics.onTimeCompletion))}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Suggestions Integration */}
        <Card data-testid="suggestions-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvSuggestionsTitle')}</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="pending-suggestions">
              {metrics.pendingSuggestions}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.pendingSuggestions > 0 ? (
                <span className="text-orange-600">{t('pvPendingEvaluationSuggestions')}</span>
              ) : (
                <span className="text-green-600">{t('pvAllSuggestionsReviewed')}</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Average Duration */}
        <Card data-testid="duration-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvAvgDuration')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="average-duration">
              {metrics.averageDuration}
            </div>
            <p className="text-xs text-muted-foreground">{t('pvDaysPerProject')}</p>
          </CardContent>
        </Card>

        {/* Cost Efficiency */}
        <Card data-testid="cost-efficiency-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvCostEfficiencyTitle')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="cost-efficiency">
              {metrics.costEfficiency}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.costEfficiency >= 90 ? (
                <span className="text-green-600">{t('pvExcellentEfficiency')}</span>
              ) : metrics.costEfficiency >= 75 ? (
                <span className="text-yellow-600">{t('pvGoodEfficiency')}</span>
              ) : (
                <span className="text-red-600">{t('pvNeedsImprovement')}</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Resource Utilization */}
        <Card data-testid="resource-utilization-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pvResourcesTitle')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="resource-utilization">
              {metrics.resourceUtilization}%
            </div>
            <div className="space-y-1">
              <Progress value={metrics.resourceUtilization} className="h-2" />
              <p className="text-xs text-muted-foreground">{t('pvTeamUtilization')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      {hasPermission('canViewReports') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Projects by Status */}
          <Card data-testid="status-breakdown-card">
            <CardHeader>
              <CardTitle className="text-base">{t('pvProjectsByStatus')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(metrics.projectsByStatus).map(([status, count]) => {
                  const percentage = metrics.totalProjects > 0 ? (count / metrics.totalProjects) * 100 : 0;
                  
                  const statusConfig = {
                    planned: { label: t('pvStatusPlanned'), color: 'bg-gray-500', icon: Archive },
                    evaluation: { label: t('pvStatusEvaluation'), color: 'bg-purple-500', icon: Zap },
                    submission: { label: t('pvStatusSubmission'), color: 'bg-orange-500', icon: Target },
                    pre_work: { label: t('pvStatusPreWork'), color: 'bg-yellow-500', icon: Clock },
                    work: { label: t('pvStatusActiveWork'), color: 'bg-blue-500', icon: Play },
                    post_work: { label: t('pvStatusPostWork'), color: 'bg-indigo-500', icon: CheckCircle2 },
                    completed: { label: t('pvStatusCompleted'), color: 'bg-green-500', icon: CheckCircle2 },
                  };
                  
                  const config = statusConfig[status as keyof typeof statusConfig];
                  if (!config || count === 0) return null;
                  
                  const IconComponent = config.icon;
                  
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", config.color)} />
                        <span className="text-sm font-medium">{config.label}</span>
                        <IconComponent className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{count}</span>
                        <Badge variant="outline" className="text-xs">
                          {percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Projects by Priority */}
          <Card data-testid="priority-breakdown-card">
            <CardHeader>
              <CardTitle className="text-base">{t('pvProjectsByPriority')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(metrics.projectsByPriority).map(([priority, count]) => {
                  const percentage = metrics.totalProjects > 0 ? (count / metrics.totalProjects) * 100 : 0;
                  
                  const priorityConfig = {
                    low: { label: t('pvPriorityLowLabel'), color: 'bg-green-500' },
                    medium: { label: t('pvPriorityMediumLabel'), color: 'bg-yellow-500' },
                    high: { label: t('pvPriorityHighLabel'), color: 'bg-orange-500' },
                    critical: { label: t('pvPriorityCriticalLabel'), color: 'bg-red-500' },
                  };
                  
                  const config = priorityConfig[priority as keyof typeof priorityConfig];
                  if (!config || count === 0) return null;
                  
                  return (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", config.color)} />
                        <span className="text-sm font-medium">{config.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{count}</span>
                        <Badge variant="outline" className="text-xs">
                          {percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Health Alert */}
      {performanceMetrics.overallHealth !== 'healthy' && (
        <Alert variant="destructive" data-testid="health-alert">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {performanceMetrics.budgetHealth === 'critical' && t('pvBudgetCriticallyHigh')}
            {performanceMetrics.scheduleHealth === 'critical' && t('pvSchedulePerformanceAttention')}
            {performanceMetrics.efficiencyHealth === 'critical' && t('pvEfficiencyBelowAcceptable')}
            {t('pvHealthAlertSuffix')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}