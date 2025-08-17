import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

/**
 * Represents a single step in the registration wizard process.
 * Contains metadata and validation state for each step.
 */
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<WizardStepProps>;
  isComplete: boolean;
  isValid: boolean;
  canSkip?: boolean;
}

/**
 * Props passed to each wizard step component.
 * Provides data handling and navigation callbacks.
 */
export interface WizardStepProps {
  data: Record<string, unknown>;
  onDataChange: (_data: Record<string, unknown>) => void;
  onValidationChange: (_isValid: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  isActive: boolean;
}

/**
 * Props for the main RegistrationWizard component.
 * Configures the wizard steps and completion handlers.
 */
interface RegistrationWizardProps {
  steps: WizardStep[];
  initialData?: Record<string, unknown>;
  onComplete: (_data: Record<string, unknown>) => void;
  onCancel: () => void;
  title?: string;
  className?: string;
}

/**
 * Multi-Step Registration Wizard Component.
 * 
 * Provides a guided registration flow with step validation,
 * progress tracking, and Quebec compliance features.
 * @param root0 - Component props object.
 * @param root0.steps - Array of wizard steps to render.
 * @param root0.initialData - Initial data for the wizard.
 * @param root0.onComplete - Function called when wizard is completed.
 * @param root0.onCancel - Function called when wizard is cancelled.
 * @param root0.title - Optional title for the wizard.
 * @param root0.className - Optional CSS class name.
 * @returns JSX element for the registration wizard.
 */
export function RegistrationWizard({
  steps: initialSteps,
  initialData = {},
  onComplete,
  onCancel,
  title = 'Inscription',
  className = ''
}: RegistrationWizardProps) {
  const { t: _t } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<WizardStep[]>(initialSteps);
  const [wizardData, setWizardData] = useState(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const completedSteps = steps.filter(step => step.isComplete).length;
  const progress = (completedSteps / steps.length) * 100;

  // Update step validation status
  const updateStepValidation = (stepId: string, isValid: boolean) => {
    setSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId ? { ...step, isValid } : step
      )
    );
  };

  // Update step completion status
  const updateStepCompletion = (stepId: string, isComplete: boolean) => {
    setSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId ? { ...step, isComplete } : step
      )
    );
  };

  // Handle data changes from step components
  const handleDataChange = (stepData: any) => {
    setWizardData((prevData: any) => ({
      ...prevData,
      [currentStep.id]: stepData
    }));
  };

  // Handle validation changes from step components
  const handleValidationChange = (isValid: boolean) => {
    updateStepValidation(currentStep.id, isValid);
    // Auto-complete step if valid and has required data
    if (isValid && wizardData[currentStep.id]) {
      updateStepCompletion(currentStep.id, true);
    }
  };

  // Navigate to next step
  const handleNext = () => {
    if (currentStep.isValid && !isLastStep) {
      updateStepCompletion(currentStep.id, true);
      setCurrentStepIndex(prev => prev + 1);
    } else if (isLastStep && currentStep.isValid) {
      handleComplete();
    }
  };

  // Navigate to previous step
  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Complete the wizard
  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Mark final step as complete
      updateStepCompletion(currentStep.id, true);
      
      // Combine all wizard data
      const completeData = {
        ...wizardData,
        [currentStep.id]: wizardData[currentStep.id] || {}
      };

      await onComplete(completeData);
    } catch (error) {
      console.error('Wizard completion error:', error);
      setIsSubmitting(false);
    }
  };

  // Jump to specific step (only if previous steps are complete)
  const jumpToStep = (stepIndex: number) => {
    // Can only go to completed steps or the next uncompleted step
    const canJump = stepIndex <= currentStepIndex || 
                   steps.slice(0, stepIndex).every(step => step.isComplete);
    
    if (canJump) {
      setCurrentStepIndex(stepIndex);
    }
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      <Card className="shadow-xl border-0">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold text-gray-900">
            {title}
          </CardTitle>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-gray-600 mt-2">
              Étape {currentStepIndex + 1} sur {steps.length} • {Math.round(progress)}% terminé
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step Navigation */}
          <div className="flex justify-center">
            <div className="flex items-center space-x-2 md:space-x-4 overflow-x-auto pb-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => jumpToStep(index)}
                    disabled={index > currentStepIndex && !steps.slice(0, index).every(s => s.isComplete)}
                    className={`
                      flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all
                      ${index === currentStepIndex 
                        ? 'border-primary bg-primary text-white' 
                        : step.isComplete 
                          ? 'border-green-500 bg-green-500 text-white cursor-pointer hover:bg-green-600'
                          : 'border-gray-300 bg-white text-gray-400'
                      }
                      ${index <= currentStepIndex || step.isComplete ? 'cursor-pointer' : 'cursor-not-allowed'}
                    `}
                    aria-label={`${step.title} - ${step.isComplete ? 'Terminé' : index === currentStepIndex ? 'En cours' : 'En attente'}`}
                  >
                    {step.isComplete ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </button>
                  
                  {index < steps.length - 1 && (
                    <div className={`w-8 md:w-16 h-0.5 ${
                      steps[index + 1].isComplete || index < currentStepIndex 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <div className="min-h-[400px]">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {currentStep.title}
              </h3>
              <p className="text-gray-600">
                {currentStep.description}
              </p>
              {currentStep.isValid && (
                <Badge variant="secondary" className="mt-2 bg-green-100 text-green-800">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Validé
                </Badge>
              )}
            </div>

            {/* Render current step component */}
            <currentStep.component
              data={wizardData[currentStep.id] || {}}
              onDataChange={handleDataChange}
              onValidationChange={handleValidationChange}
              onNext={handleNext}
              onPrevious={handlePrevious}
              isActive={true}
            />
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex space-x-3">
              {!isFirstStep && (
                <Button
                  onClick={handlePrevious}
                  variant="outline"
                  className="flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Précédent
                </Button>
              )}
              
              <Button
                onClick={onCancel}
                variant="ghost"
                className="text-gray-600"
              >
                Annuler
              </Button>
            </div>

            <Button
              onClick={handleNext}
              disabled={!currentStep.isValid || isSubmitting}
              className="flex items-center min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Traitement...
                </>
              ) : isLastStep ? (
                'Terminer'
              ) : (
                <>
                  Suivant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}