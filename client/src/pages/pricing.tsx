import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import koveoLogo from '@/assets/koveo-logo.jpg';
import {
  Check,
  ArrowRight,
  Building,
  Users,
  Shield,
  BarChart3,
  FileText,
  Bell,
  CreditCard,
  MessageSquare,
  Calendar,
  Settings,
  LogIn,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

/**
 * Pricing page component for Koveo Gestion.
 * Displays pricing information and main features for Quebec property management.
 */
export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();

  const mainFeatures = [
    {
      icon: Building,
      title: t('buildingManagement'),
      description: t('buildingManagementDesc'),
    },
    {
      icon: Users,
      title: t('residentPortal'),
      description: t('residentPortalDesc'),
    },
    {
      icon: BarChart3,
      title: t('financialReporting'),
      description: t('financialReportingDesc'),
    },
    {
      icon: Shield,
      title: t('law25Compliance'),
      description: t('law25ComplianceDesc'),
    },
    {
      icon: FileText,
      title: t('documentManagement'),
      description: t('documentManagementDesc'),
    },
    {
      icon: Bell,
      title: t('smartNotifications'),
      description: t('smartNotificationsDesc'),
    },
    {
      icon: CreditCard,
      title: t('electronicBilling'),
      description: t('electronicBillingDesc'),
    },
    {
      icon: MessageSquare,
      title: t('centralizedCommunication'),
      description: t('centralizedCommunicationDesc'),
    },
    {
      icon: Calendar,
      title: t('maintenancePlanning'),
      description: t('maintenancePlanningDesc'),
    },
    {
      icon: Settings,
      title: t('processManagement'),
      description: t('processManagementDesc'),
    },
  ];

  const includedFeatures = [
    t('unlimitedResidents'),
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
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'>
      {/* Navigation Header */}
      <TopNavigationBar />

      {/* Hero Section */}
      <section className='py-20 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-4xl md:text-6xl font-bold text-gray-900 mb-6'>
            {t('simplePricing')}
          </h1>
          <p className='text-xl text-gray-600 mb-12'>{t('pricingSubtitle')}</p>

          {/* Pricing Card */}
          <Card className='max-w-lg mx-auto shadow-xl border-2 border-koveo-navy/20'>
            <CardHeader className='bg-koveo-navy text-white rounded-t-lg'>
              <CardTitle className='text-2xl font-bold'>{t('professionalPlan')}</CardTitle>
              <CardDescription className='text-blue-100'>
                {t('perfectForPropertyManagers')}
              </CardDescription>
            </CardHeader>
            <CardContent className='p-8'>
              <div className='text-center mb-8'>
                <div className='text-5xl font-bold text-koveo-navy mb-2'>
                  $9.50
                </div>
                <div className='text-lg text-gray-600 mb-2'>CAD + taxes</div>
                <div className='text-gray-600'>{t('perDoorPerMonth')}</div>
                <div className='text-sm text-gray-500 mt-2'>{t('noSetupFees')}</div>
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
                  onClick={() => setLocation('/dashboard/quick-actions')}
                  data-testid='btn-go-to-dashboard'
                >
                  {t('goToDashboard')}
                  <ArrowRight className='ml-2 h-5 w-5' />
                </Button>
              ) : (
                <TrialRequestForm>
                  <Button
                    className='w-full bg-koveo-navy hover:bg-koveo-navy/90 text-lg py-3'
                    data-testid='btn-get-started'
                  >
                    {t('getStarted')}
                    <ArrowRight className='ml-2 h-5 w-5' />
                  </Button>
                </TrialRequestForm>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Overview */}
      <section className='py-20 px-4 sm:px-6 lg:px-8 bg-white'>
        <div className='max-w-7xl mx-auto'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
              {t('everythingYouNeed')}
            </h2>
            <p className='text-xl text-gray-600 mb-8'>{t('featuresOverviewDesc')}</p>
            <Link href='/features'>
              <Button
                variant='outline'
                className='border-koveo-navy text-koveo-navy hover:bg-koveo-navy hover:text-white'
              >
                {t('viewAllFeatures')}
                <ArrowRight className='ml-2 h-4 w-4' />
              </Button>
            </Link>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6'>
            {mainFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className='text-center hover:shadow-lg transition-shadow'>
                  <CardContent className='p-6'>
                    <div className='w-12 h-12 bg-koveo-navy/10 rounded-lg flex items-center justify-center mx-auto mb-4'>
                      <IconComponent className='h-6 w-6 text-koveo-navy' />
                    </div>
                    <h3 className='font-semibold text-gray-900 mb-2'>{feature.title}</h3>
                    <p className='text-sm text-gray-600'>{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className='py-20 px-4 sm:px-6 lg:px-8 bg-koveo-navy'>
        <div className='max-w-4xl mx-auto text-center'>
          <h2 className='text-3xl md:text-4xl font-bold text-white mb-6'>
            {t('readyToGetStarted')}
          </h2>
          <p className='text-xl text-blue-100 mb-8'>{t('startManagingToday')}</p>
          {isAuthenticated ? (
            <Button
              size='lg'
              className='bg-white text-koveo-navy hover:bg-gray-100 text-lg px-8 py-3'
              onClick={() => setLocation('/dashboard/quick-actions')}
              data-testid='cta-dashboard'
            >
              {t('goToDashboard')}
              <ArrowRight className='ml-2 h-5 w-5' />
            </Button>
          ) : (
            <TrialRequestForm>
              <Button
                size='lg'
                className='bg-white text-koveo-navy hover:bg-gray-100 text-lg px-8 py-3'
                data-testid='cta-get-started'
              >
                {t('getStarted')}
                <ArrowRight className='ml-2 h-5 w-5' />
              </Button>
            </TrialRequestForm>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex flex-col md:flex-row justify-between items-center'>
            <div className='flex items-center mb-4 md:mb-0'>
              <img src={koveoLogo} alt='Koveo Gestion' className='h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover shadow-sm mr-4' />
              <span className='text-lg font-semibold'>Koveo Gestion</span>
            </div>
            <div className='flex space-x-6'>
              <Link
                href='/privacy-policy'
                className='text-gray-400 hover:text-white transition-colors'
              >
                {t('privacyPolicy')}
              </Link>
              <Link
                href='/terms-of-service'
                className='text-gray-400 hover:text-white transition-colors'
              >
                {t('termsOfService')}
              </Link>
            </div>
          </div>
          <div className='mt-8 pt-8 border-t border-gray-800 text-center text-gray-400'>
            <p>&copy; 2024 Koveo Gestion. {t('allRightsReserved')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
