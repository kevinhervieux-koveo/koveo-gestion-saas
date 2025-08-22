import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Privacy Policy page component for Koveo Gestion.
 * Comprehensive privacy policy compliant with Quebec Law 25.
 */
export default function PrivacyPolicyPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <img 
                src={koveoLogo} 
                alt="Koveo Gestion" 
                className="h-10 w-10 rounded-lg object-cover cursor-pointer"
                data-testid="logo-link"
              />
            </Link>
            <Button 
              variant="ghost" 
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
          <div className="flex items-center space-x-3">
            <LanguageSwitcher />
            <div className="flex space-x-3">
              {isAuthenticated ? (
                <>
                  <Button variant="outline" onClick={logout} data-testid="button-logout">
                    Déconnexion
                  </Button>
                  <Button onClick={() => setLocation('/dashboard')} className="bg-blue-600 hover:bg-blue-700" data-testid="button-dashboard">
                    Tableau de bord
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setLocation('/login')} data-testid="button-sign-in">
                    Se connecter
                  </Button>
                  <Button onClick={() => setLocation('/login')} className="bg-blue-600 hover:bg-blue-700" data-testid="button-get-started">
                    Commencer
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center space-x-3 mb-8">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Politique de confidentialité
            </h1>
          </div>

          <div className="prose max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>Dernière mise à jour :</strong> Janvier 2025
            </p>

            <p className="text-gray-700 mb-8">
              Chez Koveo Gestion, nous nous engageons à protéger vos renseignements personnels en conformité 
              avec la Loi 25 du Québec sur la protection des renseignements personnels dans le secteur privé 
              et les meilleures pratiques de l'industrie.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Collecte des renseignements</h2>
            <p className="text-gray-700 mb-4">
              Nous collectons les renseignements personnels suivants dans le cadre de nos services :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Informations d'identification (nom, adresse courriel, numéro de téléphone)</li>
              <li>Informations professionnelles (organisation, rôle, adresse d'affaires)</li>
              <li>Données de connexion et d'utilisation de la plateforme</li>
              <li>Communications et correspondances avec notre service client</li>
              <li>Informations de paiement (traitées par des tiers sécurisés)</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Utilisation des renseignements</h2>
            <p className="text-gray-700 mb-4">
              Vos renseignements personnels sont utilisés exclusivement pour :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Fournir et améliorer nos services de gestion immobilière</li>
              <li>Créer et gérer votre compte utilisateur</li>
              <li>Communiquer avec vous concernant votre compte et nos services</li>
              <li>Assurer la sécurité et l'intégrité de notre plateforme</li>
              <li>Respecter nos obligations légales et réglementaires</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Partage et divulgation</h2>
            <p className="text-gray-700 mb-4">
              Nous ne vendons, ne louons, ni ne partageons vos renseignements personnels, sauf dans les cas suivants :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Avec votre consentement explicite</li>
              <li>Avec nos fournisseurs de services tiers de confiance (hébergement, paiement)</li>
              <li>Lorsque requis par la loi ou par une autorité compétente</li>
              <li>Pour protéger nos droits, notre sécurité ou celle de nos utilisateurs</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Protection des données</h2>
            <p className="text-gray-700 mb-4">
              Nous mettons en place des mesures de sécurité techniques, physiques et administratives appropriées :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Chiffrement des données en transit et au repos (AES-256)</li>
              <li>Contrôles d'accès stricts et authentification à deux facteurs</li>
              <li>Surveillance continue de la sécurité et audits réguliers</li>
              <li>Formation du personnel sur la protection des données</li>
              <li>Hébergement des données au Canada uniquement</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Conservation des données</h2>
            <p className="text-gray-700 mb-6">
              Nous conservons vos renseignements personnels uniquement pour la durée nécessaire aux fins 
              pour lesquelles ils ont été collectés, ou selon les exigences légales applicables. 
              Les données sont supprimées de manière sécurisée à la fin de la période de conservation.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Vos droits</h2>
            <p className="text-gray-700 mb-4">
              Conformément à la Loi 25, vous avez le droit de :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Accéder à vos renseignements personnels que nous détenons</li>
              <li>Demander la correction de renseignements inexacts ou incomplets</li>
              <li>Demander la suppression de vos renseignements dans certaines circonstances</li>
              <li>Vous opposer au traitement de vos données à des fins spécifiques</li>
              <li>Retirer votre consentement à tout moment</li>
              <li>Déposer une plainte auprès de la Commission d'accès à l'information du Québec</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Cookies et technologies similaires</h2>
            <p className="text-gray-700 mb-6">
              Nous utilisons des cookies et des technologies similaires pour améliorer votre expérience, 
              analyser l'utilisation de notre site et personnaliser le contenu. Vous pouvez gérer vos 
              préférences de cookies dans les paramètres de votre navigateur.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Modifications de la politique</h2>
            <p className="text-gray-700 mb-6">
              Nous pouvons modifier cette politique de confidentialité occasionnellement. 
              Toute modification importante sera communiquée par courriel et affichée sur notre site. 
              La date de dernière mise à jour est indiquée en haut de cette page.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Contact</h2>
            <p className="text-gray-700 mb-4">
              Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits :
            </p>
            <div className="bg-blue-50 p-6 rounded-lg">
              <p className="text-gray-700">
                <strong>Responsable de la protection des données</strong><br/>
                Koveo Gestion<br/>
                Courriel : privacy@koveogestion.com<br/>
                Téléphone : 1-XXX-XXX-XXXX
              </p>
            </div>
          </div>
        </div>
      </div>

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