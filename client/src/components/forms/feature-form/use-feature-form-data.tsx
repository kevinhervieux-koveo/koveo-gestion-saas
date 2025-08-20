import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Feature } from '@shared/schema';

/**
 * Interface for form data structure.
 */
export interface FeatureFormData {
  featureName: string;
  featureCategory: string;
  featureDescription: string;
  isStrategicPath: boolean;
  businessObjective: string;
  targetUsers: string;
  successMetrics: string;
  priority: string;
  timeline: string;
  complexity: string;
  dependencies: string;
  dataRequirements: string;
  integrationNeeds: string;
  securityConsiderations: string;
  userFlow: string;
  uiRequirements: string;
  accessibilityNeeds: string;
  performanceRequirements: string;
  testingStrategy: string;
  additionalNotes: string;
  rbacRequired: boolean;
  rbacRoles: {
    admin: { read: boolean; write: boolean; organizationalLimitation: string };
    manager: { read: boolean; write: boolean; organizationalLimitation: string };
    owner: { read: boolean; write: boolean; organizationalLimitation: string };
    tenant: { read: boolean; write: boolean; organizationalLimitation: string };
  };
}

/**
 * Initial form data with default values.
 */
const getInitialFormData = (): FeatureFormData => ({
  featureName: '',
  featureCategory: 'Compliance & Security',
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
    tenant: { read: false, write: false, organizationalLimitation: '' }
  },
});

/**
 * Hook for managing feature form data with draft functionality.
 * @param feature
 */
export function useFeatureFormData(feature: Feature | null) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FeatureFormData>(getInitialFormData());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  /**
   * Gets the localStorage key for drafts.
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
        featureId: feature?.id || null
      };
      window.localStorage.setItem(getDraftKey(), JSON.stringify(draftData));
      setLastSaved(new Date());
      setIsDirty(false);
      
      toast({
        title: 'Draft Saved',
        description: 'Your progress has been automatically saved.',
        duration: 2000,
      });
    } catch (_error) {
      console.error('Failed to save draft:', _error);
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
    } catch (_error) {
      console.error('Failed to load draft:', _error);
    }
  }, [getDraftKey]);

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
    } catch (_error) {
      console.error('Failed to clear draft:', _error);
    }
  }, [getDraftKey, toast]);

  /**
   * Updates form data when input values change.
   */
  const updateFormData = useCallback((field: string, value: string | boolean | unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  /**
   * Updates RBAC role permissions.
   */
  const updateRBACRole = useCallback((role: string, field: string, value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      rbacRoles: {
        ...prev.rbacRoles,
        [role]: {
          ...prev.rbacRoles[role as keyof typeof prev.rbacRoles],
          [field]: value
        }
      }
    }));
    setIsDirty(true);
  }, []);

  /**
   * Resets form to initial state.
   */
  const resetForm = useCallback(() => {
    setFormData(getInitialFormData());
    setLastSaved(null);
    setIsDirty(false);
  }, []);

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

  return {
    formData,
    lastSaved,
    isDirty,
    updateFormData,
    updateRBACRole,
    saveDraft,
    loadDraft,
    clearDraft,
    resetForm,
  };
}