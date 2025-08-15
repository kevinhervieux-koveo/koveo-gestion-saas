import { useLanguage } from '@/hooks/use-language';

/**
 *
 */
export function InitializationWizard() {
  const { t } = useLanguage();

  return (
    <div className='mb-8'>
      {/* Progress Indicator */}
      <div className='mb-8'>
        <div className='flex items-center justify-between text-sm text-gray-500 mb-2'>
          <span>{t('initializationProgress')}</span>
          <span>Step 1 of 5</span>
        </div>
        <div className='w-full bg-gray-200 rounded-full h-2'>
          <div
            className='bg-koveo-navy h-2 rounded-full transition-all duration-500'
            style={{ width: '20%' }}
          ></div>
        </div>
        <div className='flex justify-between text-xs text-gray-400 mt-2'>
          <span className='text-koveo-navy font-medium'>{t('frameworkSetup')}</span>
          <span>{t('pillarCreation')}</span>
          <span>{t('qualityTools')}</span>
          <span>{t('testingSetup')}</span>
          <span>{t('validation')}</span>
        </div>
      </div>
    </div>
  );
}
