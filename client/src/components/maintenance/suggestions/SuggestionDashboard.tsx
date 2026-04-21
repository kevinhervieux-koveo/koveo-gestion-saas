import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  DollarSign,
  CheckCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Building,
  Users,
  Timer,
  Target,
  Zap,
} from 'lucide-react';
import { SuggestionDashboardProps, DashboardMetrics } from './types';

// Chart color schemes
const chartColors = {
  primary: '#3b82f6',
  secondary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#6366f1',
  success: '#22c55e',
};

const priorityColors = ['#ef4444', '#f59e0b', '#3b82f6', '#6b7280'];
const typeColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

/**
 * SuggestionDashboard component for metrics and analytics summary
 * Provides comprehensive dashboard with key metrics, charts, and export capabilities
 */
export function SuggestionDashboard({
  buildingId,
  organizationId,
  timeRange = 'month',
  onTimeRangeChange,
  onExport,
  className,
}: SuggestionDashboardProps) {
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');

  // Fetch dashboard metrics
  const {
    data: metricsResponse,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useQuery({
    queryKey: ['/api/maintenance/dashboard/suggestions', buildingId, organizationId, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (buildingId) params.append('buildingId', buildingId);
      if (organizationId) params.append('organizationId', organizationId);
      params.append('timeRange', timeRange);
      
      const response = await apiRequest('GET', `/api/maintenance/dashboard/suggestions?${params}`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const metrics: DashboardMetrics = metricsResponse?.metrics || {
    totalSuggestions: 0,
    pendingSuggestions: 0,
    overdueSuggestions: 0,
    criticalSuggestions: 0,
    totalEstimatedCost: 0,
    avgCompletionTime: 0,
    acceptanceRate: 0,
    monthlyTrend: [],
    priorityDistribution: [],
    typeDistribution: [],
  };

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const completedSuggestions = metrics.totalSuggestions - metrics.pendingSuggestions;
    const completionRate = metrics.totalSuggestions > 0 
      ? (completedSuggestions / metrics.totalSuggestions) * 100 
      : 0;

    const avgMonthlyCost = metrics.monthlyTrend.length > 0
      ? metrics.monthlyTrend.reduce((sum, trend) => sum + trend.cost, 0) / metrics.monthlyTrend.length
      : 0;

    const costTrend = metrics.monthlyTrend.length >= 2
      ? ((metrics.monthlyTrend[metrics.monthlyTrend.length - 1].cost - 
          metrics.monthlyTrend[metrics.monthlyTrend.length - 2].cost) / 
          metrics.monthlyTrend[metrics.monthlyTrend.length - 2].cost) * 100
      : 0;

    return {
      completedSuggestions,
      completionRate,
      avgMonthlyCost,
      costTrend,
      urgencyScore: (metrics.criticalSuggestions * 3 + metrics.overdueSuggestions * 2) / 
                   Math.max(metrics.totalSuggestions, 1),
    };
  }, [metrics]);

  // Handle export functionality
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    onExport?.(format);
    toast({
      title: "Export Started",
      description: `Dashboard report export in ${format.toUpperCase()} format has started.`,
    });
  };

  // Get trend icon
  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <div className="h-4 w-4" />;
  };

  if (isLoadingMetrics) {
    return (
      <div className={cn("space-y-6", className)} data-testid="suggestion-dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)} data-testid="suggestion-dashboard">
      {/* Dashboard Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Suggestion Dashboard
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Time Range Selector */}
              <Select value={timeRange} onValueChange={onTimeRangeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>

              {/* Export Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="export-menu">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('excel')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel Spreadsheet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileText className="h-4 w-4 mr-2" />
                    CSV Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Suggestions */}
        <Card data-testid="metric-total-suggestions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" />
              Total Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSuggestions.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <CheckCircle className="h-3 w-3" />
              {derivedMetrics.completionRate.toFixed(1)}% completed
            </div>
          </CardContent>
        </Card>

        {/* Pending Suggestions */}
        <Card data-testid="metric-pending-suggestions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.pendingSuggestions}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Awaiting action
            </div>
          </CardContent>
        </Card>

        {/* Overdue Suggestions */}
        <Card data-testid="metric-overdue-suggestions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.overdueSuggestions}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Past due date
            </div>
            {metrics.overdueSuggestions > 0 && (
              <Progress 
                value={(metrics.overdueSuggestions / metrics.totalSuggestions) * 100} 
                className="h-1 mt-2"
              />
            )}
          </CardContent>
        </Card>

        {/* Total Estimated Cost */}
        <Card data-testid="metric-total-cost">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${metrics.totalEstimatedCost.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {getTrendIcon(derivedMetrics.costTrend)}
              {Math.abs(derivedMetrics.costTrend).toFixed(1)}% vs last period
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="metric-acceptance-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Acceptance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics.acceptanceRate.toFixed(1)}%</div>
            <Progress value={metrics.acceptanceRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card data-testid="metric-completion-time">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Avg Completion Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics.avgCompletionTime} days</div>
            <div className="text-xs text-muted-foreground mt-1">
              Average processing time
            </div>
          </CardContent>
        </Card>

        <Card data-testid="metric-urgency-score">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Urgency Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{derivedMetrics.urgencyScore.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on critical & overdue items
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <Card data-testid="monthly-trend-chart">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Monthly Trend</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant={chartType === 'line' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartType('line')}
                  data-testid="chart-type-line"
                >
                  Line
                </Button>
                <Button
                  variant={chartType === 'bar' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  data-testid="chart-type-bar"
                >
                  Bar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'line' ? (
                <LineChart data={metrics.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="suggestions" 
                    stroke={chartColors.primary} 
                    name="Suggestions"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    stroke={chartColors.success} 
                    name="Completed"
                  />
                </LineChart>
              ) : (
                <BarChart data={metrics.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="suggestions" fill={chartColors.primary} name="Suggestions" />
                  <Bar dataKey="completed" fill={chartColors.success} name="Completed" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card data-testid="priority-distribution-chart">
          <CardHeader>
            <CardTitle className="text-lg">Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.priorityDistribution}
                  dataKey="count"
                  nameKey="priority"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ priority, percentage }) => `${priority} (${percentage.toFixed(1)}%)`}
                >
                  {metrics.priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={priorityColors[index % priorityColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card data-testid="type-distribution-chart">
          <CardHeader>
            <CardTitle className="text-lg">Suggestion Types</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.typeDistribution} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="type" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill={chartColors.info} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Trend */}
        <Card data-testid="cost-trend-chart">
          <CardHeader>
            <CardTitle className="text-lg">Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Cost']} />
                <Line 
                  type="monotone" 
                  dataKey="cost" 
                  stroke={chartColors.warning} 
                  strokeWidth={3}
                  dot={{ fill: chartColors.warning }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}