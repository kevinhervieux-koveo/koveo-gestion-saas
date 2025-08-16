import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  CheckCircle2,
  Circle,
  Clock,
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
  Target,
  Terminal,
  Globe,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronRight,
  ListTodo,
  MessageCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Feature, ActionableItem } from '@shared/schema';
import { FeatureForm } from '@/components/forms';

/**
 * Duplicate analysis result for a feature
 */
interface DuplicateInfo {
  isDuplicate: boolean;
  duplicateCount: number;
  duplicateFeatures: Feature[];
  similarityType: 'exact' | 'similar' | 'none';
}

/**
 * Section interface for roadmap organization
 */
interface Section {
  title: string;
  icon: any;
  description: string;
  features: Feature[];
}

/**
 * Owner roadmap page displaying all features with planning capabilities.
 * Users can click on any feature to open a detailed planning dialog.
 */
export default function OwnerRoadmap() {
  const { toast } = useToast();
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [actionableItems, setActionableItems] = useState<Record<string, ActionableItem[]>>({});

  // Fetch features from the database
  const { data: features = [], isLoading } = useQuery({
    queryKey: ['/api/features', { roadmap: true }],
    queryFn: () => fetch('/api/features?roadmap=true').then((res) => res.json()),
  });

  /**
   * Fetches actionable items for a specific feature
   */
  const fetchActionableItems = async (featureId: string) => {
    if (actionableItems[featureId]) return; // Already fetched
    
    try {
      const response = await fetch(`/api/features/${featureId}/actionable-items`);
      if (response.ok) {
        const items = await response.json();
        setActionableItems(prev => ({ ...prev, [featureId]: items }));
      }
    } catch (error) {
      console.error('Failed to fetch actionable items:', error);
    }
  };

  /**
   * Copies the implementation prompt to clipboard
   */
  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({
        title: 'Prompt copied!',
        description: 'The implementation prompt has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy the prompt to clipboard.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Toggles feature expansion and fetches actionable items if needed
   */
  const toggleFeatureExpansion = (featureId: string) => {
    setExpandedFeatures(prev => {
      const isExpanded = prev.includes(featureId);
      if (isExpanded) {
        return prev.filter(id => id !== featureId);
      } else {
        // Fetch actionable items when expanding
        fetchActionableItems(featureId);
        return [...prev, featureId];
      }
    });
  };

  /**
   * Analyzes features for duplicates and similarities
   */
  const duplicateAnalysis = useMemo(() => {
    if (!features.length) return new Map<string, DuplicateInfo>();
    
    const analysis = new Map<string, DuplicateInfo>();
    
    features.forEach((feature, index) => {
      const duplicates: Feature[] = [];
      let exactMatch = false;
      
      // Compare with all other features
      features.forEach((otherFeature, otherIndex) => {
        if (index === otherIndex) return;
        
        const nameMatch = feature.name.toLowerCase().trim() === otherFeature.name.toLowerCase().trim();
        const descMatch = feature.description?.toLowerCase().trim() === otherFeature.description?.toLowerCase().trim();
        
        // Check for exact duplicates (same name OR same description)
        if (nameMatch || (descMatch && feature.description && otherFeature.description)) {
          duplicates.push(otherFeature);
          exactMatch = true;
        }
        // Check for similar features (containing similar keywords)
        else {
          const featureWords = feature.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const otherWords = otherFeature.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          
          const commonWords = featureWords.filter(word => otherWords.includes(word));
          
          // If more than 50% of significant words match, consider it similar
          if (featureWords.length > 0 && commonWords.length / featureWords.length > 0.5) {
            duplicates.push(otherFeature);
          }
        }
      });
      
      analysis.set(feature.id, {
        isDuplicate: duplicates.length > 0,
        duplicateCount: duplicates.length,
        duplicateFeatures: duplicates,
        similarityType: exactMatch ? 'exact' : duplicates.length > 0 ? 'similar' : 'none'
      });
    });
    
    return analysis;
  }, [features]);

  /**
   * Gets total duplicate statistics
   */
  const duplicateStats = useMemo(() => {
    const exactDuplicates = Array.from(duplicateAnalysis.values()).filter(d => d.similarityType === 'exact');
    const similarFeatures = Array.from(duplicateAnalysis.values()).filter(d => d.similarityType === 'similar');
    
    return {
      totalExact: exactDuplicates.length,
      totalSimilar: similarFeatures.length,
      totalWithDuplicates: Array.from(duplicateAnalysis.values()).filter(d => d.isDuplicate).length
    };
  }, [duplicateAnalysis]);

  /**
   * Handles clicking on a feature item to open the planning dialog.
   * @param feature
   */
  const handleFeatureClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setDialogOpen(true);
  };

  /**
   * Handles creating a new feature item
   */
  const handleCreateNewItem = () => {
    setSelectedFeature(null);
    setDialogOpen(true);
  };

  /**
   * Copies LLM help form to clipboard for feature discussion
   */
  const handleCopyLLMForm = async () => {
    const llmHelpForm = `# Feature Development Discussion Form

## 🎯 Feature Overview
**What feature do you want to build?**
[Describe the feature in one sentence]

**What problem does this solve?**
[Explain the user problem or business need]

## 👥 User Context
**Who will use this feature?**
[Target users: Property managers, Tenants, Board members, etc.]

**How will they use it?**
[Describe the user's workflow and interaction]

## 📋 Requirements
**What should this feature do? (List 3-5 key capabilities)**
1. 
2. 
3. 
4. 
5. 

**What should this feature NOT do? (Any constraints or boundaries)**
- 
- 
- 

## 🔧 Technical Considerations
**Does this feature need to:**
- [ ] Store new data in the database?
- [ ] Integrate with external APIs?
- [ ] Work on mobile devices?
- [ ] Support Quebec French language?
- [ ] Meet accessibility requirements?
- [ ] Handle file uploads/downloads?
- [ ] Send notifications?

**Any existing features this should connect to?**
[List related features or integrations]

## 📊 Success Criteria
**How will we know this feature is successful?**
[Measurable outcomes or user feedback]

**What's the priority level?**
[ ] Critical (must have immediately)
[ ] High (needed soon)
[ ] Medium (would be nice to have)
[ ] Low (future consideration)

## 💭 Additional Context
**Any examples or references?**
[Screenshots, competitor examples, or inspiration]

**Special Quebec/Law 25 considerations?**
[Privacy, language, or compliance requirements]

---
**Instructions for LLM:** Use this form to discuss and refine the feature requirements. Ask clarifying questions about unclear sections and help develop a comprehensive feature specification.`;

    try {
      await navigator.clipboard.writeText(llmHelpForm);
      toast({
        title: 'LLM Help Form Copied',
        description: 'The feature discussion form has been copied to your clipboard. Use it with any LLM tool to refine your feature requirements.',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy the form to clipboard.',
        variant: 'destructive',
      });
    }
  };

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
      features: groupedFeatures['Website'] || [],
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className='w-4 h-4 text-green-600' />;
      case 'in-progress':
        return <Clock className='w-4 h-4 text-blue-600' />;
      case 'planned':
        return <Circle className='w-4 h-4 text-gray-400' />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className='bg-green-100 text-green-800 hover:bg-green-100'>Completed</Badge>;
      case 'in-progress':
        return <Badge className='bg-blue-100 text-blue-800 hover:bg-blue-100'>In Progress</Badge>;
      case 'planned':
        return <Badge className='bg-gray-100 text-gray-800 hover:bg-gray-100'>Planned</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) {
      return null;
    }
    switch (priority) {
      case 'high':
        return (
          <Badge className='bg-red-100 text-red-800 hover:bg-red-100 ml-2'>High Priority</Badge>
        );
      case 'medium':
        return (
          <Badge className='bg-yellow-100 text-yellow-800 hover:bg-yellow-100 ml-2'>Medium</Badge>
        );
      case 'low':
        return <Badge className='bg-gray-100 text-gray-600 hover:bg-gray-100 ml-2'>Low</Badge>;
      default:
        return null;
    }
  };

  /**
   * Gets duplicate badge for a feature
   */
  const getDuplicateBadge = (featureId: string) => {
    const dupInfo = duplicateAnalysis.get(featureId);
    if (!dupInfo || !dupInfo.isDuplicate) return null;
    
    if (dupInfo.similarityType === 'exact') {
      return (
        <Badge className='bg-red-100 text-red-800 hover:bg-red-100 ml-2 flex items-center gap-1'>
          <AlertTriangle className='h-3 w-3' />
          Exact Duplicate ({dupInfo.duplicateCount})
        </Badge>
      );
    } else {
      return (
        <Badge className='bg-orange-100 text-orange-800 hover:bg-orange-100 ml-2 flex items-center gap-1'>
          <Copy className='h-3 w-3' />
          Similar ({dupInfo.duplicateCount})
        </Badge>
      );
    }
  };

  /**
   * Gets duplicate note text for a feature
   */
  const getDuplicateNote = (featureId: string) => {
    const dupInfo = duplicateAnalysis.get(featureId);
    if (!dupInfo || !dupInfo.isDuplicate) return null;
    
    const duplicateNames = dupInfo.duplicateFeatures.map(f => f.name).join(', ');
    
    if (dupInfo.similarityType === 'exact') {
      return `⚠️ This feature has ${dupInfo.duplicateCount} exact ${dupInfo.duplicateCount === 1 ? 'duplicate' : 'duplicates'}: ${duplicateNames}`;
    } else {
      return `📋 This feature is similar to ${dupInfo.duplicateCount} other ${dupInfo.duplicateCount === 1 ? 'feature' : 'features'}: ${duplicateNames}`;
    }
  };

  /**
   * Gets status icon for actionable items
   */
  const getActionableItemStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className='w-3 h-3 text-green-600' />;
      case 'in-progress':
        return <Clock className='w-3 h-3 text-blue-600' />;
      case 'blocked':
        return <AlertTriangle className='w-3 h-3 text-red-600' />;
      case 'pending':
      default:
        return <Circle className='w-3 h-3 text-gray-400' />;
    }
  };

  /**
   * Gets status badge for actionable items
   */
  const getActionableItemStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className='bg-green-100 text-green-800 hover:bg-green-100 text-xs'>Done</Badge>;
      case 'in-progress':
        return <Badge className='bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs'>Working</Badge>;
      case 'blocked':
        return <Badge className='bg-red-100 text-red-800 hover:bg-red-100 text-xs'>Blocked</Badge>;
      case 'pending':
      default:
        return <Badge className='bg-gray-100 text-gray-800 hover:bg-gray-100 text-xs'>Todo</Badge>;
    }
  };

  const calculateProgress = (features: Feature[]) => {
    const completed = features.filter((f) => f.status === 'completed').length;
    const inProgress = features.filter((f) => f.status === 'in-progress').length;
    const total = features.length;
    const progress = ((completed + inProgress * 0.5) / total) * 100;
    return {
      completed,
      inProgress,
      planned: features.filter((f) => f.status === 'planned').length,
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

      {/* Refresh Command */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>npm run validate</code>
          </div>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
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
                <div className='text-2xl font-bold text-red-600'>
                  {duplicateStats.totalExact}
                </div>
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
            type="multiple"
            value={expandedSections}
            onValueChange={setExpandedSections}
            className="space-y-4"
          >
            {sections.map((section) => {
              const SectionIcon = section.icon;
              const stats = calculateProgress(section.features);

              return (
                <AccordionItem key={section.title} value={section.title} className="border rounded-lg overflow-hidden">
                  <AccordionTrigger className="hover:no-underline">
                    <Card className='w-full shadow-none border-none'>
                      <CardHeader className='bg-gray-50'>
                        <div className='flex items-start justify-between'>
                          <div className='flex items-start space-x-3'>
                            <div className='w-10 h-10 bg-koveo-navy rounded-lg flex items-center justify-center'>
                              <SectionIcon className='w-5 h-5 text-white' />
                            </div>
                            <div>
                              <CardTitle className='text-lg text-left'>{section.title}</CardTitle>
                              <CardDescription className='mt-1 text-left'>{section.description}</CardDescription>
                            </div>
                          </div>
                          <div className='text-right'>
                            <div className='text-2xl font-bold text-koveo-navy'>{stats.progress}%</div>
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
                              variant="outline" 
                              size="sm" 
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
                            const isExpanded = expandedFeatures.includes(feature.id || feature.name);
                            const items = actionableItems[feature.id || feature.name] || [];
                            
                            return (
                              <div key={feature.id || feature.name} className='border-l-4 border-transparent hover:border-blue-400'>
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
                                        {getDuplicateBadge(feature.id || feature.name)}
                                        {items.length > 0 && (
                                          <Badge className='bg-purple-100 text-purple-800 hover:bg-purple-100 ml-2 text-xs'>
                                            <ListTodo className='w-3 h-3 mr-1' />
                                            {items.length} {items.length === 1 ? 'task' : 'tasks'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className='text-sm text-gray-600 mt-1'>{feature.description}</p>
                                      {getDuplicateNote(feature.id || feature.name) && (
                                        <div className='mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800'>
                                          {getDuplicateNote(feature.id || feature.name)}
                                        </div>
                                      )}
                                      <p className='text-xs text-blue-600 mt-2 font-medium'>Click name to plan development →</p>
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
                                        <span className='text-xs'>Generate a development prompt to create tasks.</span>
                                      </div>
                                    ) : (
                                      <div className='divide-y divide-gray-200'>
                                        {items.map((item, index) => (
                                          <div key={item.id || index} className='p-3 pl-12 hover:bg-white transition-colors'>
                                            <div className='flex items-start space-x-3'>
                                              {getActionableItemStatusIcon(item.status)}
                                              <div className='flex-1'>
                                                <div className='flex items-center space-x-2'>
                                                  <span className='text-sm font-medium text-gray-900'>{item.title}</span>
                                                  {getActionableItemStatusBadge(item.status)}
                                                  {item.estimatedEffort && (
                                                    <Badge variant='outline' className='text-xs'>
                                                      {item.estimatedEffort}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <p className='text-xs text-gray-600 mt-1'>{item.description}</p>
                                                {item.technicalDetails && (
                                                  <p className='text-xs text-gray-500 mt-1'>
                                                    <strong>Technical:</strong> {item.technicalDetails}
                                                  </p>
                                                )}
                                                {item.implementationPrompt && (
                                                  <div className='mt-2 p-2 bg-blue-50 border border-blue-200 rounded'>
                                                    <div className='flex items-start justify-between'>
                                                      <div className='flex-1'>
                                                        <p className='text-xs font-medium text-blue-900 mb-1'>Replit AI Agent Prompt:</p>
                                                        <p className='text-xs text-blue-800 whitespace-pre-wrap font-mono'>
                                                          {item.implementationPrompt}
                                                        </p>
                                                      </div>
                                                      <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        className='ml-2 h-6 px-2'
                                                        onClick={() => handleCopyPrompt(item.implementationPrompt)}
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

      <FeatureForm
        feature={selectedFeature}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
