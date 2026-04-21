import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import {
  Shield,
  Lock,
  Key,
  Database,
  ArrowRight,
  CheckCircle,
  FileText,
  Eye,
  UserCheck,
  Server,
  Users,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { SeoHead } from '@/components/seo/SeoHead';
import { seoContent } from '@/components/seo/seo-content';

export default function SecurityPage() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated, logout } = useAuth();
  const seo = seoContent.security[language];

  const securityFeatures = [
    {
      icon: Lock,
      title: t('enterpriseEncryption'),
      description: t('enterpriseEncryptionDesc'),
      features: [
        t('securityFeatureAes256'),
        t('securityFeatureHttpsTls'),
        t('securityFeatureSeparateKeys'),
        t('securityFeatureKeyRotation'),
      ],
      badge: t('securityBadgeMilitaryGrade'),
    },
    {
      icon: UserCheck,
      title: t('roleBasedAccess'),
      description: t('roleBasedAccessDesc'),
      features: [
        t('securityFeatureDefinedRoles'),
        t('securityFeatureGranularPermissions'),
        t('securityFeatureCompleteAudit'),
        t('securityFeatureSecureSessions'),
      ],
      badge: t('securityBadgeControlledAccess'),
    },
    {
      icon: Database,
      title: t('quebecDataProtection'),
      description: t('quebecDataProtectionDesc'),
      features: [
        t('securityFeatureCanadaHosted'),
        t('securityFeatureLaw25Compliance'),
        t('securityFeatureInformedConsent'),
        t('securityFeatureRightToForget'),
      ],
      badge: t('securityBadgeLaw25'),
    },
    {
      icon: Server,
      title: t('secureInfrastructure'),
      description: t('secureInfrastructureDesc'),
      features: [
        t('securityFeatureMultiDataCenter'),
        t('securityFeature247Monitoring'),
        t('securityFeatureEncryptedBackups'),
        t('securityFeatureDisasterRecovery'),
      ],
      badge: t('securityBadgeHighAvailability'),
    },
  ];

  const complianceStandards = [
    {
      icon: Shield,
      title: t('securityComplianceLaw25Title'),
      description: t('securityComplianceLaw25Desc'),
      status: t('securityStatusCertified'),
    },
    {
      icon: FileText,
      title: t('securityComplianceIndustryTitle'),
      description: t('securityComplianceIndustryDesc'),
      status: t('securityStatusCompliant'),
    },
    {
      icon: Key,
      title: t('securityComplianceEncryptionTitle'),
      description: t('securityComplianceEncryptionDesc'),
      status: t('securityStatusActive'),
    },
  ];

  return (
    <div className='min-h-screen bg-gray-50'>
      <SeoHead title={seo.title} description={seo.description} path="/security" />
      <TopNavigationBar />

      <section className='bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-20'>
        <div className='container mx-auto px-4 text-center'>
          <div className='max-w-3xl mx-auto'>
            <Shield className='h-16 w-16 mx-auto mb-6 text-blue-200' />
            <h1 className='text-4xl md:text-5xl font-bold mb-6'>
              {t('securityTitle')}
            </h1>
            <p className='text-xl text-blue-100 mb-8'>
              {t('securityIntro')}
            </p>
          </div>
        </div>
      </section>

      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              {t('securityEnterpriseSectionTitle')}
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              {t('securityEnterpriseSectionDesc')}
            </p>
          </div>

          <div className='grid md:grid-cols-2 gap-8 max-w-6xl mx-auto'>
            {securityFeatures.map((feature, index) => (
              <Card key={index} className='border-0 shadow-lg'>
                <CardHeader className='pb-4'>
                  <div className='flex items-center space-x-3 mb-3'>
                    <feature.icon className='h-8 w-8 text-blue-600' />
                    <CardTitle className='text-xl'>{feature.title}</CardTitle>
                  </div>
                  <CardDescription className='text-gray-600 text-base'>
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className='space-y-2'>
                    {feature.features.map((item, i) => (
                      <li key={i} className='flex items-start space-x-2'>
                        <CheckCircle className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                        <span className='text-gray-700 text-sm'>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className='bg-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              {t('securityComplianceSectionTitle')}
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              {t('securityComplianceSectionDesc')}
            </p>
          </div>

          <div className='grid md:grid-cols-3 gap-8 max-w-4xl mx-auto'>
            {complianceStandards.map((standard, index) => (
              <Card key={index} className='text-center border-0 shadow-lg'>
                <CardHeader>
                  <standard.icon className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                  <CardTitle className='text-lg'>{standard.title}</CardTitle>
                  <div className='mt-2'>
                    <span className='bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full'>
                      {standard.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600'>
                    {standard.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className='bg-blue-600 text-white py-20'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='text-3xl font-bold mb-4'>
            {t('securityCtaTitle')}
          </h2>
          <p className='text-xl text-blue-100 mb-8 max-w-2xl mx-auto'>
            {t('securityCtaDescription')}
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
            {isAuthenticated ? (
              <Button
                size='lg'
                className='bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3'
                onClick={() => setLocation('/dashboard/overview')}
              >
                {t('goToDashboard')}
                <ArrowRight className='ml-2 h-5 w-5' />
              </Button>
            ) : (
              <TrialRequestForm>
                <Button
                  size='lg'
                  className='bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3'
                  data-testid='button-start-trial-security'
                >
                  {t('startFreeTrial')}
                  <ArrowRight className='ml-2 h-5 w-5' />
                </Button>
              </TrialRequestForm>
            )}
            <Button
              size='lg'
              variant='outline'
              className='bg-blue-500 border-blue-400 text-white hover:bg-blue-400 text-lg px-8 py-3'
              onClick={async () => {
                if (isAuthenticated) {
                  await logout();
                }
                setLocation('/login?demo=true');
              }}
              data-testid='button-try-demo-security'
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
