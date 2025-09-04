import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
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
  ArrowLeft,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FileText, Download } from 'lucide-react';

/**
 * Story page component for Koveo Gestion.
 * Tells the story behind Koveo and our mission for Quebec property management.
 * Now displays real company history from histoire.pdf when available.
 */
export default function StoryPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [showPdfSection, setShowPdfSection] = useState(false);

  // Fetch company history from object storage
  const { data: companyHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['company-history'],
    queryFn: async () => {
      const response = await fetch('/api/company/history');
      if (!response.ok) {
        throw new Error('Failed to fetch company history');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      title: 'Conformité et transparence',
      description:
        'Nous nous engageons à respecter toutes les réglementations québécoises et à maintenir la transparence dans nos pratiques.',
    },
    {
      icon: Heart,
      title: 'Service à la clientèle',
      description:
        "L'expérience utilisateur et la satisfaction client sont au cœur de tout ce que nous faisons.",
    },
    {
      icon: Zap,
      title: 'Innovation responsable',
      description:
        'Nous innovons de manière réfléchie, en nous concentrant sur des solutions pratiques qui apportent une vraie valeur.',
    },
    {
      icon: Users,
      title: 'Communauté québécoise',
      description:
        'Nous nous engageons envers la communauté des gestionnaires immobiliers du Québec et comprenons leurs défis uniques.',
    },
  ];

  const teamHighlights = [
    "Équipe d'experts en gestion immobilière québécoise",
    'Spécialistes en conformité réglementaire',
    'Développeurs experts en sécurité des données',
    'Support client bilingue (français/anglais)',
  ];

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Navigation Header */}
      <TopNavigationBar />

      {/* Hero Section */}
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

      {/* Mission Section */}
      <section className='py-20 bg-white'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto text-center'>
            <h2 className='text-3xl font-bold text-gray-900 mb-6'>Notre mission</h2>
            <p className='text-xl text-gray-600 mb-12'>
              Simplifier et moderniser la gestion immobilière au Québec en offrant des outils
              technologiques avancés, sécurisés et conformes aux réglementations locales.
            </p>

            <div className='grid md:grid-cols-3 gap-8'>
              <Card className='border-0 shadow-lg text-center'>
                <CardHeader>
                  <Target className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                  <CardTitle className='text-lg'>Vision</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600'>
                    Devenir la plateforme de référence pour la gestion immobilière moderne au
                    Québec.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className='border-0 shadow-lg text-center'>
                <CardHeader>
                  <Heart className='h-12 w-12 text-red-500 mx-auto mb-4' />
                  <CardTitle className='text-lg'>Valeurs</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600'>
                    Transparence, innovation responsable et engagement envers la communauté
                    québécoise.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className='border-0 shadow-lg text-center'>
                <CardHeader>
                  <Shield className='h-12 w-12 text-green-500 mx-auto mb-4' />
                  <CardTitle className='text-lg'>Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-gray-600'>
                    Protection de vos données avec une conformité totale à la Loi 25 du Québec.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>Notre parcours</h2>
            <p className='text-xl text-gray-600 max-w-2xl mx-auto'>
              De l'idée initiale à la plateforme complète d'aujourd'hui, découvrez les étapes
              clés de notre développement.
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

      {/* Values Section */}
      <section className='bg-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>Nos valeurs</h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              Les principes qui guident chaque décision et orientent notre développement.
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

      {/* Team Section */}
      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>Notre équipe</h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              Des experts passionnés par l'amélioration de la gestion immobilière au Québec.
            </p>
          </div>

          <div className='max-w-4xl mx-auto'>
            <Card className='border-0 shadow-lg'>
              <CardHeader>
                <CardTitle className='text-center text-2xl'>Expertise québécoise</CardTitle>
                <CardDescription className='text-center text-lg text-gray-600'>
                  Notre équipe combine une expertise technique de pointe avec une connaissance
                  approfondie du marché immobilier québécois.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid md:grid-cols-2 gap-6'>
                  {teamHighlights.map((highlight, index) => (
                    <div key={index} className='flex items-start space-x-3'>
                      <CheckCircle className='h-5 w-5 text-green-500 mt-1 flex-shrink-0' />
                      <span className='text-gray-700'>{highlight}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Company History PDF Section */}
      {companyHistory && (
        <section className='bg-blue-50 py-16'>
          <div className='container mx-auto px-4'>
            <div className='max-w-3xl mx-auto text-center'>
              <FileText className='h-12 w-12 text-blue-600 mx-auto mb-4' />
              <h2 className='text-2xl font-bold text-gray-900 mb-4'>
                Documentation complète
              </h2>
              <p className='text-lg text-gray-600 mb-8'>
                Consultez notre documentation détaillée sur l'histoire et la mission de
                Koveo Gestion.
              </p>
              <Button
                onClick={() => setShowPdfSection(!showPdfSection)}
                className='bg-blue-600 hover:bg-blue-700'
                data-testid='button-toggle-pdf'
              >
                <Download className='mr-2 h-4 w-4' />
                Voir la documentation
              </Button>

              {showPdfSection && companyHistory && (
                <div className='mt-8 bg-white rounded-lg shadow-lg p-6'>
                  <h3 className='text-lg font-semibold mb-4'>
                    Documents disponibles
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
                          Télécharger
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

      {/* CTA Section */}
      <section className='bg-blue-900 text-white py-20'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='text-3xl font-bold mb-4'>
            Rejoignez notre vision
          </h2>
          <p className='text-xl text-blue-100 mb-8 max-w-2xl mx-auto'>
            Découvrez comment Koveo Gestion peut transformer votre approche de la gestion
            immobilière.
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center'>
            {!isAuthenticated ? (
              <>
                <Link href='/'>
                  <Button size='lg' className='bg-white text-blue-900 hover:bg-gray-100'>
                    Essai gratuit
                    <ArrowRight className='ml-2 h-4 w-4' />
                  </Button>
                </Link>
                <Link href='/features'>
                  <Button size='lg' variant='outline' className='border-blue-300 text-white hover:bg-blue-800'>
                    Découvrir nos fonctionnalités
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                size='lg'
                className='bg-white text-blue-900 hover:bg-gray-100'
                onClick={() => setLocation('/dashboard/quick-actions')}
              >
                Accéder au tableau de bord
                <ArrowRight className='ml-2 h-4 w-4' />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Navigation */}
      <div className='container mx-auto px-4 py-8'>
        <div className='flex justify-between items-center'>
          <Button
            variant='outline'
            onClick={() => setLocation('/')}
            data-testid='button-back-home'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Retour à l'accueil
          </Button>
          
          <div className='flex space-x-4'>
            <Link href='/privacy-policy'>
              <Button variant='outline' size='sm'>
                Politique de confidentialité
              </Button>
            </Link>
            <Link href='/security'>
              <Button variant='outline' size='sm'>
                Sécurité
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}