import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardCard } from '@/components/ui/standard-card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import {
  Building,
  Users,
  Shield,
  BarChart3,
  ArrowRight,
  CheckCircle,
  FileText,
  Bell,
  CreditCard,
  Settings,
  MessageSquare,
  Calendar,
  DollarSign,
  Wrench,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import { SeoHead } from '@/components/seo/SeoHead';
import { seoContent } from '@/components/seo/seo-content';

export default function FeaturesPage() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated, logout } = useAuth();
  const seo = seoContent.features[language];

  const coreFeatures = [
    {
      icon: Building,
      title: t('featuresBuildingManagementTitle'),
      description: t('featuresBuildingManagementDesc'),
      features: [
        t('featuresBuildingManagement1'),
        t('featuresBuildingManagement2'),
        t('featuresBuildingManagement3'),
        t('featuresBuildingManagement4'),
      ],
    },
    {
      icon: Users,
      title: t('featuresResidentPortalTitle'),
      description: t('featuresResidentPortalDesc'),
      features: [
        t('featuresResidentPortal1'),
        t('featuresResidentPortal2'),
        t('featuresResidentPortal3'),
        t('featuresResidentPortal4'),
      ],
    },
    {
      icon: BarChart3,
      title: t('featuresFinancialReportsTitle'),
      description: t('featuresFinancialReportsDesc'),
      features: [
        t('featuresFinancialReports1'),
        t('featuresFinancialReports2'),
        t('featuresFinancialReports3'),
        t('featuresFinancialReports4'),
      ],
    },
    {
      icon: Shield,
      title: t('featuresLaw25Title'),
      description: t('featuresLaw25Desc'),
      features: [
        t('featuresLaw251'),
        t('featuresLaw252'),
        t('featuresLaw253'),
        t('featuresLaw254'),
      ],
    },
  ];

  const advancedFeatures = [
    {
      icon: FileText,
      title: t('featuresDocMgmtTitle'),
      description: t('featuresDocMgmtDesc'),
      features: [t('featuresDocMgmt1'), t('featuresDocMgmt2'), t('featuresDocMgmt3')],
    },
    {
      icon: Bell,
      title: t('featuresNotificationsTitle'),
      description: t('featuresNotificationsDesc'),
      features: [t('featuresNotifications1'), t('featuresNotifications2'), t('featuresNotifications3')],
    },
    {
      icon: CreditCard,
      title: t('featuresBillingTitle'),
      description: t('featuresBillingDesc'),
      features: [t('featuresBilling1'), t('featuresBilling2'), t('featuresBilling3')],
    },
    {
      icon: MessageSquare,
      title: t('featuresCommTitle'),
      description: t('featuresCommDesc'),
      features: [t('featuresComm1'), t('featuresComm2'), t('featuresComm3')],
    },
    {
      icon: Calendar,
      title: t('featuresPlanningTitle'),
      description: t('featuresPlanningDesc'),
      features: [t('featuresPlanning1'), t('featuresPlanning2'), t('featuresPlanning3')],
    },
    {
      icon: Settings,
      title: t('featuresProcessTitle'),
      description: t('featuresProcessDesc'),
      features: [t('featuresProcess1'), t('featuresProcess2'), t('featuresProcess3')],
    },
    {
      icon: Wrench,
      title: t('featuresProjectMgmtTitle'),
      description: t('featuresProjectMgmtDesc'),
      features: [t('featuresProjectMgmt1'), t('featuresProjectMgmt2'), t('featuresProjectMgmt3'), t('featuresProjectMgmt4')],
    },
  ];

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50'>
      <SeoHead title={seo.title} description={seo.description} path="/features" />
      <TopNavigationBar />

      <section className='container mx-auto px-4 py-16 text-center'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-5xl font-bold text-gray-900 mb-6 leading-tight'>
            {t('featuresPageTitle')}
            <span className='text-blue-600'> {t('featuresPageTitleHighlight')}</span>
          </h1>
          <p className='text-xl text-gray-600 mb-8 leading-relaxed'>
            {t('featuresPageSubtitle')}
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
            {isAuthenticated ? (
              <Button
                size='lg'
                className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
                onClick={() => setLocation('/dashboard/overview')}
                data-testid='button-go-to-dashboard'
              >
                {t('goToDashboard') || 'Go to Dashboard'}
                <ArrowRight className='ml-2 h-5 w-5' />
              </Button>
            ) : (
              <TrialRequestForm>
                <Button
                  size='lg'
                  className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
                  data-testid='button-start-trial'
                >
                  {t('startFreeTrial')}
                  <ArrowRight className='ml-2 h-5 w-5' />
                </Button>
              </TrialRequestForm>
            )}
            <Button
              size='lg'
              variant='outline'
              className='border-blue-600 text-blue-600 hover:bg-blue-50 text-lg px-8 py-3'
              onClick={async () => {
                if (isAuthenticated) {
                  await logout();
                }
                setLocation('/login?demo=true');
              }}
              data-testid='button-try-demo-top'
            >
              {t('tryDemo')}
              <Users className='ml-2 h-5 w-5' />
            </Button>
          </div>
        </div>
      </section>

      <section className='container mx-auto px-4 py-16'>
        <div className='text-center mb-16'>
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('featuresCoreFeaturesTitle')}</h2>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            {t('featuresCoreFeaturesSubtitle')}
          </p>
        </div>

        <div className='grid lg:grid-cols-2 gap-8 mb-16'>
          {coreFeatures.map((feature, _index) => (
            <StandardCard
              key={_index}
              title={feature.title}
              description={feature.description}
              className='hover:shadow-lg transition-shadow'
              headerClassName='pb-3'
              data-testid={`core-feature-${_index}`}
            >
              <div className='flex items-center space-x-4 mb-4'>
                <feature.icon className='h-12 w-12 text-blue-600' />
              </div>
              <ul className='space-y-2'>
                {feature.features.map((item, itemIndex) => (
                  <li key={itemIndex} className='flex items-start space-x-2'>
                    <CheckCircle className='h-5 w-5 text-green-600 mt-0.5 flex-shrink-0' />
                    <span className='text-sm text-gray-700'>{item}</span>
                  </li>
                ))}
              </ul>
            </StandardCard>
          ))}
        </div>
      </section>

      <section className='bg-gray-50 py-16'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('featuresAdvancedTitle')}</h2>
            <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
              {t('featuresAdvancedSubtitle')}
            </p>
          </div>

          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {advancedFeatures.map((feature, _index) => (
              <StandardCard
                key={_index}
                title={feature.title}
                description={feature.description}
                className='text-center hover:shadow-lg transition-shadow'
                data-testid={`advanced-feature-${_index}`}
              >
                <feature.icon className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                <ul className='text-sm space-y-1'>
                  {feature.features.map((item, itemIndex) => (
                    <li key={itemIndex} className='flex items-center space-x-2'>
                      <CheckCircle className='h-4 w-4 text-green-600 flex-shrink-0' />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </StandardCard>
            ))}
          </div>
        </div>
      </section>

      <section className='bg-blue-600 text-white py-16'>
        <div className='container mx-auto px-4 text-center'>
          <div className='max-w-2xl mx-auto'>
            <h2 className='text-3xl font-bold mb-4'>
              {t('featuresReadyToTransform')}
            </h2>
            <p className='text-lg mb-8 text-blue-100'>
              {t('featuresJoinManagers')}
            </p>
            <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
              {isAuthenticated ? (
                <Button
                  size='lg'
                  className='bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3'
                  onClick={() => setLocation('/dashboard/overview')}
                  data-testid='button-go-to-dashboard-bottom'
                >
                  {t('goToDashboard') || 'Go to Dashboard'}
                  <ArrowRight className='ml-2 h-5 w-5' />
                </Button>
              ) : (
                <TrialRequestForm>
                  <Button
                    size='lg'
                    className='bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3'
                    data-testid='button-start-trial-bottom'
                  >
                    {t('startFreeTrial')}
                    <ArrowRight className='ml-2 h-5 w-5' />
                  </Button>
                </TrialRequestForm>
              )}
              <Button
                size='lg'
                className='bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 text-lg px-8 py-3'
                onClick={async () => {
                  if (isAuthenticated) {
                    await logout();
                  }
                  setLocation('/login?demo=true');
                }}
                data-testid='button-try-demo-bottom'
              >
                {t('tryDemo')}
                <Users className='ml-2 h-5 w-5' />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <StandardFooter />
    </div>
  );
}
