import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, Home, Building, Users, DollarSign, FileText, Wrench, Bell, Settings, Shield, Bot, BarChart3, Database, Cloud } from 'lucide-react';

interface Feature {
  name: string;
  description: string;
  status: 'completed' | 'in-progress' | 'planned';
  priority?: 'high' | 'medium' | 'low';
}

interface Section {
  title: string;
  icon: any;
  description: string;
  features: Feature[];
}

export default function OwnerRoadmap() {
  const sections: Section[] = [
    {
      title: 'Dashboard & Home',
      icon: Home,
      description: 'Central hub for property management overview',
      features: [
        { name: 'Property Overview Dashboard', description: 'Real-time overview of all properties, occupancy rates, and key metrics', status: 'completed' },
        { name: 'Quick Actions Panel', description: 'Fast access to common tasks like creating bills or maintenance requests', status: 'completed' },
        { name: 'Notification Center', description: 'Centralized notification management with priority levels', status: 'completed' },
        { name: 'Multi-language Support', description: 'Full French and English language support', status: 'completed' },
        { name: 'Dark Mode', description: 'Toggle between light and dark themes', status: 'in-progress' },
        { name: 'Customizable Widgets', description: 'Drag-and-drop dashboard customization', status: 'planned', priority: 'medium' },
        { name: 'Mobile App', description: 'Native iOS and Android applications', status: 'planned', priority: 'high' },
      ]
    },
    {
      title: 'Property Management',
      icon: Building,
      description: 'Building and residence management features',
      features: [
        { name: 'Multi-Building Management', description: 'Manage multiple buildings from a single platform', status: 'completed' },
        { name: 'Residence Registry', description: 'Complete registry of all units with detailed information', status: 'completed' },
        { name: 'Occupancy Tracking', description: 'Real-time tracking of occupied, vacant, and reserved units', status: 'completed' },
        { name: 'Common Areas Management', description: 'Booking system for amenities and common spaces', status: 'in-progress' },
        { name: 'Parking Management', description: 'Assign and track parking spaces and storage units', status: 'in-progress' },
        { name: 'Digital Floor Plans', description: 'Interactive building floor plans with unit details', status: 'planned', priority: 'medium' },
        { name: 'Virtual Tours', description: '360° virtual tours for vacant units', status: 'planned', priority: 'low' },
      ]
    },
    {
      title: 'Resident Management',
      icon: Users,
      description: 'Resident and tenant management system',
      features: [
        { name: 'Resident Portal', description: 'Self-service portal for residents to view bills and submit requests', status: 'completed' },
        { name: 'User Authentication', description: 'Secure login with role-based access control', status: 'completed' },
        { name: 'Resident Onboarding', description: 'Automated workflow for new resident registration', status: 'completed' },
        { name: 'Tenant Screening', description: 'Background checks and credit verification', status: 'in-progress' },
        { name: 'Digital Lease Management', description: 'Electronic lease signing and storage', status: 'in-progress' },
        { name: 'Move-in/Move-out Checklists', description: 'Digital inspection forms with photo documentation', status: 'planned', priority: 'high' },
        { name: 'Community Board', description: 'Social features for resident communication', status: 'planned', priority: 'medium' },
      ]
    },
    {
      title: 'Financial Management',
      icon: DollarSign,
      description: 'Comprehensive financial and billing system',
      features: [
        { name: 'Bill Generation', description: 'Automated monthly bill creation with customizable templates', status: 'completed' },
        { name: 'Payment Processing', description: 'Multiple payment methods including bank transfer and credit cards', status: 'completed' },
        { name: 'Budget Management', description: 'Annual budget planning with line item tracking', status: 'completed' },
        { name: 'Financial Reporting', description: 'Detailed financial reports and statements', status: 'completed' },
        { name: 'Late Payment Management', description: 'Automated reminders and penalty calculations', status: 'in-progress' },
        { name: 'Payment Plans', description: 'Flexible payment arrangements for residents', status: 'in-progress' },
        { name: 'Expense Tracking', description: 'Track and categorize all property expenses', status: 'in-progress' },
        { name: 'Reserve Fund Management', description: 'Track and project reserve fund requirements', status: 'planned', priority: 'high' },
        { name: 'Tax Document Generation', description: 'Automated tax forms and receipts', status: 'planned', priority: 'high' },
      ]
    },
    {
      title: 'Maintenance & Requests',
      icon: Wrench,
      description: 'Maintenance request and work order management',
      features: [
        { name: 'Request Submission', description: 'Easy submission with photo uploads and location details', status: 'completed' },
        { name: 'Priority Management', description: 'Automatic prioritization based on urgency and category', status: 'completed' },
        { name: 'Work Order Assignment', description: 'Assign to internal staff or external contractors', status: 'completed' },
        { name: 'Progress Tracking', description: 'Real-time status updates and completion tracking', status: 'completed' },
        { name: 'Preventive Maintenance', description: 'Scheduled maintenance calendar and reminders', status: 'in-progress' },
        { name: 'Vendor Management', description: 'Contractor database with ratings and history', status: 'in-progress' },
        { name: 'Inventory Management', description: 'Track maintenance supplies and equipment', status: 'planned', priority: 'medium' },
        { name: 'Cost Estimation', description: 'AI-powered maintenance cost predictions', status: 'planned', priority: 'high' },
      ]
    },
    {
      title: 'Document Management',
      icon: FileText,
      description: 'Centralized document storage and management',
      features: [
        { name: 'Document Upload', description: 'Secure upload with automatic categorization', status: 'completed' },
        { name: 'Access Control', description: 'Role-based document access permissions', status: 'completed' },
        { name: 'Version Control', description: 'Track document versions and changes', status: 'in-progress' },
        { name: 'Digital Signatures', description: 'Electronic signature integration', status: 'in-progress' },
        { name: 'Meeting Minutes', description: 'Template-based meeting documentation', status: 'in-progress' },
        { name: 'Contract Management', description: 'Track contract expiry and renewals', status: 'planned', priority: 'high' },
        { name: 'Document OCR', description: 'Text extraction from scanned documents', status: 'planned', priority: 'medium' },
      ]
    },
    {
      title: 'Communication',
      icon: Bell,
      description: 'Multi-channel communication system',
      features: [
        { name: 'Email Notifications', description: 'Automated email alerts for important events', status: 'completed' },
        { name: 'In-App Messaging', description: 'Direct messaging between users', status: 'in-progress' },
        { name: 'SMS Alerts', description: 'Text message notifications for urgent matters', status: 'in-progress' },
        { name: 'Announcement Board', description: 'Building-wide announcements and notices', status: 'in-progress' },
        { name: 'Push Notifications', description: 'Mobile push notifications', status: 'planned', priority: 'high' },
        { name: 'Newsletter System', description: 'Monthly newsletter generation and distribution', status: 'planned', priority: 'low' },
      ]
    },
    {
      title: 'AI & Automation',
      icon: Bot,
      description: 'Artificial intelligence and automation features',
      features: [
        { name: 'AI Property Assistant', description: 'Natural language chat interface for queries', status: 'in-progress' },
        { name: 'Predictive Maintenance', description: 'AI-powered maintenance predictions', status: 'planned', priority: 'high' },
        { name: 'Automated Bill Generation', description: 'Smart billing with automatic adjustments', status: 'completed' },
        { name: 'Document Intelligence', description: 'AI document analysis and extraction', status: 'planned', priority: 'medium' },
        { name: 'Expense Optimization', description: 'AI recommendations for cost reduction', status: 'planned', priority: 'high' },
        { name: 'Occupancy Predictions', description: 'Forecast vacancy rates and trends', status: 'planned', priority: 'medium' },
        { name: 'Smart Scheduling', description: 'AI-optimized maintenance scheduling', status: 'planned', priority: 'medium' },
      ]
    },
    {
      title: 'Compliance & Security',
      icon: Shield,
      description: 'Quebec Law 25 compliance and security features',
      features: [
        { name: 'Law 25 Compliance', description: 'Full compliance with Quebec privacy law', status: 'completed' },
        { name: 'Data Encryption', description: 'End-to-end encryption for sensitive data', status: 'completed' },
        { name: 'Audit Logging', description: 'Complete audit trail of all actions', status: 'completed' },
        { name: 'Two-Factor Authentication', description: '2FA for enhanced security', status: 'in-progress' },
        { name: 'GDPR Compliance', description: 'European data protection compliance', status: 'in-progress' },
        { name: 'Data Retention Policies', description: 'Automated data lifecycle management', status: 'planned', priority: 'high' },
        { name: 'Security Monitoring', description: 'Real-time threat detection', status: 'planned', priority: 'high' },
      ]
    },
    {
      title: 'Analytics & Reporting',
      icon: BarChart3,
      description: 'Business intelligence and reporting tools',
      features: [
        { name: 'Financial Reports', description: 'Comprehensive financial statements', status: 'completed' },
        { name: 'Occupancy Analytics', description: 'Occupancy trends and forecasting', status: 'in-progress' },
        { name: 'Maintenance Analytics', description: 'Maintenance cost and frequency analysis', status: 'in-progress' },
        { name: 'Custom Report Builder', description: 'Drag-and-drop report creation', status: 'planned', priority: 'medium' },
        { name: 'Executive Dashboards', description: 'High-level KPI dashboards', status: 'planned', priority: 'high' },
        { name: 'Benchmark Analysis', description: 'Compare performance against industry standards', status: 'planned', priority: 'low' },
      ]
    },
    {
      title: 'Integration & API',
      icon: Database,
      description: 'Third-party integrations and API access',
      features: [
        { name: 'Payment Gateway Integration', description: 'Stripe and Moneris integration', status: 'completed' },
        { name: 'Accounting Software Sync', description: 'QuickBooks and Sage integration', status: 'in-progress' },
        { name: 'RESTful API', description: 'Full API for third-party integrations', status: 'in-progress' },
        { name: 'Webhook System', description: 'Event-driven webhooks', status: 'planned', priority: 'medium' },
        { name: 'Calendar Sync', description: 'Google and Outlook calendar integration', status: 'planned', priority: 'low' },
        { name: 'Banking API', description: 'Direct bank account integration', status: 'planned', priority: 'high' },
      ]
    },
    {
      title: 'Infrastructure & Performance',
      icon: Cloud,
      description: 'Platform infrastructure and optimization',
      features: [
        { name: 'Cloud Hosting', description: 'Scalable cloud infrastructure on Vercel', status: 'completed' },
        { name: 'Database Optimization', description: 'PostgreSQL with read replicas', status: 'completed' },
        { name: 'CDN Distribution', description: 'Global content delivery network', status: 'completed' },
        { name: 'Auto-scaling', description: 'Automatic resource scaling', status: 'in-progress' },
        { name: 'Backup & Recovery', description: 'Automated backups with point-in-time recovery', status: 'in-progress' },
        { name: 'Load Balancing', description: 'Multi-region load distribution', status: 'planned', priority: 'high' },
        { name: 'Performance Monitoring', description: 'Real-time performance analytics', status: 'planned', priority: 'medium' },
      ]
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Product Roadmap"
        subtitle="Complete feature list and development progress"
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
                    {section.features.map((feature, index) => (
                      <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
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