import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VisualEditorInterface } from './visual-editor-interface';
import { MessageQueueInterface } from './message-queue-interface';
import { ContextAwarenessPanel } from './context-awareness-panel';
import { ReplitIntegrationPanel } from './replit-integration-panel';
import { 
  Bot, 
  Eye, 
  MessageSquare, 
  Brain, 
  Settings,
  BarChart3,
  Zap,
  Cpu,
  Activity
} from 'lucide-react';

/**
 * Main AI Agent Dashboard
 * Central control panel for all AI agent UI capabilities
 */
export function AgentDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [agentStatus, setAgentStatus] = useState<'active' | 'idle' | 'working'>('idle');

  const capabilities = [
    {
      name: 'Visual Editor',
      icon: Eye,
      description: 'Direct UI editing with code generation',
      status: 'available',
      component: 'visual-editor'
    },
    {
      name: 'Message Queue',
      icon: MessageSquare,
      description: 'Schedule and manage AI tasks',
      status: 'available',
      component: 'message-queue'
    },
    {
      name: 'Context Awareness',
      icon: Brain,
      description: 'Intelligent project understanding',
      status: 'active',
      component: 'context'
    },
    {
      name: 'Performance Monitor',
      icon: BarChart3,
      description: 'Real-time system metrics',
      status: 'available',
      component: 'performance'
    },
    {
      name: 'Code Analysis',
      icon: Cpu,
      description: 'Automated code quality checks',
      status: 'available',
      component: 'analysis'
    },
    {
      name: 'Smart Suggestions',
      icon: Zap,
      description: 'AI-powered recommendations',
      status: 'active',
      component: 'suggestions'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'available': return 'bg-blue-100 text-blue-800';
      case 'disabled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'working': return 'text-blue-600';
      case 'idle': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Bot className="w-6 h-6" />
              AI Agent Control Center
              <Badge className={getAgentStatusColor(agentStatus)}>
                <Activity className="w-3 h-3 mr-1" />
                {agentStatus}
              </Badge>
            </CardTitle>
            <Button
              onClick={() => setAgentStatus(agentStatus === 'active' ? 'idle' : 'active')}
              variant={agentStatus === 'active' ? 'destructive' : 'default'}
            >
              {agentStatus === 'active' ? 'Deactivate Agent' : 'Activate Agent'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Main Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visual-editor">Visual Editor</TabsTrigger>
          <TabsTrigger value="message-queue">Task Queue</TabsTrigger>
          <TabsTrigger value="context">Context AI</TabsTrigger>
          <TabsTrigger value="replit">Replit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Capabilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Icon className="w-5 h-5 text-gray-600" />
                      <Badge className={`text-xs ${getStatusColor(capability.status)}`}>
                        {capability.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-medium mb-2">{capability.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{capability.description}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab(capability.component)}
                      disabled={capability.status === 'disabled'}
                    >
                      Open {capability.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">3</div>
                <div className="text-sm text-gray-600">Active Features</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">12</div>
                <div className="text-sm text-gray-600">Tasks Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">2</div>
                <div className="text-sm text-gray-600">Pending Actions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">95%</div>
                <div className="text-sm text-gray-600">System Health</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visual-editor">
          <VisualEditorInterface />
        </TabsContent>

        <TabsContent value="message-queue">
          <MessageQueueInterface />
        </TabsContent>

        <TabsContent value="context">
          <ContextAwarenessPanel />
        </TabsContent>

        <TabsContent value="replit">
          <ReplitIntegrationPanel />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Performance Monitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Performance Monitoring</p>
                <p className="text-sm">Real-time system metrics coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                Code Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Cpu className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Code Analysis Engine</p>
                <p className="text-sm">Automated quality checks coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Smart Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">AI Recommendations</p>
                <p className="text-sm">Intelligent suggestions coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}