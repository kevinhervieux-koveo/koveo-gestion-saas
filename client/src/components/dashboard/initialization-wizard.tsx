import { useLanguage } from '@/hooks/use-language';
import { useStepper } from '@/lib/common-hooks';

/**
 * Initialization wizard component that guides users through the setup process
 * of the Koveo Gestion development framework with progress indicators.
 * Uses the shared `useStepper` hook so its progress display stays in sync
 * with other wizards in the app.
 * @returns JSX element displaying the initialization wizard interface.
 */
export function InitializationWizard() {
  const { t } = useLanguage();

  const stepLabels = [
    t('frameworkSetup'),
    t('pillarCreation'),
    t('qualityTools'),
    t('testingSetup'),
    t('validation'),
  ];

  const { currentStep, totalSteps, progress } = useStepper(stepLabels.length);

  return (
    <div className='mb-8'>
      {/* Progress Indicator */}
      <div className='mb-8'>
        <div className='flex items-center justify-between text-sm text-gray-500 mb-2'>
          <span>{t('initializationProgress')}</span>
          <span>
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
        <div className='w-full bg-gray-200 rounded-full h-2'>
          <div
            className='bg-koveo-navy h-2 rounded-full transition-all duration-500'
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className='flex justify-between text-xs text-gray-400 mt-2'>
          {stepLabels.map((label, index) => (
            <span
              key={label}
              className={index === currentStep ? 'text-koveo-navy font-medium' : ''}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
