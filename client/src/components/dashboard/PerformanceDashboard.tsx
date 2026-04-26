// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Comprehensive Performance Dashboard for Quebec Property Management SaaS
 * Real-time monitoring of frontend, backend, and user experience metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { chartColors, buildChartConfig } from '@/lib/chart-colors';
import { AlertTriangle, Activity, Zap, Timer, Database, Cpu, MemoryStick, TrendingUp, TrendingDown, RefreshCw, HardDrive } from 'lucide-react';
import { useWebVitals, WebVitalsMetrics } from '@/utils/web-vitals-monitor';
import { complexityAnalyzer } from '@/utils/component-complexity-analyzer';
import { performanceMonitor } from '@/utils/performance-monitor';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/hooks/use-language';

interface PerformanceData {
  database: {
    averageQueryTime: string;
    maxQueryTime: string;
    minQueryTime: string;
    totalQueries: number;
    slowQueries: number;
    recentSlowQueries: any[];
  };
  cache: {
    hitRate: number;
    size: number;
    entries: number;
  };
  optimization: {
    enabled: boolean;
    indexesOptimized: number;
    queriesOptimized: number;
  };
  trends: {
    current: {
      averageQueryTime: string;
      totalQueries: number;
      slowQueries: number;
    };
    improvement: {
      percentage: string;
      achieved: boolean;
      targetReached: boolean;
    };
    status: string;
  };
  timestamp: string;
}

interface WebVitalsData {
  name: string;
  value: number;
  rating: string;
  timestamp: number;
  url: string;
}

