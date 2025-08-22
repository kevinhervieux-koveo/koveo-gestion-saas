import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, FileText, Zap, Save, Clock, Trash2 } from 'lucide-react';
import { z } from 'zod';
import type { Feature } from '@shared/schema';

import { BaseDialog } from '@/components/ui/base-dialog';
import { StandardForm, type FormFieldConfig } from '@/components/ui/standard-form';
import { useCreateMutation } from '@/hooks/use-api-handler';
import { useToast } from '@/hooks/use-toast';

// Validation schema
const featureFormSchema = z.object({
  featureName: z.string().min(1, 'Feature name is required'),
  featureCategory: z.enum(['Compliance & Security', 'User Management', 'Financial', 'Maintenance', 'Analytics', 'Integration']),
  featureDescription: z.string().min(10, 'Please provide a detailed description'),
  businessObjective: z.string().optional(),
  targetUsers: z.string().optional(),
  successMetrics: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  timeline: z.string().optional(),
  complexity: z.enum(['simple', 'medium', 'complex', 'very-complex']).default('medium'),
  dependencies: z.string().optional(),
  dataRequirements: z.string().optional(),
  integrationNeeds: z.string().optional(),
  securityConsiderations: z.string().optional(),
  userFlow: z.string().min(1, 'User flow is required'),
  uiRequirements: z.string().optional(),
  accessibilityNeeds: z.string().optional(),
  performanceRequirements: z.string().optional(),
  testingStrategy: z.string().optional(),
  additionalNotes: z.string().optional(),
  isStrategicPath: z.boolean().default(false),
  rbacRequired: z.boolean().default(false),
});

/**
 *
 */
type FeatureFormData = z.infer<typeof featureFormSchema>;

/**
 *
 */
