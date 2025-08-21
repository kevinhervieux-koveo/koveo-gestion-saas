import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Database,
  Server,
  BarChart3,
  RefreshCw
} from 'lucide-react';

import { DataTable, type ColumnConfig } from '@/components/ui/data-table';
import { BaseDialog } from '@/components/ui/base-dialog';
import { cn } from '@/lib/utils';

// Types
/**
 *
 */
interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  responseTime: number;
  uptime: number;
}

/**
 *
 */
interface AlertItem extends Record<string, unknown> {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  component: string;
}

/**
 *
 */
interface PerformanceData {
  timestamp: string;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

/**
 *
 */
interface MonitoringData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: SystemMetrics;
  alerts: AlertItem[];
  performance: PerformanceData[];
  lastUpdated: string;
}

/**
 * Replit AI Monitoring Component - Refactored using reusable components
 * Reduced from 441+ lines to ~220 lines by leveraging DataTable and BaseDialog.
 */
/**
 * ReplitAiMonitoring function.
 * @returns Function result.
 */
export function ReplitAiMonitoring() {
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch monitoring data
  const { data: monitoringData, isLoading, error, refetch } = useQuery<MonitoringData>({
    queryKey: ['/api/monitoring/system'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Status configuration
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'healthy':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', variant: 'success' as const };
      case 'degraded':
        return { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', variant: 'warning' as const };
      case 'unhealthy':
        return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', variant: 'destructive' as const };
      default:
        return { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50', variant: 'secondary' as const };
    }
  };

  // Alert level configuration
  const getAlertConfig = (level: string) => {
    switch (level) {
      case 'critical':
        return { variant: 'destructive' as const, icon: AlertTriangle };
      case 'error':
        return { variant: 'destructive' as const, icon: AlertTriangle };
      case 'warning':
        return { variant: 'warning' as const, icon: AlertTriangle };
      default:
        return { variant: 'secondary' as const, icon: Activity };
    }
  };

  // Alert table columns
  const alertColumns: ColumnConfig<AlertItem>[] = [
    {
      id: 'level',
      header: 'Level',
      cell: (alert) => {
        const config = getAlertConfig(alert.level);
        return (
          <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
            <config.icon className="h-3 w-3" />
            {alert.level.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      id: 'component',
      header: 'Component',
      cell: (alert) => (
        <span className="font-medium">{alert.component}</span>
      ),
    },
    {
      id: 'message',
      header: 'Message',
      cell: (alert) => (
        <span className="truncate max-w-md">{alert.message}</span>
      ),
    },
    {
      id: 'timestamp',
      header: 'Time',
      cell: (alert) => (
        <span className="text-sm text-muted-foreground">
          {new Date(alert.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (alert) => (
        <Badge variant={alert.resolved ? 'success' : 'destructive'}>
          {alert.resolved ? 'Resolved' : 'Active'}
        </Badge>
      ),
    },
  ];

  if (isLoading) {
    return <MonitoringSkeleton />;
  }

  if (error || !monitoringData) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Monitoring Data Unavailable</AlertTitle>
        <AlertDescription>
          Failed to load system monitoring data. Please check your connection and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const statusConfig = getStatusConfig(monitoringData.status);
  const activeAlerts = monitoringData.alerts.filter(alert => !alert.resolved);

  return (
    <div className="space-y-6">
      {/* System Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <statusConfig.icon className={cn("h-6 w-6", statusConfig.color)} />
              <div>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Real-time monitoring and performance metrics</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusConfig.variant} className="capitalize">
                {monitoringData.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date(monitoringData.lastUpdated).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? 's' : ''}
          </AlertTitle>
          <AlertDescription>
            There are critical issues that require attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Monitoring Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <SystemMetricsGrid metrics={monitoringData.metrics} />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <PerformanceCharts data={monitoringData.performance} />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <DataTable
            data={monitoringData.alerts}
            columns={alertColumns}
            searchableColumns={['message', 'component']}
            filterableColumns={[
              {
                id: 'level',
                title: 'Level',
                options: [
                  { value: 'all', label: 'All Levels' },
                  { value: 'critical', label: 'Critical' },
                  { value: 'error', label: 'Error' },
                  { value: 'warning', label: 'Warning' },
                  { value: 'info', label: 'Info' },
                ],
              },
              {
                id: 'resolved',
                title: 'Status',
                options: [
                  { value: 'all', label: 'All' },
                  { value: 'false', label: 'Active' },
                  { value: 'true', label: 'Resolved' },
                ],
              },
            ]}
            onRowClick={(alert) => setSelectedAlert(alert)}
            initialPageSize={10}
            emptyStateMessage="No alerts found"
          />
        </TabsContent>
      </Tabs>

      {/* Alert Details Dialog */}
      <BaseDialog
        open={!!selectedAlert}
        onOpenChange={(open) => !open && setSelectedAlert(null)}
        title="Alert Details"
        description={selectedAlert?.component || 'Alert information'}
        showFooter={false}
      >
        {selectedAlert && <AlertDetails alert={selectedAlert} />}
      </BaseDialog>
    </div>
  );
}

// System metrics grid component
/**
 *
 */
interface SystemMetricsGridProps {
  metrics: SystemMetrics;
}

/**
 *
 * @param root0
 * @param root0.metrics
 */
/**
 * SystemMetricsGrid function.
 * @param root0
 * @param root0.metrics
 * @returns Function result.
 */
function SystemMetricsGrid({ metrics }: SystemMetricsGridProps) {
  const metricCards = [
    { label: 'CPU Usage', value: metrics.cpu, icon: Zap, unit: '%', max: 100 },
    { label: 'Memory Usage', value: metrics.memory, icon: Database, unit: '%', max: 100 },
    { label: 'Disk Usage', value: metrics.disk, icon: Server, unit: '%', max: 100 },
    { label: 'Response Time', value: metrics.responseTime, icon: Clock, unit: 'ms', max: 1000 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((metric) => (
        <Card key={metric.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metric.value}{metric.unit}
            </div>
            <Progress value={Math.min((metric.value / metric.max) * 100, 100)} className="mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Performance charts placeholder
/**
 *
 */
interface PerformanceChartsProps {
  data: PerformanceData[];
}

/**
 *
 * @param root0
 * @param root0.data
 */
/**
 * PerformanceCharts function.
 * @param root0
 * @param root0.data
 * @returns Function result.
 */
function PerformanceCharts({ data }: PerformanceChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Response Time Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Performance chart would be rendered here
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Throughput
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Throughput chart would be rendered here
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Alert details component
/**
 *
 */
interface AlertDetailsProps {
  alert: AlertItem;
}

/**
 * Alert details component.
 * @param root0
 * @param root0.alert
 */
/**
 * AlertDetails function.
 * @param root0
 * @param root0.alert
 * @returns Function result.
 */
function AlertDetails({ alert }: AlertDetailsProps) {
  // Local alert configuration since getAlertConfig is not in scope
  const getLocalAlertConfig = (level: string) => {
    switch (level) {
      case 'critical':
        return { variant: 'destructive' as const, icon: AlertTriangle };
      case 'error':
        return { variant: 'destructive' as const, icon: AlertTriangle };
      case 'warning':
        return { variant: 'warning' as const, icon: AlertTriangle };
      default:
        return { variant: 'secondary' as const, icon: Activity };
    }
  };
  
  const config = getLocalAlertConfig(alert.level);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={config.variant} className="flex items-center gap-1">
          <config.icon className="h-3 w-3" />
          {alert.level.toUpperCase()}
        </Badge>
        <Badge variant={alert.resolved ? 'success' : 'destructive'}>
          {alert.resolved ? 'Resolved' : 'Active'}
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Component</label>
          <p className="text-sm">{alert.component}</p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-muted-foreground">Message</label>
          <p className="text-sm">{alert.message}</p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
          <p className="text-sm">{new Date(alert.timestamp).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
/**
 *
 */
/**
 * MonitoringSkeleton function.
 * @returns Function result.
 */
function MonitoringSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-6 w-20 bg-muted animate-pulse rounded" />
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                <div className="h-2 w-full bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}