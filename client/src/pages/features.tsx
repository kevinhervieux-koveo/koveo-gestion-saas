import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Lock,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

/**
 * Features page component for Koveo Gestion.
 * Detailed presentation of platform features for Quebec property management.
 */
export default function /**
 * Features page function.
 */ /**
 * Features page function.
 */

FeaturesPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const coreFeatures = [
    {
      icon: Building,
      title: 'Gestion de bâtiments complète',
      description:
        'Supervisez tous vos bâtiments avec suivi des maintenances, gestion des résidents, et surveillance de la conformité réglementaire québécoise.',
      features: [
        'Suivi des maintenances préventives et correctives',
        'Gestion des espaces communs',
        'Surveillance de la conformité québécoise',
        'Rapports de performance des bâtiments',
      ],
    },
    {
      icon: Users,
      title: 'Portail résident autonome',
      description:
        'Portail en libre-service pour les résidents afin de consulter les factures, soumettre des demandes, et communiquer avec la gestion immobilière.',
      features: [
        'Consultation des factures et paiements en ligne',
        'Soumission de demandes de maintenance',
        'Communication directe avec la gestion',
        'Historique des interactions et documents',
      ],
    },
    {
      icon: BarChart3,
      title: 'Rapports financiers détaillés',
      description:
        'Analyses financières approfondies, suivi budgétaire, et rapports conformes aux réglementations québécoises pour la transparence.',
      features: [
        'Tableaux de bord financiers en temps réel',
        'Suivi budgétaire et prévisions',
        'Rapports conformes aux normes québécoises',
        'Analyses de rentabilité par propriété',
      ],
    },
    {
      icon: Shield,
      title: 'Conformité Loi 25 du Québec',
      description:
        'Conformité intégrée à la Loi 25 du Québec et aux réglementations de gestion immobilière. Protection des données garantie.',
      features: [
        'Protection des données selon la Loi 25',
        'Conformité aux réglementations immobilières',
        'Audit de sécurité régulier',
        'Gestion des consentements et de la vie privée',
      ],
    },
  ];

  const advancedFeatures = [
    {
      icon: FileText,
      title: 'Gestion documentaire',
      description: 'Stockage sécurisé et organisation de tous vos documents immobiliers',
      features: ['Stockage cloud sécurisé', 'Partage de documents', 'Versions et historique'],
    },
    {
      icon: Bell,
      title: 'Notifications intelligentes',
      description: 'Alertes automatiques pour maintenances, paiements et événements importants',
      features: ['Alertes personnalisables', 'Notifications par courriel', 'Rappels automatiques'],
    },
    {
      icon: CreditCard,
      title: 'Facturation électronique',
      description: 'Système de facturation numérique pour suivre les paiements',
      features: ['Factures électroniques', 'Suivi des paiements', 'Historique des factures'],
    },
    {
      icon: MessageSquare,
      title: 'Communication centralisée',
      description: 'Plateforme de communication unifiée entre gestionnaires et résidents',
      features: ['Messages intégrés', 'Suivi des conversations', 'Communication de masse'],
    },
    {
      icon: Calendar,
      title: 'Planification des maintenances',
      description: "Système de planification intelligent pour l'entretien des propriétés",
      features: ['Calendrier intégré', 'Programmation récurrente', 'Suivi des interventions'],
    },
    {
      icon: Settings,
      title: 'Gestion des processus',
      description: 'Outils pour organiser et gérer les processus de gestion immobilière',
      features: ['Flux de travail organisés', 'Règles de gestion', 'Configuration système'],
    },
  ];

  const quebecCompliance = [
    {
      title: 'Loi 25 - Protection des renseignements personnels',
      description:
        'Conformité complète aux exigences de protection des données personnelles du Québec',
    },
    {
      title: 'Réglementation de la copropriété',
      description: 'Respect des lois québécoises sur la gestion des copropriétés et syndicats',
    },
    {
      title: 'Normes de transparence financière',
      description: 'Rapports financiers conformes aux exigences québécoises de transparence',
    },
    {
      title: 'Accessibilité et bilinguisme',
      description: "Interface bilingue français-anglais et conformité aux normes d'accessibilité",
    },
  ];

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50'>
      {/* Navigation Header */}
      <TopNavigationBar />

      {/* Hero Section */}
      <section className='container mx-auto px-4 py-16 text-center'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-5xl font-bold text-gray-900 mb-6 leading-tight'>
            Fonctionnalités complètes pour
            <span className='text-blue-600'> la gestion immobilière au Québec</span>
          </h1>
          <p className='text-xl text-gray-600 mb-8 leading-relaxed'>
            Découvrez toutes les fonctionnalités de notre plateforme conçue spécifiquement pour
            répondre aux besoins des gestionnaires immobiliers et résidents du Québec.
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center'>
            <Button
              size='lg'
              className='bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3'
              onClick={() => setLocation('/login')}
              data-testid='button-try-features'
            >
              Essayer maintenant
              <ArrowRight className='ml-2 h-5 w-5' />
            </Button>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className='container mx-auto px-4 py-16'>
        <div className='text-center mb-16'>
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>Fonctionnalités principales</h2>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Quatre piliers essentiels pour une gestion immobilière efficace et conforme au Québec.
          </p>
        </div>

        <div className='grid lg:grid-cols-2 gap-8 mb-16'>
          {coreFeatures.map((feature, _index) => (
            <Card
              key={_index}
              className='hover:shadow-lg transition-shadow'
              data-testid={`core-feature-${_index}`}
            >
              <CardHeader>
                <div className='flex items-center space-x-4'>
                  <feature.icon className='h-12 w-12 text-blue-600' />
                  <div>
                    <CardTitle className='text-xl'>{feature.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className='text-base mb-4'>{feature.description}</CardDescription>
                <ul className='space-y-2'>
                  {feature.features.map((item, itemIndex) => (
                    <li key={itemIndex} className='flex items-start space-x-2'>
                      <CheckCircle className='h-5 w-5 text-green-600 mt-0.5 flex-shrink-0' />
                      <span className='text-sm text-gray-700'>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Advanced Features Grid */}
      <section className='bg-gray-50 py-16'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>Fonctionnalités avancées</h2>
            <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
              Outils complémentaires pour optimiser votre gestion immobilière quotidienne.
            </p>
          </div>

          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {advancedFeatures.map((feature, _index) => (
              <Card
                key={_index}
                className='text-center hover:shadow-lg transition-shadow'
                data-testid={`advanced-feature-${_index}`}
              >
                <CardHeader>
                  <feature.icon className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                  <CardTitle className='text-lg'>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className='mb-4'>{feature.description}</CardDescription>
                  <ul className='text-sm space-y-1'>
                    {feature.features.map((item, itemIndex) => (
                      <li key={itemIndex} className='flex items-center space-x-2'>
                        <CheckCircle className='h-4 w-4 text-green-600 flex-shrink-0' />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Quebec Compliance Section */}
      <section className='container mx-auto px-4 py-16'>
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>
            Conformité réglementaire québécoise
          </h2>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Notre plateforme respecte toutes les exigences légales et réglementaires du Québec.
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-8'>
          {quebecCompliance.map((item, _index) => (
            <div
              key={_index}
              className='flex items-start space-x-4'
              data-testid={`compliance-item-${_index}`}
            >
              <Lock className='h-6 w-6 text-blue-600 mt-1 flex-shrink-0' />
              <div>
                <h3 className='font-semibold text-gray-900 mb-2'>{item.title}</h3>
                <p className='text-gray-600'>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className='bg-blue-600 text-white py-16'>
        <div className='container mx-auto px-4 text-center'>
          <div className='max-w-2xl mx-auto'>
            <h2 className='text-3xl font-bold mb-4'>
              Prêt à transformer votre gestion immobilière?
            </h2>
            <p className='text-lg mb-8 text-blue-100'>
              Rejoignez les gestionnaires immobiliers du Québec qui font confiance à Koveo Gestion
              pour leurs besoins de gestion immobilière.
            </p>
            <Button
              size='lg'
              className='bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3'
              onClick={() => setLocation('/login')}
              data-testid='button-start-now'
            >
              Commencer maintenant
              <ArrowRight className='ml-2 h-5 w-5' />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <StandardFooter />
    </div>
  );
}
