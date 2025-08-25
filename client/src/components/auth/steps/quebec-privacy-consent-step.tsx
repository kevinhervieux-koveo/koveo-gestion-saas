import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  FileText,
  Eye,
  Lock,
  Database,
  Phone,
  Mail,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { WizardStepProps } from '../registration-wizard';

/**
 * Interface for Quebec privacy consent step data.
 * Contains consent checkboxes and acknowledgment flags for Law 25 compliance.
 */
interface QuebecPrivacyConsentData {
  dataCollectionConsent: boolean;
  marketingConsent: boolean;
  analyticsConsent: boolean;
  thirdPartyConsent: boolean;
  acknowledgedRights: boolean;
  isValid: boolean;
  consentDate?: string;
}

/**
 * Quebec Privacy Consent Step Component.
 *
 * Collects explicit consent for data processing activities
 * in compliance with Quebec's Law 25 (Bill 64) privacy requirements.
 * @param root0 - The wizard step props.
 * @param root0.data - Current step data.
 * @param root0.onDataChange - Callback when step data changes.
 * @param root0.onValidationChange - Callback when validation status changes.
 * @returns JSX element for the Quebec privacy consent step.
 */
/**
 * QuebecPrivacyConsentStep function.
 * @param root0
 * @param root0.data
 * @param root0.onDataChange
 * @param root0.onValidationChange
 * @param root0._data
 * @returns Function result.
 */
