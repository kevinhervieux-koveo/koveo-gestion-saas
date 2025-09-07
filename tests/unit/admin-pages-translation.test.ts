/**
 * ADMIN PAGES TRANSLATION TEST
 * 
 * This test validates that all admin pages have proper translation coverage
 * and Quebec Law 25 compliance for bilingual support.
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';

describe('Admin Pages Translation Coverage', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('Admin Page Headers and Titles', () => {
    const adminPageKeys = [
      // Organizations page
      'organizationsManagement',
      'organizationsManagementDesc',
      'createEditDeleteOrganizations',
      
      // Permissions page
      'permissionsManagement',
      'permissionsManagementDesc',
      'roleBasedAccessControl',
      'systemPermissions',
      'userRoles',
      'permissionSettings',
      
      // Compliance page
      'quebecLaw25Compliance',
      'privacyComplianceMonitoring',
      'violationTracking',
      'scanCommand',
      'semgrepCli',
      
      // Quality page
      'qualityAssurance',
      'qualityMetricsTracking',
      'refreshCommand',
      
      // Documentation page
      'documentationCenter',
      'generateManageDocumentation',
      'projectOverview',
      'technicalComponents',
      'apiSpecifications',
      'databaseSchema',
      'dependencyInformation',
      
      // Roadmap page
      'productRoadmap',
      'featurePlanningCapabilities',
      'roadmapManagement',
      'featureStatus',
      'priorityManagement',
      
      // Pillars page
      'pillarFramework',
      'developmentFrameworkMethodology',
      'validateCommand',
      
      // Suggestions page
      'suggestionsManagement',
      'userFeedbackSuggestions',
      'suggestionReview',
    ];

    languages.forEach((lang) => {
      describe(`${lang.toUpperCase()} translations`, () => {
        adminPageKeys.forEach((key) => {
          it(`should have translation for admin key: ${key}`, () => {
            const translation = translations[lang][key as keyof typeof translations[typeof lang]];
            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
            
            // Quebec compliance: French translations should be different from English
            if (lang === 'fr') {
              const englishTranslation = translations['en'][key as keyof typeof translations['en']];
              if (englishTranslation) {
                expect(translation).not.toBe(englishTranslation);
              }
            }
          });
        });
      });
    });
  });

  describe('Admin Actions and Buttons', () => {
    const adminActionKeys = [
      // Common admin actions
      'createNew',
      'editSelected',
      'deleteSelected',
      'bulkActions',
      'exportData',
      'importData',
      'manageUsers',
      'assignRoles',
      'revokePermissions',
      'grantPermissions',
      'activateAccount',
      'deactivateAccount',
      'resetPassword',
      'sendInvitation',
      'cancelInvitation',
      'resendInvitation',
      
      // System administration
      'systemSettings',
      'securitySettings',
      'auditLogs',
      'systemBackup',
      'dataExport',
      'complianceReport',
      'performanceMetrics',
      'systemHealth',
      
      // Quebec Law 25 specific
      'privacyAudit',
      'dataRetentionPolicy',
      'consentManagement',
      'rightToErasure',
      'dataPortability',
      'privacyImpactAssessment',
    ];

    languages.forEach((lang) => {
      describe(`${lang.toUpperCase()} admin action translations`, () => {
        adminActionKeys.forEach((key) => {
          it(`should have translation for admin action: ${key}`, () => {
            const translation = translations[lang][key as keyof typeof translations[typeof lang]];
            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe('Admin Error Messages and Validation', () => {
    const adminErrorKeys = [
      // Permission errors
      'insufficientPermissions',
      'accessDenied',
      'roleAssignmentFailed',
      'permissionRevocationFailed',
      'unauthorized',
      
      // System errors
      'systemError',
      'configurationError',
      'validationFailed',
      'operationFailed',
      'connectionError',
      'timeoutError',
      
      // Quebec Law 25 compliance errors
      'privacyViolation',
      'dataRetentionViolation',
      'consentRequired',
      'dataProcessingError',
      'complianceCheckFailed',
    ];

    languages.forEach((lang) => {
      describe(`${lang.toUpperCase()} admin error translations`, () => {
        adminErrorKeys.forEach((key) => {
          it(`should have translation for admin error: ${key}`, () => {
            const translation = translations[lang][key as keyof typeof translations[typeof lang]];
            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe('Admin Status and Notifications', () => {
    const adminStatusKeys = [
      // User statuses
      'userActive',
      'userInactive',
      'userPending',
      'userSuspended',
      'userDeleted',
      
      // System statuses
      'systemOnline',
      'systemOffline',
      'maintenanceMode',
      'backupInProgress',
      'updateAvailable',
      'securityAlert',
      
      // Compliance statuses
      'compliant',
      'nonCompliant',
      'pendingReview',
      'requiresAction',
      'auditRequired',
    ];

    languages.forEach((lang) => {
      describe(`${lang.toUpperCase()} admin status translations`, () => {
        adminStatusKeys.forEach((key) => {
          it(`should have translation for admin status: ${key}`, () => {
            const translation = translations[lang][key as keyof typeof translations[typeof lang]];
            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe('Quebec Law 25 Specific Admin Terms', () => {
    const quebecLaw25Keys = [
      // Legal terms in French and English
      'donneesPersonnelles', // Personal data
      'consentementEclaire', // Informed consent
      'droitALOubli', // Right to be forgotten
      'portabiliteDonnees', // Data portability
      'evaluationImpactViePrivee', // Privacy impact assessment
      'responsableTraitement', // Data controller
      'sousTraitant', // Data processor
      'violationDonnees', // Data breach
      'notificationViolation', // Breach notification
      'registreTraitement', // Processing registry
      
      // Administrative terms
      'auditConformite', // Compliance audit
      'mesuresSecurite', // Security measures
      'conservationDonnees', // Data retention
      'suppressionDonnees', // Data deletion
      'rectificationDonnees', // Data rectification
    ];

    languages.forEach((lang) => {
      describe(`${lang.toUpperCase()} Quebec Law 25 admin translations`, () => {
        quebecLaw25Keys.forEach((key) => {
          it(`should have translation for Quebec Law 25 term: ${key}`, () => {
            const translation = translations[lang][key as keyof typeof translations[typeof lang]];
            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
            
            // For French, ensure Quebec French terminology is used
            if (lang === 'fr' && key.includes('donnees')) {
              expect(translation.toLowerCase()).toMatch(/donn[ée]es/);
            }
          });
        });
      });
    });
  });

  describe('Admin Interface Consistency', () => {
    it('should have consistent admin navigation terms', () => {
      const adminNavKeys = [
        'adminDashboard',
        'userManagement',
        'systemSettings',
        'reports',
        'analytics',
        'compliance',
        'security',
      ];

      languages.forEach((lang) => {
        adminNavKeys.forEach((key) => {
          const translation = translations[lang][key as keyof typeof translations[typeof lang]];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have consistent table headers for admin lists', () => {
      const tableHeaderKeys = [
        'name',
        'email',
        'role',
        'status',
        'lastLogin',
        'createdAt',
        'updatedAt',
        'actions',
      ];

      languages.forEach((lang) => {
        tableHeaderKeys.forEach((key) => {
          const translation = translations[lang][key as keyof typeof translations[typeof lang]];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        });
      });
    });
  });
});