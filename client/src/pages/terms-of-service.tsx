import { Button } from '@/components/ui/button';
import { TopNavigationBar } from '@/components/layout/TopNavigationBar';
import { Shield, ArrowLeft, FileText } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

/**
 * Terms of Service page component for Koveo Gestion.
 * Comprehensive terms of service for Quebec property management platform.
 */
export default function /**
 * Terms of service page function.
 */ /**
 * Terms of service page function.
 */

TermsOfServicePage() {
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
            <FileText className='h-8 w-8 text-blue-600' />
            <h1 className='text-3xl font-bold text-gray-900'>Conditions d'utilisation</h1>
          </div>

          <div className='prose max-w-none'>
            <p className='text-gray-600 mb-6'>
              <strong>Dernière mise à jour :</strong> Janvier 2025
            </p>

            <p className='text-gray-700 mb-8'>
              Ces conditions d'utilisation régissent votre accès et votre utilisation de la
              plateforme Koveo Gestion, un service de gestion immobilière conçu pour le marché
              québécois.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              1. Acceptation des conditions
            </h2>
            <p className='text-gray-700 mb-6'>
              En accédant ou en utilisant notre plateforme, vous acceptez d'être lié par ces
              conditions d'utilisation et notre politique de confidentialité. Si vous n'acceptez pas
              ces conditions, veuillez ne pas utiliser nos services.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>2. Description du service</h2>
            <p className='text-gray-700 mb-4'>
              Koveo Gestion fournit une plateforme de gestion immobilière comprenant :
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Gestion de bâtiments et de résidences</li>
              <li>Portail résident pour communications et paiements</li>
              <li>Outils de suivi financier et de rapports</li>
              <li>Gestion documentaire sécurisée</li>
              <li>Fonctionnalités de conformité québécoise</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>3. Comptes utilisateur</h2>
            <p className='text-gray-700 mb-4'>Pour utiliser notre service, vous devez :</p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Créer un compte avec des informations exactes et à jour</li>
              <li>Maintenir la sécurité de vos identifiants de connexion</li>
              <li>Nous informer immédiatement de tout accès non autorisé</li>
              <li>Être responsable de toutes les activités sous votre compte</li>
              <li>Respecter les lois applicables du Québec et du Canada</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>4. Utilisation acceptable</h2>
            <p className='text-gray-700 mb-4'>Vous vous engagez à ne pas :</p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Utiliser le service à des fins illégales ou non autorisées</li>
              <li>Tenter d'accéder aux comptes d'autres utilisateurs</li>
              <li>Interférer avec le fonctionnement du service</li>
              <li>Télécharger ou transmettre des virus ou codes malveillants</li>
              <li>Violer les droits de propriété intellectuelle</li>
              <li>Harceler ou nuire à d'autres utilisateurs</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              5. Propriété intellectuelle
            </h2>
            <p className='text-gray-700 mb-6'>
              Koveo Gestion et ses concédants détiennent tous les droits de propriété intellectuelle
              relatifs au service, y compris les logiciels, contenus, marques et designs. Vous
              conservez la propriété de vos données, mais nous accordez une licence d'utilisation
              nécessaire pour fournir le service.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              6. Confidentialité et données
            </h2>
            <p className='text-gray-700 mb-6'>
              Notre traitement de vos données personnelles est régi par notre politique de
              confidentialité, qui respecte la Loi 25 du Québec. Vous vous engagez à respecter la
              confidentialité des informations d'autres utilisateurs auxquelles vous pourriez avoir
              accès.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              7. Paiements et facturation
            </h2>
            <p className='text-gray-700 mb-4'>Les conditions de paiement comprennent :</p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Les frais sont facturés selon votre plan d'abonnement choisi</li>
              <li>Le paiement est dû à l'avance pour chaque période de facturation</li>
              <li>Les taxes applicables s'ajoutent aux frais d'abonnement</li>
              <li>Le non-paiement peut entraîner la suspension du service</li>
              <li>Les remboursements sont accordés selon notre politique de remboursement</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              8. Disponibilité du service
            </h2>
            <p className='text-gray-700 mb-6'>
              Nous nous efforçons de maintenir une haute disponibilité du service, mais ne
              garantissons pas un accès ininterrompu. Nous pouvons effectuer des maintenances
              programmées avec préavis raisonnable.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>
              9. Limitation de responsabilité
            </h2>
            <p className='text-gray-700 mb-6'>
              Dans les limites permises par la loi québécoise, notre responsabilité est limitée au
              montant payé pour le service au cours des 12 derniers mois. Nous ne sommes pas
              responsables des dommages indirects, consécutifs ou punitifs.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>10. Résiliation</h2>
            <p className='text-gray-700 mb-4'>
              Vous pouvez résilier votre compte à tout moment. Nous pouvons suspendre ou résilier
              votre accès en cas de :
            </p>
            <ul className='list-disc pl-6 text-gray-700 mb-6'>
              <li>Violation de ces conditions d'utilisation</li>
              <li>Non-paiement des frais dus</li>
              <li>Activité frauduleuse ou illégale</li>
              <li>Cessation du service (avec préavis de 30 jours)</li>
            </ul>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>11. Droit applicable</h2>
            <p className='text-gray-700 mb-6'>
              Ces conditions sont régies par les lois du Québec et du Canada. Tout différend sera
              soumis à la juridiction exclusive des tribunaux du Québec.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>12. Modifications</h2>
            <p className='text-gray-700 mb-6'>
              Nous nous réservons le droit de modifier ces conditions occasionnellement. Les
              modifications importantes seront communiquées par courriel avec un préavis de 30
              jours.
            </p>

            <h2 className='text-2xl font-semibold text-gray-900 mb-4'>13. Contact</h2>
            <p className='text-gray-700 mb-4'>
              Pour toute question concernant ces conditions d'utilisation :
            </p>
            <div className='bg-blue-50 p-6 rounded-lg'>
              <p className='text-gray-700'>
                <strong>Service client Koveo Gestion</strong>
                <br />
                Courriel : info@koveo-gestion.com
                <br />
                Téléphone : 1-514-712-8441
                <br />
                Adresse : Montréal, Québec, Canada
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className='bg-gray-900 text-white py-12'>
        <div className='container mx-auto px-4'>
          <div className='flex flex-col md:flex-row items-center justify-between'>
            <div className='flex items-center mb-4 md:mb-0'>
              <img src={koveoLogo} alt='Koveo Gestion' className='h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover shadow-sm' />
            </div>
            <div className='flex items-center space-x-4 text-sm text-gray-400'>
              <Shield className='h-4 w-4' />
              <span>Conforme à la Loi 25 du Québec</span>
              <span>•</span>
              <span>Vos données sont protégées</span>
              <span>•</span>
              <Link href='/privacy-policy' data-testid='footer-privacy-link'>
                <span className='hover:text-white cursor-pointer'>
                  Politique de confidentialité
                </span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
