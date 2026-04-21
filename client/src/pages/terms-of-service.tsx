import { Button } from '@/components/ui/button';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import { Shield, ArrowLeft, FileText } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { SeoHead } from '@/components/seo/SeoHead';
import { seoContent } from '@/components/seo/seo-content';

export default function TermsOfServicePage() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const seo = seoContent.termsOfService[language];

  return (
    <div className='min-h-screen bg-gray-50'>
      <SeoHead title={seo.title} description={seo.description} path="/terms-of-service" />
      <TopNavigationBar />

      <div className='container mx-auto px-4 py-12 max-w-4xl'>
        <div className='bg-white rounded-lg shadow-sm p-8'>
          <div className='flex items-center space-x-3 mb-8'>
            <FileText className='h-8 w-8 text-blue-600' />
            <h1 className='text-3xl font-bold text-gray-900'>{t('termsPageTitle')}</h1>
          </div>

          <div className='prose max-w-none'>
            <p className='text-gray-600 mb-6'>
              <strong>{t('termsLastUpdated')}</strong>
            </p>

            <p className='text-gray-700 mb-8'>
              {t('termsIntro')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('termsSection1Title')}
            </h2>
            <p className='text-gray-700 mb-6'>
              {t('termsSection1Content')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('termsSection2Title')}</h2>
            <p className='text-gray-700 mb-4'>
              {t('termsSection2Intro')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('termsServiceItem1')}</li>
              <li>{t('termsServiceItem2')}</li>
              <li>{t('termsServiceItem3')}</li>
              <li>{t('termsServiceItem4')}</li>
              <li>{t('termsServiceItem5')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('termsSection3Title')}</h2>
            <p className='text-gray-700 mb-4'>{t('termsSection3Intro')}</p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('termsAccountItem1')}</li>
              <li>{t('termsAccountItem2')}</li>
              <li>{t('termsAccountItem3')}</li>
              <li>{t('termsAccountItem4')}</li>
              <li>{t('termsAccountItem5')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('termsSection4Title')}</h2>
            <p className='text-gray-700 mb-4'>{t('termsSection4Intro')}</p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('termsUseItem1')}</li>
              <li>{t('termsUseItem2')}</li>
              <li>{t('termsUseItem3')}</li>
              <li>{t('termsUseItem4')}</li>
              <li>{t('termsUseItem5')}</li>
              <li>{t('termsUseItem6')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('termsSection5Title')}
            </h2>
            <p className='text-gray-700 mb-6'>
              {t('termsSection5Content')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('termsSection6Title')}
            </h2>
            <p className='text-gray-700 mb-6'>
              {t('termsSection6Content')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('termsSection7Title')}
            </h2>
            <p className='text-gray-700 mb-4'>{t('termsSection7Intro')}</p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('termsPaymentItem1')}</li>
              <li>{t('termsPaymentItem2')}</li>
              <li>{t('termsPaymentItem3')}</li>
              <li>{t('termsPaymentItem4')}</li>
              <li>{t('termsPaymentItem5')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('termsSection8Title')}
            </h2>
            <p className='text-gray-700 mb-6'>
              {t('termsSection8Content')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('termsSection9Title')}
            </h2>
            <p className='text-gray-700 mb-6'>
              {t('termsSection9Content')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('termsSection10Title')}</h2>
            <p className='text-gray-700 mb-4'>
              {t('termsSection10Intro')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>{t('termsTerminationItem1')}</li>
              <li>{t('termsTerminationItem2')}</li>
              <li>{t('termsTerminationItem3')}</li>
              <li>{t('termsTerminationItem4')}</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('termsSection11Title')}</h2>
            <p className='text-gray-700 mb-6'>
              {t('termsSection11Content')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('termsSection12Title')}</h2>
            <p className='text-gray-700 mb-6'>
              {t('termsSection12Content')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('termsSection13Title')}</h2>
            <p className='text-gray-700 mb-4'>
              {t('termsSection13Intro')}
            </p>
            <div className='bg-blue-50 p-6 rounded-lg'>
              <p className='text-gray-700 whitespace-pre-line'>
                {t('termsContactInfo')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <StandardFooter />
    </div>
  );
}