export function QuebecPrivacyConsentStep({
  _data,
  onDataChange,
  onValidationChange,
}: WizardStepProps) {
  const { t: _t } = useLanguage();
  const [formData, setFormData] = useState<QuebecPrivacyConsentData>({
    dataCollectionConsent: false,
    marketingConsent: false,
    analyticsConsent: false,
    thirdPartyConsent: false,
    acknowledgedRights: false,
    isValid: false,
    consentDate: new Date().toISOString(),
    ..._data,
  });

  const [isDataCollectionExpanded, setIsDataCollectionExpanded] = useState(false);

  // Validate form whenever consent data changes
  useEffect(() => {
    const isValid = formData.dataCollectionConsent && formData.acknowledgedRights;
    const updatedData = { ...formData, isValid };

    onDataChange(updatedData);
    onValidationChange(isValid);
  }, [formData]); // Remove callbacks from dependency array to prevent infinite loop

  const _validateForm = () => {
    // Required consents: data collection and rights acknowledgment
    return formData.dataCollectionConsent && formData.acknowledgedRights;
  };

  const handleConsentChange = (field: keyof QuebecPrivacyConsentData, _value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: _value,
      consentDate: new Date().toISOString(), // Update consent timestamp
    }));
  };

  const handleMasterDataCollectionChange = (_value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      dataCollectionConsent: _value, // Essential consent (required)
      marketingConsent: _value, // Optional consent
      analyticsConsent: _value, // Optional consent
      thirdPartyConsent: _value, // Optional consent
      consentDate: new Date().toISOString(),
    }));
  };

  return (
    <div className='space-y-6 max-w-3xl mx-auto'>
      <Alert className='border-blue-200 bg-blue-50'>
        <Shield className='h-4 w-4 text-blue-600' />
        <AlertDescription className='text-blue-800'>
          <strong>Protection des renseignements personnels (Loi 25 - Québec):</strong> Votre
          consentement est requis pour la collecte et l'utilisation de vos données personnelles.
        </AlertDescription>
      </Alert>

      <div className='space-y-6'>
        {/* Data Collection and Processing */}
        <Card>
          <CardContent className='pt-6'>
            <div className='space-y-4'>
              {/* Master Data Collection Checkbox */}
              <div className='bg-green-50 border border-green-200 p-4 rounded-lg'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-start space-x-3 flex-1'>
                    <Checkbox
                      id='masterDataCollectionConsent'
                      checked={
                        formData.dataCollectionConsent &&
                        formData.marketingConsent &&
                        formData.analyticsConsent &&
                        formData.thirdPartyConsent
                      }
                      onCheckedChange={(checked) =>
                        handleMasterDataCollectionChange(checked as boolean)
                      }
                      className='mt-1'
                    />
                    <div className='flex-1'>
                      <div className='flex items-center space-x-2'>
                        <Database className='h-5 w-5 text-blue-600' />
                        <Label
                          htmlFor='masterDataCollectionConsent'
                          className='text-lg font-medium text-green-900 cursor-pointer'
                        >
                          Collecte et traitement des données
                        </Label>
                      </div>
                      <p className='text-xs text-green-800 mt-1'>
                        J'accepte tous les types de collecte et traitement de données (essentielles
                        et optionnelles).
                      </p>
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={() => setIsDataCollectionExpanded(!isDataCollectionExpanded)}
                    className='ml-2 p-1 hover:bg-green-100 rounded-md transition-colors'
                  >
                    {isDataCollectionExpanded ? (
                      <ChevronUp className='h-4 w-4 text-green-700' />
                    ) : (
                      <ChevronDown className='h-4 w-4 text-green-700' />
                    )}
                  </button>
                </div>
              </div>

              {/* Detailed Consents (Collapsible) */}
              {isDataCollectionExpanded && (
                <div className='space-y-3 ml-8'>
                  {/* Essential Data Collection */}
                  <div className='bg-blue-50 border border-blue-200 p-3 rounded-lg'>
                    <div className='flex items-start space-x-3'>
                      <Checkbox
                        id='dataCollectionConsent'
                        checked={formData.dataCollectionConsent}
                        onCheckedChange={(checked) =>
                          handleConsentChange('dataCollectionConsent', checked as boolean)
                        }
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <Label
                          htmlFor='dataCollectionConsent'
                          className='text-sm font-medium text-blue-900 cursor-pointer'
                        >
                          Collecte des données essentielles (Requis) *
                        </Label>
                        <p className='text-xs text-blue-800 mt-1'>
                          Authentification, communication, gestion de compte, services de gestion
                          immobilière.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Marketing Communications */}
                  <div className='bg-gray-50 border border-gray-200 p-3 rounded-lg'>
                    <div className='flex items-start space-x-3'>
                      <Checkbox
                        id='marketingConsent'
                        checked={formData.marketingConsent}
                        onCheckedChange={(checked) =>
                          handleConsentChange('marketingConsent', checked as boolean)
                        }
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <Label
                          htmlFor='marketingConsent'
                          className='text-sm font-medium text-gray-900 cursor-pointer'
                        >
                          Communications marketing (Optionnel)
                        </Label>
                        <p className='text-xs text-gray-600 mt-1'>
                          Communications promotionnelles, nouvelles fonctionnalités, offres
                          spéciales.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Analytics and Performance */}
                  <div className='bg-gray-50 border border-gray-200 p-3 rounded-lg'>
                    <div className='flex items-start space-x-3'>
                      <Checkbox
                        id='analyticsConsent'
                        checked={formData.analyticsConsent}
                        onCheckedChange={(checked) =>
                          handleConsentChange('analyticsConsent', checked as boolean)
                        }
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <Label
                          htmlFor='analyticsConsent'
                          className='text-sm font-medium text-gray-900 cursor-pointer'
                        >
                          Analyse et amélioration (Optionnel)
                        </Label>
                        <p className='text-xs text-gray-600 mt-1'>
                          Données d'utilisation anonymisées pour améliorer les services.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Third Party Services */}
                  <div className='bg-gray-50 border border-gray-200 p-3 rounded-lg'>
                    <div className='flex items-start space-x-3'>
                      <Checkbox
                        id='thirdPartyConsent'
                        checked={formData.thirdPartyConsent}
                        onCheckedChange={(checked) =>
                          handleConsentChange('thirdPartyConsent', checked as boolean)
                        }
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <Label
                          htmlFor='thirdPartyConsent'
                          className='text-sm font-medium text-gray-900 cursor-pointer'
                        >
                          Services tiers intégrés (Optionnel)
                        </Label>
                        <p className='text-xs text-gray-600 mt-1'>
                          Cartographie, notifications, stockage pour améliorer l'expérience.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rights and Acknowledgments */}
        <Card>
          <CardContent className='pt-6'>
            <h3 className='text-lg font-medium text-gray-900 flex items-center mb-4'>
              <Eye className='h-5 w-5 mr-2 text-blue-600' />
              Droits et contrôle
            </h3>

            <div className='space-y-4'>
              {/* Rights Acknowledgment */}
              <div
                className={`p-4 rounded-lg border-2 ${!formData.acknowledgedRights ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-200'}`}
              >
                <div className='flex items-start space-x-3'>
                  <Checkbox
                    id='acknowledgedRights'
                    checked={formData.acknowledgedRights}
                    onCheckedChange={(checked) =>
                      handleConsentChange('acknowledgedRights', checked as boolean)
                    }
                    className='mt-1'
                  />
                  <div className='flex-1'>
                    <Label
                      htmlFor='acknowledgedRights'
                      className={`text-sm font-medium cursor-pointer ${!formData.acknowledgedRights ? 'text-yellow-900' : 'text-blue-900'}`}
                    >
                      Reconnaissance de mes droits (Requis) *
                    </Label>
                    <p
                      className={`text-xs mt-1 ${!formData.acknowledgedRights ? 'text-yellow-800' : 'text-blue-800'}`}
                    >
                      J'ai été informé(e) de mes droits concernant mes renseignements personnels et
                      je comprends que je peux exercer ces droits à tout moment.
                    </p>
                    {!formData.acknowledgedRights && (
                      <p className='text-xs text-yellow-700 font-medium mt-2'>
                        ⚠️ Cette case doit être cochée pour continuer.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* User Rights Information */}
              <div className='bg-white border border-gray-200 p-4 rounded-lg'>
                <h4 className='text-sm font-medium text-gray-900 mb-3'>
                  📋 Vos droits selon la Loi 25 du Québec
                </h4>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600'>
                  <div className='flex items-start space-x-2'>
                    <Eye className='h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>Droit d'accès:</strong> Consulter vos données personnelles
                    </span>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <FileText className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>Droit de rectification:</strong> Corriger des informations inexactes
                    </span>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <Lock className='h-4 w-4 text-red-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>Droit de suppression:</strong> Demander l'effacement de vos données
                    </span>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <Download className='h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>Droit de portabilité:</strong> Récupérer vos données dans un format
                      lisible
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className='bg-gray-50 border border-gray-200 p-4 rounded-lg'>
                <h4 className='text-sm font-medium text-gray-900 mb-2'>
                  📞 Contact pour vos droits
                </h4>
                <p className='text-xs text-gray-600'>
                  Pour exercer vos droits ou pour toute question concernant vos données
                  personnelles, contactez notre responsable de la protection des données:
                </p>
                <div className='mt-2 space-y-1 text-xs text-gray-700'>
                  <div className='flex items-center space-x-2'>
                    <Mail className='h-3 w-3' />
                    <span>info@koveo-gestion.com</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <Phone className='h-3 w-3' />
                    <span>514-712-8441</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention and Security */}
        <Card className='border-green-200 bg-green-50'>
          <CardContent className='pt-6'>
            <h3 className='text-lg font-medium text-green-900 flex items-center mb-4'>
              <Lock className='h-5 w-5 mr-2' />
              Sécurité et conservation
            </h3>

            <div className='space-y-3 text-sm text-green-800'>
              <div className='flex items-start space-x-2'>
                <Shield className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <span>
                  <strong>Sécurité:</strong> Vos données sont chiffrées et stockées sur des serveurs
                  sécurisés au Canada
                </span>
              </div>
              <div className='flex items-start space-x-2'>
                <Database className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <span>
                  <strong>Conservation:</strong> Vos données sont conservées selon les exigences
                  légales québécoises
                </span>
              </div>
              <div className='flex items-start space-x-2'>
                <FileText className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <span>
                  <strong>Transparence:</strong> Consultez notre politique de confidentialité
                  complète à tout moment
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
