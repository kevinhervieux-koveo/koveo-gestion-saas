import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Feature } from '@shared/schema';
import type { FeatureFormData } from './use-feature-form-data';

/**
 * Hook for managing feature form mutations.
 */
export function useFeatureFormMutations(
  feature: Feature | null,
  onClose: () => void
) {
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
      onClose();
    },
    onError: () => {
      toast({
        title: 'Integration Failed',
        description: 'Failed to add the feature to the roadmap. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Mutation to save generated prompt as actionable item
  const savePromptMutation = useMutation({
    mutationFn: async ({ featureId, prompt, title }: { featureId: string, prompt: string, title: string }) => {
      const response = await fetch(`/api/features/${featureId}/actionable-items/from-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          title,
          description: 'AI-generated development prompt'
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
        queryClient.invalidateQueries({ queryKey: [`/api/features/${feature.id}/actionable-items`] });
      }
      
      toast({
        title: 'Prompt Saved',
        description: 'Implementation prompt has been saved as an actionable item.',
      });
    },
    onError: () => {
      toast({
        title: 'Save Failed',
        description: 'Failed to save the prompt. Please try again.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Handles form submission - either creates new feature or shows already exists message.
   */
  const handleSubmit = (formData: FeatureFormData) => {
    if (!feature) {
      // Create new feature
      const featureData = {
        name: formData.featureName,
        description: formData.featureDescription,
        category: formData.featureCategory,
        status: 'submitted',
        priority: formData.priority || 'medium',
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
      toast({
        title: 'Feature Already in Roadmap',
        description: 'This feature is already part of the roadmap.',
      });
      onClose();
    }
  };

  /**
   * Saves the generated prompt as an actionable item.
   */
  const handleSavePrompt = (prompt: string, title: string) => {
    if (!feature?.id) {
      toast({
        title: 'Cannot Save Prompt',
        description: 'No feature ID available. Please save the feature first.',
        variant: 'destructive',
      });
      return;
    }

    savePromptMutation.mutate({
      featureId: feature.id,
      prompt,
      title: title || 'Implementation Prompt'
    });
  };

  return {
    createFeatureMutation,
    savePromptMutation,
    handleSubmit,
    handleSavePrompt,
  };
}