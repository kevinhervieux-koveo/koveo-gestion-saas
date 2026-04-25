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
  const { t } = useLanguage();
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
    
    // Only update if validation state actually changed
    if (formData.isValid !== isValid) {
      const updatedData = { ...formData, isValid };
      onDataChange(updatedData);
      onValidationChange(isValid);
    }
  }, [formData.dataCollectionConsent, formData.acknowledgedRights, formData.isValid]);

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
          <strong>{t('authPrivacyAlertTitle')}</strong> {t('authPrivacyAlertText')}
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
                          {t('authDataCollectionTitle')}
                        </Label>
                      </div>
                      <p className='text-xs text-green-800 mt-1'>
                        {t('authDataCollectionMasterText')}
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
                          {t('authEssentialDataLabel')}
                        </Label>
                        <p className='text-xs text-blue-800 mt-1'>
                          {t('authEssentialDataDesc')}
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
                          {t('authMarketingLabel')}
                        </Label>
                        <p className='text-xs text-gray-600 mt-1'>
                          {t('authMarketingDesc')}
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
                          {t('authAnalyticsLabel')}
                        </Label>
                        <p className='text-xs text-gray-600 mt-1'>
                          {t('authAnalyticsDesc')}
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
                          {t('authThirdPartyLabel')}
                        </Label>
                        <p className='text-xs text-gray-600 mt-1'>
                          {t('authThirdPartyDesc')}
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
              {t('authRightsAndControl')}
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
                      {t('authAcknowledgeRightsLabel')}
                    </Label>
                    <p
                      className={`text-xs mt-1 ${!formData.acknowledgedRights ? 'text-yellow-800' : 'text-blue-800'}`}
                    >
                      {t('authAcknowledgeRightsDesc')}
                    </p>
                    {!formData.acknowledgedRights && (
                      <p className='text-xs text-yellow-700 font-medium mt-2'>
                        {t('authAcknowledgeRightsWarning')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* User Rights Information */}
              <div className='bg-white border border-gray-200 p-4 rounded-lg'>
                <h4 className='text-sm font-medium text-gray-900 mb-3'>
                  {t('authYourRightsTitle')}
                </h4>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600'>
                  <div className='flex items-start space-x-2'>
                    <Eye className='h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>{t('authRightAccess')}</strong> {t('authRightAccessDesc')}
                    </span>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <FileText className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>{t('authRightRectification')}</strong>{' '}
                      {t('authRightRectificationDesc')}
                    </span>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <Lock className='h-4 w-4 text-red-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>{t('authRightDeletion')}</strong> {t('authRightDeletionDesc')}
                    </span>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <Download className='h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>{t('authRightPortability')}</strong>{' '}
                      {t('authRightPortabilityDesc')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className='bg-gray-50 border border-gray-200 p-4 rounded-lg'>
                <h4 className='text-sm font-medium text-gray-900 mb-2'>
                  {t('authContactRightsTitle')}
                </h4>
                <p className='text-xs text-gray-600'>{t('authContactRightsDesc')}</p>
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
              {t('authSecurityRetentionTitle')}
            </h3>

            <div className='space-y-3 text-sm text-green-800'>
              <div className='flex items-start space-x-2'>
                <Shield className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <span>
                  <strong>{t('authSecurityLabel')}</strong> {t('authSecurityDesc')}
                </span>
              </div>
              <div className='flex items-start space-x-2'>
                <Database className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <span>
                  <strong>{t('authRetentionLabel')}</strong> {t('authRetentionDesc')}
                </span>
              </div>
              <div className='flex items-start space-x-2'>
                <FileText className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <span>
                  <strong>{t('authTransparencyLabel')}</strong> {t('authTransparencyDesc')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
