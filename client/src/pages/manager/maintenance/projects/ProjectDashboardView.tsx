import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { format, subMonths, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Building2,
  Zap,
  Download,
  RefreshCw,
  Filter,
  Eye,
} from 'lucide-react';

export interface ProjectDashboardViewProps {
  className?: string;
  onProjectSelect?: (project: MaintenanceProject) => void;
  onEditProject?: (project: MaintenanceProject) => void;
  onManageElements?: (project: MaintenanceProject) => void;
  onManageTimeline?: (project: MaintenanceProject) => void;
  onUpdateStatus?: (project: MaintenanceProject) => void;
  searchTerm?: string;
  statusFilter?: string;
  priorityFilter?: string;
  typeFilter?: string;
  showOverdueOnly?: boolean;
  selectedProjects?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  buildingId?: string;
  organizationId?: string;
}

interface DashboardMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  totalBudget: number;
  spentBudget: number;
  budgetUtilization: number;
  averageDuration: number;
  completionRate: number;
  onTimeCompletion: number;
  costEfficiency: number;
  trendsData: Array<{
    month: string;
    created: number;
    completed: number;
    budget: number;
  }>;
  statusBreakdown: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  priorityBreakdown: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  budgetTrends: Array<{
    month: string;
    planned: number;
    actual: number;
    variance: number;
  }>;
  performanceIndicators: {
    budgetHealth: 'healthy' | 'warning' | 'critical';
    scheduleHealth: 'healthy' | 'warning' | 'critical';
    qualityHealth: 'healthy' | 'warning' | 'critical';
  };
}

/**
 * ProjectDashboardView component providing analytics and insights interface
 * Displays comprehensive project portfolio overview with performance metrics and KPI tracking
 */
