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
  X,
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
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);

  const mainFeatures = [
    {
      icon: Building,
      title: t('buildingManagement'),
      description: t('buildingManagementDesc'),
      detailedDescription: language === 'fr' 
        ? 'Gérez facilement tous vos bâtiments avec notre système intégré. Suivez les maintenances préventives et correctives, gérez les espaces communs, surveillez la conformité aux réglementations québécoises et générez des rapports détaillés sur la performance de vos bâtiments.'
        : 'Easily manage all your buildings with our integrated system. Track preventive and corrective maintenance, manage common areas, monitor compliance with Quebec regulations, and generate detailed reports on your buildings\' performance.',
      features: language === 'fr' 
        ? ['Suivi des maintenances préventives et correctives', 'Gestion des espaces communs et réservations', 'Surveillance de la conformité québécoise', 'Rapports de performance détaillés', 'Gestion des fournisseurs et contrats']
        : ['Preventive and corrective maintenance tracking', 'Common area and reservation management', 'Quebec compliance monitoring', 'Detailed performance reports', 'Vendor and contract management']
    },
    {
      icon: Users,
      title: t('residentPortal'),
      description: t('residentPortalDesc'),
      detailedDescription: language === 'fr'
        ? 'Offrez à vos résidents un portail en libre-service complet. Ils peuvent consulter leurs factures, effectuer des paiements en ligne, soumettre des demandes de maintenance, communiquer directement avec la gestion et accéder à leur historique de documents.'
        : 'Provide your residents with a comprehensive self-service portal. They can view their bills, make online payments, submit maintenance requests, communicate directly with management, and access their document history.',
      features: language === 'fr'
        ? ['Consultation des factures et paiements en ligne', 'Soumission de demandes de maintenance', 'Communication directe avec la gestion', 'Historique des interactions et documents', 'Notifications automatiques personnalisées']
        : ['Bill viewing and online payments', 'Maintenance request submission', 'Direct communication with management', 'Interaction and document history', 'Personalized automatic notifications']
    },
    {
      icon: BarChart3,
      title: t('financialReporting'),
      description: t('financialReportingDesc'),
      detailedDescription: language === 'fr'
        ? 'Obtenez une vision claire de vos finances avec nos outils d\'analyse avancés. Tableaux de bord en temps réel, suivi budgétaire précis, prévisions financières et rapports conformes aux normes comptables québécoises.'
        : 'Get a clear view of your finances with our advanced analytics tools. Real-time dashboards, precise budget tracking, financial forecasting, and reports compliant with Quebec accounting standards.',
      features: language === 'fr'
        ? ['Tableaux de bord financiers en temps réel', 'Suivi budgétaire et prévisions', 'Rapports conformes aux normes québécoises', 'Analyses de rentabilité par propriété', 'Gestion des flux de trésorerie']
        : ['Real-time financial dashboards', 'Budget tracking and forecasting', 'Quebec standards compliant reports', 'Profitability analysis by property', 'Cash flow management']
    },
    {
      icon: Shield,
      title: t('law25Compliance'),
      description: t('law25ComplianceDesc'),
      detailedDescription: language === 'fr'
        ? 'Respectez automatiquement la Loi 25 sur la protection des renseignements personnels. Notre plateforme intègre toutes les mesures de sécurité et de confidentialité requises pour protéger les données de vos résidents.'
        : 'Automatically comply with Law 25 on personal information protection. Our platform integrates all required security and privacy measures to protect your residents\' data.',
      features: language === 'fr'
        ? ['Chiffrement des données de bout en bout', 'Contrôles d\'accès granulaires', 'Audit trail complet des accès', 'Gestion des consentements', 'Rapports de conformité automatiques']
        : ['End-to-end data encryption', 'Granular access controls', 'Complete access audit trail', 'Consent management', 'Automatic compliance reports']
    },
    {
      icon: FileText,
      title: t('documentManagement'),
      description: t('documentManagementDesc'),
      detailedDescription: language === 'fr'
        ? 'Stockez, organisez et partagez tous vos documents en toute sécurité. Système de catégorisation intelligent, contrôle d\'accès par rôle et recherche avancée pour retrouver rapidement l\'information.'
        : 'Store, organize and share all your documents securely. Intelligent categorization system, role-based access control, and advanced search to quickly find information.',
      features: language === 'fr'
        ? ['Stockage sécurisé et sauvegarde automatique', 'Catégorisation intelligente des documents', 'Contrôle d\'accès par rôle utilisateur', 'Recherche avancée et indexation', 'Versioning et historique des modifications']
        : ['Secure storage and automatic backup', 'Intelligent document categorization', 'Role-based user access control', 'Advanced search and indexing', 'Versioning and modification history']
    },
    {
      icon: Bell,
      title: t('smartNotifications'),
      description: t('smartNotificationsDesc'),
      detailedDescription: language === 'fr'
        ? 'Restez informé avec notre système de notifications intelligentes. Alertes automatiques pour les échéances, rappels personnalisés et notifications en temps réel pour tous les événements importants.'
        : 'Stay informed with our smart notification system. Automatic alerts for deadlines, personalized reminders, and real-time notifications for all important events.',
      features: language === 'fr'
        ? ['Alertes automatiques pour les échéances', 'Rappels personnalisés configurables', 'Notifications multi-canaux (email, SMS, app)', 'Escalation automatique des urgences', 'Historique complet des notifications']
        : ['Automatic deadline alerts', 'Configurable personalized reminders', 'Multi-channel notifications (email, SMS, app)', 'Automatic emergency escalation', 'Complete notification history']
    },
    {
      icon: CreditCard,
      title: t('electronicBilling'),
      description: t('electronicBillingDesc'),
      detailedDescription: language === 'fr'
        ? 'Simplifiez la facturation avec notre système électronique intégré. Génération automatique des factures, paiements en ligne sécurisés et suivi en temps réel des recouvrements.'
        : 'Simplify billing with our integrated electronic system. Automatic invoice generation, secure online payments, and real-time collection tracking.',
      features: language === 'fr'
        ? ['Génération automatique des factures', 'Paiements en ligne sécurisés', 'Suivi des recouvrements en temps réel', 'Intégration avec les systèmes comptables', 'Rapports de revenus détaillés']
        : ['Automatic invoice generation', 'Secure online payments', 'Real-time collection tracking', 'Accounting system integration', 'Detailed revenue reports']
    },
    {
      icon: MessageSquare,
      title: t('centralizedCommunication'),
      description: t('centralizedCommunicationDesc'),
      detailedDescription: language === 'fr'
        ? 'Centralisez toutes vos communications dans une plateforme unifiée. Messages directs, annonces générales, forums de discussion et historique complet des échanges.'
        : 'Centralize all your communications in one unified platform. Direct messages, general announcements, discussion forums, and complete exchange history.',
      features: language === 'fr'
        ? ['Messagerie directe sécurisée', 'Annonces et notifications générales', 'Forums de discussion par bâtiment', 'Historique complet des communications', 'Modération et contrôle du contenu']
        : ['Secure direct messaging', 'General announcements and notifications', 'Building-specific discussion forums', 'Complete communication history', 'Content moderation and control']
    },
    {
      icon: Calendar,
      title: t('maintenancePlanning'),
      description: t('maintenancePlanningDesc'),
      detailedDescription: language === 'fr'
        ? 'Planifiez intelligemment toutes vos maintenances avec notre système automatisé. Calendrier intégré, rappels automatiques, suivi des coûts et historique complet des interventions.'
        : 'Intelligently plan all your maintenance with our automated system. Integrated calendar, automatic reminders, cost tracking, and complete intervention history.',
      features: language === 'fr'
        ? ['Calendrier de maintenance intégré', 'Planification automatique des tâches récurrentes', 'Suivi des coûts et budgets', 'Historique complet des interventions', 'Gestion des fournisseurs et techniciens']
        : ['Integrated maintenance calendar', 'Automatic recurring task scheduling', 'Cost and budget tracking', 'Complete intervention history', 'Vendor and technician management']
    },
    {
      icon: Settings,
      title: t('processManagement'),
      description: t('processManagementDesc'),
      detailedDescription: language === 'fr'
        ? 'Optimisez vos processus de gestion avec des workflows automatisés. Définissez des procédures standardisées, automatisez les tâches répétitives et suivez les performances en temps réel.'
        : 'Optimize your management processes with automated workflows. Define standardized procedures, automate repetitive tasks, and track performance in real-time.',
      features: language === 'fr'
        ? ['Workflows automatisés personnalisables', 'Procédures standardisées', 'Automatisation des tâches répétitives', 'Indicateurs de performance en temps réel', 'Amélioration continue des processus']
        : ['Customizable automated workflows', 'Standardized procedures', 'Repetitive task automation', 'Real-time performance indicators', 'Continuous process improvement']
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
                <Card 
                  key={index} 
                  className='text-center hover:shadow-lg transition-shadow cursor-pointer hover:scale-105 transform transition-transform'
                  onClick={() => setSelectedFeature(index)}
                  data-testid={`feature-card-${index}`}
                >
                  <CardContent className='p-6'>
                    <div className='w-12 h-12 bg-koveo-navy/10 rounded-lg flex items-center justify-center mx-auto mb-4'>
                      <IconComponent className='h-6 w-6 text-koveo-navy' />
                    </div>
                    <h3 className='font-semibold text-gray-900 mb-2'>{feature.title}</h3>
                    <p className='text-sm text-gray-600'>{feature.description}</p>
                    <p className='text-xs text-koveo-navy mt-2 font-medium'>
                      {language === 'fr' ? 'Cliquez pour plus de détails' : 'Click for more details'}
                    </p>
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

      {/* Feature Detail Modal */}
      <Dialog open={selectedFeature !== null} onOpenChange={() => setSelectedFeature(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedFeature !== null && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl">
                  {(() => {
                    const IconComponent = mainFeatures[selectedFeature].icon;
                    return <IconComponent className="h-8 w-8 text-koveo-navy" />;
                  })()}
                  {mainFeatures[selectedFeature].title}
                </DialogTitle>
                <DialogDescription className="text-lg">
                  {mainFeatures[selectedFeature].detailedDescription}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  {language === 'fr' ? 'Fonctionnalités incluses :' : 'Included features:'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mainFeatures[selectedFeature].features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-gray-600 mb-2">
                      {language === 'fr' 
                        ? 'Cette fonctionnalité est incluse dans notre plan professionnel' 
                        : 'This feature is included in our professional plan'}
                    </p>
                    <div className="text-2xl font-bold text-koveo-navy">
                      $9.50
                    </div>
                    <div className="text-sm text-gray-600">
                      {language === 'fr' ? 'CAD + taxes par porte par mois' : 'CAD + taxes per door per month'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {isAuthenticated ? (
                      <Button
                        onClick={() => setLocation('/dashboard/quick-actions')}
                        className="bg-koveo-navy hover:bg-koveo-navy/90"
                        data-testid="feature-modal-dashboard-btn"
                      >
                        {t('goToDashboard')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <TrialRequestForm>
                        <Button
                          className="bg-koveo-navy hover:bg-koveo-navy/90"
                          data-testid="feature-modal-trial-btn"
                        >
                          {t('getStarted')}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </TrialRequestForm>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
