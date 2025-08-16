import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Brain,
  MessageSquare,
  Zap,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

/**
 * Interface for AI interaction data.
 * Tracks AI agent activities and performance metrics.
 */
interface AIInteraction {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  duration: number;
  status: 'success' | 'error' | 'pending';
  improvement?: string;
  impact?: 'high' | 'medium' | 'low';
}

/**
 * Interface for AI metrics data.
 * Contains performance statistics and improvement tracking.
 */
interface AIMetrics {
  totalInteractions: number;
  successRate: number;
  avgResponseTime: number;
  improvementsSuggested: number;
  improvementsImplemented: number;
  categoriesAnalyzed: string[];
  lastAnalysis: string;
  aiEfficiency: number;
}

/**
 * Interface for AI-generated insights.
 * Contains recommendations and improvement suggestions.
 */
interface AIInsight {
  id: string;
  type: 'performance' | 'quality' | 'security' | 'ux' | 'efficiency';
  title: string;
  description: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'in_progress' | 'completed';
  createdAt: string;
}

/**
 * Replit AI Monitoring Component.
 * 
 * Displays AI agent performance metrics, interactions, and generated insights.
 * Provides interface for triggering AI analysis and applying suggestions.
 * @returns JSX element for the AI monitoring dashboard.
 */
export function ReplitAIMonitoring() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch AI metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<AIMetrics>({
    queryKey: ['/api/ai/metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent AI interactions
  const { data: interactions = [], isLoading: interactionsLoading } = useQuery<AIInteraction[]>({
    queryKey: ['/api/ai/interactions'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch AI insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery<AIInsight[]>({
    queryKey: ['/api/ai/insights'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Trigger AI analysis
  const analysisMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ai/analyze'),
    onSuccess: () => {
      toast({
        title: 'AI Analysis Started',
        description: 'The AI agent is analyzing your application for improvements.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ai'] });
    },
    onError: () => {
      toast({
        title: 'Analysis Failed',
        description: 'Unable to start AI analysis. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Apply AI suggestion
  const applySuggestionMutation = useMutation({
    mutationFn: (insightId: string) => apiRequest('POST', `/api/ai/insights/${insightId}/apply`),
    onSuccess: () => {
      toast({
        title: 'Suggestion Applied',
        description: 'The AI suggestion has been successfully implemented.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ai/insights'] });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'new':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Activity className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <Zap className="h-4 w-4" />;
      case 'quality':
        return <Sparkles className="h-4 w-4" />;
      case 'security':
        return <AlertCircle className="h-4 w-4" />;
      case 'ux':
        return <MessageSquare className="h-4 w-4" />;
      case 'efficiency':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Action Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Replit AI Agent Monitoring</h2>
            <p className="text-sm text-gray-600">
              Track AI interactions and continuous improvement suggestions
            </p>
          </div>
        </div>
        <Button
          onClick={() => analysisMutation.mutate()}
          disabled={analysisMutation.isPending}
          className="flex items-center gap-2"
        >
          {analysisMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          Run AI Analysis
        </Button>
      </div>

      {/* Key Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Activity className="h-8 w-8 text-blue-500" />
                <span className="text-2xl font-bold">{metrics.totalInteractions}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Total Interactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <span className="text-2xl font-bold">{metrics.successRate}%</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Success Rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Clock className="h-8 w-8 text-yellow-500" />
                <span className="text-2xl font-bold">{metrics.avgResponseTime}ms</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Avg Response</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Sparkles className="h-8 w-8 text-purple-500" />
                <span className="text-2xl font-bold">{metrics.improvementsSuggested}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Suggestions</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-8 w-8 text-indigo-500" />
                <span className="text-2xl font-bold">{metrics.improvementsImplemented}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Implemented</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-8 w-8 text-cyan-500" />
                <span className="text-2xl font-bold">{metrics.aiEfficiency}%</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">AI Efficiency</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="interactions">Recent Interactions</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Performance Overview</CardTitle>
              <CardDescription>
                Real-time monitoring of Replit AI agent effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics && (
                <>
                  {/* Success Rate Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Success Rate</span>
                      <span className="text-sm text-gray-600">{metrics.successRate}%</span>
                    </div>
                    <Progress value={metrics.successRate} className="h-2" />
                  </div>

                  {/* AI Efficiency Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">AI Efficiency Score</span>
                      <span className="text-sm text-gray-600">{metrics.aiEfficiency}%</span>
                    </div>
                    <Progress value={metrics.aiEfficiency} className="h-2" />
                  </div>

                  {/* Categories Analyzed */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Categories Analyzed</h4>
                    <div className="flex flex-wrap gap-2">
                      {metrics.categoriesAnalyzed.map((category) => (
                        <Badge key={category} variant="outline">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Last Analysis */}
                  <Alert>
                    <Activity className="h-4 w-4" />
                    <AlertDescription>
                      Last AI analysis completed: {new Date(metrics.lastAnalysis).toLocaleString()}
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent AI Interactions</CardTitle>
              <CardDescription>
                Real-time log of AI agent activities and improvements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {interactionsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading interactions...</div>
                ) : interactions.length > 0 ? (
                  interactions.slice(0, 10).map((interaction) => (
                    <div key={interaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Bot className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{interaction.action}</p>
                          <p className="text-xs text-gray-600">
                            {interaction.category} • {new Date(interaction.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(interaction.status)}>
                          {interaction.status}
                        </Badge>
                        <span className="text-xs text-gray-500">{interaction.duration}ms</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No recent interactions recorded
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Generated Insights</CardTitle>
              <CardDescription>
                Continuous improvement recommendations from AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insightsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading insights...</div>
                ) : insights.length > 0 ? (
                  insights.map((insight) => (
                    <div key={insight.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-2">
                          {getTypeIcon(insight.type)}
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              {insight.title}
                              {getPriorityIcon(insight.priority)}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                              <span className="font-medium text-blue-900">Recommendation: </span>
                              <span className="text-blue-700">{insight.recommendation}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(insight.status)}>
                            {insight.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(insight.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {insight.status === 'new' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applySuggestionMutation.mutate(insight.id)}
                            disabled={applySuggestionMutation.isPending}
                          >
                            Apply Suggestion
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No insights available. Run an AI analysis to generate recommendations.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}