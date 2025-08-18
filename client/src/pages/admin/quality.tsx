import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, AlertTriangle, TrendingUp, Shield, Bug, Target, Plus, Eye } from 'lucide-react';
import { useState } from 'react';

interface QualityMetric {
  id: string;
  name: string;
  category: string;
  value: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  lastUpdated: string;
}

interface TestResult {
  id: string;
  testSuite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  coverage: number;
  failureReason?: string;
  runDate: string;
}

interface SecurityAudit {
  id: string;
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved';
  reportedDate: string;
}

export default function Quality() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Mock data - in real app this would come from API
  const { data: qualityMetrics = [], isLoading: metricsLoading } = useQuery<QualityMetric[]>({
    queryKey: ['/api/quality/metrics'],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        name: 'Code Coverage',
        category: 'Testing',
        value: 85,
        target: 80,
        trend: 'up',
        status: 'good',
        lastUpdated: '2024-08-18'
      },
      {
        id: '2',
        name: 'Performance Score',
        category: 'Performance',
        value: 92,
        target: 90,
        trend: 'stable',
        status: 'good',
        lastUpdated: '2024-08-18'
      },
      {
        id: '3',
        name: 'Security Vulnerabilities',
        category: 'Security',
        value: 2,
        target: 0,
        trend: 'down',
        status: 'warning',
        lastUpdated: '2024-08-17'
      },
      {
        id: '4',
        name: 'Bug Density',
        category: 'Quality',
        value: 0.8,
        target: 1.0,
        trend: 'down',
        status: 'good',
        lastUpdated: '2024-08-18'
      }
    ])
  });

  const { data: testResults = [], isLoading: testsLoading } = useQuery<TestResult[]>({
    queryKey: ['/api/quality/tests'],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        testSuite: 'Authentication Tests',
        status: 'passed',
        duration: 45,
        coverage: 95,
        runDate: '2024-08-18T08:30:00Z'
      },
      {
        id: '2',
        testSuite: 'Organizations API Tests',
        status: 'passed',
        duration: 32,
        coverage: 88,
        runDate: '2024-08-18T08:30:00Z'
      },
      {
        id: '3',
        testSuite: 'Property Management Tests',
        status: 'failed',
        duration: 67,
        coverage: 82,
        failureReason: 'Database connection timeout',
        runDate: '2024-08-18T08:30:00Z'
      },
      {
        id: '4',
        testSuite: 'UI Component Tests',
        status: 'passed',
        duration: 28,
        coverage: 91,
        runDate: '2024-08-18T08:30:00Z'
      }
    ])
  });

  const { data: securityAudits = [], isLoading: securityLoading } = useQuery<SecurityAudit[]>({
    queryKey: ['/api/quality/security'],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        component: 'User Authentication',
        severity: 'medium',
        type: 'Input Validation',
        description: 'Email validation could be bypassed with special characters',
        status: 'in-progress',
        reportedDate: '2024-08-15'
      },
      {
        id: '2',
        component: 'File Upload',
        severity: 'high',
        type: 'File Security',
        description: 'Insufficient file type validation on document uploads',
        status: 'open',
        reportedDate: '2024-08-16'
      },
      {
        id: '3',
        component: 'Data Export',
        severity: 'low',
        type: 'Information Disclosure',
        description: 'Export logs contain more information than necessary',
        status: 'resolved',
        reportedDate: '2024-08-10'
      }
    ])
  });

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getTestStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'skipped':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title="Quality Assurance"
        subtitle="Monitor code quality, testing, security, and performance metrics"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Test Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round((testResults.filter(t => t.status === 'passed').length / testResults.length) * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {testResults.filter(t => t.status === 'passed').length} of {testResults.length} tests
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Code Coverage</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(testResults.reduce((sum, test) => sum + test.coverage, 0) / testResults.length)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Average across all suites
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Issues</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {securityAudits.filter(audit => audit.status !== 'resolved').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Open vulnerabilities
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">92</div>
              <p className="text-xs text-muted-foreground">
                +5 from last week
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metrics">Quality Metrics</TabsTrigger>
            <TabsTrigger value="testing">Test Results</TabsTrigger>
            <TabsTrigger value="security">Security Audit</TabsTrigger>
          </TabsList>
          
          <TabsContent value="metrics" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle>Quality Metrics</CardTitle>
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Metric
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {qualityMetrics.map((metric) => (
                    <div key={metric.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{metric.name}</h3>
                          <p className="text-sm text-muted-foreground">{metric.category}</p>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMetricStatusColor(metric.status)}`}>
                            {metric.status}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Updated: {metric.lastUpdated}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Current: {metric.value}{metric.name.includes('Coverage') || metric.name.includes('Score') ? '%' : ''}</span>
                          <span>Target: {metric.target}{metric.name.includes('Coverage') || metric.name.includes('Score') ? '%' : ''}</span>
                        </div>
                        <Progress 
                          value={metric.name.includes('Vulnerabilities') ? 100 - (metric.value / metric.target * 100) : (metric.value / metric.target * 100)} 
                          className="h-2" 
                        />
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-xs text-muted-foreground">
                          Trend: {metric.trend === 'up' ? '📈' : metric.trend === 'down' ? '📉' : '➡️'} 
                          {metric.trend}
                        </span>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="testing" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5" />
                  <CardTitle>Test Results</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Suite</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Run Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testResults.map((test) => (
                      <TableRow key={test.id}>
                        <TableCell className="font-medium">{test.testSuite}</TableCell>
                        <TableCell>
                          <Badge variant={getTestStatusColor(test.status)}>
                            {test.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{test.duration}s</TableCell>
                        <TableCell>{test.coverage}%</TableCell>
                        <TableCell>{new Date(test.runDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5" />
                  <CardTitle>Security Audit Results</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reported</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityAudits.map((audit) => (
                      <TableRow key={audit.id}>
                        <TableCell className="font-medium">{audit.component}</TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(audit.severity)}>
                            {audit.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{audit.type}</TableCell>
                        <TableCell className="max-w-xs truncate">{audit.description}</TableCell>
                        <TableCell>
                          <Badge variant={audit.status === 'resolved' ? 'default' : 'secondary'}>
                            {audit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{audit.reportedDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}