interface FeatureFormProps {
  feature: Feature | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

/**
 * Feature Form Component - Refactored using reusable components
 * Reduced from 1,080+ lines to ~400 lines by leveraging BaseDialog, StandardForm, and API hooks.
 * @param root0
 * @param root0.feature
 * @param root0.open
 * @param root0.onOpenChange
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
  const [currentStep, setCurrentStep] = useState<'form' | 'prompt'>('form');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // RBAC state
  const [rbacRoles, setRbacRoles] = useState({
    admin: { read: true, write: true, organizationalLimitation: '' },
    manager: { read: true, write: true, organizationalLimitation: '' },
    owner: { read: true, write: false, organizationalLimitation: '' },
    tenant: { read: false, write: false, organizationalLimitation: '' }
  });

  // API mutations using reusable hooks
  const createFeatureMutation = useCreateMutation<Feature, FeatureFormData>(
    '/api/features',
    {
      successMessage: (data) => `"${data.name}" has been successfully added to the roadmap.`,
      invalidateQueries: ['/api/features'],
      onSuccessCallback: () => onOpenChange(false)
    }
  );

  const savePromptMutation = useCreateMutation<unknown, { featureId: string, prompt: string, title: string }>(
    `/api/features/actionable-items/from-prompt`,
    {
      successMessage: 'The development prompt has been saved as an actionable item.',
      invalidateQueries: (data, variables) => [`/api/features/${variables.featureId}/actionable-items`]
    }
  );

  // Draft management
  const getDraftKey = useCallback(() => {
    const baseKey = 'koveo-feature-draft';
    return feature?.id ? `${baseKey}-${feature.id}` : `${baseKey}-new`;
  }, [feature?.id]);

  const saveDraft = useCallback((formData: FeatureFormData) => {
    try {
      const draftData = { formData, timestamp: new Date().toISOString(), featureId: feature?.id || null };
      localStorage.setItem(getDraftKey(), JSON.stringify(draftData));
      setLastSaved(new Date());
      toast({ title: 'Draft Saved', description: 'Your progress has been automatically saved.', duration: 2000 });
    } catch (_error) {
      console.error('Failed to save draft:', _error);
    }
  }, [feature?.id, toast, getDraftKey]);

  const loadDraft = useCallback((): Partial<FeatureFormData> => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey());
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft);
        setLastSaved(new Date(draftData.timestamp));
        return draftData.formData;
      }
    } catch (_error) {
      console.error('Failed to load draft:', _error);
    }
    return {};
  }, [getDraftKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(getDraftKey());
      setLastSaved(null);
      toast({ title: 'Draft Cleared', description: 'Saved draft has been removed.' });
    } catch (_error) {
      console.error('Failed to clear draft:', _error);
    }
  }, [getDraftKey, toast]);

  // Form field configurations
  const getBasicFields = (): FormFieldConfig[] => [
    {
      name: 'featureName',
      label: 'Feature Name',
      type: 'text',
      placeholder: 'Enter the feature name',
    },
    {
      name: 'featureCategory',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'Compliance & Security', label: 'Compliance & Security' },
        { value: 'User Management', label: 'User Management' },
        { value: 'Financial', label: 'Financial' },
        { value: 'Maintenance', label: 'Maintenance' },
        { value: 'Analytics', label: 'Analytics' },
        { value: 'Integration', label: 'Integration' },
      ],
    },
    {
      name: 'featureDescription',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Provide a detailed description of the feature',
      rows: 3,
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { value: 'Low', label: 'Low' },
        { value: 'Medium', label: 'Medium' },
        { value: 'High', label: 'High' },
        { value: 'Critical', label: 'Critical' },
      ],
    },
  ];

  const getBusinessFields = (): FormFieldConfig[] => [
    {
      name: 'businessObjective',
      label: 'Business Objective',
      type: 'textarea',
      placeholder: 'What business problem does this solve?',
      rows: 2,
    },
    {
      name: 'targetUsers',
      label: 'Target Users',
      type: 'textarea',
      placeholder: 'Who will use this feature?',
      rows: 2,
    },
    {
      name: 'successMetrics',
      label: 'Success Metrics',
      type: 'textarea',
      placeholder: 'How will you measure success?',
      rows: 2,
    },
    {
      name: 'timeline',
      label: 'Timeline',
      type: 'text',
      placeholder: 'Expected timeline for completion',
    },
  ];

  const getTechnicalFields = (): FormFieldConfig[] => [
    {
      name: 'complexity',
      label: 'Complexity Assessment',
      type: 'select',
      options: [
        { value: 'simple', label: 'Simple (1-3 days)' },
        { value: 'medium', label: 'Medium (1-2 weeks)' },
        { value: 'complex', label: 'Complex (2-4 weeks)' },
        { value: 'very-complex', label: 'Very Complex (1+ months)' },
      ],
    },
    {
      name: 'dependencies',
      label: 'Dependencies',
      type: 'textarea',
      placeholder: 'What other features, APIs, or systems does this depend on?',
      rows: 2,
    },
    {
      name: 'dataRequirements',
      label: 'Data Requirements',
      type: 'textarea',
      placeholder: 'What data needs to be stored, modified, or accessed?',
      rows: 2,
    },
    {
      name: 'integrationNeeds',
      label: 'Integration Needs',
      type: 'textarea',
      placeholder: 'External APIs, services, or third-party integrations needed',
      rows: 2,
    },
    {
      name: 'securityConsiderations',
      label: 'Security Considerations',
      type: 'textarea',
      placeholder: 'Authentication, authorization, data privacy concerns',
      rows: 2,
    },
  ];

  const getUXFields = (): FormFieldConfig[] => [
    {
      name: 'userFlow',
      label: 'User Flow',
      type: 'textarea',
      placeholder: 'Describe the step-by-step user interaction with this feature',
      rows: 3,
    },
    {
      name: 'uiRequirements',
      label: 'UI Requirements',
      type: 'textarea',
      placeholder: 'Specific UI components, layouts, or visual requirements',
      rows: 2,
    },
    {
      name: 'accessibilityNeeds',
      label: 'Accessibility Needs',
      type: 'text',
      placeholder: 'Screen reader support, keyboard navigation, color contrast',
    },
  ];

  const getQualityFields = (): FormFieldConfig[] => [
    {
      name: 'performanceRequirements',
      label: 'Performance Requirements',
      type: 'textarea',
      placeholder: 'Load times, data processing speed, scalability needs',
      rows: 2,
    },
    {
      name: 'testingStrategy',
      label: 'Testing Strategy',
      type: 'textarea',
      placeholder: 'Unit tests, integration tests, user acceptance criteria',
      rows: 2,
    },
    {
      name: 'additionalNotes',
      label: 'Additional Notes',
      type: 'textarea',
      placeholder: 'Any other important information',
      rows: 2,
    },
  ];

  // Generate comprehensive prompt
  const generatePrompt = (data: FeatureFormData) => {
    const featureName = feature?.name || data.featureName;
    const featureCategory = feature?.category || data.featureCategory;
    const featureStatus = feature?.status || 'submitted';
    const featurePriority = data.priority || feature?.priority || 'Medium';
    const featureDescription = feature?.description || data.featureDescription;

    const prompt = `# Feature Development Request: ${featureName}

## 🎯 Overview
**Category:** ${featureCategory}
**Status:** ${featureStatus}
**Priority:** ${featurePriority}
**Description:** ${featureDescription}

## 📋 Business Requirements
**Business Objective:** ${data.businessObjective || 'Not specified'}
**Target Users:** ${data.targetUsers || 'All system users'}
**Success Metrics:** ${data.successMetrics || 'Feature completion and user adoption'}
**Timeline:** ${data.timeline || 'Standard development timeline'}

## 🔧 Technical Requirements
**Complexity:** ${data.complexity || 'Medium complexity'}
**Dependencies:** ${data.dependencies || 'None specified'}
**Data Requirements:** ${data.dataRequirements || 'Standard data handling'}
**Integration Needs:** ${data.integrationNeeds || 'Standard system integration'}
**Security:** ${data.securityConsiderations || 'Follow standard security practices'}

## 👤 User Experience
**User Flow:** ${data.userFlow || 'Standard user interaction pattern'}
**UI Requirements:** ${data.uiRequirements || 'Follow existing design system (shadcn/ui)'}
**Accessibility:** ${data.accessibilityNeeds || 'Standard accessibility guidelines'}

## 🎯 Quality & Performance
**Performance:** ${data.performanceRequirements || 'Standard performance expectations'}
**Testing:** ${data.testingStrategy || 'Standard testing approach'}

## 📝 Additional Notes
${data.additionalNotes || 'No additional notes'}

---
*Generated on ${new Date().toLocaleDateString()} - Ready for development*`;

    setGeneratedPrompt(prompt);
    setCurrentStep('prompt');
  };

  const handleSubmit = (data: FeatureFormData) => {
    if (currentStep === 'form') {
      generatePrompt(data);
    } else {
      createFeatureMutation.mutate(data);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    toast({ title: 'Copied!', description: 'Development prompt copied to clipboard.' });
  };

  const savePrompt = () => {
    if (feature?.id) {
      savePromptMutation.mutate({
        featureId: feature.id,
        prompt: generatedPrompt,
        title: `Development Prompt: ${feature.name}`
      });
    }
  };

  const defaultValues = {
    ...loadDraft(),
    featureCategory: 'Compliance & Security' as const,
    priority: 'Medium' as const,
    complexity: 'medium' as const,
    isStrategicPath: false,
    rbacRequired: false,
  };

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title={feature ? `Edit Feature: ${feature.name}` : 'New Feature Request'}
      description="Collect comprehensive requirements for feature development"
      maxWidth="4xl"
      showFooter={false}
    >
      {currentStep === 'form' ? (
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="technical">Technical</TabsTrigger>
            <TabsTrigger value="ux">UX</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <StandardForm
                    schema={featureFormSchema.pick({ featureName: true, featureCategory: true, featureDescription: true, priority: true })}
                    fields={getBasicFields()}
                    onSubmit={() => {}} // Handled by parent form
                    showSubmitButton={false}
                    defaultValues={defaultValues}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="business">
              <Card>
                <CardHeader>
                  <CardTitle>Business Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <StandardForm
                    schema={featureFormSchema.pick({ businessObjective: true, targetUsers: true, successMetrics: true, timeline: true })}
                    fields={getBusinessFields()}
                    onSubmit={() => {}}
                    showSubmitButton={false}
                    defaultValues={defaultValues}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="technical">
              <Card>
                <CardHeader>
                  <CardTitle>Technical Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <StandardForm
                    schema={featureFormSchema.pick({ complexity: true, dependencies: true, dataRequirements: true, integrationNeeds: true, securityConsiderations: true })}
                    fields={getTechnicalFields()}
                    onSubmit={() => {}}
                    showSubmitButton={false}
                    defaultValues={defaultValues}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ux">
              <Card>
                <CardHeader>
                  <CardTitle>User Experience</CardTitle>
                </CardHeader>
                <CardContent>
                  <StandardForm
                    schema={featureFormSchema.pick({ userFlow: true, uiRequirements: true, accessibilityNeeds: true })}
                    fields={getUXFields()}
                    onSubmit={() => {}}
                    showSubmitButton={false}
                    defaultValues={defaultValues}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality">
              <Card>
                <CardHeader>
                  <CardTitle>Quality & Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <StandardForm
                    schema={featureFormSchema.pick({ performanceRequirements: true, testingStrategy: true, additionalNotes: true })}
                    fields={getQualityFields()}
                    onSubmit={() => {}}
                    showSubmitButton={false}
                    defaultValues={defaultValues}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => saveDraft(defaultValues)}>
                <Save className="h-4 w-4 mr-1" />
                Save Draft
              </Button>
              {lastSaved && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Saved {lastSaved.toLocaleTimeString()}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={clearDraft}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear Draft
              </Button>
            </div>
            
            <StandardForm
              schema={featureFormSchema}
              fields={[]} // No fields, just submit button
              onSubmit={handleSubmit}
              isLoading={createFeatureMutation.isPending}
              submitText="Generate Prompt"
              submitIcon={<Zap className="h-4 w-4" />}
              defaultValues={defaultValues}
              showFieldsOnly={false}
            />
          </div>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generated Development Prompt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {generatedPrompt}
            </pre>
            
            <div className="flex gap-2">
              <Button onClick={copyPrompt} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy Prompt
              </Button>
              
              {feature?.id && (
                <Button onClick={savePrompt} disabled={savePromptMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Actionable Item
                </Button>
              )}
              
              <StandardForm
                schema={featureFormSchema}
                fields={[]}
                onSubmit={handleSubmit}
                isLoading={createFeatureMutation.isPending}
                submitText="Add to Roadmap"
                defaultValues={defaultValues}
                showFieldsOnly={false}
              />
              
              <Button variant="outline" onClick={() => setCurrentStep('form')}>
                Back to Form
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </BaseDialog>
  );
}