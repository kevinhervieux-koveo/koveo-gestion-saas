import { Button } from '@/components/ui/button';
import { StandardCard } from '@/components/ui/standard-card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import {
  Check,
  ArrowRight,
  Building,
  Users,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { SeoHead } from '@/components/seo/SeoHead';
import { seoContent } from '@/components/seo/seo-content';

/**
 * Pricing page component for Koveo Gestion.
 * Displays pricing information and main features for Quebec property management.
 */
export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated, logout } = useAuth();
  const seo = seoContent.pricing[language];

  const includedFeatures = [
    t('unlimitedResidents') + '*',
    t('documentStorage'),
    t('maintenanceTracking'),
    t('financialReports'),
    t('law25Protection'),
    t('multilingualSupport'),
    t('mobileAccess'),
    t('cloudBackup'),
    t('emailSupport'),
    t('regularUpdates'),
  ];

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50'>
      <SeoHead title={seo.title} description={seo.description} path="/pricing" />
      {/* Navigation Header */}
      <TopNavigationBar />

      {/* Hero Section */}
      <section className='py-20 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-7xl mx-auto'>
          <div className='text-center mb-12'>
            <h1 className='text-4xl md:text-6xl font-bold text-gray-900 mb-6'>
              {t('simplePricing')}
            </h1>
            <p className='text-xl text-gray-600 mb-4'>{t('pricingSubtitle')}</p>
            <p className='text-sm text-gray-500 italic'>{t('pricingSubjectToChange')}</p>
          </div>

          {/* Pricing Cards Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
            {/* Professional Plan Card */}
            <StandardCard
              title={t('professionalPlan')}
              description={t('perfectForPropertyManagers')}
              className='shadow-xl border-2 border-blue-600/20'
              headerClassName='bg-blue-600 text-white rounded-t-lg [&_.text-muted-foreground]:text-white [&_[data-slot=description]]:text-white'
              contentClassName='p-8'
            >
                <div className='text-center mb-8'>
                  <div className='text-5xl font-bold text-blue-600 mb-2'>
                    $13.75
                  </div>
                  <div className='text-lg text-gray-600 mb-2'>CAD + taxes</div>
                  <div className='text-gray-600'>{t('perDoorPerMonth')}</div>
                  <div className='text-sm text-gray-500 mt-2'>{t('noSetupFees')}</div>
                </div>

                <div className='space-y-4 mb-4'>
                  <h4 className='font-semibold text-gray-900 mb-4'>{t('whatsIncluded')}</h4>
                  {includedFeatures.map((feature, index) => (
                    <div key={index} className='flex items-center'>
                      <Check className='h-5 w-5 text-green-500 mr-3 flex-shrink-0' />
                      <span className='text-gray-700'>{feature}</span>
                    </div>
                  ))}
                </div>
                
                <p className='text-xs text-gray-500 mb-6'>{t('unlimitedUsersDisclaimer')}</p>

                <div className='flex flex-col gap-3'>
                  {isAuthenticated ? (
                    <Button
                      className='w-full bg-blue-600 hover:bg-blue-700 text-lg py-3'
                      onClick={() => setLocation('/dashboard/overview')}
                      data-testid='btn-go-to-dashboard'
                    >
                      {t('goToDashboard')}
                      <ArrowRight className='ml-2 h-5 w-5' />
                    </Button>
                  ) : (
                    <TrialRequestForm>
                      <Button
                        className='w-full bg-blue-600 hover:bg-blue-700 text-lg py-3'
                        data-testid='btn-start-trial-professional'
                      >
                        {t('startFreeTrial')}
                        <ArrowRight className='ml-2 h-5 w-5' />
                      </Button>
                    </TrialRequestForm>
                  )}
                  <Button
                    variant='outline'
                    className='w-full border-blue-600 text-blue-600 hover:bg-blue-50 text-lg py-3'
                    onClick={async () => {
                      if (isAuthenticated) {
                        await logout();
                      }
                      setLocation('/login?demo=true');
                    }}
                    data-testid='btn-try-demo-professional'
                  >
                    {t('tryDemo')}
                    <Users className='ml-2 h-5 w-5' />
                  </Button>
                </div>
            </StandardCard>

            {/* Condo Management Services Card */}
            <StandardCard
              title={t('condoManagementPlan')}
              description={t('condoManagementDescription')}
              className='hidden shadow-xl border-2 border-koveo-navy/20'
              headerClassName='bg-koveo-navy text-white rounded-t-lg [&_.text-muted-foreground]:text-white [&_[data-slot=description]]:text-white'
              contentClassName='p-8'
            >
                <div className='text-center mb-8'>
                  <div className='text-5xl font-bold text-koveo-navy mb-2'>
                    $35
                  </div>
                  <div className='text-lg text-gray-600 mb-2'>CAD + taxes</div>
                  <div className='text-gray-600'>{t('perDoorPerMonth')}</div>
                  <div className='text-sm text-green-600 font-medium mt-2'>{t('applicationIncluded')}</div>
                </div>

                <div className='space-y-4 mb-8'>
                  <h4 className='font-semibold text-gray-900 mb-4'>{t('whatsIncluded')}</h4>
                  {includedFeatures.map((feature, index) => (
                    <div key={index} className='flex items-center'>
                      <Check className='h-5 w-5 text-green-500 mr-3 flex-shrink-0' />
                      <span className='text-gray-700'>{feature}</span>
                    </div>
                  ))}
                </div>

                {isAuthenticated ? (
                  <Button
                    className='w-full bg-koveo-navy hover:bg-koveo-navy/90 text-lg py-3'
                    onClick={() => setLocation('/dashboard/overview')}
                    data-testid='btn-go-to-dashboard-condo'
                  >
                    {t('goToDashboard')}
                    <ArrowRight className='ml-2 h-5 w-5' />
                  </Button>
                ) : (
                  <TrialRequestForm>
                    <Button
                      className='w-full bg-koveo-navy hover:bg-koveo-navy/90 text-lg py-3'
                      data-testid='btn-get-started-condo'
                    >
                      {t('getStarted')}
                      <ArrowRight className='ml-2 h-5 w-5' />
                    </Button>
                  </TrialRequestForm>
                )}
            </StandardCard>

            {/* Rental Management Services Card */}
            <StandardCard
              title={t('rentalManagementPlan')}
              description={t('rentalManagementDescription')}
              className='hidden shadow-xl border-2 border-koveo-navy/20'
              headerClassName='bg-koveo-navy text-white rounded-t-lg [&_.text-muted-foreground]:text-white [&_[data-slot=description]]:text-white'
              contentClassName='p-8'
            >
                <div className='text-center mb-8'>
                  <div className='text-5xl font-bold text-koveo-navy mb-2'>
                    $25
                  </div>
                  <div className='text-lg text-gray-600 mb-2'>
                    CAD + taxes {t('plusExpenses')}
                  </div>
                  <div className='text-gray-600 text-sm'>({t('basedOnClientNeeds')})</div>
                  <div className='text-sm text-green-600 font-medium mt-2'>{t('applicationIncluded')}</div>
                </div>

                <div className='space-y-4 mb-8'>
                  <h4 className='font-semibold text-gray-900 mb-4'>{t('whatsIncluded')}</h4>
                  {includedFeatures.map((feature, index) => (
                    <div key={index} className='flex items-center'>
                      <Check className='h-5 w-5 text-green-500 mr-3 flex-shrink-0' />
                      <span className='text-gray-700'>{feature}</span>
                    </div>
                  ))}
                </div>

                {isAuthenticated ? (
                  <Button
                    className='w-full bg-koveo-navy hover:bg-koveo-navy/90 text-lg py-3'
                    onClick={() => setLocation('/dashboard/overview')}
                    data-testid='btn-go-to-dashboard-rental'
                  >
                    {t('goToDashboard')}
                    <ArrowRight className='ml-2 h-5 w-5' />
                  </Button>
                ) : (
                  <TrialRequestForm>
                    <Button
                      className='w-full bg-koveo-navy hover:bg-koveo-navy/90 text-lg py-3'
                      data-testid='btn-get-started-rental'
                    >
                      {t('getStarted')}
                      <ArrowRight className='ml-2 h-5 w-5' />
                    </Button>
                  </TrialRequestForm>
                )}
            </StandardCard>
          </div>
        </div>
      </section>

      {/* View All Features Link */}
      <section className='py-12 px-4 sm:px-6 lg:px-8 bg-white'>
        <div className='max-w-7xl mx-auto text-center'>
          <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
            {t('everythingYouNeed')}
          </h2>
          <p className='text-xl text-gray-600 mb-8'>{t('featuresOverviewDesc')}</p>
          <Link href='/features'>
            <Button
              variant='outline'
              className='border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
            >
              {t('viewAllFeatures')}
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
          </Link>
        </div>
      </section>

      {/* Large Client Section */}
      <section className='py-16 px-4 sm:px-6 lg:px-8 bg-gray-50'>
        <div className='max-w-4xl mx-auto text-center'>
          <Building className='h-16 w-16 text-blue-600 mx-auto mb-6' />
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>
            {t('largeClientTitle')}
          </h2>
          <p className='text-xl text-gray-600 mb-6'>
            {t('largeClientDescription')}
          </p>
          <p className='text-lg text-blue-600 font-medium mb-8'>
            {t('largeClientBenefit')}
          </p>
          <TrialRequestForm>
            <Button
              size='lg'
              className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
              data-testid='btn-contact-large-client'
            >
              {t('largeClientCta')}
              <ArrowRight className='ml-2 h-5 w-5' />
            </Button>
          </TrialRequestForm>
        </div>
      </section>

      {/* Footer */}
      <StandardFooter />
    </div>
  );
}
