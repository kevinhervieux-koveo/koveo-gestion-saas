import { useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Home,
  Building,
  Users,
  DollarSign,
  FileText,
  Wrench,
  Bell,
  Settings,
  Shield,
  Bot,
  BarChart3,
  Database,
  Cloud,
  Plus,
  Terminal,
  Globe,
  Search,
  Target,
  CheckCircle2,
  Clock,
  Circle,
  ChevronDown,
  ChevronRight,
  ListTodo,
  MessageCircle,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Feature, ActionableItem } from '@shared/schema';
import { FeatureForm } from '@/components/forms';
import {
  useFeatureDuplicateAnalysis,
  getDuplicateBadge,
  getDuplicateNote,
} from '@/components/roadmap/feature-duplicate-analysis';
import { RoadmapSection, type Section } from '@/components/roadmap/roadmap-section';
import { generateLLMHelpForm } from '@/components/roadmap/llm-help-form';
import {
  getStatusIcon,
  getStatusBadge,
  getPriorityBadge,
  getActionableItemStatusIcon,
  getActionableItemStatusBadge,
} from '@/components/roadmap/feature-status-badges';

/**
 * Owner roadmap page displaying all features with planning capabilities.
 * Users can click on any feature to open a detailed planning dialog.
 */
export default function OwnerRoadmap() {
  const { toast } = useToast();

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: ({ featureId, status }: { featureId: string; status: string }) =>
      apiRequest('POST', `/api/features/${featureId}/update-status`, { status }),
    onSuccess: () => {
      toast({
        title: 'Status Updated',
        description: 'Feature status has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/features'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update feature status.',
        variant: 'destructive',
      });
    },
  });

  // Actionable item status update mutation
  const actionableItemMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      apiRequest('PUT', `/api/actionable-items/${itemId}`, {
        status,
        completedAt: status === 'completed' ? new Date() : null,
      }),
    onSuccess: () => {
      toast({
        title: 'Task Updated',
        description: 'Actionable item status has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/features'] });
      // Note: Individual actionable items will invalidate their own queries
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update actionable item status.',
        variant: 'destructive',
      });
    },
  });

  // Strategic path toggle mutation
  const strategicMutation = useMutation({
    mutationFn: ({ featureId, isStrategicPath }: { featureId: string; isStrategicPath: boolean }) =>
      apiRequest('POST', `/api/features/${featureId}/toggle-strategic`, { isStrategicPath }),
    onSuccess: () => {
      toast({
        title: 'Strategic Path Updated',
        description: 'Feature strategic path status has been updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/features'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update strategic path status.',
        variant: 'destructive',
      });
    },
  });

  // Sync mutation for manual synchronization
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/features/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync features');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync Completed',
        description: data.message || 'All features have been synchronized to production.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to synchronize features to production.',
        variant: 'destructive',
      });
    },
  });
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [actionableItems, setActionableItems] = useState<Record<string, ActionableItem[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch features from the database
  const {
    data: features = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/features', 'roadmap'],
    queryFn: async () => {
      const res = await fetch('/api/features?roadmap=true', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
  });

  // Minimal debug logging only for actual errors
  }

  /**
   * Fetches actionable items for a specific feature.
   */
  const fetchActionableItems = useCallback(async (featureId: string) => {
    // Check if already fetched to prevent duplicate requests
    setActionableItems((prev) => {
      if (prev[featureId]) {
        return prev; // Already fetched, don't update state
      }
      // Set as loading/empty to prevent duplicate requests
      return { ...prev, [featureId]: [] };
    });

    try {
      const response = await fetch(`/api/features/${featureId}/actionable-items`);
      if (response.ok) {
        const items = await response.json();
        setActionableItems((current) => ({ ...current, [featureId]: items }));
      } else {
        console.error('Failed to fetch actionable items:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching actionable items:', error);
    }
  }, []);

  /**
   * Copies text to clipboard with toast feedback.
   * @param prompt
   */
  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({
        title: 'Prompt copied!',
        description: 'The implementation prompt has been copied to your clipboard.',
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: 'Failed to copy',
        description: 'Could not copy the prompt to clipboard.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Handles toggling actionable item status between pending and completed.
   * @param item
   */
  const handleToggleActionableItem = (item: ActionableItem) => {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    actionableItemMutation.mutate({ itemId: item.id, status: newStatus });
  };

  /**
   * Handles updating actionable item status via dropdown.
   * @param item
   * @param newStatus
   */
  const handleActionableItemStatusChange = (item: ActionableItem, newStatus: string) => {
    actionableItemMutation.mutate({ itemId: item.id, status: newStatus });
  };

  /**
   * Toggles feature expansion and fetches actionable items if needed.
   * @param featureId
   */
  const toggleFeatureExpansion = useCallback(
    (featureId: string) => {
      setExpandedFeatures((prev) => {
        const isExpanded = prev.includes(featureId);
        if (isExpanded) {
          return prev.filter((id) => id !== featureId);
        } else {
          // Fetch actionable items when expanding
          fetchActionableItems(featureId);
          return [...prev, featureId];
        }
      });
    },
    [fetchActionableItems]
  );

  // Use the duplicate analysis hook
  const { duplicateAnalysis, duplicateStats } = useFeatureDuplicateAnalysis(features);

  /**
   * Handles clicking on a feature item to open the planning dialog.
   * @param feature
   */
  const handleFeatureClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setDialogOpen(true);
  };

  /**
   * Handles creating a new feature item.
   */
  const handleCreateNewItem = () => {
    setSelectedFeature(null);
    setDialogOpen(true);
  };

  /**
   * Copies LLM help form to clipboard for feature discussion.
   */
  const handleCopyLLMForm = async () => {
    try {
      await navigator.clipboard.writeText(generateLLMHelpForm());
      toast({
        title: 'Enhanced LLM Help Form Copied',
        description:
          'The enhanced feature discussion form with Koveo Gestion context has been copied. The LLM will focus specifically on your requirements.',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error copying LLM form:', error);
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy the form to clipboard.',
        variant: 'destructive',
      });
    }
  };

  // Filter features based on search term
  const filteredFeatures = useMemo(() => {
    if (!searchTerm.trim()) {
      return features;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    return features.filter(
      (feature: Feature) =>
        feature.name.toLowerCase().includes(searchLower) ||
        feature.description?.toLowerCase().includes(searchLower) ||
        feature.category.toLowerCase().includes(searchLower)
    );
  }, [features, searchTerm]);

  // Group features by category and strategic path
  const groupedFeatures = filteredFeatures.reduce(
    (acc: Record<string, Feature[]>, feature: Feature) => {
      // Handle Strategic Path as a special case
      if ((feature as any).isStrategicPath) {
        if (!acc['Strategic Path']) {
          acc['Strategic Path'] = [];
        }
        acc['Strategic Path'].push(feature);
      }

      // Also group by category
      if (!acc[feature.category]) {
        acc[feature.category] = [];
      }
      acc[feature.category].push(feature);
      return acc;
    },
    {}
  );

  // Debug logging

  const sections: Section[] = [
    {
      title: 'Strategic Path',
      icon: Target,
      description: 'High-level strategic initiatives and business objectives',
      features: groupedFeatures['Strategic Path'] || [],
    },
    {
      title: 'Dashboard & Home',
      icon: Home,
      description: 'Central hub for property management overview',
      features: groupedFeatures['Dashboard & Home'] || [],
    },
    {
      title: 'Property Management',
      icon: Building,
      description: 'Building and residence management features',
      features: groupedFeatures['Property Management'] || [],
    },
    {
      title: 'Resident Management',
      icon: Users,
      description: 'Resident and tenant management system',
      features: groupedFeatures['Resident Management'] || [],
    },
    {
      title: 'Financial Management',
      icon: DollarSign,
      description: 'Comprehensive financial and billing system',
      features: groupedFeatures['Financial Management'] || [],
    },
    {
      title: 'Maintenance & Requests',
      icon: Wrench,
      description: 'Maintenance request and work order management',
      features: groupedFeatures['Maintenance & Requests'] || [],
    },
    {
      title: 'Document Management',
      icon: FileText,
      description: 'Centralized document storage and management',
      features: groupedFeatures['Document Management'] || [],
    },
    {
      title: 'Communication',
      icon: Bell,
      description: 'Multi-channel communication system',
      features: groupedFeatures.Communication || [],
    },
    {
      title: 'AI & Automation',
      icon: Bot,
      description: 'Artificial intelligence and automation features',
      features: groupedFeatures['AI & Automation'] || [],
    },
    {
      title: 'Compliance & Security',
      icon: Shield,
      description: 'Quebec Law 25 compliance and security features',
      features: groupedFeatures['Compliance & Security'] || [],
    },
    {
      title: 'Analytics & Reporting',
      icon: BarChart3,
      description: 'Business intelligence and reporting tools',
      features: groupedFeatures['Analytics & Reporting'] || [],
    },
    {
      title: 'Integration & API',
      icon: Database,
      description: 'Third-party integrations and API access',
      features: groupedFeatures['Integration & API'] || [],
    },
    {
      title: 'Infrastructure & Performance',
      icon: Cloud,
      description: 'Platform infrastructure and optimization',
      features: groupedFeatures['Infrastructure & Performance'] || [],
    },
    {
      title: 'Website',
      icon: Globe,
      description: 'Website features, SEO, and automation tools',
      features: groupedFeatures.Website || [],
    },
  ];

  const calculateProgress = (_features: Feature[]) => {
    const completed = _features.filter((f) => f.status === 'completed').length;
    const inProgress = _features.filter((f) => f.status === 'in-progress').length;
    const total = _features.length;
    const progress = total > 0 ? ((completed + inProgress * 0.5) / total) * 100 : 0;
    return {
      completed,
      inProgress,
      planned: _features.filter((f) => f.status === 'planned').length,
      progress: Math.round(progress),
    };
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Product Roadmap' subtitle='Loading roadmap data...' />
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-koveo-navy mx-auto'></div>
            <p className='mt-4 text-gray-600'>Loading features...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title='Product Roadmap'
        subtitle='Complete feature list and development progress (Live Data)'
      />

      {/* Search Bar */}
      <div className='bg-white border-b px-6 py-4'>
        <div className='relative max-w-md'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
          <Input
            type='text'
            placeholder='Search features by name, description, or category...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='pl-10 pr-4'
          />
        </div>
        {searchTerm && (
          <div className='mt-2 text-sm text-gray-600'>
            Found {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}{' '}
            matching "{searchTerm}"
            {filteredFeatures.length !== features.length && (
              <button
                onClick={() => setSearchTerm('')}
                className='ml-2 text-blue-600 hover:text-blue-800 underline'
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Refresh Command */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>
              npm run validate
            </code>
          </div>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Sync Status Info */}
          <Card className='bg-blue-50 border-blue-200'>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Database className='w-4 h-4 text-blue-600' />
                  <span className='text-sm font-medium text-blue-800'>
                    Automatic Synchronization
                  </span>
                </div>
                <div className='text-xs text-blue-600'>
                  {process.env.NODE_ENV === 'development'
                    ? 'DEV → PROD Sync Enabled'
                    : 'Production Environment'}
                </div>
              </div>
              <p className='text-xs text-blue-700 mt-2'>
                {process.env.NODE_ENV === 'development'
                  ? 'New feature requests automatically appear as "Submitted" status and sync to production. Updates to roadmap features are automatically synchronized.'
                  : 'This is the production roadmap. Changes are synchronized from the development environment.'}
              </p>
            </CardContent>
          </Card>

          {/* Create New Item Buttons */}
          <div className='flex justify-end gap-3 mb-6'>
            <Button
              onClick={handleCopyLLMForm}
              variant='outline'
              className='border-purple-200 text-purple-700 hover:bg-purple-50'
            >
              <MessageCircle className='w-4 h-4 mr-2' />
              LLM Help Form
            </Button>
            <Button
              onClick={() => syncMutation.mutate()}
              variant='outline'
              disabled={syncMutation.isPending}
              className='border-blue-200 text-blue-700 hover:bg-blue-50'
            >
              <Database className='w-4 h-4 mr-2' />
              {syncMutation.isPending ? 'Syncing...' : 'Sync to Production'}
            </Button>
            <Button onClick={handleCreateNewItem} className='bg-koveo-navy hover:bg-koveo-navy/90'>
              <Plus className='w-4 h-4 mr-2' />
              Create New Item
            </Button>
          </div>
          {/* Overview Stats */}
          <div className='grid grid-cols-6 gap-4 mb-6'>
            <Card>
              <CardContent className='p-4'>
                <div className='text-2xl font-bold text-green-600'>
                  {sections.reduce(
                    (acc, s) => acc + s.features.filter((f) => f.status === 'completed').length,
                    0
                  )}
                </div>
                <div className='text-sm text-gray-600'>Completed Features</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-4'>
                <div className='text-2xl font-bold text-blue-600'>
                  {sections.reduce(
                    (acc, s) => acc + s.features.filter((f) => f.status === 'in-progress').length,
                    0
                  )}
                </div>
                <div className='text-sm text-gray-600'>In Progress</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-4'>
                <div className='text-2xl font-bold text-gray-600'>
                  {sections.reduce(
                    (acc, s) => acc + s.features.filter((f) => f.status === 'planned').length,
                    0
                  )}
                </div>
                <div className='text-sm text-gray-600'>Planned Features</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-4'>
                <div className='text-2xl font-bold text-koveo-navy'>
                  {sections.reduce((acc, s) => acc + s.features.length, 0)}
                </div>
                <div className='text-sm text-gray-600'>Total Features</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-4'>
                <div className='text-2xl font-bold text-red-600'>{duplicateStats.totalExact}</div>
                <div className='text-sm text-gray-600'>Exact Duplicates</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-4'>
                <div className='text-2xl font-bold text-orange-600'>
                  {duplicateStats.totalSimilar}
                </div>
                <div className='text-sm text-gray-600'>Similar Features</div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Sections - Now Collapsible */}
          <Accordion
            type='multiple'
            value={expandedSections}
            onValueChange={setExpandedSections}
            className='space-y-4'
          >
            {sections.map((section) => {
              const SectionIcon = section.icon;
              const stats = calculateProgress(section.features);

              return (
                <AccordionItem
                  key={section.title}
                  value={section.title}
                  className='border rounded-lg overflow-hidden'
                >
                  <AccordionTrigger className='hover:no-underline'>
                    <Card className='w-full shadow-none border-none'>
                      <CardHeader className='bg-gray-50'>
                        <div className='flex items-start justify-between'>
                          <div className='flex items-start space-x-3'>
                            <div className='w-10 h-10 bg-koveo-navy rounded-lg flex items-center justify-center'>
                              <SectionIcon className='w-5 h-5 text-white' />
                            </div>
                            <div>
                              <CardTitle className='text-lg text-left'>{section.title}</CardTitle>
                              <CardDescription className='mt-1 text-left'>
                                {section.description}
                              </CardDescription>
                            </div>
                          </div>
                          <div className='text-right'>
                            <div className='text-2xl font-bold text-koveo-navy'>
                              {stats.progress}%
                            </div>
                            <div className='text-xs text-gray-500'>
                              {stats.completed}/{section.features.length} complete
                            </div>
                          </div>
                        </div>
                        <div className='mt-4'>
                          <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
                            <div
                              className='h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500'
                              style={{ width: `${stats.progress}%` }}
                            />
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className='p-0 bg-white'>
                      <div className='divide-y divide-gray-100'>
                        {section.features.length === 0 ? (
                          <div className='p-8 text-center text-gray-500'>
                            <div className='mb-2'>No features in this category yet</div>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateNewItem();
                              }}
                            >
                              <Plus className='w-4 h-4 mr-1' />
                              Add First Feature
                            </Button>
                          </div>
                        ) : (
                          section.features.map((feature) => {
                            const isExpanded = expandedFeatures.includes(
                              feature.id || feature.name
                            );
                            const items = actionableItems[feature.id || feature.name] || [];

                            return (
                              <div
                                key={feature.id || feature.name}
                                className='border-l-4 border-transparent hover:border-blue-400'
                              >
                                {/* Feature Header */}
                                <div className='p-4 hover:bg-blue-50 transition-colors'>
                                  <div className='flex items-start space-x-3'>
                                    <div className='flex items-center space-x-2'>
                                      {getStatusIcon(feature.status)}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFeatureExpansion(feature.id || feature.name);
                                        }}
                                        className='p-1 hover:bg-gray-200 rounded transition-colors'
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className='w-4 h-4 text-gray-500' />
                                        ) : (
                                          <ChevronRight className='w-4 h-4 text-gray-500' />
                                        )}
                                      </button>
                                    </div>
                                    <div className='flex-1'>
                                      <div className='flex items-center flex-wrap'>
                                        <span
                                          className='font-medium text-gray-900 hover:text-blue-600 transition-colors cursor-pointer'
                                          onClick={() => handleFeatureClick(feature)}
                                        >
                                          {feature.name}
                                        </span>
                                        {getStatusBadge(feature.status)}
                                        {feature.priority && getPriorityBadge(feature.priority)}
                                        {getDuplicateBadge(feature.id || feature.name, undefined)}
                                        {items.length > 0 && (
                                          <Badge className='bg-purple-100 text-purple-800 hover:bg-purple-100 ml-2 text-xs'>
                                            <ListTodo className='w-3 h-3 mr-1' />
                                            {items.length} {items.length === 1 ? 'task' : 'tasks'}
                                          </Badge>
                                        )}
                                        {(feature as any).isStrategicPath && (
                                          <Badge className='bg-orange-100 text-orange-800 hover:bg-orange-100 ml-2 text-xs'>
                                            <Target className='w-3 h-3 mr-1' />
                                            Strategic
                                          </Badge>
                                        )}
                                      </div>
                                      <p className='text-sm text-gray-600 mt-1'>
                                        {feature.description}
                                      </p>

                                      {/* Feature Controls */}
                                      <div className='flex items-center gap-4 mt-3 pt-2 border-t border-gray-100'>
                                        {/* Status Change */}
                                        <div className='flex items-center gap-2'>
                                          <Label
                                            htmlFor={`status-${feature.id}`}
                                            className='text-xs text-gray-600'
                                          >
                                            Status:
                                          </Label>
                                          <Select
                                            value={feature.status}
                                            onValueChange={(value) =>
                                              statusMutation.mutate({
                                                featureId: feature.id!,
                                                status: value,
                                              })
                                            }
                                            disabled={statusMutation.isPending}
                                          >
                                            <SelectTrigger
                                              id={`status-${feature.id}`}
                                              className='w-32 h-7 text-xs'
                                            >
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value='submitted'>Submitted</SelectItem>
                                              <SelectItem value='planned'>Planned</SelectItem>
                                              <SelectItem value='in-progress'>
                                                In Progress
                                              </SelectItem>
                                              <SelectItem value='ai-analyzed'>
                                                AI Analyzed
                                              </SelectItem>
                                              <SelectItem value='completed'>Completed</SelectItem>
                                              <SelectItem value='cancelled'>Cancelled</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {/* Strategic Path Toggle */}
                                        <div className='flex items-center gap-2'>
                                          <Label
                                            htmlFor={`strategic-${feature.id}`}
                                            className='text-xs text-gray-600'
                                          >
                                            Strategic Path:
                                          </Label>
                                          <Switch
                                            id={`strategic-${feature.id}`}
                                            checked={(feature as any).isStrategicPath || false}
                                            onCheckedChange={(checked) =>
                                              strategicMutation.mutate({
                                                featureId: feature.id!,
                                                isStrategicPath: checked,
                                              })
                                            }
                                            disabled={strategicMutation.isPending}
                                            className='scale-75'
                                          />
                                        </div>
                                      </div>
                                      {getDuplicateNote(feature.id || feature.name, undefined) && (
                                        <div className='mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800'>
                                          {getDuplicateNote(feature.id || feature.name, undefined)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Actionable Items */}
                                {isExpanded && (
                                  <div className='bg-gray-50 border-t border-gray-200'>
                                    {items.length === 0 ? (
                                      <div className='p-4 text-center text-gray-500 text-sm'>
                                        <ListTodo className='w-6 h-6 mx-auto mb-2 text-gray-400' />
                                        No actionable items yet.
                                        <br />
                                        <span className='text-xs'>
                                          Generate a development prompt to create tasks.
                                        </span>
                                      </div>
                                    ) : (
                                      <div className='divide-y divide-gray-200'>
                                        {items.map((item, _index) => (
                                          <div
                                            key={item.id || _index}
                                            className='p-3 pl-12 hover:bg-white transition-colors'
                                          >
                                            <div className='flex items-start space-x-3'>
                                              <button
                                                onClick={() => handleToggleActionableItem(item)}
                                                className='p-1 hover:bg-gray-100 rounded transition-colors'
                                                title={`Mark as ${item.status === 'completed' ? 'pending' : 'completed'}`}
                                              >
                                                {getActionableItemStatusIcon(item.status)}
                                              </button>
                                              <div className='flex-1'>
                                                <div className='flex items-center justify-between'>
                                                  <div className='flex items-center space-x-2'>
                                                    <span className='text-sm font-medium text-gray-900'>
                                                      {item.title}
                                                    </span>
                                                    {getActionableItemStatusBadge(item.status)}
                                                    {(item as any).estimatedEffort && (
                                                      <Badge variant='outline' className='text-xs'>
                                                        {(item as any).estimatedEffort}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  <div className='flex items-center gap-2'>
                                                    <Select
                                                      value={item.status}
                                                      onValueChange={(_value) =>
                                                        handleActionableItemStatusChange(
                                                          item,
                                                          _value
                                                        )
                                                      }
                                                      disabled={actionableItemMutation.isPending}
                                                    >
                                                      <SelectTrigger className='w-24 h-6 text-xs'>
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value='pending'>
                                                          Todo
                                                        </SelectItem>
                                                        <SelectItem value='in-progress'>
                                                          Working
                                                        </SelectItem>
                                                        <SelectItem value='completed'>
                                                          Done
                                                        </SelectItem>
                                                        <SelectItem value='blocked'>
                                                          Blocked
                                                        </SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                </div>
                                                <p className='text-xs text-gray-600 mt-1'>
                                                  {item.description}
                                                </p>
                                                {(item as any).technicalDetails && (
                                                  <p className='text-xs text-gray-500 mt-1'>
                                                    <strong>Technical:</strong>{' '}
                                                    {(item as any).technicalDetails}
                                                  </p>
                                                )}
                                                {(item as any).implementationPrompt && (
                                                  <div className='mt-2 p-2 bg-blue-50 border border-blue-200 rounded'>
                                                    <div className='flex items-start justify-between'>
                                                      <div className='flex-1'>
                                                        <p className='text-xs font-medium text-blue-900 mb-1'>
                                                          Replit AI Agent Prompt:
                                                        </p>
                                                        <p className='text-xs text-blue-800 whitespace-pre-wrap font-mono'>
                                                          {(item as any).implementationPrompt}
                                                        </p>
                                                      </div>
                                                      <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        className='ml-2 h-6 px-2'
                                                        onClick={() =>
                                                          handleCopyPrompt(
                                                            (item as any).implementationPrompt || ''
                                                          )
                                                        }
                                                      >
                                                        <Copy className='w-3 h-3 mr-1' />
                                                        Copy
                                                      </Button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>

      <FeatureForm feature={selectedFeature} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
