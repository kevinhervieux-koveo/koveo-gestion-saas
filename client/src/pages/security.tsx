import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
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
  Zap,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

/**
 * Security page component for Koveo Gestion.
 * Comprehensive overview of security features and compliance measures.
 */
export default function SecurityPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const securityFeatures = [
    {
      icon: Lock,
      title: t('enterpriseEncryption'),
      description: t('enterpriseEncryptionDesc'),
      features: [
        'Chiffrement AES-256 pour tous les données',
        'Connexions HTTPS/TLS 1.3 obligatoires',
        'Clés de chiffrement gérées séparément',
        'Rotation automatique des clés de sécurité',
      ],
      badge: 'Niveau militaire',
    },
    {
      icon: UserCheck,
      title: t('roleBasedAccess'),
      description: t('roleBasedAccessDesc'),
      features: [
        'Rôles définis : administrateur, gestionnaire, résident',
        'Permissions granulaires par fonctionnalité',
        'Audit complet des accès et actions',
        'Sessions sécurisées avec expiration automatique',
      ],
      badge: 'Accès contrôlé',
    },
    {
      icon: Database,
      title: t('quebecDataProtection'),
      description: t('quebecDataProtectionDesc'),
      features: [
        'Données hébergées exclusivement au Canada',
        'Conformité Loi 25 - Protection des renseignements',
        'Consentement éclairé et gestion des préférences',
        "Droit à l'oubli et portabilité des données",
      ],
      badge: 'Loi 25',
    },
    {
      icon: Server,
      title: t('secureInfrastructure'),
      description: t('secureInfrastructureDesc'),
      features: [
        'Redondance multi-centres de données',
        'Surveillance de sécurité 24/7/365',
        'Sauvegardes chiffrées automatiques',
        "Plan de reprise d'activité testé",
      ],
      badge: 'Haute disponibilité',
    },
  ];

  const complianceStandards = [
    {
      icon: Shield,
      title: 'Loi 25 du Québec',
      description: 'Conformité complète aux exigences de protection des renseignements personnels',
      status: 'Certifié',
    },
    {
      icon: FileText,
      title: "Standards de l'industrie",
      description: 'Respect des meilleures pratiques de sécurité informatique',
      status: 'Conforme',
    },
    {
      icon: Key,
      title: 'Chiffrement avancé',
      description: 'Implémentation des standards de chiffrement les plus récents',
      status: 'Actif',
    },
  ];

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Navigation Header */}
      <TopNavigationBar />

      {/* Hero Section */}
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

      {/* Security Features */}
      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Sécurité de niveau entreprise
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              Notre plateforme intègre les plus hautes mesures de sécurité pour protéger vos données
              et garantir la confidentialité des informations de vos propriétés.
            </p>
          </div>

          <div className='grid md:grid-cols-2 gap-8 max-w-6xl mx-auto'>
            {securityFeatures.map((feature, index) => (
              <Card key={index} className='relative overflow-hidden border-0 shadow-lg'>
                <div className='absolute top-4 right-4'>
                  <span className='bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full'>
                    {feature.badge}
                  </span>
                </div>
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

      {/* Compliance Section */}
      <section className='bg-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Conformité et certifications
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              Koveo Gestion respecte les réglementations les plus strictes pour assurer la protection
              de vos données et la conformité légale.
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

      {/* Security Measures Detail */}
      <section className='bg-gray-50 py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto'>
            <div className='text-center mb-16'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Mesures de sécurité détaillées
              </h2>
              <p className='text-xl text-gray-600'>
                Découvrez en détail comment nous protégeons vos données.
              </p>
            </div>

            <div className='grid md:grid-cols-2 gap-8'>
              <Card className='border-0 shadow-lg'>
                <CardHeader>
                  <div className='flex items-center space-x-3'>
                    <Database className='h-6 w-6 text-blue-600' />
                    <CardTitle>Protection des données</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='flex items-start space-x-3'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-1' />
                    <span className='text-gray-700 text-sm'>
                      Chiffrement AES-256 pour toutes les données sensibles
                    </span>
                  </div>
                  <div className='flex items-start space-x-3'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-1' />
                    <span className='text-gray-700 text-sm'>
                      Hachage sécurisé des mots de passe avec salt unique
                    </span>
                  </div>
                  <div className='flex items-start space-x-3'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-1' />
                    <span className='text-gray-700 text-sm'>
                      Anonymisation des données pour les analyses
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className='border-0 shadow-lg'>
                <CardHeader>
                  <div className='flex items-center space-x-3'>
                    <Eye className='h-6 w-6 text-blue-600' />
                    <CardTitle>Surveillance et audit</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='flex items-start space-x-3'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-1' />
                    <span className='text-gray-700 text-sm'>
                      Journalisation complète de tous les accès
                    </span>
                  </div>
                  <div className='flex items-start space-x-3'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-1' />
                    <span className='text-gray-700 text-sm'>
                      Détection automatique des activités suspectes
                    </span>
                  </div>
                  <div className='flex items-start space-x-3'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-1' />
                    <span className='text-gray-700 text-sm'>
                      Audits de sécurité réguliers par des tiers
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className='bg-blue-900 text-white py-20'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='text-3xl font-bold mb-4'>
            Prêt à sécuriser votre gestion immobilière?
          </h2>
          <p className='text-xl text-blue-100 mb-8 max-w-2xl mx-auto'>
            Rejoignez les propriétaires qui font confiance à Koveo Gestion pour la sécurité de
            leurs données.
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center'>
            {!isAuthenticated ? (
              <>
                <Link href='/'>
                  <Button size='lg' className='bg-white text-blue-900 hover:bg-gray-100'>
                    Commencer l'essai gratuit
                    <ArrowRight className='ml-2 h-4 w-4' />
                  </Button>
                </Link>
                <Link href='/privacy-policy'>
                  <Button size='lg' variant='outline' className='border-blue-300 text-white hover:bg-blue-800'>
                    Voir la politique de confidentialité
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
            <Link href='/story'>
              <Button variant='outline' size='sm'>
                Notre histoire
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}