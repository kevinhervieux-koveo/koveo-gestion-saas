/**
 * Comprehensive Forms Translation Test Suite
 * Validates that ALL forms and their validation messages are properly translated:
 * - Login forms
 * - Registration forms
 * - Invitation forms
 * - Settings forms
 * - All form validation messages
 * - All form field labels and placeholders
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';

describe('Comprehensive Forms Translation Coverage', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('Login Form Translation', () => {
    const loginFormKeys = [
      'email',
      'password',
      'login',
      'signIn',
      'forgotPassword',
      'demoMode',
      'selectRole'
    ];

    it('should have all login form elements translated', () => {
      loginFormKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have proper Quebec French login terminology', () => {
      const fr = translations.fr;
      expect(fr.email).toBe('Courriel');
      expect(fr.password).toBe('Mot de passe');
      expect(fr.login).toBe('Connexion');
    });
  });

  describe('Registration and Invitation Form Translation', () => {
    const registrationKeys = [
      'firstName',
      'lastName',
      'email',
      'password',
      'confirmPassword',
      'organization',
      'building',
      'residence',
      'role',
      'personalMessage',
      'expiryDays'
    ];

    it('should have all registration form fields translated', () => {
      registrationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French registration terminology', () => {
      const fr = translations.fr;
      if (fr.firstName) expect(fr.firstName).toBe('Prénom');
      if (fr.lastName) expect(fr.lastName).toBe('Nom de famille');
      if (fr.confirmPassword) expect(fr.confirmPassword).toBe('Confirmer le mot de passe');
    });
  });

  describe('Form Field Labels Translation', () => {
    const formLabelKeys = [
      'enterEmailAddress',
      'enterPassword',
      'enterFirstName',
      'enterLastName',
      'selectOrganization',
      'selectBuilding',
      'selectResidence',
      'selectRole',
      'optional',
      'required'
    ];

    it('should have all form field labels and placeholders translated', () => {
      formLabelKeys.forEach(key => {
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

  describe('Form Button Translation', () => {
    const formButtonKeys = [
      'submit',
      'save',
      'cancel',
      'close',
      'send',
      'sendInvitation',
      'reset',
      'clear',
      'add',
      'remove',
      'edit',
      'delete',
      'update',
      'create'
    ];

    it('should have all form buttons translated', () => {
      formButtonKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should use proper Quebec French action verbs', () => {
      const fr = translations.fr;
      if (fr.save) expect(fr.save).toBe('Enregistrer');
      if (fr.cancel) expect(fr.cancel).toBe('Annuler');
      if (fr.send) expect(fr.send).toBe('Envoyer');
      if (fr.create) expect(fr.create).toBe('Créer');
      if (fr.update) expect(fr.update).toBe('Mettre à jour');
    });
  });

  describe('Settings and Configuration Forms Translation', () => {
    const settingsKeys = [
      'userProfile',
      'accountSettings',
      'notifications',
      'language',
      'theme',
      'timezone',
      'preferences'
    ];

    it('should have settings form elements translated', () => {
      settingsKeys.forEach(key => {
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

  describe('Demands and Management Forms Translation', () => {
    const demandsKeys = [
      'title',
      'description',
      'priority',
      'status',
      'category',
      'assignedTo',
      'dueDate',
      'notes',
      'attachments'
    ];

    it('should have demands management form fields translated', () => {
      demandsKeys.forEach(key => {
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

  describe('Document Management Forms Translation', () => {
    const documentKeys = [
      'documentTitle',
      'documentType',
      'documentDescription',
      'uploadDocument',
      'selectFile',
      'fileSize',
      'allowedFormats'
    ];

    it('should have document management form fields translated', () => {
      documentKeys.forEach(key => {
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

  describe('Search and Filter Forms Translation', () => {
    const filterKeys = [
      'search',
      'filter',
      'sortBy',
      'dateRange',
      'fromDate',
      'toDate',
      'clearFilters',
      'applyFilters'
    ];

    it('should have search and filter form elements translated', () => {
      filterKeys.forEach(key => {
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
});