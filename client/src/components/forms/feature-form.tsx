import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Copy, FileText, Zap, Save, Clock, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Feature } from '@shared/schema';

/**
 * Props for the FeatureForm component.
 */
interface FeatureFormProps {
  feature: Feature | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

/**
 * Reusable form dialog component for planning feature development.
 * Collects detailed requirements and generates development prompts.
 * Located in forms directory for easy reuse across the application.
 * @param root0 - Component props.
 * @param root0.feature - The feature to edit, null for new features.
 * @param root0.open - Dialog open state.
 * @param root0.onOpenChange - Callback to handle dialog open state changes.
 * @returns Feature form dialog component.
 */
/**
 * FeatureForm function.
 * @param root0
 * @param root0.feature
 * @param root0.open
 * @param root0.onOpenChange
 * @returns Function result.
 */
export function FeatureForm({ feature, open, onOpenChange }: FeatureFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation to create feature in roadmap
  const createFeatureMutation = useMutation({
    mutationFn: async (featureData: {
      name: string;
      description: string;
      category: string;
      status?: string;
      priority?: string;
      businessObjective?: string;
      targetUsers?: string;
      successMetrics?: string;
      technicalComplexity?: string;
      dependencies?: string;
      userFlow?: string;
    }) => {
      const response = await fetch('/api/features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(featureData),
      });

      if (!response.ok) {
        throw new Error('Failed to create feature');
      }

      return response.json();
    },
    onSuccess: (newFeature) => {
      // Invalidate queries to refresh roadmap data
      queryClient.invalidateQueries({ queryKey: ['/api/features'] });

      toast({
        title: 'Feature Integrated',
        description: `"${newFeature.name}" has been successfully added to the roadmap.`,
      });

      // Close the dialog
      handleClose(false);
    },
      toast({
        title: 'Integration Failed',
        description: 'Failed to add the feature to the roadmap. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Mutation to save generated prompt as actionable item
  const savePromptMutation = useMutation({
    mutationFn: async ({
      featureId,
      prompt,
      title,
    }: {
      featureId: string;
      prompt: string;
      title: string;
    }) => {
      const response = await fetch(`/api/features/${featureId}/actionable-items/from-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          title,
          description: 'AI-generated development prompt',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save prompt as actionable item');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      if (feature?.id) {
        queryClient.invalidateQueries({
          queryKey: [`/api/features/${feature.id}/actionable-items`],
        });
      }

      toast({
        title: 'Prompt Saved',
        description: 'The development prompt has been saved as an actionable item.',
      });
    },
      toast({
        title: 'Save Failed',
        description: 'Failed to save the prompt as an actionable item.',
        variant: 'destructive',
      });
    },
  });
  const [formData, setFormData] = useState({
    // New feature fields
    featureName: '',
    featureCategory: 'Compliance & Security', // Default to a valid category
    featureDescription: '',
    isStrategicPath: false,

    // General questions
    businessObjective: '',
    targetUsers: '',
    successMetrics: '',
    priority: '',
    timeline: '',

    // Technical questions
    complexity: '',
    dependencies: '',
    dataRequirements: '',
    integrationNeeds: '',
    securityConsiderations: '',

    // User experience questions
    userFlow: '',
    uiRequirements: '',
    accessibilityNeeds: '',

    // Additional requirements
    performanceRequirements: '',
    testingStrategy: '',
    additionalNotes: '',

    // RBAC requirements
    rbacRequired: false,
    rbacRoles: {
      admin: { read: true, write: true, organizationalLimitation: '' },
      manager: { read: true, write: true, organizationalLimitation: '' },
      owner: { read: true, write: false, organizationalLimitation: '' },
      tenant: { read: false, write: false, organizationalLimitation: '' },
    },
  });

  const [step, setStep] = useState<'form' | 'prompt'>('form');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  /**
   * Gets the localStorage key for drafts.
   * @returns The localStorage key for feature drafts.
   */
  const getDraftKey = useCallback(() => {
    const baseKey = 'koveo-feature-draft';
    return feature?.id ? `${baseKey}-${feature.id}` : `${baseKey}-new`;
  }, [feature?.id]);

  /**
   * Saves form data to localStorage.
   */
  const saveDraft = useCallback(() => {
    try {
      const draftData = {
        formData,
        timestamp: new Date().toISOString(),
        featureId: feature?.id || null,
      };
      window.localStorage.setItem(getDraftKey(), JSON.stringify(draftData));
      setLastSaved(new Date());
      setIsDirty(false);

      toast({
        title: 'Draft Saved',
        description: 'Your progress has been automatically saved.',
        duration: 2000,
      });
    }
  }, [formData, feature?.id, toast, getDraftKey]);

  /**
   * Loads draft from localStorage.
   */
  const loadDraft = useCallback(() => {
    try {
      const savedDraft = window.localStorage.getItem(getDraftKey());
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft);
        const formData = draftData.formData;

        // Fix invalid category if it exists
        if (formData.featureCategory === 'Strategic Path') {
          formData.featureCategory = 'Compliance & Security';
        }

        setFormData(formData);
        setLastSaved(new Date(draftData.timestamp));
        setIsDirty(false);
      }
    }
  }, [feature?.id, getDraftKey]);

  /**
   * Clears the saved draft.
   */
  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(getDraftKey());
      setLastSaved(null);
      setIsDirty(false);

      toast({
        title: 'Draft Cleared',
        description: 'Saved draft has been removed.',
      });
    }
  }, [feature?.id, toast, getDraftKey]);

  /**
   * Updates form data when input values change.
   * @param field - The form field to update.
   * @param value - The new value for the field.
   * @param _value
   */
  const updateFormData = (field: string, value: string | boolean | unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  /**
   * Generates a comprehensive development prompt based on the collected requirements.
   */
  const generatePrompt = () => {
    const featureName = feature?.name || formData.featureName || 'New Feature';
    const featureCategory = feature?.category || formData.featureCategory || 'Not specified';
    const featureStatus = feature?.status || 'submitted';
    const featurePriority = formData.priority || feature?.priority || 'Medium';
    const featureDescription =
      feature?.description || formData.featureDescription || 'Feature description not provided';

    const prompt = `# Feature Development Request: ${featureName}

## 🎯 Overview
**Category:** ${featureCategory}
**Current Status:** ${featureStatus}
**Priority:** ${featurePriority}
**Description:** ${featureDescription}

## 📋 Business Requirements

### Business Objective
${formData.businessObjective || 'Not specified'}

### Target Users
${formData.targetUsers || 'All system users'}

### Success Metrics
${formData.successMetrics || 'Feature completion and user adoption'}

### Timeline
${formData.timeline || 'Standard development timeline'}

## 🔧 Technical Requirements

### Complexity Assessment
${formData.complexity || 'Medium complexity'}

### Dependencies
${formData.dependencies || 'None specified'}

### Data Requirements
${formData.dataRequirements || 'Standard data handling'}

### Integration Needs
${formData.integrationNeeds || 'Standard system integration'}

### Security Considerations
${formData.securityConsiderations || 'Follow standard security practices'}

${
  formData.rbacRequired
    ? `
### Role-Based Access Control (RBAC)
**RBAC Required:** Yes

**Role Permissions:**
${Object.entries(formData.rbacRoles)
  .filter(([_, permissions]) => permissions.read || permissions.write)
  .map(([role, permissions]) => {
    const accessTypes = [];
    if (permissions.read) {
      accessTypes.push('Read');
    }
    if (permissions.write) {
      accessTypes.push('Write');
    }
    const orgLimit = permissions.organizationalLimitation
      ? ` (${permissions.organizationalLimitation})`
      : '';
    return `- **${role.replace('_', ' ').toUpperCase()}**: ${accessTypes.join(', ')} access${orgLimit}`;
  })
  .join('\n')}

**Implementation Notes:**
- Use the existing RBAC system in server/auth.ts with requireAuth and authorize middleware
- Apply role-based query scoping using the functions in server/db/queries/scope-query.ts
- Ensure all API endpoints check permissions using the authorize('permission:action') middleware
- Follow the established patterns in config/permissions.json for permission naming
`
    : ''
}

## 👤 User Experience Requirements

### User Flow
${formData.userFlow || 'Standard user interaction pattern'}

### UI Requirements
${formData.uiRequirements || 'Follow existing design system (shadcn/ui)'}

### Accessibility Needs
${formData.accessibilityNeeds || 'WCAG 2.1 AA compliance required'}

## ⚡ Performance & Quality Requirements

### Performance Requirements
${formData.performanceRequirements || 'Standard performance expectations'}

### Testing Strategy
${formData.testingStrategy || 'Unit tests, integration tests, and manual testing'}

## 📝 Implementation Guidelines

**CRITICAL: This feature must be implemented with the highest standards of quality, maintainability, and best practices.**

### Code Quality Standards
- Follow TypeScript strict mode and maintain 100% type safety
- Implement comprehensive error handling and user feedback
- Use consistent naming conventions and clear, self-documenting code
- Add thorough JSDoc comments for all exported functions and interfaces
- Maintain test coverage above 90% for all new code

### Architecture & Design Patterns
- Follow the existing project architecture (React + Express + PostgreSQL + Drizzle ORM)
- Use established patterns: React Query for data fetching, Zod for validation
- Implement proper separation of concerns (UI components, business logic, data layer)
- Follow SOLID principles and avoid code duplication
- Use composition over inheritance where applicable

### User Interface Standards
- Use the established shadcn/ui component system exclusively
- Ensure responsive design works on all screen sizes (mobile, tablet, desktop)
- Follow the existing design tokens and color scheme
- Implement proper loading states, error states, and empty states
- Add appropriate micro-interactions and transitions

### Database & Backend Standards
- Create proper database migrations using Drizzle Kit
- Implement input validation on both client and server sides using Zod schemas
- Follow RESTful API conventions and proper HTTP status codes
- Add comprehensive error handling and logging
- Ensure proper data relationships and foreign key constraints

### Security & Performance
- Implement proper authentication and authorization checks
- Sanitize all user inputs to prevent XSS and injection attacks
- Use prepared statements and parameterized queries
- Optimize database queries and add proper indexing
- Implement caching strategies where appropriate

### Testing Requirements
- Write unit tests for all business logic and utility functions
- Add integration tests for API endpoints and database operations
- Include component tests for React components with user interactions
- Test error scenarios and edge cases thoroughly
- Add end-to-end tests for critical user flows

### Documentation & Maintenance
- Update the project's replit.md file with any architectural changes
- Add inline comments explaining complex business logic
- Create clear commit messages following conventional commit format
- Ensure backward compatibility unless explicitly requested otherwise

## 🚀 Additional Notes
${formData.additionalNotes || 'No additional notes'}

## ✅ Definition of Done
- [ ] Feature implemented following all quality standards above
- [ ] All tests pass with >90% coverage for new code
- [ ] Code review completed and approved
- [ ] Documentation updated (JSDoc, inline comments, replit.md if needed)
- [ ] Manual testing completed across different devices and browsers
- [ ] Performance benchmarks meet requirements
- [ ] Security review completed
- [ ] Feature deployed and working in production environment

**Remember: Quality and maintainability are more important than speed. Take the time to implement this feature properly, following all established patterns and best practices in the Koveo Gestion codebase.**`;

    setGeneratedPrompt(prompt);
    setStep('prompt');

    // Save prompt as actionable item if we have a feature ID
    if (feature?.id) {
      savePromptMutation.mutate({
        featureId: feature.id,
        prompt,
        title: `Development Prompt: ${featureName}`,
      });
    }
  };

  /**
   * Copies the generated prompt to clipboard.
   */
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast({
        title: 'Prompt Copied',
        description: 'The development prompt has been copied to your clipboard.',
      });
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy prompt to clipboard.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Handles integrating the feature into the roadmap.
   */
  const integrateToRoadmap = () => {
    if (isNewFeature) {
      // For new features, create them in the roadmap with minimal required data
      const featureData = {
        name: formData.featureName,
        description: formData.featureDescription || `Feature: ${formData.featureName}`, // Default description
        category: formData.featureCategory || 'Compliance & Security', // Default category
        status: 'submitted' as const,
        priority: (formData.priority || 'medium') as 'low' | 'medium' | 'high',
        businessObjective: formData.businessObjective || undefined,
        targetUsers: formData.targetUsers || undefined,
        successMetrics: formData.successMetrics || undefined,
        technicalComplexity: formData.complexity || undefined,
        dependencies: formData.dependencies || undefined,
        userFlow: formData.userFlow || undefined,
        isStrategicPath: formData.isStrategicPath,
      };

      createFeatureMutation.mutate(featureData);
    } else {
      // For existing features, just close the dialog
      // (they're already in the roadmap)
      toast({
        title: 'Feature Already in Roadmap',
        description: 'This feature is already part of the roadmap.',
      });
      handleClose(false);
    }
  };

  /**
   * Resets the dialog to initial state.
   */
  const resetDialog = () => {
    setStep('form');
    setFormData({
      featureName: '',
      featureCategory: 'Compliance & Security', // Default to a valid category
      featureDescription: '',
      isStrategicPath: false,
      businessObjective: '',
      targetUsers: '',
      successMetrics: '',
      priority: '',
      timeline: '',
      complexity: '',
      dependencies: '',
      dataRequirements: '',
      integrationNeeds: '',
      securityConsiderations: '',
      userFlow: '',
      uiRequirements: '',
      accessibilityNeeds: '',
      performanceRequirements: '',
      testingStrategy: '',
      additionalNotes: '',
      rbacRequired: false,
      rbacRoles: {
        admin: { read: true, write: true, organizationalLimitation: '' },
        manager: { read: true, write: true, organizationalLimitation: '' },
        owner: { read: true, write: false, organizationalLimitation: '' },
        tenant: { read: false, write: false, organizationalLimitation: '' },
      },
    });
    setGeneratedPrompt('');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      if (isDirty) {
        // Save draft before closing if there are unsaved changes
        saveDraft();
      }
      resetDialog();
    }
    onOpenChange(open);
  };

  // Auto-save effect - saves after 3 seconds of inactivity
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const timer = setTimeout(() => {
      saveDraft();
    }, 3000);

    return () => clearTimeout(timer);
  }, [formData, isDirty, saveDraft]);

  // Clear invalid drafts and load draft when form opens
  useEffect(() => {
    if (open) {
      // Clear any drafts with invalid "Strategic Path" category
      try {
        const allKeys = Object.keys(window.localStorage);
        const draftKeys = allKeys.filter((key) => key.startsWith('koveo-feature-draft'));

        draftKeys.forEach((key) => {
          try {
            const draftData = JSON.parse(window.localStorage.getItem(key) || '{}');
            if (draftData.formData?.featureCategory === 'Strategic Path') {
              window.localStorage.removeItem(key);
            }
            // Invalid JSON, remove it
            window.localStorage.removeItem(key);
          }
        });
      }

      loadDraft();
    }
  }, [open, loadDraft]);

  const isNewFeature = !feature;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <DialogTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              {step === 'form'
                ? isNewFeature
                  ? 'Create New Feature'
                  : 'Plan Feature Development'
                : 'Generated Development Prompt'}
            </DialogTitle>

            {step === 'form' && (
              <div className='flex items-center gap-2'>
                {lastSaved && (
                  <div className='flex items-center gap-1 text-xs text-gray-500'>
                    <Clock className='h-3 w-3' />
                    Saved {lastSaved.toLocaleTimeString()}
                  </div>
                )}

                {lastSaved && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={clearDraft}
                    className='text-xs text-red-600 hover:text-red-700'
                  >
                    <Trash2 className='h-3 w-3' />
                  </Button>
                )}
              </div>
            )}
          </div>

          {isDirty && step === 'form' && (
            <div className='flex items-center gap-1 text-xs text-amber-600 mt-1'>
              <Clock className='h-3 w-3' />
              Auto-saving in progress...
            </div>
          )}
        </DialogHeader>

        {step === 'form' ? (
          <div className='space-y-6'>
            {/* Feature Info */}
            {!isNewFeature && (
              <div className='bg-gray-50 p-4 rounded-lg'>
                <h3 className='font-semibold text-lg mb-2'>{feature.name}</h3>
                <p className='text-sm text-gray-600 mb-2'>{feature.description}</p>
                <div className='flex gap-2'>
                  <Badge variant='outline'>{feature.category}</Badge>
                  <Badge variant={feature.status === 'completed' ? 'default' : 'secondary'}>
                    {feature.status}
                  </Badge>
                  {feature.priority && (
                    <Badge variant={feature.priority === 'high' ? 'destructive' : 'secondary'}>
                      {feature.priority}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* New Feature Fields */}
            {isNewFeature && (
              <div className='space-y-4 bg-blue-50 p-4 rounded-lg'>
                <h3 className='text-lg font-semibold'>New Feature Details</h3>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='featureName'>Feature Name *</Label>
                    <Input
                      id='featureName'
                      placeholder='Enter feature name'
                      value={formData.featureName || ''}
                      onChange={(e) => updateFormData('featureName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor='featureCategory'>Category</Label>
                    <Select
                      value={formData.featureCategory || ''}
                      onValueChange={(_value: string) => updateFormData('featureCategory', _value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select category' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='Dashboard & Home'>Dashboard & Home</SelectItem>
                        <SelectItem value='Property Management'>Property Management</SelectItem>
                        <SelectItem value='Resident Management'>Resident Management</SelectItem>
                        <SelectItem value='Financial Management'>Financial Management</SelectItem>
                        <SelectItem value='Maintenance & Requests'>
                          Maintenance & Requests
                        </SelectItem>
                        <SelectItem value='Document Management'>Document Management</SelectItem>
                        <SelectItem value='Communication'>Communication</SelectItem>
                        <SelectItem value='AI & Automation'>AI & Automation</SelectItem>
                        <SelectItem value='Compliance & Security'>Compliance & Security</SelectItem>
                        <SelectItem value='Analytics & Reporting'>Analytics & Reporting</SelectItem>
                        <SelectItem value='Integration & API'>Integration & API</SelectItem>
                        <SelectItem value='Infrastructure & Performance'>
                          Infrastructure & Performance
                        </SelectItem>
                        <SelectItem value='Website'>Website</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor='featureDescription'>Feature Description</Label>
                  <Textarea
                    id='featureDescription'
                    placeholder='Describe what this feature will do'
                    value={formData.featureDescription || ''}
                    onChange={(e) => updateFormData('featureDescription', e.target.value)}
                  />
                </div>

                {/* Strategic Path Toggle */}
                <div className='flex items-center gap-3 pt-2'>
                  <Label htmlFor='strategic-path' className='text-sm font-medium'>
                    Strategic Path:
                  </Label>
                  <Switch
                    id='strategic-path'
                    checked={formData.isStrategicPath}
                    onCheckedChange={(checked: boolean) =>
                      updateFormData('isStrategicPath', checked)
                    }
                    className='scale-90'
                  />
                  <span className='text-xs text-gray-500'>
                    Mark this feature as part of the strategic roadmap
                  </span>
                </div>
              </div>
            )}

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* Business Requirements */}
              <div className='space-y-4'>
                <h3 className='text-lg font-semibold'>Business Requirements</h3>

                <div>
                  <Label htmlFor='businessObjective'>Business Objective *</Label>
                  <Textarea
                    id='businessObjective'
                    placeholder='What problem does this feature solve? What business value does it provide?'
                    value={formData.businessObjective}
                    onChange={(e) => updateFormData('businessObjective', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='targetUsers'>Target Users *</Label>
                  <Input
                    id='targetUsers'
                    placeholder='e.g., Property managers, Tenants, Owners'
                    value={formData.targetUsers}
                    onChange={(e) => updateFormData('targetUsers', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='successMetrics'>Success Metrics</Label>
                  <Textarea
                    id='successMetrics'
                    placeholder='How will we measure success? What are the KPIs?'
                    value={formData.successMetrics}
                    onChange={(e) => updateFormData('successMetrics', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='priority'>Development Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(_value: string) => updateFormData('priority', _value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select priority level' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='critical'>Critical</SelectItem>
                      <SelectItem value='high'>High</SelectItem>
                      <SelectItem value='medium'>Medium</SelectItem>
                      <SelectItem value='low'>Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor='timeline'>Expected Timeline</Label>
                  <Input
                    id='timeline'
                    placeholder='e.g., 2 weeks, 1 month, Next sprint'
                    value={formData.timeline}
                    onChange={(e) => updateFormData('timeline', e.target.value)}
                  />
                </div>
              </div>

              {/* Technical Requirements */}
              <div className='space-y-4'>
                <h3 className='text-lg font-semibold'>Technical Requirements</h3>

                <div>
                  <Label htmlFor='complexity'>Complexity Assessment</Label>
                  <Select
                    value={formData.complexity}
                    onValueChange={(_value: string) => updateFormData('complexity', _value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Assess technical complexity' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='simple'>Simple (1-3 days)</SelectItem>
                      <SelectItem value='medium'>Medium (1-2 weeks)</SelectItem>
                      <SelectItem value='complex'>Complex (2-4 weeks)</SelectItem>
                      <SelectItem value='very-complex'>Very Complex (1+ months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor='dependencies'>Dependencies</Label>
                  <Textarea
                    id='dependencies'
                    placeholder='What other features, APIs, or systems does this depend on?'
                    value={formData.dependencies}
                    onChange={(e) => updateFormData('dependencies', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='dataRequirements'>Data Requirements</Label>
                  <Textarea
                    id='dataRequirements'
                    placeholder='What data needs to be stored, modified, or accessed?'
                    value={formData.dataRequirements}
                    onChange={(e) => updateFormData('dataRequirements', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='integrationNeeds'>Integration Needs</Label>
                  <Textarea
                    id='integrationNeeds'
                    placeholder='External APIs, services, or third-party integrations needed'
                    value={formData.integrationNeeds}
                    onChange={(e) => updateFormData('integrationNeeds', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='securityConsiderations'>Security Considerations</Label>
                  <Textarea
                    id='securityConsiderations'
                    placeholder='Authentication, authorization, data privacy concerns'
                    value={formData.securityConsiderations}
                    onChange={(e) => updateFormData('securityConsiderations', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* User Experience Section */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>User Experience</h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='userFlow'>User Flow *</Label>
                  <Textarea
                    id='userFlow'
                    placeholder='Describe the step-by-step user interaction with this feature'
                    value={formData.userFlow}
                    onChange={(e) => updateFormData('userFlow', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='uiRequirements'>UI Requirements</Label>
                  <Textarea
                    id='uiRequirements'
                    placeholder='Specific UI components, layouts, or visual requirements'
                    value={formData.uiRequirements}
                    onChange={(e) => updateFormData('uiRequirements', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor='accessibilityNeeds'>Accessibility Needs</Label>
                <Input
                  id='accessibilityNeeds'
                  placeholder='Screen reader support, keyboard navigation, color contrast'
                  value={formData.accessibilityNeeds}
                  onChange={(e) => updateFormData('accessibilityNeeds', e.target.value)}
                />
              </div>
            </div>

            {/* Quality & Performance Section */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Quality & Performance</h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='performanceRequirements'>Performance Requirements</Label>
                  <Textarea
                    id='performanceRequirements'
                    placeholder='Load times, data processing speed, scalability needs'
                    value={formData.performanceRequirements}
                    onChange={(e) => updateFormData('performanceRequirements', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor='testingStrategy'>Testing Strategy</Label>
                  <Textarea
                    id='testingStrategy'
                    placeholder='Unit tests, integration tests, user acceptance criteria'
                    value={formData.testingStrategy}
                    onChange={(e) => updateFormData('testingStrategy', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* RBAC Requirements Section */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Role-Based Access Control (RBAC)</h3>

              <div className='flex items-center gap-3'>
                <Label htmlFor='rbacRequired' className='text-sm font-medium'>
                  Does this feature require RBAC?
                </Label>
                <Switch
                  id='rbacRequired'
                  checked={formData.rbacRequired}
                  onCheckedChange={(checked: boolean) => updateFormData('rbacRequired', checked)}
                />
                <span className='text-xs text-gray-500'>
                  Enable role-based access control for this feature
                </span>
              </div>

              {formData.rbacRequired && (
                <div className='bg-yellow-50 p-4 rounded-lg space-y-4'>
                  <h4 className='font-medium text-yellow-800'>Configure Role Permissions</h4>
                  <p className='text-sm text-yellow-700'>
                    For each role, specify read/write permissions and organizational limitations.
                  </p>

                  {Object.entries(formData.rbacRoles).map(([role, permissions]) => (
                    <div key={role} className='bg-white p-3 rounded border'>
                      <div className='flex items-center justify-between mb-2'>
                        <h5 className='font-medium capitalize text-gray-900'>
                          {role.replace('_', ' ')}
                        </h5>
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                        <div className='flex items-center gap-2'>
                          <input
                            type='checkbox'
                            id={`${role}-read`}
                            checked={permissions.read}
                            onChange={(e) => {
                              const newRoles = { ...formData.rbacRoles };
                              newRoles[role as keyof typeof formData.rbacRoles].read =
                                e.target.checked;
                              updateFormData('rbacRoles', newRoles);
                            }}
                            className='rounded'
                          />
                          <Label htmlFor={`${role}-read`} className='text-sm'>
                            Read Access
                          </Label>
                        </div>

                        <div className='flex items-center gap-2'>
                          <input
                            type='checkbox'
                            id={`${role}-write`}
                            checked={permissions.write}
                            onChange={(e) => {
                              const newRoles = { ...formData.rbacRoles };
                              newRoles[role as keyof typeof formData.rbacRoles].write =
                                e.target.checked;
                              updateFormData('rbacRoles', newRoles);
                            }}
                            className='rounded'
                          />
                          <Label htmlFor={`${role}-write`} className='text-sm'>
                            Write Access
                          </Label>
                        </div>

                        <div>
                          <Input
                            placeholder='Organizational limitations'
                            value={permissions.organizationalLimitation}
                            onChange={(e) => {
                              const newRoles = { ...formData.rbacRoles };
                              newRoles[
                                role as keyof typeof formData.rbacRoles
                              ].organizationalLimitation = e.target.value;
                              updateFormData('rbacRoles', newRoles);
                            }}
                            className='text-xs'
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Notes */}
            <div>
              <Label htmlFor='additionalNotes'>Additional Notes</Label>
              <Textarea
                id='additionalNotes'
                placeholder='Any other requirements, constraints, or considerations'
                value={formData.additionalNotes}
                onChange={(e) => updateFormData('additionalNotes', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <div className='flex items-center justify-between mb-2'>
                <p className='text-sm text-gray-600'>
                  Generated development prompt for{' '}
                  <strong>{feature?.name || formData.featureName || 'New Feature'}</strong>
                </p>
                <div className='flex gap-2'>
                  <Button onClick={copyPrompt} size='sm' variant='outline'>
                    <Copy className='h-4 w-4 mr-1' />
                    Copy Prompt
                  </Button>

                  {feature?.id && (
                    <Button
                      onClick={() =>
                        savePromptMutation.mutate({
                          featureId: feature.id,
                          prompt: generatedPrompt,
                          title: `Development Prompt: ${feature.name}`,
                        })
                      }
                      size='sm'
                      variant='outline'
                      disabled={savePromptMutation.isPending}
                      className='bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    >
                      <Save className='h-4 w-4 mr-1' />
                      {savePromptMutation.isPending ? 'Saving...' : 'Save as Task'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className='bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto'>
              <pre className='whitespace-pre-wrap'>{generatedPrompt}</pre>
            </div>
          </div>
        )}

        <DialogFooter className='flex justify-between'>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              onClick={integrateToRoadmap}
              disabled={
                createFeatureMutation.isPending || (isNewFeature && !formData.featureName.trim())
              }
              className='bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            >
              <Plus className='h-4 w-4 mr-2' />
              {createFeatureMutation.isPending ? 'Integrating...' : 'Integrate to Roadmap'}
            </Button>

            {lastSaved && step === 'form' && (
              <Button
                variant='ghost'
                size='sm'
                onClick={clearDraft}
                className='text-red-600 hover:text-red-700'
              >
                <Trash2 className='h-4 w-4 mr-1' />
                Clear Draft
              </Button>
            )}
          </div>

          <div className='flex gap-2'>
            {step === 'form' && (
              <Button
                onClick={saveDraft}
                variant='outline'
                className='bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
              >
                <Save className='h-4 w-4 mr-2' />
                Save Progress
              </Button>
            )}

            {step === 'prompt' && (
              <Button variant='outline' onClick={() => setStep('form')}>
                Back to Form
              </Button>
            )}

            <Button
              onClick={generatePrompt}
              disabled={
                !formData.businessObjective ||
                !formData.targetUsers ||
                !formData.userFlow ||
                (isNewFeature && !formData.featureName.trim())
              }
              className='flex items-center gap-2'
            >
              <Zap className='h-4 w-4' />
              {step === 'form' ? 'Generate Prompt' : 'Regenerate'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
