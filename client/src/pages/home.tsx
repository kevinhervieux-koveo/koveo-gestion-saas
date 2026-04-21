import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import { Building, Users, Shield, BarChart3, ArrowRight, CheckCircle, Wrench } from 'lucide-react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { SeoHead, SITE_BASE_URL } from '@/components/seo/SeoHead';
import { seoContent } from '@/components/seo/seo-content';
import type { Translations } from '@/lib/i18n';

type FeatureKey = 'building' | 'resident' | 'financial' | 'compliance' | 'projects';
type TranslationKey = keyof Translations;

interface FeatureCardData {
  id: FeatureKey;
  icon: typeof Building;
  iconColor: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  detailTitleKey: TranslationKey;
  detailDescKey: TranslationKey;
  features: TranslationKey[];
  linkPath: string;
  linkLabelKey: TranslationKey;
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated, logout } = useAuth();
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);

  const seo = seoContent.home[language];
  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Koveo Gestion',
    description: seo.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_BASE_URL,
    inLanguage: ['fr-CA', 'en-CA'],
    audience: {
      '@type': 'Audience',
      audienceType: 'Quebec property managers, condo boards and rental owners',
    },
    offers: {
      '@type': 'Offer',
      price: '13.75',
      priceCurrency: 'CAD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '13.75',
        priceCurrency: 'CAD',
        unitText: 'per door per month',
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'Koveo Gestion',
      url: SITE_BASE_URL,
      areaServed: { '@type': 'AdministrativeArea', name: 'Quebec, Canada' },
    },
  };

  const featureCards: FeatureCardData[] = [
    {
      id: 'building',
      icon: Building,
      iconColor: 'text-blue-600',
      titleKey: 'buildingManagement',
      descKey: 'buildingManagementDesc',
      detailTitleKey: 'featuresBuildingManagementTitle',
      detailDescKey: 'featuresBuildingManagementDesc',
      features: [
        'featuresBuildingManagement1',
        'featuresBuildingManagement2',
        'featuresBuildingManagement3',
        'featuresBuildingManagement4',
      ],
      linkPath: '/features',
      linkLabelKey: 'viewAllFeatures',
    },
    {
      id: 'resident',
      icon: Users,
      iconColor: 'text-green-600',
      titleKey: 'residentPortal',
      descKey: 'residentPortalDesc',
      detailTitleKey: 'featuresResidentPortalTitle',
      detailDescKey: 'featuresResidentPortalDesc',
      features: [
        'featuresResidentPortal1',
        'featuresResidentPortal2',
        'featuresResidentPortal3',
        'featuresResidentPortal4',
      ],
      linkPath: '/features',
      linkLabelKey: 'viewAllFeatures',
    },
    {
      id: 'financial',
      icon: BarChart3,
      iconColor: 'text-purple-600',
      titleKey: 'financialReporting',
      descKey: 'financialReportingDesc',
      detailTitleKey: 'featuresFinancialReportsTitle',
      detailDescKey: 'featuresFinancialReportsDesc',
      features: [
        'featuresFinancialReports1',
        'featuresFinancialReports2',
        'featuresFinancialReports3',
        'featuresFinancialReports4',
      ],
      linkPath: '/features',
      linkLabelKey: 'viewAllFeatures',
    },
    {
      id: 'compliance',
      icon: Shield,
      iconColor: 'text-red-600',
      titleKey: 'quebecCompliance',
      descKey: 'quebecComplianceDesc',
      detailTitleKey: 'featuresLaw25Title',
      detailDescKey: 'featuresLaw25Desc',
      features: ['featuresLaw251', 'featuresLaw252', 'featuresLaw253', 'featuresLaw254'],
      linkPath: '/security',
      linkLabelKey: 'viewSecurityDetails',
    },
    {
      id: 'projects',
      icon: Wrench,
      iconColor: 'text-orange-600',
      titleKey: 'projectManagement',
      descKey: 'projectManagementDesc',
      detailTitleKey: 'featuresProjectMgmtTitle',
      detailDescKey: 'featuresProjectMgmtDesc',
      features: [
        'featuresProjectMgmt1',
        'featuresProjectMgmt2',
        'featuresProjectMgmt3',
        'featuresProjectMgmt4',
      ],
      linkPath: '/features',
      linkLabelKey: 'viewAllFeatures',
    },
  ];

  const activeFeatureData = featureCards.find((f) => f.id === activeFeature);

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50'>
      <SeoHead
        title={seo.title}
        description={seo.description}
        path="/"
        jsonLd={homeJsonLd}
      />
      <TopNavigationBar />

      <section className='container mx-auto px-4 py-16 text-center'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-5xl font-bold text-gray-700 mb-6 leading-tight'>
            {t('modernPropertyManagement')}
            <span className='text-blue-600'> {t('forQuebec')}</span>
          </h1>
          <p className='text-xl text-gray-500 mb-8 leading-relaxed'>
            {t('comprehensivePropertyManagement')}
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
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-bold text-gray-700 mb-4'>{t('everythingYouNeed')}</h2>
          <p className='text-lg text-gray-500 max-w-2xl mx-auto'>{t('builtForPropertyOwners')}</p>
        </div>

        <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6'>
          {featureCards.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <Card
                key={feature.id}
                className='text-center hover:shadow-lg transition-shadow cursor-pointer'
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFeature(feature.id);
                }}
                data-testid={`feature-card-${feature.id}`}
              >
                <CardHeader>
                  <IconComponent className={`h-12 w-12 ${feature.iconColor} mx-auto mb-4`} />
                  <CardTitle>{t(feature.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{t(feature.descKey)}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Dialog open={activeFeature !== null} onOpenChange={(open) => !open && setActiveFeature(null)}>
        <DialogContent className='max-w-lg'>
          {activeFeatureData && (
            <>
              <DialogHeader>
                <div className='flex items-center gap-3 mb-2'>
                  <activeFeatureData.icon
                    className={`h-8 w-8 ${activeFeatureData.iconColor}`}
                  />
                  <DialogTitle className='text-xl'>
                    {t(activeFeatureData.detailTitleKey)}
                  </DialogTitle>
                </div>
                <DialogDescription>{t(activeFeatureData.detailDescKey)}</DialogDescription>
              </DialogHeader>
              <div className='mt-4'>
                <ul className='space-y-3'>
                  {activeFeatureData.features.map((featureKey, index) => (
                    <li key={index} className='flex items-start gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-600 mt-0.5 flex-shrink-0' />
                      <span className='text-sm text-gray-700'>{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className='mt-6 flex justify-end'>
                <Button
                  onClick={() => {
                    setActiveFeature(null);
                    setLocation(activeFeatureData.linkPath);
                  }}
                  className='bg-blue-600 hover:bg-blue-700'
                  data-testid={`feature-dialog-button-${activeFeatureData.id}`}
                >
                  {t(activeFeatureData.linkLabelKey)}
                  <ArrowRight className='ml-2 h-4 w-4' />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <section className='bg-white py-16'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto'>
            <h2 className='text-3xl font-bold text-gray-700 text-center mb-12'>
              {t('whyChooseKoveo')}
            </h2>
            <div className='grid md:grid-cols-2 gap-8'>
              <div className='space-y-6'>
                <div className='flex items-start space-x-4'>
                  <CheckCircle className='h-6 w-6 text-green-600 mt-1 flex-shrink-0' />
                  <div>
                    <h3 className='font-semibold text-gray-900'>{t('quebecLaw25Compliant')}</h3>
                    <p className='text-gray-500'>{t('quebecLaw25CompliantDesc')}</p>
                  </div>
                </div>
                <div className='flex items-start space-x-4'>
                  <CheckCircle className='h-6 w-6 text-green-600 mt-1 flex-shrink-0' />
                  <div>
                    <h3 className='font-semibold text-gray-900'>{t('bilingualSupport')}</h3>
                    <p className='text-gray-500'>{t('bilingualSupportDesc')}</p>
                  </div>
                </div>
                <div className='flex items-start space-x-4'>
                  <CheckCircle className='h-6 w-6 text-green-600 mt-1 flex-shrink-0' />
                  <div>
                    <h3 className='font-semibold text-gray-900'>{t('roleBasedAccess')}</h3>
                    <p className='text-gray-500'>{t('roleBasedAccessDesc')}</p>
                  </div>
                </div>
              </div>
              <div className='space-y-6'>
                <div className='flex items-start space-x-4'>
                  <CheckCircle className='h-6 w-6 text-green-600 mt-1 flex-shrink-0' />
                  <div>
                    <h3 className='font-semibold text-gray-900'>{t('cloudBasedSecurity')}</h3>
                    <p className='text-gray-500'>{t('cloudBasedSecurityDesc')}</p>
                  </div>
                </div>
                <div className='flex items-start space-x-4'>
                  <CheckCircle className='h-6 w-6 text-green-600 mt-1 flex-shrink-0' />
                  <div>
                    <h3 className='font-semibold text-gray-900'>{t('mobileResponsive')}</h3>
                    <p className='text-gray-500'>{t('mobileResponsiveDesc')}</p>
                  </div>
                </div>
                <div className='flex items-start space-x-4'>
                  <CheckCircle className='h-6 w-6 text-green-600 mt-1 flex-shrink-0' />
                  <div>
                    <h3 className='font-semibold text-gray-900'>{t('expertSupport')}</h3>
                    <p className='text-gray-500'>{t('expertSupportDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='container mx-auto px-4 py-16 text-center'>
        <div className='max-w-2xl mx-auto'>
          <h2 className='text-3xl font-bold text-gray-700 mb-4'>{t('readyToTransform')}</h2>
          <p className='text-lg text-gray-500 mb-8'>{t('joinPropertyOwners')}</p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
            {isAuthenticated ? (
              <Button
                size='lg'
                className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
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
                  className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
                  data-testid='button-start-trial-bottom'
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
              data-testid='button-try-demo-bottom'
            >
              {t('tryDemo')}
              <Users className='ml-2 h-5 w-5' />
            </Button>
          </div>
        </div>
      </section>

      <StandardFooter />
    </div>
  );
}
