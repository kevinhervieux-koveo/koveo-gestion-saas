import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HamburgerMenu } from '@/components/ui/hamburger-menu';
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
  Award
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Story page component for Koveo Gestion.
 * Tells the story behind Koveo and our mission for Quebec property management.
 * Now displays real company history from histoire.pdf when available.
 */
export default function  /**
   * Story page function.
   */
 StoryPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated, logout } = useAuth();
  const [showPdfSection, setShowPdfSection] = useState(false);

  // Fetch company history from object storage
  const { data: companyHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['company-history'],
    queryFn: async () => {
      const response = await fetch('/api/company/history');  /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */

      if (!response.ok) {throw new Error('Failed to fetch company history');}
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const timeline = [
    {
      year: "2023",
      title: "Fondation de Koveo Gestion",
      description: "Création de l'entreprise avec pour mission de moderniser la gestion immobilière au Québec.",
      icon: Lightbulb
    },
    {
      year: "2024",
      title: "Développement de la plateforme",
      description: "Conception et développement de notre solution complète en conformité avec la Loi 25 du Québec.",
      icon: Building
    },
    {
      year: "2025",
      title: "Lancement commercial",
      description: "Mise en service de la plateforme pour les gestionnaires immobiliers du Québec.",
      icon: Zap
    }
  ];

  const values = [
    {
      icon: Shield,
      title: "Conformité et transparence",
      description: "Nous nous engageons à respecter toutes les réglementations québécoises et à maintenir la transparence dans nos pratiques."
    },
    {
      icon: Heart,
      title: "Service à la clientèle",
      description: "L'expérience utilisateur et la satisfaction client sont au cœur de tout ce que nous faisons."
    },
    {
      icon: Zap,
      title: "Innovation responsable",
      description: "Nous innovons de manière réfléchie, en nous concentrant sur des solutions pratiques qui apportent une vraie valeur."
    },
    {
      icon: Users,
      title: "Communauté québécoise",
      description: "Nous nous engageons envers la communauté des gestionnaires immobiliers du Québec et comprenons leurs défis uniques."
    }
  ];

  const teamHighlights = [
    "Équipe d'experts en gestion immobilière québécoise",
    "Spécialistes en conformité réglementaire",
    "Développeurs expérimentés en sécurité des données",
    "Support client bilingue français-anglais"
  ];

  const achievements = [
    {
      icon: Shield,
      title: "Conformité Loi 25",
      description: "Première plateforme conforme dès le lancement"
    },
    {
      icon: Building,
      title: "Focus Québec",
      description: "Solution dédiée au marché québécois"
    },
    {
      icon: Users,
      title: "Interface bilingue",
      description: "Support complet français-anglais"
    },
    {
      icon: Award,
      title: "Sécurité entreprise",
      description: "Standards de sécurité de niveau entreprise"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Navigation Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={koveoLogo} 
              alt="Koveo Gestion" 
              className="h-10 w-10 rounded-lg object-cover cursor-pointer"
              onClick={() => setLocation('/')}
              data-testid="logo-link"
            />
          </div>
          <HamburgerMenu />
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            L'histoire de
            <span className="text-blue-600"> Koveo Gestion</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Découvrez notre mission de moderniser la gestion immobilière au Québec avec 
            des solutions technologiques respectueuses de la réglementation locale.
          </p>
        </div>
      </section>

      {/* Company History from Object Storage */}
      {companyHistory && (
        <section className="container mx-auto px-4 py-12 mb-8">
          <div className="max-w-4xl mx-auto">
            {/* PDF Document Available */}
            {companyHistory.found && companyHistory.fileInfo && (
              <Card className="bg-blue-50 border-blue-200 mb-8" data-testid="histoire-pdf-card">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <CardTitle className="text-xl text-blue-900">
                        Document officiel d'histoire de Koveo
                      </CardTitle>
                      <CardDescription className="text-blue-700">
                        {companyHistory.fileInfo.name} • {Math.round(companyHistory.fileInfo.size / 1024)} KB
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-blue-800">
                      {companyHistory.message || "Document d'histoire complet disponible en téléchargement"}
                    </p>
                    {companyHistory.fileInfo.downloadUrl && (
                      <Button
                        onClick={() => window.open(companyHistory.fileInfo.downloadUrl, '_blank')}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="download-histoire-pdf"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger le PDF
                      </Button>
                    )}
                  </div>
                  {companyHistory.fileInfo.lastModified && (
                    <p className="text-sm text-blue-600 mt-2">
                      Dernière mise à jour : {new Date(companyHistory.fileInfo.lastModified).toLocaleDateString('fr-CA')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Display structured content if available */}
            {companyHistory.content && (
              <div className="space-y-8" data-testid="company-history-content">
                {companyHistory.content.title && (
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      {companyHistory.content.title}
                    </h2>
                    {companyHistory.content.subtitle && (
                      <p className="text-xl text-gray-600">
                        {companyHistory.content.subtitle}
                      </p>
                    )}
                  </div>
                )}

                {/* Display sections from the PDF content */}
                {companyHistory.content.sections && companyHistory.content.sections.length > 0 && (
                  <div className="grid gap-6">
                    {companyHistory.content.sections.map((section: any, index: number) => (
                      <Card key={index} className="hover:shadow-lg transition-shadow" data-testid={`history-section-${index}`}>
                        <CardHeader>
                          <div className="flex items-center space-x-4">
                            {section.year && (
                              <div className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">
                                {section.year}
                              </div>
                            )}
                            <CardTitle>{section.title}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-base leading-relaxed">
                            {section.content}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Display mission statement */}
                {companyHistory.content.mission && (
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200" data-testid="company-mission">
                    <CardHeader>
                      <CardTitle className="text-blue-900 flex items-center">
                        <Target className="mr-2 h-6 w-6" />
                        Notre mission officielle
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-blue-800 text-lg leading-relaxed">
                        {companyHistory.content.mission}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Display company values */}
                {companyHistory.content.values && companyHistory.content.values.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                      Nos valeurs fondamentales
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {companyHistory.content.values.map((value: string, index: number) => (
                        <div 
                          key={index}
                          className="bg-white p-4 rounded-lg border border-gray-200 flex items-center space-x-3"
                          data-testid={`company-value-${index}`}
                        >
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show if content is from fallback or real source */}
                {!companyHistory.found && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">
                      <em>Contenu de base affiché - histoire.pdf non trouvé dans le stockage</em>
                    </p>
                  </div>
                )}

                {companyHistory.found && !companyHistory.fileInfo && (
                  <div className="text-center py-4">
                    <p className="text-sm text-blue-600">
                      <em>Contenu chargé depuis les documents d'entreprise</em>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Loading state */}
      {historyLoading && (
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-6"></div>
              <div className="space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Mission Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Notre mission
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Koveo Gestion a été créée avec une vision claire : simplifier la gestion immobilière 
                au Québec en offrant une plateforme technologique moderne, sécurisée et conforme 
                aux réglementations locales.
              </p>
              <p className="text-lg text-gray-600 mb-6">
                Nous croyons que les gestionnaires immobiliers du Québec méritent des outils qui 
                comprennent leurs défis spécifiques, respectent les lois locales et parlent leur langue.
              </p>
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <span className="text-gray-700 font-medium">Fièrement québécois</span>
              </div>
            </div>
            <div className="bg-blue-50 p-8 rounded-lg">
              <Target className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-4">Notre objectif</h3>
              <p className="text-gray-700">
                Devenir la plateforme de référence pour la gestion immobilière au Québec 
                en combinant innovation technologique et respect des particularités locales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Notre parcours
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Depuis notre création, nous nous concentrons sur le développement d'une solution complète et conforme.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {timeline.map((event, index) => (
                <div key={index} className="flex items-start space-x-6" data-testid={`timeline-${index}`}>
                  <div className="flex-shrink-0">
                    <div className="bg-blue-600 rounded-full p-3">
                      <event.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="flex items-center space-x-4 mb-3">
                        <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">
                          {event.year}
                        </span>
                        <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
                      </div>
                      <p className="text-gray-600">{event.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Nos valeurs
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Les principes qui guident notre travail et nos décisions chaque jour.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {values.map((value, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow" data-testid={`value-${index}`}>
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <value.icon className="h-12 w-12 text-blue-600" />
                  <CardTitle className="text-xl">{value.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {value.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Notre équipe
              </h2>
              <p className="text-lg text-gray-600">
                Une équipe d'experts dédiés à votre succès en gestion immobilière.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-semibold mb-6">Expertise québécoise</h3>
                <div className="space-y-4">
                  {teamHighlights.map((highlight, index) => (
                    <div key={index} className="flex items-start space-x-3" data-testid={`team-highlight-${index}`}>
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold mb-4">Notre engagement</h3>
                <p className="text-gray-600 mb-4">
                  Nous nous engageons à comprendre les défis uniques de la gestion immobilière 
                  au Québec et à développer des solutions qui respectent votre contexte réglementaire.
                </p>
                <p className="text-gray-600">
                  Notre équipe combine expertise technique et connaissance approfondie du 
                  marché immobilier québécois.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Nos réalisations
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Ce qui nous rend fiers et nous distingue dans l'industrie.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {achievements.map((achievement, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow" data-testid={`achievement-${index}`}>
              <CardHeader>
                <achievement.icon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <CardTitle className="text-lg">{achievement.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {achievement.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Vision Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">
              Notre vision pour l'avenir
            </h2>
            <p className="text-lg mb-8 text-blue-100">
              Nous continuons à développer notre plateforme en écoutant nos clients et 
              en anticipant leurs besoins futurs. Notre objectif est de rester à la pointe 
              de l'innovation tout en maintenant notre engagement envers la conformité québécoise.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-700 p-6 rounded-lg">
                <h3 className="font-semibold mb-2">Innovation continue</h3>
                <p className="text-blue-100 text-sm">
                  Amélioration constante de nos fonctionnalités
                </p>
              </div>
              <div className="bg-blue-700 p-6 rounded-lg">
                <h3 className="font-semibold mb-2">Expansion mesurée</h3>
                <p className="text-blue-100 text-sm">
                  Croissance responsable au service de nos clients
                </p>
              </div>
              <div className="bg-blue-700 p-6 rounded-lg">
                <h3 className="font-semibold mb-2">Partenariats stratégiques</h3>
                <p className="text-blue-100 text-sm">
                  Collaborations avec l'écosystème immobilier québécois
                </p>
              </div>
            </div>
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3"
              onClick={() => setLocation('/login')}
              data-testid="button-join-story"
            >
              Rejoignez notre histoire
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <img 
                src={koveoLogo} 
                alt="Koveo Gestion" 
                className="h-8 w-8 rounded object-cover"
              />
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <Shield className="h-4 w-4" />
              <span>Conforme à la Loi 25 du Québec</span>
              <span>•</span>
              <span>Vos données sont protégées</span>
              <span>•</span>
              <Link href="/privacy-policy" data-testid="footer-privacy-link">
                <span className="hover:text-white cursor-pointer">Politique de confidentialité</span>
              </Link>
              <span>•</span>
              <Link href="/terms-of-service" data-testid="footer-terms-link">
                <span className="hover:text-white cursor-pointer">Conditions d'utilisation</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}