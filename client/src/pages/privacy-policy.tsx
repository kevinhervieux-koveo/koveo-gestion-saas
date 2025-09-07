import { Button } from '@/components/ui/button';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { Shield, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

/**
 * Privacy Policy page component for Koveo Gestion.
 * Comprehensive privacy policy compliant with Quebec Law 25.
 */
export default function PrivacyPolicyPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Navigation Header */}
      <TopNavigationBar />

      {/* Content */}
      <div className='container mx-auto px-4 py-12 max-w-4xl'>
        <div className='bg-white rounded-lg shadow-sm p-8'>
          <div className='flex items-center space-x-3 mb-8'>
            <Shield className='h-8 w-8 text-blue-600' />
            <h1 className='text-3xl font-bold text-gray-900'>{t('privacyPolicyTitle')}</h1>
          </div>

          <div className='prose max-w-none'>
            <p className='text-gray-600 mb-6'>
              <strong>{t('lastUpdated')}</strong> Janvier 2025
            </p>

            <p className='text-gray-700 mb-8'>
              {t('privacyPolicyIntro')}
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('informationCollection')}
            </h2>
            <p className='text-gray-700 mb-4'>
              {t('informationCollectionDesc')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Informations d'identification (nom, adresse courriel, numéro de téléphone)</li>
              <li>Informations professionnelles (organisation, rôle, adresse d'affaires)</li>
              <li>Données de connexion et d'utilisation de la plateforme</li>
              <li>Communications et correspondances avec notre service client</li>
              <li>Informations de paiement (traitées par des tiers sécurisés)</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              {t('informationUse')}
            </h2>
            <p className='text-gray-700 mb-4'>
              {t('informationUseDesc')}
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Fournir et améliorer nos services de gestion immobilière</li>
              <li>Créer et gérer votre compte utilisateur</li>
              <li>Communiquer avec vous concernant votre compte et nos services</li>
              <li>Assurer la sécurité et l'intégrité de notre plateforme</li>
              <li>Respecter nos obligations légales et réglementaires</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('informationSharing')}</h2>
            <p className='text-gray-700 mb-4'>
              Nous ne vendons, ne louons, ni ne partageons vos renseignements personnels, sauf dans
              les cas suivants :
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Avec votre consentement explicite</li>
              <li>Avec nos fournisseurs de services tiers de confiance (hébergement, paiement)</li>
              <li>Lorsque requis par la loi ou par une autorité compétente</li>
              <li>Pour protéger nos droits, notre sécurité ou celle de nos utilisateurs</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('dataSecurity')}</h2>
            <p className='text-gray-700 mb-4'>
              Nous mettons en place des mesures de sécurité techniques, physiques et administratives
              appropriées :
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Chiffrement des données en transit et au repos (AES-256)</li>
              <li>Contrôles d'accès stricts et authentification à deux facteurs</li>
              <li>Surveillance continue et audits de sécurité réguliers</li>
              <li>Formation du personnel sur la protection des données</li>
              <li>Sauvegarde sécurisée et plans de récupération</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('privacyRights')}</h2>
            <p className='text-gray-700 mb-4'>
              Conformément à la Loi 25, vous avez le droit de :
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Accéder à vos renseignements personnels</li>
              <li>Demander la rectification de vos données</li>
              <li>Demander la suppression de vos renseignements</li>
              <li>Retirer votre consentement à tout moment</li>
              <li>Porter plainte auprès de la Commission d'accès à l'information</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>{t('contactPrivacy')}</h2>
            <p className='text-gray-700 mb-6'>
              Pour toute question concernant cette politique de confidentialité ou pour exercer vos
              droits, contactez-nous :
            </p>
            <div className='bg-blue-50 p-6 rounded-lg'>
              <p className='text-gray-700 mb-2'>
                <strong>Koveo Gestion</strong>
              </p>
              <p className='text-gray-700 mb-2'>
                Courriel : <a href='mailto:privacy@koveo-gestion.com' className='text-blue-600 hover:underline'>privacy@koveo-gestion.com</a>
              </p>
              <p className='text-gray-700'>
                Responsable de la protection des renseignements personnels
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className='mt-12 pt-8 border-t border-gray-200 flex justify-between'>
            <Button
              variant='outline'
              onClick={() => setLocation('/')}
              data-testid='button-back-home'
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              Retour à l'accueil
            </Button>
            
            {!isAuthenticated && (
              <Link href='/login'>
                <Button data-testid='button-login'>
                  Se connecter
                  <ArrowRight className='ml-2 h-4 w-4' />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}