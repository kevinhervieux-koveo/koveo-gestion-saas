import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Monitor, 
  Database, 
  Globe, 
  Code,
  RefreshCw,
  Zap,
  CheckCircle,
  AlertTriangle,
  Clock,
  Activity
} from 'lucide-react';

interface ReplitMetrics {
  environment: {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  database: {
    connectionStatus: 'connected' | 'disconnected' | 'error';
    queryPerformance: number;
    activeConnections: number;
    lastBackup: Date;
  };
  deployment: {
    status: 'deployed' | 'building' | 'failed';
    lastDeploy: Date;
    version: string;
    healthChecks: boolean;
  };
  integrations: Array<{
    name: string;
    status: 'active' | 'inactive' | 'error';
    lastSync: Date;
    type: 'database' | 'api' | 'service' | 'ai';
  }>;
}

/**
 * Replit Integration Panel for AI Agent
 * Monitors and manages Replit platform integrations and services
 */
export function ReplitIntegrationPanel() {
  const [metrics, setMetrics] = useState<ReplitMetrics>({
    environment: {
      status: 'healthy',
      uptime: 99.8,
      memoryUsage: 68,
      cpuUsage: 45,
      diskUsage: 32
    },
    database: {
      connectionStatus: 'connected',
      queryPerformance: 95,
      activeConnections: 12,
      lastBackup: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
    },
    deployment: {
      status: 'deployed',
      lastDeploy: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      version: '1.0.0',
      healthChecks: true
    },
    integrations: [
      {
        name: 'PostgreSQL Database',
        status: 'active',
        lastSync: new Date(),
        type: 'database'
      },
      {
        name: 'Vite Dev Server',
        status: 'active',
        lastSync: new Date(Date.now() - 1000 * 60 * 5),
        type: 'service'
      },
      {
        name: 'Express API',
        status: 'active',
        lastSync: new Date(),
        type: 'api'
      },
      {
        name: 'AI Agent Tools',
        status: 'active',
        lastSync: new Date(Date.now() - 1000 * 30),
        type: 'ai'
      }
    ]
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMetrics = () => {
    setIsRefreshing(true);
    
    // Simulate metrics refresh with realistic data
    setTimeout(() => {
      setMetrics(prev => ({
        ...prev,
        environment: {
          ...prev.environment,
          uptime: Math.max(95, prev.environment.uptime + (Math.random() - 0.5) * 2),
          memoryUsage: Math.max(0, Math.min(100, prev.environment.memoryUsage + (Math.random() - 0.5) * 10)),
          cpuUsage: Math.max(0, Math.min(100, prev.environment.cpuUsage + (Math.random() - 0.5) * 15))
        },
        integrations: prev.integrations.map(integration => ({
          ...integration,
          lastSync: integration.status === 'active' ? new Date() : integration.lastSync
        }))
      }));
      setIsRefreshing(false);
    }, 1500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'deployed':
      case 'active': return 'bg-green-100 text-green-800';
      case 'warning':
      case 'building': return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'failed':
      case 'disconnected':
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'deployed':
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
      case 'building': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'error':
      case 'failed':
      case 'disconnected':
      case 'inactive': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Monitor className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'database': return <Database className="w-4 h-4" />;
      case 'api': return <Globe className="w-4 h-4" />;
      case 'service': return <Monitor className="w-4 h-4" />;
      case 'ai': return <Zap className="w-4 h-4" />;
      default: return <Code className="w-4 h-4" />;
    }
  };

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Replit Platform Integration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Environment Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {getStatusIcon(metrics.environment.status)}
                    Environment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={getStatusColor(metrics.environment.status)}>
                    {metrics.environment.status}
                  </Badge>
                  <div className="mt-2 text-xs text-gray-600">
                    Uptime: {metrics.environment.uptime.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              {/* Database Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {getStatusIcon(metrics.database.connectionStatus)}
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={getStatusColor(metrics.database.connectionStatus)}>
                    {metrics.database.connectionStatus}
                  </Badge>
                  <div className="mt-2 text-xs text-gray-600">
                    Performance: {metrics.database.queryPerformance}%
                  </div>
                </CardContent>
              </Card>

              {/* Deployment Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {getStatusIcon(metrics.deployment.status)}
                    Deployment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={getStatusColor(metrics.deployment.status)}>
                    {metrics.deployment.status}
                  </Badge>
                  <div className="mt-2 text-xs text-gray-600">
                    Version: {metrics.deployment.version}
                  </div>
                </CardContent>
              </Card>

              {/* Active Integrations */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-600" />
                    Integrations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.integrations.filter(i => i.status === 'active').length}
                  </div>
                  <div className="text-xs text-gray-600">
                    of {metrics.integrations.length} active
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Health Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">System Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Memory Usage</span>
                    <span className="text-sm font-medium">{metrics.environment.memoryUsage}%</span>
                  </div>
                  <Progress value={metrics.environment.memoryUsage} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">CPU Usage</span>
                    <span className="text-sm font-medium">{metrics.environment.cpuUsage}%</span>
                  </div>
                  <Progress value={metrics.environment.cpuUsage} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Disk Usage</span>
                    <span className="text-sm font-medium">{metrics.environment.diskUsage}%</span>
                  </div>
                  <Progress value={metrics.environment.diskUsage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="environment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Environment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Runtime</div>
                    <div className="font-medium">Node.js 20.x</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Package Manager</div>
                    <div className="font-medium">npm</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Build System</div>
                    <div className="font-medium">Vite + esbuild</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Framework</div>
                    <div className="font-medium">React 18 + Express</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Database Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Connection Status</span>
                    <Badge className={getStatusColor(metrics.database.connectionStatus)}>
                      {metrics.database.connectionStatus}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Connections</span>
                    <span className="text-sm font-medium">{metrics.database.activeConnections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Query Performance</span>
                    <span className="text-sm font-medium">{metrics.database.queryPerformance}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Database Operations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Last Backup</span>
                    <span className="text-sm font-medium">
                      {metrics.database.lastBackup.toLocaleTimeString()}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    View Database Health
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <div className="space-y-3">
              {metrics.integrations.map((integration, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(integration.type)}
                        <div>
                          <div className="font-medium text-sm">{integration.name}</div>
                          <div className="text-xs text-gray-500">
                            Last sync: {integration.lastSync.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getStatusColor(integration.status)}`}>
                          {integration.status}
                        </Badge>
                        {getStatusIcon(integration.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}