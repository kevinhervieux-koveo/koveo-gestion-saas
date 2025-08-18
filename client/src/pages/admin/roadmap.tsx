import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Target, TrendingUp, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { useState } from 'react';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'in-progress' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  startDate: string;
  targetDate: string;
  progress: number;
  assignee: string;
  dependencies: string[];
}

interface RoadmapMilestone {
  id: string;
  name: string;
  targetDate: string;
  status: 'upcoming' | 'current' | 'completed';
  progress: number;
  items: number;
}

export default function Roadmap() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState('6months');

  // Mock data - in real app this would come from API
  const { data: roadmapItems = [], isLoading } = useQuery<RoadmapItem[]>({
    queryKey: ['/api/roadmap/items'],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        title: 'Multi-tenant Architecture Enhancement',
        description: 'Implement advanced multi-tenant capabilities for better organization isolation',
        status: 'in-progress',
        priority: 'high',
        category: 'Architecture',
        startDate: '2024-08-01',
        targetDate: '2024-10-15',
        progress: 65,
        assignee: 'Engineering Team',
        dependencies: ['Security Audit']
      },
      {
        id: '2',
        title: 'Quebec Law 25 Full Compliance',
        description: 'Complete implementation of privacy protection measures',
        status: 'in-progress',
        priority: 'critical',
        category: 'Compliance',
        startDate: '2024-07-15',
        targetDate: '2024-09-30',
        progress: 80,
        assignee: 'Legal & Tech Team',
        dependencies: []
      },
      {
        id: '3',
        title: 'Advanced Reporting Dashboard',
        description: 'Build comprehensive financial and operational reporting',
        status: 'planned',
        priority: 'medium',
        category: 'Features',
        startDate: '2024-10-01',
        targetDate: '2024-12-15',
        progress: 0,
        assignee: 'Product Team',
        dependencies: ['Multi-tenant Architecture']
      },
      {
        id: '4',
        title: 'Mobile App Development',
        description: 'Native mobile applications for residents and managers',
        status: 'planned',
        priority: 'high',
        category: 'Platform',
        startDate: '2024-11-01',
        targetDate: '2025-03-30',
        progress: 0,
        assignee: 'Mobile Team',
        dependencies: ['API Optimization']
      },
      {
        id: '5',
        title: 'AI-Powered Maintenance Scheduling',
        description: 'Implement machine learning for predictive maintenance',
        status: 'planned',
        priority: 'medium',
        category: 'Innovation',
        startDate: '2025-01-15',
        targetDate: '2025-06-30',
        progress: 0,
        assignee: 'AI Team',
        dependencies: ['Data Migration']
      }
    ])
  });

  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<RoadmapMilestone[]>({
    queryKey: ['/api/roadmap/milestones'],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        name: 'Q3 2024 - Compliance & Security',
        targetDate: '2024-09-30',
        status: 'current',
        progress: 75,
        items: 8
      },
      {
        id: '2',
        name: 'Q4 2024 - Platform Enhancement',
        targetDate: '2024-12-31',
        status: 'upcoming',
        progress: 25,
        items: 12
      },
      {
        id: '3',
        name: 'Q1 2025 - Mobile & Innovation',
        targetDate: '2025-03-31',
        status: 'upcoming',
        progress: 0,
        items: 6
      }
    ])
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in-progress':
        return 'default';
      case 'planned':
        return 'secondary';
      case 'on-hold':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredItems = roadmapItems.filter(item =>
    selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase()
  );

  const categories = ['all', ...Array.from(new Set(roadmapItems.map(item => item.category)))];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title="Product Roadmap"
        subtitle="Strategic development timeline and feature planning"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roadmapItems.length}</div>
              <p className="text-xs text-muted-foreground">
                Across all categories
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {roadmapItems.filter(item => item.status === 'in-progress').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Active development
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {roadmapItems.filter(item => item.status === 'completed').length}
              </div>
              <p className="text-xs text-muted-foreground">
                This quarter
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(roadmapItems.reduce((sum, item) => sum + item.progress, 0) / roadmapItems.length)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Average completion
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="planning">Planning Board</TabsTrigger>
          </TabsList>
          
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5" />
                    <CardTitle>Development Timeline</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat === 'all' ? 'All Categories' : cat}
                        </option>
                      ))}
                    </select>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{item.title}</h3>
                            <Badge variant={getStatusColor(item.status)}>
                              {item.status}
                            </Badge>
                            <div className={`w-3 h-3 rounded-full ${getPriorityColor(item.priority)}`} />
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>📅 {item.startDate} → {item.targetDate}</span>
                            <span>👤 {item.assignee}</span>
                            <span>🏷️ {item.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Progress</span>
                          <span>{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} className="h-2" />
                      </div>
                      {item.dependencies.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground">
                            Dependencies: {item.dependencies.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="milestones" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5" />
                  <CardTitle>Development Milestones</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{milestone.name}</h3>
                        <Badge variant={milestone.status === 'completed' ? 'default' : 'secondary'}>
                          {milestone.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>{milestone.items} items • Target: {milestone.targetDate}</span>
                          <span>{milestone.progress}%</span>
                        </div>
                        <Progress value={milestone.progress} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="planning" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5" />
                  <CardTitle>Planning Board</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {['planned', 'in-progress', 'completed', 'on-hold'].map((status) => (
                    <div key={status} className="space-y-3">
                      <h4 className="font-medium capitalize flex items-center gap-2">
                        {status === 'in-progress' && <Clock className="h-4 w-4" />}
                        {status === 'completed' && <CheckCircle className="h-4 w-4" />}
                        {status === 'on-hold' && <AlertCircle className="h-4 w-4" />}
                        {status === 'planned' && <Target className="h-4 w-4" />}
                        {status.replace('-', ' ')} ({roadmapItems.filter(item => item.status === status).length})
                      </h4>
                      <div className="space-y-2">
                        {roadmapItems
                          .filter(item => item.status === status)
                          .map(item => (
                            <div key={item.id} className="p-3 border rounded-lg">
                              <h5 className="font-medium text-sm mb-1">{item.title}</h5>
                              <p className="text-xs text-muted-foreground mb-2">{item.category}</p>
                              <div className="flex items-center justify-between">
                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(item.priority)}`} />
                                <span className="text-xs">{item.progress}%</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}