/**
 * Render a byte count in the largest sensible unit (Task #1095). Used
 * by the bulk-import staging-disk card so admins see "12.4 GB" instead
 * of "13297844224 bytes".
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exp = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, exp);
  // Two decimals up to GB, one for larger units to keep the number compact.
  const fixed = exp >= 4 ? 1 : 2;
  return `${value.toFixed(fixed)} ${units[exp]}`;
}

export function PerformanceDashboard() {
  const { t } = useLanguage();
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [webVitalsHistory, setWebVitalsHistory] = useState<WebVitalsData[]>([]);
  
  const { metrics: webVitalsMetrics, recommendations, performanceScore, userExperienceRating } = useWebVitals();

  // Fetch server-side performance data
  const { data: performanceData, isLoading: isLoadingPerformance, refetch: refetchPerformance } = useQuery({
    queryKey: ['/api/performance/stats'],
    refetchInterval: isAutoRefresh ? refreshInterval : false,
  });

  const { data: trendsData, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['/api/performance/trends'],
    refetchInterval: isAutoRefresh ? refreshInterval : false,
  });

  // Task #1095: surface the bulk-import staging disk-usage snapshot
  // exposed by `/api/health` so an admin can see free/total bytes and
  // a clear LOW indicator without ssh-ing in to grep the janitor logs.
  // Refreshes on the same cadence as the rest of the dashboard.
  const { data: healthData, isLoading: isLoadingHealth } = useQuery<{
    status?: string;
    bulkImportStaging?: {
      root: string;
      freeBytes: number;
      totalBytes: number;
      freePercent: number;
      isLow: boolean;
    } | null;
  }>({
    queryKey: ['/api/health'],
    refetchInterval: isAutoRefresh ? refreshInterval : false,
  });
  const staging = healthData?.bulkImportStaging ?? null;

  // Component complexity data
  const [complexityData, setComplexityData] = useState(complexityAnalyzer.generateOptimizationReport());

  // Update complexity data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setComplexityData(complexityAnalyzer.generateOptimizationReport());
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Store Web Vitals history for trending
  useEffect(() => {
    if (Object.keys(webVitalsMetrics).length > 0) {
      const entry: WebVitalsData = {
        name: 'composite',
        value: performanceScore || 0,
        rating: userExperienceRating || 'unknown',
        timestamp: Date.now(),
        url: window.location.href,
      };

      setWebVitalsHistory(prev => {
        const updated = [...prev, entry];
        // Keep only last 20 entries
        return updated.slice(-20);
      });
    }
  }, [webVitalsMetrics, performanceScore, userExperienceRating]);

  // Prepare chart data
  const webVitalsChartData = useMemo(() => {
    return webVitalsHistory.map((entry, index) => ({
      time: index,
      score: entry.value,
      rating: entry.rating,
    }));
  }, [webVitalsHistory]);

  const getStatusColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadgeVariant = (rating: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (rating) {
      case 'good': return 'default';
      case 'needs-improvement': return 'secondary';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6" data-testid="performance-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Performance Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('realTimeMonitoringAndOptimizationInsights')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Auto-refresh:</label>
            <Button
              variant={isAutoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              data-testid="button-toggle-auto-refresh"
            >
              {isAutoRefresh ? 'On' : 'Off'}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPerformance()}
            disabled={isLoadingPerformance}
            data-testid="button-refresh-manual"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingPerformance ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Performance Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card data-testid="card-performance-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceScore || 0}/100</div>
            <Progress value={performanceScore || 0} className="mt-2" />
            <Badge 
              variant={getStatusBadgeVariant(userExperienceRating || 'unknown')} 
              className="mt-2"
              data-testid={`badge-rating-${userExperienceRating}`}
            >
              {userExperienceRating || 'Unknown'}
            </Badge>
          </CardContent>
        </Card>

        <Card data-testid="card-web-vitals-lcp">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LCP</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webVitalsMetrics.LCP ? `${Math.round(webVitalsMetrics.LCP)}ms` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Largest Contentful Paint</p>
          </CardContent>
        </Card>

        <Card data-testid="card-web-vitals-fid">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FID</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webVitalsMetrics.FID ? `${Math.round(webVitalsMetrics.FID)}ms` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">First Input Delay</p>
          </CardContent>
        </Card>

        <Card data-testid="card-web-vitals-cls">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CLS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webVitalsMetrics.CLS ? webVitalsMetrics.CLS.toFixed(3) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Cumulative Layout Shift</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Recommendations */}
      {recommendations.length > 0 && (
        <Alert data-testid="alert-recommendations">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Performance Recommendations</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {recommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-sm">
                  <strong>{rec.metric}:</strong> {rec.recommendation}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="frontend" className="space-y-6" data-testid="tabs-performance-metrics">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="frontend" data-testid="tab-frontend">Frontend</TabsTrigger>
          <TabsTrigger value="backend" data-testid="tab-backend">Backend</TabsTrigger>
          <TabsTrigger value="components" data-testid="tab-components">Components</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        {/* Frontend Performance Tab */}
        <TabsContent value="frontend" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Web Vitals Chart */}
            <Card data-testid="card-web-vitals-chart">
              <CardHeader>
                <CardTitle>Performance Score Trend</CardTitle>
                <CardDescription>{t('realTimeWebVitalsPerformanceTracking')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={buildChartConfig({ score: { label: 'Performance Score', color: chartColors.purple } })} className="h-[300px] w-full">
                  <LineChart data={webVitalsChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke={chartColors.purple}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Web Vitals Details */}
            <Card data-testid="card-web-vitals-details">
              <CardHeader>
                <CardTitle>Core Web Vitals Details</CardTitle>
                <CardDescription>{t('currentPerformanceMetricsBreakdown')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(webVitalsMetrics).map(([key, value]) => {
                  if (typeof value === 'number' && ['LCP', 'FID', 'FCP', 'TTFB'].includes(key)) {
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{key}</span>
                        <span className="text-sm">{Math.round(value)}ms</span>
                      </div>
                    );
                  }
                  if (key === 'CLS' && typeof value === 'number') {
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{key}</span>
                        <span className="text-sm">{value.toFixed(3)}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Backend Performance Tab */}
        <TabsContent value="backend" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Database Performance */}
            <Card data-testid="card-database-performance">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Performance
                </CardTitle>
                <CardDescription>{t('queryExecutionMetricsAndOptimizationStatus')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {performanceData?.database && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Average Query Time</p>
                        <p className="text-2xl font-bold">{performanceData.database.averageQueryTime}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Total Queries</p>
                        <p className="text-2xl font-bold">{performanceData.database.totalQueries}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Slow Queries</p>
                        <p className="text-2xl font-bold text-red-600">{performanceData.database.slowQueries}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Cache Hit Rate</p>
                        <p className="text-2xl font-bold text-green-600">
                          {performanceData.cache?.hitRate ? `${performanceData.cache.hitRate}%` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Bulk-import staging volume (Task #1095). Mirrors the
                snapshot the Task #1088 janitor logs every pass so an
                admin can spot a filling-up staging disk without ssh. */}
            <Card data-testid="card-bulk-import-staging-disk">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Bulk-Import Staging Disk
                  {staging?.isLow && (
                    <Badge
                      variant="destructive"
                      className="ml-2 uppercase tracking-wide"
                      data-testid="badge-bulk-import-staging-low"
                    >
                      Low
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Free space on the volume that holds in-progress bulk
                  document imports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingHealth && !staging && (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-bulk-import-staging-loading"
                  >
                    Loading…
                  </p>
                )}
                {!isLoadingHealth && !staging && (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-bulk-import-staging-unavailable"
                  >
                    Staging disk usage is unavailable. Check the server
                    logs for the most recent janitor probe.
                  </p>
                )}
                {staging && (
                  <>
                    <div>
                      <p className="text-sm font-medium">Mount</p>
                      <p
                        className="text-xs font-mono break-all text-muted-foreground"
                        data-testid="text-bulk-import-staging-root"
                      >
                        {staging.root}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Free</p>
                        <p
                          className={`text-2xl font-bold ${
                            staging.isLow ? 'text-red-600' : 'text-green-600'
                          }`}
                          data-testid="text-bulk-import-staging-free"
                        >
                          {formatBytes(staging.freeBytes)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Total</p>
                        <p
                          className="text-2xl font-bold"
                          data-testid="text-bulk-import-staging-total"
                        >
                          {formatBytes(staging.totalBytes)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">Free %</p>
                        <span
                          className={`text-sm font-bold ${
                            staging.isLow ? 'text-red-600' : ''
                          }`}
                          data-testid="text-bulk-import-staging-free-percent"
                        >
                          {staging.freePercent.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={staging.freePercent} />
                    </div>
                    {staging.isLow && (
                      <Alert
                        variant="destructive"
                        data-testid="alert-bulk-import-staging-low"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Staging disk free space is LOW</AlertTitle>
                        <AlertDescription>
                          Expand the volume or repoint
                          <code className="mx-1 px-1 rounded bg-muted text-xs">
                            BULK_IMPORT_STAGING_ROOT
                          </code>
                          at a larger disk before the next bulk upload.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Server Performance */}
            <Card data-testid="card-server-performance">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Server Performance
                </CardTitle>
                <CardDescription>{t('realTimeServerMetricsAndStatus')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trendsData && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge 
                        variant={trendsData.status === 'optimal' ? 'default' : 'secondary'}
                        data-testid={`badge-server-status-${trendsData.status}`}
                      >
                        {trendsData.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Performance Improvement</span>
                      <span className={`text-sm font-bold ${
                        trendsData.improvement.achieved ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {trendsData.improvement.percentage}
                        {trendsData.improvement.achieved ? (
                          <TrendingUp className="inline h-4 w-4 ml-1" />
                        ) : (
                          <TrendingDown className="inline h-4 w-4 ml-1" />
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Component Performance Tab */}
        <TabsContent value="components" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Component Complexity Overview */}
            <Card data-testid="card-component-complexity">
              <CardHeader>
                <CardTitle>Component Complexity Analysis</CardTitle>
                <CardDescription>{t('identificationOfPerformanceBottlenecks')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Total Components</p>
                    <p className="text-2xl font-bold">{complexityData.summary.totalComponents}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Complex Components</p>
                    <p className="text-2xl font-bold text-yellow-600">{complexityData.summary.complexComponents}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Average Complexity</p>
                  <div className="flex items-center gap-2">
                    <Progress value={complexityData.summary.averageComplexity} className="flex-1" />
                    <span className="text-sm font-bold">{complexityData.summary.averageComplexity}/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Issues */}
            <Card data-testid="card-top-issues">
              <CardHeader>
                <CardTitle>Top Performance Issues</CardTitle>
                <CardDescription>{t('mostCommonOptimizationOpportunities')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {complexityData.summary.topIssues.slice(0, 5).map((issue, index) => (
                    <div key={index} className="text-sm p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      {issue}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Component Recommendations */}
          {complexityData.recommendations.length > 0 && (
            <Card data-testid="card-component-recommendations">
              <CardHeader>
                <CardTitle>{t('componentOptimizationRecommendations')}</CardTitle>
                <CardDescription>{t('priorityOrderedOptimizationSuggestions')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complexityData.recommendations.slice(0, 5).map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{rec.component}</h4>
                        <Badge 
                          variant={
                            rec.priority === 'high' ? 'destructive' : 
                            rec.priority === 'medium' ? 'secondary' : 'outline'
                          }
                          data-testid={`badge-priority-${rec.priority}`}
                        >
                          {rec.priority} priority
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Issues: {rec.issues.join(', ')}
                      </div>
                      <div className="text-sm">
                        <strong>Suggestions:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {rec.suggestions.slice(0, 2).map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card data-testid="card-performance-trends">
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>{t('historicalPerformanceDataAndImprovements')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {trendsData?.improvement.percentage || 'N/A'}
                  </div>
                  <p className="text-sm text-muted-foreground">Performance Improvement</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {performanceScore || 0}/100
                  </div>
                  <p className="text-sm text-muted-foreground">Current Score</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {complexityData.summary.complexComponents}
                  </div>
                  <p className="text-sm text-muted-foreground">Components Need Optimization</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}