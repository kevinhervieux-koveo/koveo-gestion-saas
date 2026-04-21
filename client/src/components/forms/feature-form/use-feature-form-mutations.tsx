import { useToast } from '@/hooks/use-toast';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import type { Feature } from '@shared/schema';
import type { FeatureFormData } from './use-feature-form-data';

/**
 * Hook for managing feature form mutations.
 * @param feature
 * @param onClose
 */
/**
 * UseFeatureFormMutations function.
 * @param feature
 * @param onClose
 * @returns Function result.
 */
export function useFeatureFormMutations(feature: Feature | null, onClose: () => void) {
  const { toast } = useToast();

  // Mutation to create feature in roadmap
  const createFeatureMutation = useCreateUpdateMutation<any, {
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
  }>({
    mutationFn: async (featureData) => {
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
    successTitle: 'Feature Integrated',
    successMessage: (newFeature) =>
      `"${newFeature.name}" has been successfully added to the roadmap.`,
    errorTitle: 'Integration Failed',
    errorMessage: 'Failed to add the feature to the roadmap. Please try again.',
    queryKeysToInvalidate: [['/api/features']],
    onSuccessCallback: () => {
      onClose();
    },
  });

  // Mutation to save generated prompt as actionable item
  const savePromptMutation = useCreateUpdateMutation<unknown, { featureId: string; prompt: string; title: string }>({
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
    successTitle: 'Prompt Saved',
    successMessage: 'Implementation prompt has been saved as an actionable item.',
    errorTitle: 'Save Failed',
    errorMessage: 'Failed to save the prompt. Please try again.',
    invalidateQueries: (_data, queryClient) => {
      if (feature?.id) {
        queryClient.invalidateQueries({
          queryKey: [`/api/features/${feature.id}/actionable-items`],
        });
      }
    },
  });

  /**
   * Handles form submission - either creates new feature or shows already exists message.
   * @param formData
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
   * @param prompt
   * @param title
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
      title: title || 'Implementation Prompt',
    });
  };

  return {
    createFeatureMutation,
    savePromptMutation,
    handleSubmit,
    handleSavePrompt,
  };
}
