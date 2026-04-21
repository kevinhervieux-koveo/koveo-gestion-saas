import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { SeoHead } from '@/components/seo/SeoHead';
import { seoContent } from '@/components/seo/seo-content';

/**
 * Privacy Policy page component for Koveo Gestion.
 * Comprehensive privacy policy compliant with Quebec Law 25.
 */
export default function PrivacyPolicyPage() {
  const { t, language } = useLanguage();
  const seo = seoContent.privacyPolicy[language];

  return (
    <div className='min-h-screen bg-gray-50'>
      <SeoHead title={seo.title} description={seo.description} path="/privacy-policy" />
      {/* Navigation Header */}
      <TopNavigationBar />

      {/* Content */}
      <div className='container mx-auto px-4 py-12 max-w-4xl'>
        <div className='bg-white rounded-lg shadow-sm p-8'>
          <div className='flex items-center space-x-3 mb-8'>
            <Shield className='h-8 w-8 text-blue-600' />
            <h1 className='text-3xl font-bold text-gray-900'>{t('privacyPolicyTitle')}</h1>
          </div>

          <div className='prose max-w-none'>
            <p className='text-gray-600 mb-6'>
              <strong>{t('lastUpdated')}</strong> {t('january')} 2025
            </p>

            <p className='text-gray-700 mb-8'>
              {t('privacyPolicyIntro')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('informationCollection')}
            </h2>
            <p className='text-gray-700 mb-4'>
              {t('informationCollectionDesc')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('privacyInfoItem1')}</li>
              <li>{t('privacyInfoItem2')}</li>
              <li>{t('privacyInfoItem3')}</li>
              <li>{t('privacyInfoItem4')}</li>
              <li>{t('privacyInfoItem5')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('informationUse')}
            </h2>
            <p className='text-gray-700 mb-4'>
              {t('informationUseDesc')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('privacyUseItem1')}</li>
              <li>{t('privacyUseItem2')}</li>
              <li>{t('privacyUseItem3')}</li>
              <li>{t('privacyUseItem4')}</li>
              <li>{t('privacyUseItem5')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('informationSharing')}</h2>
            <p className='text-gray-700 mb-4'>
              {t('privacySharingIntro')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('privacySharingItem1')}</li>
              <li>{t('privacySharingItem2')}</li>
              <li>{t('privacySharingItem3')}</li>
              <li>{t('privacySharingItem4')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('dataSecurity')}</h2>
            <p className='text-gray-700 mb-4'>
              {t('privacySecurityIntro')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('privacySecurityItem1')}</li>
              <li>{t('privacySecurityItem2')}</li>
              <li>{t('privacySecurityItem3')}</li>
              <li>{t('privacySecurityItem4')}</li>
              <li>{t('privacySecurityItem5')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('privacyRights')}</h2>
            <p className='text-gray-700 mb-4'>
              {t('privacyRightsIntro')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('privacyRightsItem1')}</li>
              <li>{t('privacyRightsItem2')}</li>
              <li>{t('privacyRightsItem3')}</li>
              <li>{t('privacyRightsItem4')}</li>
              <li>{t('privacyRightsItem5')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('contactPrivacy')}</h2>
            <p className='text-gray-700 mb-6'>
              {t('privacyContactIntro')}
            </p>
            <div className='bg-blue-50 p-6 rounded-lg'>
              <p className='text-gray-700 mb-2'>
                <strong>Koveo Gestion</strong>
              </p>
              <p className='text-gray-700 mb-2'>
                {t('privacyContactEmail')} <a href='mailto:privacy@koveo-gestion.com' className='text-blue-600 hover:underline'>{t('privacyContactEmailLabel')}</a>
              </p>
              <p className='text-gray-700'>
                {t('privacyContactOfficer')}
              </p>
            </div>
          </div>

        </div>
      </div>

      <StandardFooter />
    </div>
  );
}