export function ProjectDashboardView({
  className,
  onProjectSelect,
  onEditProject,
  onManageElements,
  onManageTimeline,
  onUpdateStatus,
  searchTerm = '',
  statusFilter = '',
  priorityFilter = '',
  typeFilter = '',
  showOverdueOnly = false,
  selectedProjects = [],
  onSelectionChange,
  buildingId,
  organizationId,
}: ProjectDashboardViewProps) {
  // Use building context to get current building state
  const { building, hasPermission } = useBuildingContext();
  const { t } = useLanguage();

  // Permission checks for various actions
  const canCreateProjects = hasPermission ? hasPermission('canCreateProjects') : true;
  const canEditMaintenance = hasPermission ? hasPermission('canEditMaintenance') : true;
  const canViewReports = hasPermission ? hasPermission('canViewReports') : true;

  // Fetch dashboard metrics data
  const {
    data: analyticsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'projects', 'metrics'],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/projects/metrics`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate mock analytics data (in real implementation, this would come from the API)
  const dashboardMetrics: DashboardMetrics = useMemo(() => {
    if (analyticsResponse?.analytics) {
      return analyticsResponse.analytics;
    }

    // Mock data for demonstration
    const mockTrendsData = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        month: format(startOfMonth(date), 'MMM yyyy'),
        created: Math.floor(Math.random() * 10) + 5,
        completed: Math.floor(Math.random() * 8) + 3,
        budget: Math.floor(Math.random() * 50000) + 25000,
      };
    });

    return {
      totalProjects: 24,
      activeProjects: 8,
      completedProjects: 14,
      overdueProjects: 2,
      totalBudget: 450000,
      spentBudget: 325000,
      budgetUtilization: 72.2,
      averageDuration: 45,
      completionRate: 87.5,
      onTimeCompletion: 78.3,
      costEfficiency: 92.1,
      trendsData: mockTrendsData,
      statusBreakdown: [
        { name: 'Completed', value: 14, color: '#22c55e' },
        { name: 'Active Work', value: 6, color: '#3b82f6' },
        { name: 'Pre-Work', value: 2, color: '#eab308' },
        { name: 'Planned', value: 2, color: '#6b7280' },
      ],
      priorityBreakdown: [
        { name: 'Medium', value: 12, color: '#eab308' },
        { name: 'High', value: 8, color: '#f97316' },
        { name: 'Low', value: 3, color: '#22c55e' },
        { name: 'Critical', value: 1, color: '#ef4444' },
      ],
      budgetTrends: mockTrendsData.map(item => ({
        month: item.month,
        planned: item.budget,
        actual: item.budget * (0.8 + Math.random() * 0.4),
        variance: (Math.random() - 0.5) * 20,
      })),
      performanceIndicators: {
        budgetHealth: 'healthy',
        scheduleHealth: 'warning',
        qualityHealth: 'healthy',
      },
    };
  }, [analyticsResponse]);

  // Calculate KPI trends
  const kpiTrends = useMemo(() => {
    const currentMetrics = dashboardMetrics;
    const previousPeriod = {
      completionRate: 82.1,
      budgetUtilization: 68.5,
      onTimeCompletion: 75.2,
      costEfficiency: 89.3,
    };

    return {
      completionRate: {
        current: currentMetrics.completionRate,
        change: currentMetrics.completionRate - previousPeriod.completionRate,
        trend: currentMetrics.completionRate > previousPeriod.completionRate ? 'up' : 'down',
      },
      budgetUtilization: {
        current: currentMetrics.budgetUtilization,
        change: currentMetrics.budgetUtilization - previousPeriod.budgetUtilization,
        trend: currentMetrics.budgetUtilization < 90 ? 'up' : 'down', // Lower is better for utilization
      },
      onTimeCompletion: {
        current: currentMetrics.onTimeCompletion,
        change: currentMetrics.onTimeCompletion - previousPeriod.onTimeCompletion,
        trend: currentMetrics.onTimeCompletion > previousPeriod.onTimeCompletion ? 'up' : 'down',
      },
      costEfficiency: {
        current: currentMetrics.costEfficiency,
        change: currentMetrics.costEfficiency - previousPeriod.costEfficiency,
        trend: currentMetrics.costEfficiency > previousPeriod.costEfficiency ? 'up' : 'down',
      },
    };
  }, [dashboardMetrics]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)} data-testid="dashboard-view-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Alert variant="destructive" className={className} data-testid="dashboard-view-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{t('pvFailedToLoadDashboard')}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Handle no building selected state - check if buildingId prop is provided
  if (!buildingId) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)} data-testid="no-building-selected">
        <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Building Selected</h3>
        {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
        <p className="text-muted-foreground text-center">
          {t('pvNoBuildingDashboard')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)} data-testid="project-dashboard-view">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Project Portfolio Dashboard</h3>
          {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
          <p className="text-sm text-muted-foreground">
            {t('pvDashboardSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canViewReports && (
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="completion-rate-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{kpiTrends.completionRate.current}%</p>
                <div className="flex items-center gap-1">
                  {kpiTrends.completionRate.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn(
                    "text-xs",
                    kpiTrends.completionRate.trend === 'up' ? "text-green-600" : "text-red-600"
                  )}>
                    {kpiTrends.completionRate.change > 0 ? '+' : ''}
                    {kpiTrends.completionRate.change.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="budget-utilization-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Budget Utilization</p>
                <p className="text-2xl font-bold">{kpiTrends.budgetUtilization.current}%</p>
                <div className="flex items-center gap-1">
                  {kpiTrends.budgetUtilization.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn(
                    "text-xs",
                    kpiTrends.budgetUtilization.trend === 'up' ? "text-green-600" : "text-red-600"
                  )}>
                    {kpiTrends.budgetUtilization.change > 0 ? '+' : ''}
                    {kpiTrends.budgetUtilization.change.toFixed(1)}%
                  </span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="schedule-performance-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">On-Time Completion</p>
                <p className="text-2xl font-bold">{kpiTrends.onTimeCompletion.current}%</p>
                <div className="flex items-center gap-1">
                  {kpiTrends.onTimeCompletion.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn(
                    "text-xs",
                    kpiTrends.onTimeCompletion.trend === 'up' ? "text-green-600" : "text-red-600"
                  )}>
                    {kpiTrends.onTimeCompletion.change > 0 ? '+' : ''}
                    {kpiTrends.onTimeCompletion.change.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="cost-efficiency-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cost Efficiency</p>
                <p className="text-2xl font-bold">{kpiTrends.costEfficiency.current}%</p>
                <div className="flex items-center gap-1">
                  {kpiTrends.costEfficiency.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn(
                    "text-xs",
                    kpiTrends.costEfficiency.trend === 'up' ? "text-green-600" : "text-red-600"
                  )}>
                    {kpiTrends.costEfficiency.change > 0 ? '+' : ''}
                    {kpiTrends.costEfficiency.change.toFixed(1)}%
                  </span>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Trends */}
        <Card data-testid="project-trends-chart">
          <CardHeader>
            <CardTitle className="text-base">Project Trends</CardTitle>
            {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
            <CardDescription>
              {t('pvProjectTrendsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardMetrics.trendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  name="Created"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.6}
                  name="Completed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Budget Analysis */}
        <Card data-testid="budget-analysis-chart">
          <CardHeader>
            <CardTitle className="text-base">Budget Analysis</CardTitle>
            {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
            <CardDescription>
              {t('pvBudgetAnalysisDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardMetrics.budgetTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="planned"
                  stroke="#6b7280"
                  strokeDasharray="5 5"
                  name="Planned Budget"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  name="Actual Spend"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card data-testid="status-distribution-chart">
          <CardHeader>
            <CardTitle className="text-base">Project Status Distribution</CardTitle>
            <CardDescription>
              {t('pvStatusBreakdownDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboardMetrics.statusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dashboardMetrics.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Breakdown */}
        <Card data-testid="priority-breakdown-chart">
          <CardHeader>
            <CardTitle className="text-base">Priority Distribution</CardTitle>
            <CardDescription>
              {t('pvPriorityBreakdownDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardMetrics.priorityBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6">
                  {dashboardMetrics.priorityBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card data-testid="budget-health-indicator">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Budget Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Overall Status</span>
              <Badge 
                variant={dashboardMetrics.performanceIndicators.budgetHealth === 'healthy' ? 'default' : 
                        dashboardMetrics.performanceIndicators.budgetHealth === 'warning' ? 'secondary' : 'destructive'}
              >
                {dashboardMetrics.performanceIndicators.budgetHealth}
              </Badge>
            </div>
            <Progress 
              value={dashboardMetrics.budgetUtilization} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {dashboardMetrics.budgetUtilization}% of total budget utilized
            </p>
          </CardContent>
        </Card>

        <Card data-testid="schedule-health-indicator">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schedule Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Overall Status</span>
              <Badge 
                variant={dashboardMetrics.performanceIndicators.scheduleHealth === 'healthy' ? 'default' : 
                        dashboardMetrics.performanceIndicators.scheduleHealth === 'warning' ? 'secondary' : 'destructive'}
              >
                {dashboardMetrics.performanceIndicators.scheduleHealth}
              </Badge>
            </div>
            <Progress 
              value={dashboardMetrics.onTimeCompletion} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {dashboardMetrics.onTimeCompletion}% on-time completion rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="quality-health-indicator">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Quality Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Overall Status</span>
              <Badge 
                variant={dashboardMetrics.performanceIndicators.qualityHealth === 'healthy' ? 'default' : 
                        dashboardMetrics.performanceIndicators.qualityHealth === 'warning' ? 'secondary' : 'destructive'}
              >
                {dashboardMetrics.performanceIndicators.qualityHealth}
              </Badge>
            </div>
            <Progress 
              value={dashboardMetrics.completionRate} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {dashboardMetrics.completionRate}% successful completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Recommendations */}
      {(dashboardMetrics.overdueProjects > 0 || dashboardMetrics.budgetUtilization > 90) && (
        <Alert variant="destructive" data-testid="dashboard-alerts">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {dashboardMetrics.overdueProjects > 0 && (
                <p>{t('pvOverdueProjectsAlert').replace('{count}', String(dashboardMetrics.overdueProjects))}</p>
              )}
              {dashboardMetrics.budgetUtilization > 90 && (
                <p>{t('pvBudgetUtilizationHighAlert').replace('{percent}', String(dashboardMetrics.budgetUtilization))}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Executive Summary */}
      <Card data-testid="executive-summary">
        <CardHeader>
          <CardTitle className="text-base">Executive Summary</CardTitle>
          {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
          <CardDescription>
            {t('pvExecutiveSummaryDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Portfolio Health</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• {dashboardMetrics.totalProjects} total projects in portfolio</li>
                <li>• {dashboardMetrics.activeProjects} currently active projects</li>
                <li>• {dashboardMetrics.completionRate}% completion rate this period</li>
                <li>• Average project duration: {dashboardMetrics.averageDuration} days</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Performance Insights</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Cost efficiency at {dashboardMetrics.costEfficiency}%</li>
                <li>• {dashboardMetrics.onTimeCompletion}% projects delivered on time</li>
                <li>{t('pvBudgetWithinTarget')}</li>
                <li>{t('pvQualityMeetingExpectations')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

