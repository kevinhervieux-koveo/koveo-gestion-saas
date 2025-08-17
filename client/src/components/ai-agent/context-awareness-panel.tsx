import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  FileText, 
  Code, 
  Users, 
  Database, 
  Globe,
  RefreshCw,
  TrendingUp,
  Target,
  Lightbulb,
  Clock
} from 'lucide-react';

interface ContextData {
  project: {
    name: string;
    type: string;
    complexity: number;
    lastModified: Date;
  };
  codebase: {
    files: number;
    lines: number;
    languages: string[];
    frameworks: string[];
  };
  userActivity: {
    recentActions: Array<{
      action: string;
      timestamp: Date;
      file?: string;
    }>;
    focusAreas: string[];
    workingPattern: 'focused' | 'exploratory' | 'debugging';
  };
  recommendations: Array<{
    type: 'optimization' | 'feature' | 'bugfix' | 'documentation';
    priority: number;
    title: string;
    description: string;
    estimatedTime: number;
  }>;
}

/**
 * Context Awareness Panel for AI Agent
 * Shows intelligent understanding of project state and user patterns
 */
export function ContextAwarenessPanel() {
  const [contextData, setContextData] = useState<ContextData>({
    project: {
      name: 'Koveo Gestion',
      type: 'Property Management SaaS',
      complexity: 85,
      lastModified: new Date()
    },
    codebase: {
      files: 127,
      lines: 18450,
      languages: ['TypeScript', 'TSX', 'CSS'],
      frameworks: ['React', 'Express', 'Drizzle ORM', 'Tailwind CSS']
    },
    userActivity: {
      recentActions: [
        { action: 'Fixed sidebar logo rendering', timestamp: new Date(Date.now() - 1000 * 60 * 2), file: 'sidebar.tsx' },
        { action: 'Enhanced dashboard debugging', timestamp: new Date(Date.now() - 1000 * 60 * 5), file: 'dashboard.tsx' },
        { action: 'Resolved authentication flow', timestamp: new Date(Date.now() - 1000 * 60 * 10), file: 'auth.tsx' },
        { action: 'Created AI agent components', timestamp: new Date(Date.now() - 1000 * 60 * 15) }
      ],
      focusAreas: ['UI/UX Enhancement', 'Authentication System', 'AI Agent Integration'],
      workingPattern: 'focused'
    },
    recommendations: [
      {
        type: 'optimization',
        priority: 9,
        title: 'Implement proper logo asset management',
        description: 'Set up consistent logo handling across components to prevent import errors',
        estimatedTime: 15
      },
      {
        type: 'feature',
        priority: 8,
        title: 'Add visual editor integration',
        description: 'Complete the visual editor with real code generation capabilities',
        estimatedTime: 45
      },
      {
        type: 'documentation',
        priority: 7,
        title: 'Update AI agent capabilities documentation',
        description: 'Document new UI integration features in replit.md',
        estimatedTime: 20
      },
      {
        type: 'bugfix',
        priority: 6,
        title: 'Fix Vite server configuration warning',
        description: 'Resolve "Missing parameter name" in vite configuration',
        estimatedTime: 30
      }
    ]
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshContext = () => {
    setIsRefreshing(true);
    // Simulate context refresh
    setTimeout(() => {
      setContextData(prev => ({
        ...prev,
        project: {
          ...prev.project,
          lastModified: new Date()
        },
        userActivity: {
          ...prev.userActivity,
          recentActions: [
            { action: 'Refreshed context data', timestamp: new Date(), file: 'context-awareness-panel.tsx' },
            ...prev.userActivity.recentActions.slice(0, 3)
          ]
        }
      }));
      setIsRefreshing(false);
    }, 1000);
  };

  const getPatternColor = (pattern: string) => {
    switch (pattern) {
      case 'focused': return 'bg-green-100 text-green-800';
      case 'exploratory': return 'bg-blue-100 text-blue-800';
      case 'debugging': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <TrendingUp className="w-4 h-4" />;
      case 'feature': return <Lightbulb className="w-4 h-4" />;
      case 'bugfix': return <Target className="w-4 h-4" />;
      case 'documentation': return <FileText className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Agent Context Awareness
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshContext}
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
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="codebase">Codebase</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Project Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Project Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">{contextData.project.name}</span>
                      <div className="text-xs text-gray-500">{contextData.project.type}</div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs">Complexity</span>
                        <span className="text-xs font-medium">{contextData.project.complexity}%</span>
                      </div>
                      <Progress value={contextData.project.complexity} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User Pattern */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Work Pattern
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge className={getPatternColor(contextData.userActivity.workingPattern)}>
                      {contextData.userActivity.workingPattern}
                    </Badge>
                    <div className="text-xs text-gray-600">
                      Focus Areas:
                    </div>
                    <div className="space-y-1">
                      {contextData.userActivity.focusAreas.map((area, index) => (
                        <Badge key={index} variant="outline" className="text-xs mr-1">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tech Stack */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Tech Stack
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">Frameworks:</div>
                    <div className="flex flex-wrap gap-1">
                      {contextData.codebase.frameworks.map((framework, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {framework}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-gray-600">Languages:</div>
                    <div className="flex flex-wrap gap-1">
                      {contextData.codebase.languages.map((lang, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contextData.userActivity.recentActions.map((action, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 border-l-2 border-gray-200">
                      <Clock className="w-4 h-4 mt-0.5 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{action.action}</p>
                        {action.file && (
                          <p className="text-xs text-gray-500">in {action.file}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {action.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="codebase" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <FileText className="w-6 h-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{contextData.codebase.files}</div>
                  <div className="text-xs text-gray-500">Files</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Code className="w-6 h-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{contextData.codebase.lines.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Lines</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Globe className="w-6 h-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{contextData.codebase.languages.length}</div>
                  <div className="text-xs text-gray-500">Languages</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Database className="w-6 h-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{contextData.codebase.frameworks.length}</div>
                  <div className="text-xs text-gray-500">Frameworks</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <div className="space-y-3">
              {contextData.recommendations
                .sort((a, b) => b.priority - a.priority)
                .map((rec, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {getRecommendationIcon(rec.type)}
                          <div className="flex-1">
                            <h4 className="text-sm font-medium mb-1">{rec.title}</h4>
                            <p className="text-xs text-gray-600 mb-2">{rec.description}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {rec.type}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                ~{rec.estimatedTime}min
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Priority</div>
                          <div className="text-sm font-bold">{rec.priority}/10</div>
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