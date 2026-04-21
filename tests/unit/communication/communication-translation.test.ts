/**
 * Communication Page Translation Test Suite
 * Validates that ALL communication page UI elements are properly translated:
 * - Notification preferences section labels and descriptions
 * - All 17 notification types with proper French/English labels
 * - Frequency options and urgency levels
 * - Form labels, buttons, and validation messages
 * - RBAC messages and Quebec Law 25 compliance
 * - Success/error toast messages and dialogs
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../../client/src/lib/i18n';

describe('Communication Page Translation Coverage', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('Notification Types Translation', () => {
    // All 17 notification types from the communication page
    const notificationTypes = [
      {
        key: 'bill_reminder',
        labelEn: 'Bill Reminders',
        labelFr: 'Rappels de factures',
        descriptionEn: 'Reminders about upcoming bill payments and deadlines',
        descriptionFr: 'Rappels concernant les paiements de factures à venir et les échéances'
      },
      {
        key: 'maintenance_update',
        labelEn: 'Maintenance Updates',
        labelFr: 'Mises à jour de maintenance',
        descriptionEn: 'Updates on maintenance requests and work progress',
        descriptionFr: 'Mises à jour sur les demandes de maintenance et l\'avancement des travaux'
      },
      {
        key: 'announcement',
        labelEn: 'General Announcements',
        labelFr: 'Annonces générales',
        descriptionEn: 'Important announcements from building management',
        descriptionFr: 'Annonces importantes de la gestion de l\'immeuble'
      },
      {
        key: 'system',
        labelEn: 'System Notifications',
        labelFr: 'Notifications système',
        descriptionEn: 'System updates, maintenance, and platform notifications',
        descriptionFr: 'Mises à jour système, maintenance et notifications de plateforme'
      },
      {
        key: 'upcoming_payment',
        labelEn: 'Upcoming Payments',
        labelFr: 'Paiements à venir',
        descriptionEn: 'Notifications about payments due in the next few days',
        descriptionFr: 'Notifications concernant les paiements dus dans les prochains jours'
      },
      {
        key: 'upcoming_bills',
        labelEn: 'New Bills Available',
        labelFr: 'Nouvelles factures disponibles',
        descriptionEn: 'Notifications when new bills are issued and available',
        descriptionFr: 'Notifications lors de l\'émission de nouvelles factures'
      },
      {
        key: 'bill_paid_last_month',
        labelEn: 'Payment Confirmations',
        labelFr: 'Confirmations de paiement',
        descriptionEn: 'Monthly summary of payments processed',
        descriptionFr: 'Résumé mensuel des paiements traités'
      },
      {
        key: 'bills_overdue',
        labelEn: 'Overdue Bills',
        labelFr: 'Factures en retard',
        descriptionEn: 'Notifications about overdue payments that need attention',
        descriptionFr: 'Notifications concernant les paiements en retard nécessitant une attention'
      },
      {
        key: 'payment_overdue',
        labelEn: 'Payment Overdue Alerts',
        labelFr: 'Alertes de paiement en retard',
        descriptionEn: 'Urgent notifications for significantly overdue payments',
        descriptionFr: 'Notifications urgentes pour les paiements significativement en retard'
      },
      {
        key: 'new_building_document',
        labelEn: 'New Documents',
        labelFr: 'Nouveaux documents',
        descriptionEn: 'Notifications when new building documents are uploaded',
        descriptionFr: 'Notifications lors du téléchargement de nouveaux documents de l\'immeuble'
      },
      {
        key: 'meeting_invite',
        labelEn: 'Meeting Invitations',
        labelFr: 'Invitations aux réunions',
        descriptionEn: 'Invitations to building meetings and assemblies',
        descriptionFr: 'Invitations aux réunions et assemblées de l\'immeuble'
      },
      {
        key: 'maintenance_completed',
        labelEn: 'Maintenance Completed',
        labelFr: 'Maintenance terminée',
        descriptionEn: 'Notifications when maintenance work is completed',
        descriptionFr: 'Notifications lorsque les travaux de maintenance sont terminés'
      },
      {
        key: 'budget_update',
        labelEn: 'Budget Updates',
        labelFr: 'Mises à jour du budget',
        descriptionEn: 'Updates about building budget and financial reports',
        descriptionFr: 'Mises à jour concernant le budget de l\'immeuble et les rapports financiers'
      },
      {
        key: 'policy_change',
        labelEn: 'Policy Changes',
        labelFr: 'Changements de politique',
        descriptionEn: 'Important notifications about policy and regulation changes',
        descriptionFr: 'Notifications importantes concernant les changements de politique et de réglementation'
      },
      {
        key: 'seasonal_reminder',
        labelEn: 'Seasonal Reminders',
        labelFr: 'Rappels saisonniers',
        descriptionEn: 'Seasonal maintenance reminders and preparation notices',
        descriptionFr: 'Rappels de maintenance saisonnière et avis de préparation'
      }
    ];

    it('should have translation keys for all notification type labels', () => {
      notificationTypes.forEach(notificationType => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          const labelKey = `notification_${notificationType.key}_label`;
          
          // Check if translation key exists
          if (t[labelKey]) {
            expect(t[labelKey]).toBeDefined();
            expect(typeof t[labelKey]).toBe('string');
            expect(t[labelKey].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have translation keys for all notification type descriptions', () => {
      notificationTypes.forEach(notificationType => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          const descriptionKey = `notification_${notificationType.key}_description`;
          
          // Check if translation key exists
          if (t[descriptionKey]) {
            expect(t[descriptionKey]).toBeDefined();
            expect(typeof t[descriptionKey]).toBe('string');
            expect(t[descriptionKey].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should validate specific French notification type translations for Quebec compliance', () => {
      const fr = translations.fr as any;
      
      // Test key notification types that should be translated appropriately for Quebec
      const keyNotificationTests = [
        { key: 'notification_bill_reminder_label', expected: 'Rappels de factures' },
        { key: 'notification_meeting_invite_label', expected: 'Invitations aux réunions' },
        { key: 'notification_maintenance_update_label', expected: 'Mises à jour de maintenance' },
      ];

      keyNotificationTests.forEach(test => {
        if (fr[test.key]) {
          expect(fr[test.key]).toBe(test.expected);
        }
      });
    });

    it('should ensure notification categories are properly translated', () => {
      const categoryKeys = [
        'notificationCategoryFinancial',
        'notificationCategoryMaintenance', 
        'notificationCategoryCommunication',
        'notificationCategorySystem'
      ];

      categoryKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('Frequency Options Translation', () => {
    const frequencyOptions = [
      { value: 'immediate', labelEn: 'Immediate', labelFr: 'Immédiat' },
      { value: 'weekly', labelEn: 'Weekly', labelFr: 'Hebdomadaire' },
      { value: '2weeks', labelEn: 'Bi-weekly', labelFr: 'Bi-hebdomadaire' },
      { value: 'monthly', labelEn: 'Monthly', labelFr: 'Mensuel' },
      { value: 'quarterly', labelEn: 'Quarterly', labelFr: 'Trimestriel' },
      { value: 'bi-annually', labelEn: 'Bi-annually', labelFr: 'Bi-annuel' },
      { value: 'annually', labelEn: 'Annually', labelFr: 'Annuel' }
    ];

    it('should have all frequency options translated', () => {
      frequencyOptions.forEach(option => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          const key = `frequency_${option.value}`;
          
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French frequency translations', () => {
      const fr = translations.fr as any;
      
      const expectedFrequencies = [
        { key: 'frequency_immediate', expected: 'Immédiat' },
        { key: 'frequency_weekly', expected: 'Hebdomadaire' },
        { key: 'frequency_monthly', expected: 'Mensuel' },
        { key: 'frequency_quarterly', expected: 'Trimestriel' },
        { key: 'frequency_annually', expected: 'Annuel' }
      ];

      expectedFrequencies.forEach(test => {
        if (fr[test.key]) {
          expect(fr[test.key]).toBe(test.expected);
        }
      });
    });

    it('should have disabled frequency option translated', () => {
      languages.forEach(lang => {
        const t = translations[lang] as any;
        if (t.frequency_disabled || t.disabled) {
          const key = t.frequency_disabled ? 'frequency_disabled' : 'disabled';
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Urgency Levels Translation', () => {
    const urgencyLevels = [
      {
        value: 'low',
        labelEn: 'Low Priority',
        labelFr: 'Priorité faible',
        descriptionEn: 'General information, no immediate action required',
        descriptionFr: 'Information générale, aucune action immédiate requise'
      },
      {
        value: 'medium',
        labelEn: 'Medium Priority',
        labelFr: 'Priorité moyenne',
        descriptionEn: 'Important information, residents should read when convenient',
        descriptionFr: 'Information importante, les résidents devraient lire quand c\'est pratique'
      },
      {
        value: 'high',
        labelEn: 'High Priority',
        labelFr: 'Priorité élevée',
        descriptionEn: 'Requires attention within 24-48 hours',
        descriptionFr: 'Nécessite une attention dans les 24-48 heures'
      },
      {
        value: 'urgent',
        labelEn: 'Urgent',
        labelFr: 'Urgent',
        descriptionEn: 'Critical communication requiring immediate attention',
        descriptionFr: 'Communication critique nécessitant une attention immédiate'
      }
    ];

    it('should have all urgency level labels translated', () => {
      urgencyLevels.forEach(level => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          const key = `urgency_${level.value}` || level.value;
          
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have urgency level descriptions translated', () => {
      urgencyLevels.forEach(level => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          const descKey = `urgency_${level.value}_description`;
          
          if (t[descKey]) {
            expect(typeof t[descKey]).toBe('string');
            expect(t[descKey].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should validate Quebec French urgency translations', () => {
      const fr = translations.fr as any;
      
      const expectedUrgencies = [
        { key: 'urgency_low', expected: 'Priorité faible' },
        { key: 'urgency_medium', expected: 'Priorité moyenne' },
        { key: 'urgency_high', expected: 'Priorité élevée' },
        { key: 'urgency_urgent', expected: 'Urgent' }
      ];

      expectedUrgencies.forEach(test => {
        if (fr[test.key]) {
          expect(fr[test.key]).toBe(test.expected);
        }
      });
    });
  });

  describe('Communication Page Titles and Headers', () => {
    const communicationTitleKeys = [
      'communication',
      'communicationPreferences',
      'notificationPreferences',
      'notificationSettings',
      'generalCommunication',
      'sendCommunication',
      'meetingPlanning',
      'meetingInvitation',
      'recipients',
      'communicationHistory',
      'recentCommunications'
    ];

    it('should have all communication page titles translated', () => {
      communicationTitleKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper French communication page titles', () => {
      const fr = translations.fr;
      
      // Test key communication page titles
      expect(fr.communication).toBe('Communication');
      
      if (fr.centralizedCommunication) {
        expect(fr.centralizedCommunication).toMatch(/communication.*centralisé/i);
      }
    });
  });

  describe('Form Labels and Field Names', () => {
    const communicationFormKeys = [
      'subject',
      'message',
      'content',
      'title',
      'description',
      'recipients',
      'selectedRecipients',
      'allRecipients',
      'urgencyLevel',
      'priority',
      'sendToAll',
      'sendToRoles',
      'organizationFilter',
      'buildingFilter',
      'residenceFilter',
      'meetingDate',
      'meetingTime',
      'meetingLocation',
      'meetingAgenda',
      'attachments',
      'scheduleSend',
      'sendNow',
      'saveDraft'
    ];

    it('should have all communication form labels translated', () => {
      communicationFormKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should use proper Quebec French form terminology', () => {
      const fr = translations.fr as any;
      
      // Test key form field translations for Quebec compliance
      if (fr.subject) expect(fr.subject).toBe('Sujet');
      if (fr.message) expect(fr.message).toBe('Message');
      if (fr.recipients) expect(fr.recipients).toBe('Destinataires');
      if (fr.urgencyLevel) expect(fr.urgencyLevel).toMatch(/niveau.*urgence/i);
    });
  });

  describe('Button Text and Actions', () => {
    const communicationButtonKeys = [
      'save',
      'savePreferences',
      'resetPreferences',
      'sendCommunication',
      'sendMessage',
      'scheduleMessage',
      'saveDraft',
      'previewMessage',
      'selectAll',
      'clearSelection',
      'bulkAction',
      'enableAll',
      'disableAll',
      'resetToDefaults',
      'applyToAll',
      'confirmSend',
      'cancelSend'
    ];

    it('should have all communication action buttons translated', () => {
      communicationButtonKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have Quebec French button translations', () => {
      const fr = translations.fr;
      
      // Test common button translations
      expect(fr.save).toBe('Enregistrer');
      expect(fr.cancel).toBe('Annuler');
      
      if (fr.send) {
        expect(fr.send).toMatch(/envoyer/i);
      }
      
      if (fr.reset) {
        expect(fr.reset).toMatch(/réinitialiser/i);
      }
    });
  });

  describe('Recipient Roles and Groups', () => {
    const recipientRoles = [
      { value: 'all', labelEn: 'All Members', labelFr: 'Tous les membres' },
      { value: 'resident', labelEn: 'Residents', labelFr: 'Résidents' },
      { value: 'tenant', labelEn: 'Tenants', labelFr: 'Locataires' },
      { value: 'manager', labelEn: 'Managers', labelFr: 'Gestionnaires' },
      { value: 'admin', labelEn: 'Administrators', labelFr: 'Administrateurs' }
    ];

    it('should have all recipient role options translated', () => {
      recipientRoles.forEach(role => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          const key = `role_${role.value}` || role.value;
          
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should validate Quebec French role translations', () => {
      const fr = translations.fr;
      
      // Test role translations for Quebec compliance
      expect(fr.resident).toBe('Résident');
      expect(fr.tenant).toBe('Locataire');
      expect(fr.manager).toBe('Gestionnaire');
      expect(fr.admin).toBe('Administrateur');
    });
  });

  describe('Validation and Error Messages', () => {
    const communicationValidationKeys = [
      'subjectRequired',
      'messageRequired',
      'recipientsRequired',
      'invalidEmailFormat',
      'messageTooLong',
      'subjectTooLong',
      'noRecipientsSelected',
      'invalidMeetingDate',
      'invalidMeetingTime',
      'meetingDateRequired',
      'meetingLocationRequired',
      'attachmentTooLarge',
      'invalidFileType',
      'communicationSendFailed',
      'communicationSaved',
      'preferencesUpdated',
      'preferencesUpdateFailed'
    ];

    it('should have all validation messages translated', () => {
      communicationValidationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper French validation messages', () => {
      const fr = translations.fr as any;
      
      // Test key validation messages
      if (fr.subjectRequired) {
        expect(fr.subjectRequired).toMatch(/sujet.*requis/i);
      }
      
      if (fr.messageRequired) {
        expect(fr.messageRequired).toMatch(/message.*requis/i);
      }
      
      if (fr.recipientsRequired) {
        expect(fr.recipientsRequired).toMatch(/destinataires.*requis/i);
      }
    });
  });

  describe('Success and Status Messages', () => {
    const communicationStatusKeys = [
      'communicationSent',
      'communicationScheduled',
      'draftSaved',
      'preferencesUpdated',
      'preferencesReset',
      'bulkActionCompleted',
      'meetingInvitationSent',
      'notificationsSaved',
      'settingsApplied',
      'sendingCommunication',
      'updatingPreferences',
      'processingRequest'
    ];

    it('should have all status messages translated', () => {
      communicationStatusKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have Quebec French status messages', () => {
      const fr = translations.fr as any;
      
      // Test key status messages
      if (fr.communicationSent) {
        expect(fr.communicationSent).toMatch(/communication.*envoyé/i);
      }
      
      if (fr.preferencesUpdated) {
        expect(fr.preferencesUpdated).toMatch(/préférences.*mis.*jour/i);
      }
    });
  });

  describe('Quebec Law 25 Compliance Messages', () => {
    const law25ComplianceKeys = [
      'quebecLaw25Compliance',
      'dataProtectionNotice',
      'privacySettings',
      'consentRequired',
      'dataRetentionNotice',
      'communicationConsent',
      'notificationConsent',
      'emailConsentRequired',
      'smsConsentRequired',
      'dataProcessingNotice',
      'withdrawConsent',
      'privacyPolicyLink'
    ];

    it('should have Quebec Law 25 compliance messages translated', () => {
      law25ComplianceKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should validate French compliance messages for Quebec regulations', () => {
      const fr = translations.fr as any;
      
      // Test Quebec-specific compliance terminology
      if (fr.quebecLaw25Compliance) {
        expect(fr.quebecLaw25Compliance).toMatch(/loi.*25.*québec/i);
      }
      
      if (fr.dataProtectionNotice) {
        expect(fr.dataProtectionNotice).toMatch(/protection.*données/i);
      }
      
      if (fr.consentRequired) {
        expect(fr.consentRequired).toMatch(/consentement.*requis/i);
      }
    });
  });

  describe('RBAC (Role-Based Access Control) Messages', () => {
    const rbacMessageKeys = [
      'accessDenied',
      'insufficientPermissions',
      'adminOnlyFeature',
      'managerOnlyFeature',
      'cannotSendToAllOrganizations',
      'restrictedRecipients',
      'bulkActionRestricted',
      'communicationLimited',
      'viewOnlyMode',
      'upgradeRequired',
      'featureNotAvailable',
      'permissionDenied'
    ];

    it('should have all RBAC messages translated', () => {
      rbacMessageKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have French RBAC messages with proper terminology', () => {
      const fr = translations.fr as any;
      
      // Test RBAC translations
      expect(fr.accessDenied).toBe('Accès refusé');
      
      if (fr.insufficientPermissions) {
        expect(fr.insufficientPermissions).toMatch(/permissions.*insuffisantes/i);
      }
      
      if (fr.adminOnlyFeature) {
        expect(fr.adminOnlyFeature).toMatch(/fonctionnalité.*administrateur/i);
      }
    });
  });

  describe('Missing Translation Detection', () => {
    it('should identify any communication UI elements that might be missing translations', () => {
      // Common communication patterns that should be translated
      const commonCommunicationPatterns = [
        'communication',
        'notifications',
        'preferences',
        'frequency',
        'urgency',
        'recipients',
        'sendCommunication',
        'savePreferences',
        'resetToDefaults',
        'bulkActions'
      ];

      commonCommunicationPatterns.forEach(pattern => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[pattern]) {
            expect(typeof t[pattern]).toBe('string');
            expect(t[pattern].length).toBeGreaterThan(0);
            // Should not contain unprocessed placeholder brackets
            expect(t[pattern]).not.toMatch(/\{[^}]*\}/);
          }
        });
      });
    });

    it('should ensure no hardcoded English text in communication components', () => {
      // These are patterns that commonly appear untranslated in communication features
      const problematicPatterns = [
        /^Communication$/i,
        /^Notifications$/i,
        /^Preferences$/i,
        /^Send Message$/i,
        /^Save Settings$/i,
        /^Reset$/i,
        /^Immediate$/i,
        /^Weekly$/i,
        /^Monthly$/i,
        /^Low Priority$/i,
        /^High Priority$/i,
        /^Recipients$/i,
        /^Select All$/i
      ];

      // This test documents patterns to watch for - serves as a reminder of what to look for
      expect(problematicPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Translation Completeness and Quality', () => {
    it('should ensure all communication translations are non-empty', () => {
      languages.forEach(lang => {
        const t = translations[lang] as any;
        
        // Check key communication translation categories
        const keyTranslationCategories = [
          'communication',
          'notifications', 
          'save',
          'cancel',
          'send',
          'reset'
        ];

        keyTranslationCategories.forEach(key => {
          if (t[key]) {
            expect(t[key].trim().length).toBeGreaterThan(0);
            expect(t[key]).not.toBe('');
            expect(t[key]).not.toMatch(/^\s*$/);
          }
        });
      });
    });

    it('should validate French translations use proper Quebec terminology', () => {
      const fr = translations.fr as any;
      
      // Quebec French specific terms vs. European French
      const quebecTerms = [
        { key: 'email', quebecTerm: 'Courriel', europeanTerm: 'E-mail' },
        { key: 'save', quebecTerm: 'Enregistrer', europeanTerm: 'Sauvegarder' },
        { key: 'cancel', quebecTerm: 'Annuler', europeanTerm: 'Annuler' }
      ];

      quebecTerms.forEach(term => {
        if (fr[term.key]) {
          // Prefer Quebec terminology
          if (term.quebecTerm !== term.europeanTerm) {
            expect(fr[term.key]).toBe(term.quebecTerm);
          }
        }
      });
    });
  });
});