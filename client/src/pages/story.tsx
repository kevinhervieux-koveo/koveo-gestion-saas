import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { StandardFooter } from '@/components/layout/StandardFooter';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import {
  Building,
  Users,
  Shield,
  ArrowRight,
  CheckCircle,
  Lightbulb,
  Target,
  Heart,
  Zap,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  Scale,
  Lock,
  Languages,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { SeoHead } from '@/components/seo/SeoHead';
import { seoContent } from '@/components/seo/seo-content';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FileText, Download } from 'lucide-react';

export default function StoryPage() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated, logout } = useAuth();
  const [showPdfSection, setShowPdfSection] = useState(false);
  const seo = seoContent.story[language];

  const { data: companyHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['company-history'],
    queryFn: async () => {
      const response = await fetch('/api/company/history');
      if (!response.ok) {
        throw new Error('Failed to fetch company history');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const timeline = [
    {
      year: t('foundationYear'),
      title: t('foundationTitle'),
      description: t('foundationDesc'),
      icon: Lightbulb,
    },
    {
      year: t('developmentYear'),
      title: t('developmentTitle'),
      description: t('developmentDesc'),
      icon: Building,
    },
    {
      year: t('launchYear'),
      title: t('launchTitle'),
      description: t('launchDesc'),
      icon: Zap,
    },
  ];

  const values = [
    {
      icon: Shield,
      title: t('storyValueComplianceTitle'),
      description: t('storyValueComplianceDesc'),
    },
    {
      icon: Heart,
      title: t('storyValueServiceTitle'),
      description: t('storyValueServiceDesc'),
    },
    {
      icon: Zap,
      title: t('storyValueInnovationTitle'),
      description: t('storyValueInnovationDesc'),
    },
    {
      icon: Users,
      title: t('storyValueCommunityTitle'),
      description: t('storyValueCommunityDesc'),
    },
  ];

  const teamHighlights = [
    { icon: Briefcase, text: t('storyTeamHighlight1') },
    { icon: Scale, text: t('storyTeamHighlight2') },
    { icon: Lock, text: t('storyTeamHighlight3') },
    { icon: Languages, text: t('storyTeamHighlight4') },
  ];

  return (
    <div className='min-h-screen bg-gray-50'>
      <SeoHead title={seo.title} description={seo.description} path="/story" />
      <TopNavigationBar />

      <section className='bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-20'>
        <div className='container mx-auto px-4 text-center'>
          <div className='max-w-3xl mx-auto'>
            <Building className='h-16 w-16 mx-auto mb-6 text-blue-200' />
            <h1 className='text-4xl md:text-5xl font-bold mb-6'>
              {t('ourStoryTitle')}
            </h1>
            <p className='text-xl text-blue-100 mb-8'>
              {t('storyIntro')}
            </p>
          </div>
        </div>
      </section>

      <section className='py-20 bg-white'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto text-center'>
            <h2 className='text-3xl font-bold text-gray-900 mb-6'>{t('storyMissionTitle')}</h2>
            <p className='text-xl text-gray-600 mb-12'>
              {t('storyMissionDesc')}
            </p>

            <div className='grid md:grid-cols-3 gap-8'>
              <Card className='border-0 shadow-lg text-center'>
                <CardHeader>
                  <Target className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                  <CardTitle className='text-lg'>{t('storyVisionTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600'>
                    {t('storyVisionDesc')}
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className='border-0 shadow-lg text-center'>
                <CardHeader>
                  <Heart className='h-12 w-12 text-red-500 mx-auto mb-4' />
                  <CardTitle className='text-lg'>{t('storyValuesTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600'>
                    {t('storyValuesDesc')}
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className='border-0 shadow-lg text-center'>
                <CardHeader>
                  <Shield className='h-12 w-12 text-green-500 mx-auto mb-4' />
                  <CardTitle className='text-lg'>{t('storyEngagementTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600'>
                    {t('storyEngagementDesc')}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('storyJourneyTitle')}</h2>
            <p className='text-xl text-gray-600 max-w-2xl mx-auto'>
              {t('storyJourneySubtitle')}
            </p>
          </div>

          <div className='max-w-4xl mx-auto'>
            {timeline.map((item, index) => (
              <div key={index} className='flex items-start mb-12 last:mb-0'>
                <div className='flex-shrink-0 mr-8'>
                  <div className='bg-blue-600 text-white rounded-full p-4'>
                    <item.icon className='h-8 w-8' />
                  </div>
                </div>
                <div className='flex-grow'>
                  <div className='bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600'>
                    <div className='flex items-center mb-3'>
                      <span className='bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full mr-4'>
                        {item.year}
                      </span>
                      <h3 className='text-xl font-bold text-gray-900'>{item.title}</h3>
                    </div>
                    <p className='text-gray-700'>{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='bg-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('storyOurValuesTitle')}</h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              {t('storyOurValuesSubtitle')}
            </p>
          </div>

          <div className='grid md:grid-cols-2 gap-8 max-w-5xl mx-auto'>
            {values.map((value, index) => (
              <Card key={index} className='border-0 shadow-lg'>
                <CardHeader>
                  <div className='flex items-center space-x-3 mb-3'>
                    <value.icon className='h-8 w-8 text-blue-600' />
                    <CardTitle className='text-xl'>{value.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600 text-base'>
                    {value.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className='py-20 bg-gray-100'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>{t('storyTeamTitle')}</h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              {t('storyTeamSubtitle')}
            </p>
          </div>

          <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto'>
            {teamHighlights.map((highlight, index) => (
              <Card key={index} className='border-0 shadow-md text-center'>
                <CardContent className='pt-6'>
                  <div className='bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center'>
                    <highlight.icon className='h-8 w-8 text-blue-600' />
                  </div>
                  <p className='text-gray-700 font-medium text-sm'>{highlight.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {companyHistory && (
        <section className='bg-blue-50 py-16'>
          <div className='container mx-auto px-4'>
            <div className='max-w-3xl mx-auto text-center'>
              <FileText className='h-12 w-12 text-blue-600 mx-auto mb-4' />
              <h2 className='text-2xl font-bold text-gray-900 mb-4'>
                {t('storyDocumentationTitle')}
              </h2>
              <p className='text-lg text-gray-600 mb-8'>
                {t('storyDocumentationDesc')}
              </p>
              <Button
                onClick={() => setShowPdfSection(!showPdfSection)}
                className='bg-blue-600 hover:bg-blue-700'
                data-testid='button-toggle-pdf'
              >
                <Download className='mr-2 h-4 w-4' />
                {t('storyViewDocumentation')}
              </Button>

              {showPdfSection && companyHistory && (
                <div className='mt-8 bg-white rounded-lg shadow-lg p-6'>
                  <h3 className='text-lg font-semibold mb-4'>
                    {t('storyAvailableDocuments')}
                  </h3>
                  <div className='space-y-3'>
                    {companyHistory.files?.map((file: any, index: number) => (
                      <div
                        key={index}
                        className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                      >
                        <div className='flex items-center space-x-3'>
                          <FileText className='h-5 w-5 text-blue-600' />
                          <span className='font-medium'>{file.name}</span>
                        </div>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => window.open(file.url, '_blank')}
                        >
                          <Download className='mr-2 h-4 w-4' />
                          {t('storyDownload')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className='bg-blue-600 text-white py-20'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='text-3xl font-bold mb-4'>
            {t('storyCtaTitle')}
          </h2>
          <p className='text-xl text-blue-100 mb-8 max-w-2xl mx-auto'>
            {t('storyCtaDesc')}
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
                  data-testid='button-start-trial-story'
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
              data-testid='button-try-demo-story'
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
