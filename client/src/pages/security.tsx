import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HamburgerMenu } from '@/components/ui/hamburger-menu';
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
  AlertTriangle
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Security page component for Koveo Gestion.
 * Comprehensive overview of security features and compliance measures.
 */
export default function  /**
   * Security page function.
   */
 SecurityPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const securityFeatures = [
    {
      icon: Lock,
      title: "Chiffrement de niveau entreprise",
      description: "Toutes les données sont chiffrées en transit et au repos avec des standards militaires AES-256.",
      features: [
        "Chiffrement AES-256 pour tous les données",
        "Connexions HTTPS/TLS 1.3 obligatoires",
        "Clés de chiffrement gérées séparément",
        "Rotation automatique des clés de sécurité"
      ],
      badge: "Niveau militaire"
    },
    {
      icon: UserCheck,
      title: "Contrôle d'accès basé sur les rôles",
      description: "Système d'autorisation granulaire garantissant que chaque utilisateur n'accède qu'aux informations nécessaires.",
      features: [
        "Rôles définis : administrateur, gestionnaire, résident",
        "Permissions granulaires par fonctionnalité",
        "Audit complet des accès et actions",
        "Sessions sécurisées avec expiration automatique"
      ],
      badge: "Accès contrôlé"
    },
    {
      icon: Database,
      title: "Protection des données québécoises",
      description: "Conformité stricte à la Loi 25 du Québec avec hébergement des données au Canada.",
      features: [
        "Données hébergées exclusivement au Canada",
        "Conformité Loi 25 - Protection des renseignements",
        "Consentement éclairé et gestion des préférences",
        "Droit à l'oubli et portabilité des données"
      ],
      badge: "Loi 25"
    },
    {
      icon: Server,
      title: "Infrastructure sécurisée",
      description: "Architecture cloud redondante avec surveillance 24/7 et sauvegardes automatisées.",
      features: [
        "Redondance multi-centres de données",
        "Surveillance de sécurité 24/7/365",
        "Sauvegardes chiffrées automatiques",
        "Plan de reprise d'activité testé"
      ],
      badge: "Haute disponibilité"
    }
  ];

  const complianceStandards = [
    {
      icon: Shield,
      title: "Loi 25 du Québec",
      description: "Conformité complète aux exigences de protection des renseignements personnels",
      status: "Certifié"
    },
    {
      icon: FileText,
      title: "Standards de l'industrie",
      description: "Respect des meilleures pratiques de sécurité informatique",
      status: "Conforme"
    },
    {
      icon: Eye,
      title: "Audits de sécurité",
      description: "Audits réguliers par des experts en cybersécurité indépendants",
      status: "Régulier"
    },
    {
      icon: AlertTriangle,
      title: "Gestion des incidents",
      description: "Protocole de réponse aux incidents et notification transparente",
      status: "Protocole actif"
    }
  ];

  const privacyFeatures = [
    "Anonymisation automatique des données sensibles",
    "Contrôle utilisateur sur ses données personnelles",
    "Suppression sécurisée à la fin de contrat",
    "Audit trail complet des accès aux données",
    "Chiffrement des communications internes",
    "Isolation des données par organisation"
  ];

  const technicalSafeguards = [
    {
      category: "Sécurité réseau",
      items: [
        "Pare-feu nouvelle génération (NGFW)",
        "Détection d'intrusion en temps réel",
        "Isolation des environnements de données",
        "VPN sécurisé pour accès administrateur"
      ]
    },
    {
      category: "Sécurité applicative",
      items: [
        "Tests de pénétration réguliers",
        "Analyse statique du code source",
        "Validation stricte des entrées utilisateur",
        "Protection contre OWASP Top 10"
      ]
    },
    {
      category: "Sécurité opérationnelle",
      items: [
        "Formation continue du personnel",
        "Gestion centralisée des logs de sécurité",
        "Monitoring des anomalies comportementales",
        "Mise à jour automatique des composants"
      ]
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
            Sécurité de niveau entreprise pour
            <span className="text-blue-600"> vos données immobilières</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Koveo Gestion utilise les technologies de sécurité les plus avancées pour protéger 
            vos données personnelles et celles de vos résidents, en conformité avec la Loi 25 du Québec.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
              onClick={() => setLocation('/login')}
              data-testid="button-secure-start"
            >
              Commencer en toute sécurité
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Security Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Sécurité multicouche
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Notre approche de sécurité en profondeur protège vos données à chaque niveau de notre plateforme.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {securityFeatures.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow" data-testid={`security-feature-${index}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <feature.icon className="h-12 w-12 text-blue-600" />
                    <div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </div>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {feature.badge}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mb-4">
                  {feature.description}
                </CardDescription>
                <ul className="space-y-2">
                  {feature.features.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Compliance Standards */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Conformité et certifications
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Nous respectons les plus hauts standards de sécurité et de confidentialité.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {complianceStandards.map((standard, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow" data-testid={`compliance-${index}`}>
                <CardHeader>
                  <standard.icon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <CardTitle className="text-lg">{standard.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {standard.description}
                  </CardDescription>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    {standard.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Protection */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Protection de la vie privée
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Vos données personnelles et celles de vos résidents sont protégées selon les plus hauts standards.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Mesures de confidentialité</h3>
              <div className="space-y-3">
                {privacyFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-2" data-testid={`privacy-feature-${index}`}>
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-blue-900">Engagement Loi 25</h3>
              <p className="text-blue-800 mb-4">
                Koveo Gestion s'engage à respecter intégralement la Loi 25 du Québec sur la protection des renseignements personnels.
              </p>
              <ul className="space-y-2 text-blue-700">
                <li>• Consentement éclairé et révocable</li>
                <li>• Transparence sur l'utilisation des données</li>
                <li>• Droit d'accès et de rectification</li>
                <li>• Notification des incidents de sécurité</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Safeguards */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Mesures techniques de protection
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {technicalSafeguards.map((safeguard, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow" data-testid={`safeguard-${index}`}>
                <CardHeader>
                  <CardTitle className="text-lg text-center">{safeguard.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {safeguard.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start space-x-2">
                        <Zap className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Vos données en sécurité, votre gestion simplifiée
            </h2>
            <p className="text-lg mb-8 text-blue-100">
              Profitez d'une plateforme de gestion immobilière sécurisée qui respecte 
              vos exigences de confidentialité et de conformité.
            </p>
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3"
              onClick={() => setLocation('/login')}
              data-testid="button-secure-trial"
            >
              Essai sécurisé gratuit
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