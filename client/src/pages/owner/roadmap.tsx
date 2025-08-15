import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, Home, Building, Users, DollarSign, FileText, Wrench, Bell, Settings, Shield, Bot, BarChart3, Database, Cloud } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Feature } from '@shared/schema';

interface Section {
  title: string;
  icon: any;
  description: string;
  features: Feature[];
}

export default function OwnerRoadmap() {
  // Fetch features from the database
  const { data: features = [], isLoading } = useQuery({
    queryKey: ['/api/features', { roadmap: true }],
    queryFn: () => fetch('/api/features?roadmap=true').then(res => res.json()),
  });

  // Group features by category
  const groupedFeatures = features.reduce((acc: Record<string, Feature[]>, feature: Feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {});

  const sections: Section[] = [
    {
      title: 'Dashboard & Home',
      icon: Home,
      description: 'Central hub for property management overview',
      features: groupedFeatures['Dashboard & Home'] || []
    },
    {
      title: 'Property Management',
      icon: Building,
      description: 'Building and residence management features',
      features: groupedFeatures['Property Management'] || []
    },
    {
      title: 'Resident Management',
      icon: Users,
      description: 'Resident and tenant management system',
      features: groupedFeatures['Resident Management'] || []
    },
    {
      title: 'Financial Management',
      icon: DollarSign,
      description: 'Comprehensive financial and billing system',
      features: groupedFeatures['Financial Management'] || []
    },
    {
      title: 'Maintenance & Requests',
      icon: Wrench,
      description: 'Maintenance request and work order management',
      features: groupedFeatures['Maintenance & Requests'] || []
    },
    {
      title: 'Document Management',
      icon: FileText,
      description: 'Centralized document storage and management',
      features: groupedFeatures['Document Management'] || []
    },
    {
      title: 'Communication',
      icon: Bell,
      description: 'Multi-channel communication system',
      features: groupedFeatures['Communication'] || []
    },
    {
      title: 'AI & Automation',
      icon: Bot,
      description: 'Artificial intelligence and automation features',
      features: groupedFeatures['AI & Automation'] || []
    },
    {
      title: 'Compliance & Security',
      icon: Shield,
      description: 'Quebec Law 25 compliance and security features',
      features: groupedFeatures['Compliance & Security'] || []
    },
    {
      title: 'Analytics & Reporting',
      icon: BarChart3,
      description: 'Business intelligence and reporting tools',
      features: groupedFeatures['Analytics & Reporting'] || []
    },
    {
      title: 'Integration & API',
      icon: Database,
      description: 'Third-party integrations and API access',
      features: groupedFeatures['Integration & API'] || []
    },
    {
      title: 'Infrastructure & Performance',
      icon: Cloud,
      description: 'Platform infrastructure and optimization',
      features: groupedFeatures['Infrastructure & Performance'] || []
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'planned':
        return <Circle className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Progress</Badge>;
      case 'planned':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Planned</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 ml-2">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 ml-2">Medium</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 ml-2">Low</Badge>;
      default:
        return null;
    }
  };

  const calculateProgress = (features: Feature[]) => {
    const completed = features.filter(f => f.status === 'completed').length;
    const inProgress = features.filter(f => f.status === 'in-progress').length;
    const total = features.length;
    const progress = ((completed + (inProgress * 0.5)) / total) * 100;
    return {
      completed,
      inProgress,
      planned: features.filter(f => f.status === 'planned').length,
      progress: Math.round(progress)
    };
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Product Roadmap"
          subtitle="Loading roadmap data..."
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-koveo-navy mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading features...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Product Roadmap"
        subtitle="Complete feature list and development progress (Live Data)"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {sections.reduce((acc, s) => acc + s.features.filter(f => f.status === 'completed').length, 0)}
                </div>
                <div className="text-sm text-gray-600">Completed Features</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {sections.reduce((acc, s) => acc + s.features.filter(f => f.status === 'in-progress').length, 0)}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-600">
                  {sections.reduce((acc, s) => acc + s.features.filter(f => f.status === 'planned').length, 0)}
                </div>
                <div className="text-sm text-gray-600">Planned Features</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-koveo-navy">
                  {sections.reduce((acc, s) => acc + s.features.length, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Features</div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Sections */}
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const stats = calculateProgress(section.features);
            
            return (
              <Card key={section.title} className="overflow-hidden">
                <CardHeader className="bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-koveo-navy rounded-lg flex items-center justify-center">
                        <SectionIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                        <CardDescription className="mt-1">{section.description}</CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-koveo-navy">{stats.progress}%</div>
                      <div className="text-xs text-gray-500">
                        {stats.completed}/{section.features.length} complete
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                        style={{ width: `${stats.progress}%` }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {section.features.map((feature) => (
                      <div key={feature.id || feature.name} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start space-x-3">
                          {getStatusIcon(feature.status)}
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="font-medium text-gray-900">{feature.name}</span>
                              {getStatusBadge(feature.status)}
                              {feature.priority && getPriorityBadge(feature.priority)}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}