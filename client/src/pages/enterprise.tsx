import { Button } from '@/components/ui/button';
import { StandardCard } from '@/components/ui/standard-card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import {
  Building,
  Building2,
  Home,
  Palette,
  DollarSign,
  Users,
  BarChart3,
  Headphones,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle,
  Rocket,
  TrendingDown,
  Star,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { TrialRequestForm } from '@/components/ui/trial-request-form';

export default function EnterprisePage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated, logout } = useAuth();

  const pricingTiers = [
    {
      price: t('enterprisePriceTier1'),
      description: t('enterprisePriceTier1Desc'),
      highlight: false,
    },
    {
      price: t('enterprisePriceTier2'),
      description: t('enterprisePriceTier2Desc'),
      highlight: true,
    },
    {
      price: t('enterprisePriceTier3'),
      description: t('enterprisePriceTier3Desc'),
      highlight: true,
    },
    {
      price: t('enterprisePriceTier4'),
      description: t('enterprisePriceTier4Desc'),
      highlight: false,
    },
  ];

  const advantages = [
    {
      icon: Building2,
      title: t('enterpriseAdvantage1'),
      description: t('enterpriseAdvantage1Desc'),
    },
    {
      icon: BarChart3,
      title: t('enterpriseAdvantage2'),
      description: t('enterpriseAdvantage2Desc'),
    },
    {
      icon: Headphones,
      title: t('enterpriseAdvantage3'),
      description: t('enterpriseAdvantage3Desc'),
    },
  ];

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50'>
      <TopNavigationBar />

      <section className='container mx-auto px-4 py-16 text-center'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-5xl font-bold text-gray-900 mb-6 leading-tight'>
            {t('enterprisePageTitle')}
          </h1>
          <p className='text-xl text-gray-600 mb-8 leading-relaxed'>
            {t('enterprisePageSubtitle')}
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
            {isAuthenticated ? (
              <Button
                size='lg'
                className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
                onClick={() => setLocation('/dashboard/overview')}
              >
                {t('goToDashboard') || 'Go to Dashboard'}
                <ArrowRight className='ml-2 h-5 w-5' />
              </Button>
            ) : (
              <TrialRequestForm>
                <Button
                  size='lg'
                  className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
                >
                  {t('enterpriseRequestQuote')}
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
            >
              {t('tryDemo')}
              <Users className='ml-2 h-5 w-5' />
            </Button>
          </div>
        </div>
      </section>

      <section className='container mx-auto px-4 py-16'>
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('enterpriseVersatilityTitle')}</h2>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            {t('enterpriseVersatilityDesc')}
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
          <StandardCard
            title={t('enterpriseRentals')}
            description={t('enterpriseRentalsDesc')}
            className='hover:shadow-lg transition-shadow'
          >
            <div className='flex items-center space-x-4 mb-4'>
              <Home className='h-12 w-12 text-blue-600' />
            </div>
          </StandardCard>

          <StandardCard
            title={t('enterpriseCondos')}
            description={t('enterpriseCondosDesc')}
            className='hover:shadow-lg transition-shadow'
          >
            <div className='flex items-center space-x-4 mb-4'>
              <Building className='h-12 w-12 text-blue-600' />
            </div>
          </StandardCard>
        </div>
      </section>

      <section className='bg-gray-50 py-16'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('enterpriseWhiteLabelTitle')}</h2>
            <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
              {t('enterpriseWhiteLabelDesc')}
            </p>
          </div>

          <div className='max-w-4xl mx-auto'>
            <StandardCard className='mb-8'>
              <div className='flex items-start space-x-4'>
                <Palette className='h-12 w-12 text-blue-600 flex-shrink-0' />
                <div>
                  <p className='text-gray-700 text-lg leading-relaxed'>
                    {t('enterpriseWhiteLabelExplanation')}
                  </p>
                </div>
              </div>
            </StandardCard>

            <div className='grid md:grid-cols-3 gap-6'>
              <div className='text-center p-6 bg-white rounded-lg shadow-sm'>
                <CheckCircle className='h-10 w-10 text-green-600 mx-auto mb-3' />
                <p className='font-semibold text-gray-800'>{t('enterpriseWhiteLabelBenefit1')}</p>
              </div>
              <div className='text-center p-6 bg-white rounded-lg shadow-sm'>
                <CheckCircle className='h-10 w-10 text-green-600 mx-auto mb-3' />
                <p className='font-semibold text-gray-800'>{t('enterpriseWhiteLabelBenefit2')}</p>
              </div>
              <div className='text-center p-6 bg-white rounded-lg shadow-sm'>
                <CheckCircle className='h-10 w-10 text-green-600 mx-auto mb-3' />
                <p className='font-semibold text-gray-800'>{t('enterpriseWhiteLabelBenefit3')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='container mx-auto px-4 py-16'>
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('enterprisePricingTitle')}</h2>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            {t('enterprisePricingDesc')}
          </p>
        </div>

        <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto'>
          {pricingTiers.map((tier, index) => (
            <div
              key={index}
              className={`relative p-6 rounded-xl text-center transition-all ${
                tier.highlight
                  ? 'bg-blue-600 text-white shadow-xl transform scale-105'
                  : 'bg-white shadow-lg'
              }`}
            >
              {tier.highlight && (
                <div className='absolute -top-3 left-1/2 transform -translate-x-1/2'>
                  <TrendingDown className='h-6 w-6 text-green-400' />
                </div>
              )}
              <div className='text-3xl font-bold mb-2'>{tier.price}</div>
              <div className={`text-sm ${tier.highlight ? 'text-blue-100' : 'text-gray-600'}`}>
                {t('enterprisePerDoor')} / {t('enterprisePerMonth')}
              </div>
              <div className={`mt-4 pt-4 border-t ${tier.highlight ? 'border-blue-500' : 'border-gray-200'}`}>
                <p className={tier.highlight ? 'text-blue-100' : 'text-gray-700'}>{tier.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className='bg-gradient-to-r from-green-500 to-green-600 py-16'>
        <div className='container mx-auto px-4'>
          <div className='max-w-3xl mx-auto text-center text-white'>
            <Rocket className='h-16 w-16 mx-auto mb-6' />
            <h2 className='text-3xl font-bold mb-4'>{t('enterpriseJuniorTitle')}</h2>
            <p className='text-xl text-green-100 mb-6'>
              {t('enterpriseJuniorDesc')}
            </p>
            <div className='bg-white/20 backdrop-blur-sm rounded-lg p-6 inline-block'>
              <Star className='h-8 w-8 text-yellow-300 mx-auto mb-3' />
              <p className='text-lg font-semibold'>
                {t('enterpriseJuniorBenefit')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className='container mx-auto px-4 py-16'>
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('enterpriseAdvantagesTitle')}</h2>
        </div>

        <div className='grid md:grid-cols-3 gap-8 max-w-5xl mx-auto'>
          {advantages.map((advantage, index) => (
            <StandardCard
              key={index}
              title={advantage.title}
              description={advantage.description}
              className='text-center hover:shadow-lg transition-shadow'
            >
              <advantage.icon className='h-12 w-12 text-blue-600 mx-auto mb-4' />
            </StandardCard>
          ))}
        </div>
      </section>

      <section className='bg-blue-600 text-white py-16'>
        <div className='container mx-auto px-4'>
          <div className='max-w-3xl mx-auto text-center'>
            <h2 className='text-3xl font-bold mb-4'>{t('enterpriseContactTitle')}</h2>
            <p className='text-lg text-blue-100 mb-8'>
              {t('enterpriseContactDesc')}
            </p>

            <div className='grid sm:grid-cols-2 gap-6 mb-8'>
              <div className='bg-white/10 backdrop-blur-sm rounded-lg p-6'>
                <Mail className='h-8 w-8 mx-auto mb-3' />
                <p className='text-sm text-blue-200 mb-1'>{t('enterpriseContactEmail')}</p>
                <a
                  href='mailto:Kevin.hervoeux@koveo-gestion.com'
                  className='text-lg font-semibold hover:underline'
                >
                  Kevin.hervoeux@koveo-gestion.com
                </a>
              </div>
              <div className='bg-white/10 backdrop-blur-sm rounded-lg p-6'>
                <Phone className='h-8 w-8 mx-auto mb-3' />
                <p className='text-sm text-blue-200 mb-1'>{t('enterpriseContactPhone')}</p>
                <a
                  href='tel:514-712-8441'
                  className='text-lg font-semibold hover:underline'
                >
                  514-712-8441
                </a>
              </div>
            </div>

            <TrialRequestForm>
              <Button
                size='lg'
                className='bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3'
              >
                {t('enterpriseRequestQuote')}
                <ArrowRight className='ml-2 h-5 w-5' />
              </Button>
            </TrialRequestForm>
          </div>
        </div>
      </section>

      <StandardFooter />
    </div>
  );
}
