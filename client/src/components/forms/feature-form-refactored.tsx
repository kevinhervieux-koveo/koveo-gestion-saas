import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
// Label import removed (unused)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileText, Zap, Clock, Trash2 } from 'lucide-react';
import type { Feature } from '@shared/schema';

// Import our modular components
import { useFeatureFormData } from './feature-form/use-feature-form-data';
import { useFeatureFormMutations } from './feature-form/use-feature-form-mutations';
import { generateDevelopmentPrompt } from './feature-form/prompt-generator';
import { RBACConfiguration } from './feature-form/rbac-configuration';
import { PromptDisplay } from './feature-form/prompt-display';
import {
  BasicInformationSection,
  BusinessRequirementsSection,
  TechnicalRequirementsSection,
  UserExperienceSection,
  QualityPerformanceSection,
} from './feature-form/form-sections';

/**
 * Props for the FeatureForm component.
 */
interface FeatureFormProps {
  feature: Feature | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

/**
 * Refactored feature form dialog component for planning feature development.
 * Now uses modular components for better maintainability and separation of concerns.
 * @param root0 - Component props.
 * @param root0.feature - Feature data for editing, null for creating new.
 * @param root0.open - Whether the dialog is open.
 * @param root0.onOpenChange - Callback when dialog open state changes.
 * @returns JSX element for the feature form dialog.
 */
/**
 * FeatureFormRefactored function.
 * @param root0
 * @param root0.feature
 * @param root0.open
 * @param root0.onOpenChange
 * @returns Function result.
 */
export function FeatureFormRefactored({ feature, open, onOpenChange }: FeatureFormProps) {
  const [step, setStep] = useState<'form' | 'prompt'>('form');
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // Use our custom hooks for data and mutations
  const {
    formData,
    lastSaved,
    isDirty,
    updateFormData,
    updateRBACRole,
    saveDraft,
    loadDraft,
    clearDraft,
    resetForm,
  } = useFeatureFormData(feature);

  const {
    createFeatureMutation,
    savePromptMutation,
    handleSubmit,
    handleSavePrompt,
  } = useFeatureFormMutations(feature, () => handleClose(false));

  /**
   * Generates the development prompt.
   */
  const generatePrompt = () => {
    const prompt = generateDevelopmentPrompt(feature, formData);
    setGeneratedPrompt(prompt);
    setStep('prompt');
  };

  /**
   * Handles copying text to clipboard.
   * @param text - The text content to copy to clipboard.
   */
  const handleCopyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  /**
   * Resets the dialog to initial state.
   */
  const resetDialog = () => {
    setStep('form');
    resetForm();
    setGeneratedPrompt('');
  };

  /**
   * Handles dialog close with draft saving.
   * @param open - Whether the dialog should be open or closed.
   */
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

  // Clear invalid drafts and load draft when form opens
  useEffect(() => {
    if (open) {
      // Clear any drafts with invalid "Strategic Path" category
      try {
        const allKeys = Object.keys(window.localStorage);
        const draftKeys = allKeys.filter(key => key.startsWith('koveo-feature-draft'));
        
        draftKeys.forEach(key => {
          try {
            const draftData = JSON.parse(window.localStorage.getItem(key) || '{}');
            if (draftData.formData?.featureCategory === 'Strategic Path') {
              window.localStorage.removeItem(key);
              console.warn('Cleared invalid draft:', key);
            }
          } catch (__error) {
            // Invalid JSON, remove it
            window.localStorage.removeItem(key);
          }
        });
      } catch (__error) {
        console.error('Error clearing invalid drafts:', __error);
      }
      
      loadDraft();
    }
  }, [open, loadDraft]);

  const isNewFeature = !feature;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {step === 'form' ? 
                (isNewFeature ? 'Create New Feature' : 'Plan Feature Development') : 
                'Generated Development Prompt'
              }
            </DialogTitle>
            
            {step === 'form' && (
              <div className="flex items-center gap-2">
                {lastSaved && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    Saved {lastSaved.toLocaleTimeString()}
                  </div>
                )}
                
                {lastSaved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearDraft}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {isDirty && step === 'form' && (
            <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
              <Clock className="h-3 w-3" />
              Auto-saving in progress...
            </div>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {step === 'form' ? (
            <>
              {/* Basic Information Section */}
              <BasicInformationSection 
                formData={formData} 
                onUpdateFormData={updateFormData} 
              />

              {/* Business Requirements Section */}
              <BusinessRequirementsSection 
                formData={formData} 
                onUpdateFormData={updateFormData} 
              />

              {/* Technical Requirements Section */}
              <TechnicalRequirementsSection 
                formData={formData} 
                onUpdateFormData={updateFormData} 
              />

              {/* User Experience Section */}
              <UserExperienceSection 
                formData={formData} 
                onUpdateFormData={updateFormData} 
              />

              {/* Quality & Performance Section */}
              <QualityPerformanceSection 
                formData={formData} 
                onUpdateFormData={updateFormData} 
              />

              {/* RBAC Requirements Section */}
              <RBACConfiguration
                formData={formData}
                onUpdateFormData={updateFormData}
                onUpdateRBACRole={updateRBACRole}
              />
            </>
          ) : (
            <>
              {/* Prompt Display */}
              <PromptDisplay
                prompt={generatedPrompt}
                feature={feature}
                onSavePrompt={handleSavePrompt}
                onCopyToClipboard={handleCopyToClipboard}
                isSaving={savePromptMutation.isPending}
              />
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          {step === 'form' ? (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={generatePrompt}
                  disabled={!formData.featureName || !formData.featureDescription}
                  className="flex items-center gap-1"
                >
                  <Zap className="h-4 w-4" />
                  Generate AI Prompt
                </Button>
                
                {isNewFeature && (
                  <Button
                    onClick={() => handleSubmit(formData)}
                    disabled={
                      !formData.featureName || 
                      !formData.featureDescription || 
                      createFeatureMutation.isPending
                    }
                  >
                    {createFeatureMutation.isPending ? 'Adding...' : 'Add to Roadmap'}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('form')}
              >
                ← Back to Form
              </Button>
              
              <div className="flex gap-2">
                {isNewFeature && (
                  <Button
                    onClick={() => handleSubmit(formData)}
                    disabled={createFeatureMutation.isPending}
                  >
                    {createFeatureMutation.isPending ? 'Adding...' : 'Add to Roadmap'}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}