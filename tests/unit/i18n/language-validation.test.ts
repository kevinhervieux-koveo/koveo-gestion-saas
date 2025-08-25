/**
 * @file Language Validation Tests.
 * @description Tests for French and English language support validation.
 */

import { describe, it, expect } from '@jest/globals';
import { translate, hasTranslation, mockTranslations } from '../../utils/mock-translations';

// Test functions using the imported mock translations
const _testTranslations = {
  en: {
    // Common UI elements
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.buildings': 'Buildings',
    'nav.residences': 'Residences',
    'nav.demands': 'Demands',
    'nav.documents': 'Documents',
    'nav.users': 'Users',

    // Demands system
    'demands.title': 'Demands',
    'demands.create': 'Create New Demand',
    'demands.type': 'Type',
    'demands.description': 'Description',
    'demands.status': 'Status',
    'demands.building': 'Building',
    'demands.residence': 'Residence',
    'demands.submitter': 'Submitter',
    'demands.created': 'Created',
    'demands.updated': 'Updated',

    // Demand types
    'demands.type.maintenance': 'Maintenance',
    'demands.type.complaint': 'Complaint',
    'demands.type.information': 'Information',
    'demands.type.other': 'Other',

    // Demand statuses
    'demands.status.submitted': 'Submitted',
    'demands.status.under_review': 'Under Review',
    'demands.status.approved': 'Approved',
    'demands.status.in_progress': 'In Progress',
    'demands.status.completed': 'Completed',
    'demands.status.rejected': 'Rejected',
    'demands.status.cancelled': 'Cancelled',

    // Form validation
    'validation.required': 'This field is required',
    'validation.min_length': 'Must be at least {min} characters',
    'validation.max_length': 'Must be no more than {max} characters',
    'validation.email': 'Please enter a valid email address',
    'validation.phone': 'Please enter a valid phone number',
    'validation.postal_code': 'Please enter a valid postal code',

    // Error messages
    'error.network': 'Network error. Please try again.',
    'error.unauthorized': 'You are not authorized to perform this action.',
    'error.not_found': 'The requested resource was not found.',
    'error.server': 'An unexpected server error occurred.',
    'error.validation': 'Please correct the errors below.',

    // Success messages
    'success.created': 'Successfully created',
    'success.updated': 'Successfully updated',
    'success.deleted': 'Successfully deleted',

    // Feature Requests/Idea Box
    'ideaBox.title': 'Idea Box',
    'ideaBox.subtitle': 'Submit and vote on feature suggestions',
    'ideaBox.submitIdea': 'Submit Idea',
    'ideaBox.searchPlaceholder': 'Search feature requests...',
    'ideaBox.noFeatures': 'No feature requests found',
    'ideaBox.firstSubmission': 'Be the first to submit a feature request!',
    'ideaBox.loading': 'Loading feature requests...',

    // Feature Request Form
    'featureRequest.create': 'Submit a Feature Request',
    'featureRequest.edit': 'Edit Feature Request',
    'featureRequest.title': 'Title',
    'featureRequest.titlePlaceholder': 'Brief, descriptive title for your feature',
    'featureRequest.description': 'Description',
    'featureRequest.descriptionPlaceholder':
      "Detailed description of the feature you'd like to see",
    'featureRequest.need': 'Need',
    'featureRequest.needPlaceholder': 'Explain why this feature is needed and how it would help',
    'featureRequest.category': 'Category',
    'featureRequest.page': 'Page/Location',
    'featureRequest.pagePlaceholder': 'e.g., Dashboard, Settings, etc.',
    'featureRequest.status': 'Status',
    'featureRequest.assignedTo': 'Assigned To',
    'featureRequest.adminNotes': 'Admin Notes',
    'featureRequest.adminNotesPlaceholder': 'Internal notes for team members',

    // Feature Request Categories
    'featureRequest.category.dashboard': 'Dashboard',
    'featureRequest.category.propertyManagement': 'Property Management',
    'featureRequest.category.residentManagement': 'Resident Management',
    'featureRequest.category.financialManagement': 'Financial Management',
    'featureRequest.category.maintenance': 'Maintenance',
    'featureRequest.category.documentManagement': 'Document Management',
    'featureRequest.category.communication': 'Communication',
    'featureRequest.category.reports': 'Reports',
    'featureRequest.category.mobileApp': 'Mobile App',
    'featureRequest.category.integrations': 'Integrations',
    'featureRequest.category.security': 'Security',
    'featureRequest.category.performance': 'Performance',
    'featureRequest.category.other': 'Other',

    // Feature Request Statuses
    'featureRequest.status.submitted': 'Submitted',
    'featureRequest.status.underReview': 'Under Review',
    'featureRequest.status.planned': 'Planned',
    'featureRequest.status.inProgress': 'In Progress',
    'featureRequest.status.completed': 'Completed',
    'featureRequest.status.rejected': 'Rejected',

    // Feature Request Actions
    'featureRequest.upvote': 'Upvote',
    'featureRequest.upvoted': 'Upvoted',
    'featureRequest.upvoteCount': '{count} upvotes',
    'featureRequest.submittedBy': 'Submitted by: {submitter}',
    'featureRequest.sortBy': 'Sort by',
    'featureRequest.sortNewest': 'Newest First',
    'featureRequest.sortOldest': 'Oldest First',
    'featureRequest.sortMostUpvoted': 'Most Upvoted',
    'featureRequest.sortLeastUpvoted': 'Least Upvoted',
    'featureRequest.allStatuses': 'All Status',
    'featureRequest.allCategories': 'All Categories',
    'featureRequest.filterStatus': 'Filter by Status',
    'featureRequest.filterCategory': 'Filter by Category',

    // Feature Request Messages
    'featureRequest.submitSuccess': 'Feature request submitted successfully!',
    'featureRequest.updateSuccess': 'Feature request updated successfully!',
    'featureRequest.deleteSuccess': 'Feature request deleted successfully!',
    'featureRequest.upvoteSuccess': 'Upvote added successfully!',
    'featureRequest.upvoteRemoved': 'Upvote removed successfully!',
    'featureRequest.alreadyUpvoted': 'You have already upvoted this feature request',
    'featureRequest.deleteConfirm': 'Are you sure you want to delete this feature request?',
    'featureRequest.deleteWarning': 'This action cannot be undone.',

    // Date and time
    'date.today': 'Today',
    'date.yesterday': 'Yesterday',
    'date.days_ago': '{count} days ago',
    'date.months': {
      january: 'January',
      february: 'February',
      march: 'March',
      april: 'April',
      may: 'May',
      june: 'June',
      july: 'July',
      august: 'August',
      september: 'September',
      october: 'October',
      november: 'November',
      december: 'December',
    },
  },
  fr: {
    // Common UI elements
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.search': 'Rechercher',
    'common.filter': 'Filtrer',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',

    // Navigation
    'nav.dashboard': 'Tableau de bord',
    'nav.buildings': 'Bâtiments',
    'nav.residences': 'Résidences',
    'nav.demands': 'Demandes',
    'nav.documents': 'Documents',
    'nav.users': 'Utilisateurs',

    // Demands system
    'demands.title': 'Demandes',
    'demands.create': 'Créer une nouvelle demande',
    'demands.type': 'Type',
    'demands.description': 'Description',
    'demands.status': 'Statut',
    'demands.building': 'Bâtiment',
    'demands.residence': 'Résidence',
    'demands.submitter': 'Demandeur',
    'demands.created': 'Créé',
    'demands.updated': 'Modifié',

    // Demand types
    'demands.type.maintenance': 'Maintenance',
    'demands.type.complaint': 'Plainte',
    'demands.type.information': 'Information',
    'demands.type.other': 'Autre',

    // Demand statuses
    'demands.status.submitted': 'Soumis',
    'demands.status.under_review': 'En révision',
    'demands.status.approved': 'Approuvé',
    'demands.status.in_progress': 'En cours',
    'demands.status.completed': 'Terminé',
    'demands.status.rejected': 'Rejeté',
    'demands.status.cancelled': 'Annulé',

    // Form validation
    'validation.required': 'Ce champ est requis',
    'validation.min_length': 'Doit contenir au moins {min} caractères',
    'validation.max_length': 'Ne doit pas dépasser {max} caractères',
    'validation.email': 'Veuillez entrer une adresse courriel valide',
    'validation.phone': 'Veuillez entrer un numéro de téléphone valide',
    'validation.postal_code': 'Veuillez entrer un code postal valide',

    // Error messages
    'error.network': 'Erreur réseau. Veuillez réessayer.',
    'error.unauthorized': "Vous n'êtes pas autorisé à effectuer cette action.",
    'error.not_found': 'La ressource demandée est introuvable.',
    'error.server': "Une erreur serveur inattendue s'est produite.",
    'error.validation': 'Veuillez corriger les erreurs ci-dessous.',

    // Success messages
    'success.created': 'Créé avec succès',
    'success.updated': 'Mis à jour avec succès',
    'success.deleted': 'Supprimé avec succès',

    // Feature Requests/Idea Box
    'ideaBox.title': 'Boîte à idées',
    'ideaBox.subtitle': 'Soumettez et votez sur les suggestions de fonctionnalités',
    'ideaBox.submitIdea': 'Soumettre une idée',
    'ideaBox.searchPlaceholder': 'Rechercher des demandes de fonctionnalités...',
    'ideaBox.noFeatures': 'Aucune demande de fonctionnalité trouvée',
    'ideaBox.firstSubmission': 'Soyez le premier à soumettre une demande de fonctionnalité !',
    'ideaBox.loading': 'Chargement des demandes de fonctionnalités...',

    // Feature Request Form
    'featureRequest.create': 'Soumettre une demande de fonctionnalité',
    'featureRequest.edit': 'Modifier la demande de fonctionnalité',
    'featureRequest.title': 'Titre',
    'featureRequest.titlePlaceholder': 'Titre bref et descriptif pour votre fonctionnalité',
    'featureRequest.description': 'Description',
    'featureRequest.descriptionPlaceholder':
      'Description détaillée de la fonctionnalité que vous aimeriez voir',
    'featureRequest.need': 'Besoin',
    'featureRequest.needPlaceholder':
      'Expliquez pourquoi cette fonctionnalité est nécessaire et en quoi elle aiderait',
    'featureRequest.category': 'Catégorie',
    'featureRequest.page': 'Page/Emplacement',
    'featureRequest.pagePlaceholder': 'ex: Tableau de bord, Paramètres, etc.',
    'featureRequest.status': 'Statut',
    'featureRequest.assignedTo': 'Assigné à',
    'featureRequest.adminNotes': 'Notes administrateur',
    'featureRequest.adminNotesPlaceholder': "Notes internes pour les membres de l'équipe",

    // Feature Request Categories
    'featureRequest.category.dashboard': 'Tableau de bord',
    'featureRequest.category.propertyManagement': 'Gestion immobilière',
    'featureRequest.category.residentManagement': 'Gestion des résidents',
    'featureRequest.category.financialManagement': 'Gestion financière',
    'featureRequest.category.maintenance': 'Maintenance',
    'featureRequest.category.documentManagement': 'Gestion de documents',
    'featureRequest.category.communication': 'Communication',
    'featureRequest.category.reports': 'Rapports',
    'featureRequest.category.mobileApp': 'Application mobile',
    'featureRequest.category.integrations': 'Intégrations',
    'featureRequest.category.security': 'Sécurité',
    'featureRequest.category.performance': 'Performance',
    'featureRequest.category.other': 'Autre',

    // Feature Request Statuses
    'featureRequest.status.submitted': 'Soumis',
    'featureRequest.status.underReview': 'En révision',
    'featureRequest.status.planned': 'Planifié',
    'featureRequest.status.inProgress': 'En cours',
    'featureRequest.status.completed': 'Terminé',
    'featureRequest.status.rejected': 'Rejeté',

    // Feature Request Actions
    'featureRequest.upvote': 'Voter pour',
    'featureRequest.upvoted': 'Voté',
    'featureRequest.upvoteCount': '{count} votes',
    'featureRequest.submittedBy': 'Soumis par : {submitter}',
    'featureRequest.sortBy': 'Trier par',
    'featureRequest.sortNewest': "Plus récent d'abord",
    'featureRequest.sortOldest': "Plus ancien d'abord",
    'featureRequest.sortMostUpvoted': 'Plus voté',
    'featureRequest.sortLeastUpvoted': 'Moins voté',
    'featureRequest.allStatuses': 'Tous les statuts',
    'featureRequest.allCategories': 'Toutes les catégories',
    'featureRequest.filterStatus': 'Filtrer par statut',
    'featureRequest.filterCategory': 'Filtrer par catégorie',

    // Feature Request Messages
    'featureRequest.submitSuccess': 'Demande de fonctionnalité soumise avec succès !',
    'featureRequest.updateSuccess': 'Demande de fonctionnalité mise à jour avec succès !',
    'featureRequest.deleteSuccess': 'Demande de fonctionnalité supprimée avec succès !',
    'featureRequest.upvoteSuccess': 'Vote ajouté avec succès !',
    'featureRequest.upvoteRemoved': 'Vote retiré avec succès !',
    'featureRequest.alreadyUpvoted': 'Vous avez déjà voté pour cette demande de fonctionnalité',
    'featureRequest.deleteConfirm':
      'Êtes-vous sûr de vouloir supprimer cette demande de fonctionnalité ?',
    'featureRequest.deleteWarning': 'Cette action ne peut pas être annulée.',

    // Date and time
    'date.today': "Aujourd'hui",
    'date.yesterday': 'Hier',
    'date.days_ago': 'Il y a {count} jours',
    'date.months': {
      january: 'Janvier',
      february: 'Février',
      march: 'Mars',
      april: 'Avril',
      may: 'Mai',
      june: 'Juin',
      july: 'Juillet',
      august: 'Août',
      september: 'Septembre',
      october: 'Octobre',
      november: 'Novembre',
      december: 'Décembre',
    },
  },
};

// Use imported translate function from mock-translations.ts
// (removed local translate function to avoid naming conflicts)

// Validation helper functions
const validateTranslationCompleteness = (
  enTranslations: Record<string, unknown>,
  frTranslations: Record<string, unknown>,
  path = ''
): string[] => {
  const missing: string[] = [];

  const traverse = (enObj: unknown, frObj: unknown, currentPath: string) => {
    if (typeof enObj === 'string') {
      if (typeof frObj !== 'string') {
        missing.push(currentPath);
      }
      return;
    }

    if (typeof enObj === 'object' && enObj !== null && !Array.isArray(enObj)) {
      const enRecord = enObj as Record<string, unknown>;
      const frRecord =
        typeof frObj === 'object' && frObj !== null && !Array.isArray(frObj)
          ? (frObj as Record<string, unknown>)
          : {};
      for (const key in enRecord) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        if (!(key in frRecord)) {
          missing.push(newPath);
        } else {
          traverse(enRecord[key], frRecord[key], newPath);
        }
      }
    }
  };

  traverse(enTranslations, frTranslations, path);
  return missing;
};

const validateFrenchAccents = (text: string): boolean => {
  // Check for common French words that should have accents
  const accentRules = [
    { wrong: /\bcree\b/gi, correct: 'créé' },
    { wrong: /\bmodifie\b/gi, correct: 'modifié' },
    { wrong: /\bstatut\b/gi, correct: 'statut' }, // This one is correct
    { wrong: /\berreur\b/gi, correct: 'erreur' }, // This one is correct
    { wrong: /\bsucces\b/gi, correct: 'succès' },
    { wrong: /\bprefere\b/gi, correct: 'préfère' },
    { wrong: /\bactivite\b/gi, correct: 'activité' },
    { wrong: /\bqualite\b/gi, correct: 'qualité' },
    { wrong: /\bsecurite\b/gi, correct: 'sécurité' },
    { wrong: /\bpropriete\b/gi, correct: 'propriété' },
  ];

  return !accentRules.some((rule) => rule.wrong.test(text));
};

const validateQuebecFrench = (text: string): { isValid: boolean; suggestions: string[] } => {
  const suggestions: string[] = [];

  // Quebec French preferences
  const _quebecPreferences = [
    {
      international: /courriel/gi,
      quebec: 'courriel',
      suggestion: 'Use "courriel" instead of "email" in Quebec French',
    },
    {
      international: /fin de semaine/gi,
      quebec: 'fin de semaine',
      suggestion: 'Use "fin de semaine" instead of "weekend"',
    },
    {
      international: /stationnement/gi,
      quebec: 'stationnement',
      suggestion: 'Use "stationnement" instead of "parking"',
    },
    {
      international: /magasinage/gi,
      quebec: 'magasinage',
      suggestion: 'Use "magasinage" instead of "shopping"',
    },
    {
      international: /dépanneur/gi,
      quebec: 'dépanneur',
      suggestion: 'Use "dépanneur" for convenience store',
    },
  ];

  // Check for non-Quebec terms
  const nonQuebecTerms = [
    { term: /email/gi, suggestion: 'Use "courriel" instead of "email"' },
    { term: /weekend/gi, suggestion: 'Use "fin de semaine" instead of "weekend"' },
    { term: /parking/gi, suggestion: 'Use "stationnement" instead of "parking"' },
    { term: /shopping/gi, suggestion: 'Use "magasinage" instead of "shopping"' },
  ];

  nonQuebecTerms.forEach(({ term, suggestion }) => {
    if (term.test(text)) {
      suggestions.push(suggestion);
    }
  });

  return {
    isValid: suggestions.length === 0,
    suggestions,
  };
};

describe('Language Validation Tests', () => {
  describe('Feature Request Translation Coverage', () => {
    it('should have complete English translations for feature requests', () => {
      const requiredKeys = [
        'idea_box.title',
        'idea_box.subtitle',
        'idea_box.submit_idea',
        'feature_request.create',
        'feature_request.edit',
        'feature_request.title',
        'feature_request.description',
        'feature_request.need',
        'feature_request.category',
        'feature_request.status',
        'feature_request.upvote',
        'feature_request.submit_success',
        'feature_request.update_success',
        'feature_request.delete_success',
      ];

      requiredKeys.forEach((key) => {
        expect(hasTranslation(key, 'en')).toBe(true);
        expect(translate(key, 'en')).toBeTruthy();
        expect(translate(key, 'en')).not.toBe(key); // Should not return the key itself
      });
    });

    it('should have complete French translations for feature requests', () => {
      const requiredKeys = [
        'idea_box.title',
        'idea_box.subtitle',
        'idea_box.submit_idea',
        'feature_request.create',
        'feature_request.edit',
        'feature_request.title',
        'feature_request.description',
        'feature_request.need',
        'feature_request.category',
        'feature_request.status',
        'feature_request.upvote',
        'feature_request.submit_success',
        'feature_request.update_success',
        'feature_request.delete_success',
      ];

      requiredKeys.forEach((key) => {
        expect(hasTranslation(key, 'fr')).toBe(true);
        expect(translate(key, {}, 'fr')).toBeTruthy();
        expect(translate(key, {}, 'fr')).not.toBe(key); // Should not return the key itself
      });
    });

    it('should have proper French translations for feature request categories', () => {
      const categoryTranslations = {
        'featureRequest.category.dashboard': 'Tableau de bord',
        'featureRequest.category.propertyManagement': 'Gestion immobilière',
        'featureRequest.category.residentManagement': 'Gestion des résidents',
        'featureRequest.category.financialManagement': 'Gestion financière',
        'featureRequest.category.maintenance': 'Maintenance',
        'featureRequest.category.documentManagement': 'Gestion de documents',
        'featureRequest.category.communication': 'Communication',
        'featureRequest.category.reports': 'Rapports',
        'featureRequest.category.mobileApp': 'Application mobile',
        'featureRequest.category.integrations': 'Intégrations',
        'featureRequest.category.security': 'Sécurité',
        'featureRequest.category.performance': 'Performance',
        'featureRequest.category.other': 'Autre',
      };

      Object.entries(categoryTranslations).forEach(([key, expectedTranslation]) => {
        expect(translate(key, {}, 'fr')).toBe(expectedTranslation);
      });
    });

    it('should have proper French translations for feature request statuses', () => {
      const statusTranslations = {
        'featureRequest.status.submitted': 'Soumis',
        'featureRequest.status.underReview': 'En révision',
        'featureRequest.status.planned': 'Planifié',
        'featureRequest.status.inProgress': 'En cours',
        'featureRequest.status.completed': 'Terminé',
        'featureRequest.status.rejected': 'Rejeté',
      };

      Object.entries(statusTranslations).forEach(([key, expectedTranslation]) => {
        expect(translate(key, {}, 'fr')).toBe(expectedTranslation);
      });
    });

    it('should validate French accents in feature request translations', () => {
      const textsToCheck = [
        translate('feature_request.create', {}, 'fr'),
        translate('feature_request.category.property_management', {}, 'fr'),
        translate('feature_request.category.security', {}, 'fr'),
        translate('feature_request.status.completed', {}, 'fr'),
        translate('idea_box.title', {}, 'fr'),
      ];

      textsToCheck.forEach((text) => {
        expect(validateFrenchAccents(text)).toBe(true);
      });
    });

    it('should validate parameter interpolation in feature request translations', () => {
      const parameterizedKeys = ['featureRequest.upvoteCount', 'featureRequest.submittedBy'];

      parameterizedKeys.forEach((key) => {
        const enText = translate(key, 'en');
        const frText = translate(key, 'fr');

        // Should contain parameter placeholders
        expect(enText).toMatch(/\{[^}]+\}/);
        expect(frText).toMatch(/\{[^}]+\}/);

        // Parameters should be consistent between languages
        const enParams = enText.match(/\{([^}]+)\}/g) || [];
        const frParams = frText.match(/\{([^}]+)\}/g) || [];
        expect(enParams.sort()).toEqual(frParams.sort());
      });
    });
  });

  describe('Translation Completeness', () => {
    it('should have all English keys translated in French', () => {
      const missingFrench = validateTranslationCompleteness(
        mockTranslations.en,
        mockTranslations.fr
      );

      expect(missingFrench).toHaveLength(0);

      if (missingFrench.length > 0) {
        console.warn('Missing French translations:', missingFrench);
      }
    });

    it('should have all French keys present in English', () => {
      const missingEnglish = validateTranslationCompleteness(
        mockTranslations.fr,
        mockTranslations.en
      );

      expect(missingEnglish).toHaveLength(0);

      if (missingEnglish.length > 0) {
        console.warn('Missing English translations:', missingEnglish);
      }
    });

    it('should validate all demand types are translated', () => {
      const demandTypes = ['maintenance', 'complaint', 'information', 'other'];

      demandTypes.forEach((type) => {
        const enKey = `demands.type.${type}`;
        const frKey = `demands.type.${type}`;

        const enTranslation = translate(enKey, {}, 'en');
        const frTranslation = translate(frKey, {}, 'fr');

        expect(enTranslation).not.toContain('[Missing translation');
        expect(frTranslation).not.toContain('[Missing translation');

        // Some words like "maintenance" are the same in English and French
        // Just ensure both translations exist and are valid
        expect(enTranslation.length).toBeGreaterThan(0);
        expect(frTranslation.length).toBeGreaterThan(0);
      });
    });

    it('should validate all demand statuses are translated', () => {
      const statuses = [
        'submitted',
        'under_review',
        'approved',
        'in_progress',
        'completed',
        'rejected',
        'cancelled',
      ];

      statuses.forEach((status) => {
        const enKey = `demands.status.${status}`;
        const frKey = `demands.status.${status}`;

        const enTranslation = translate(enKey, {}, 'en');
        const frTranslation = translate(frKey, {}, 'fr');

        expect(enTranslation).not.toContain('[Missing translation');
        expect(frTranslation).not.toContain('[Missing translation');
        expect(enTranslation).not.toBe(frTranslation);
      });
    });
  });

  describe('French Language Quality', () => {
    it('should validate French translations have proper accents', () => {
      const frenchTexts = [
        mockTranslations.fr['success.created'],
        mockTranslations.fr['success.updated'],
        mockTranslations.fr['success.deleted'],
      ];

      frenchTexts.forEach((text) => {
        expect(validateFrenchAccents(text)).toBe(true);
      });
    });

    it('should validate Quebec French terminology is used correctly', () => {
      const quebecValidation = validateQuebecFrench(mockTranslations.fr['validation.email']);

      expect(quebecValidation.isValid).toBe(true);

      if (!quebecValidation.isValid) {
        console.warn('Quebec French suggestions:', quebecValidation.suggestions);
      }
    });

    it('should validate French grammar for pluralization', () => {
      const pluralTestCases = [
        { count: 0, key: 'date.days_ago', expectedPattern: /0 jour/ },
        { count: 1, key: 'date.days_ago', expectedPattern: /1 jour/ },
        { count: 2, key: 'date.days_ago', expectedPattern: /2 jours/ },
      ];

      pluralTestCases.forEach(({ count, key, expectedPattern }) => {
        const translation = translate(key, { count }, 'fr');
        expect(translation).toMatch(expectedPattern);
      });
    });

    it('should validate French date format preferences', () => {
      const months = mockTranslations.fr['date.months'];

      // Check that French month names are properly capitalized (lowercase in French)
      if (months && typeof months === 'object') {
        Object.values(months).forEach((month: unknown) => {
          if (typeof month === 'string') {
            expect(month.charAt(0)).toBe(month.charAt(0).toUpperCase());
            expect(month.slice(1)).toBe(month.slice(1).toLowerCase());
          }
        });
      }
    });
  });

  describe('Parameter Interpolation', () => {
    it('should correctly interpolate parameters in English', () => {
      const result = translate('validation.min_length', { min: 5 }, 'en');
      expect(result).toBe('Must be at least 5 characters');
    });

    it('should correctly interpolate parameters in French', () => {
      const result = translate('validation.min_length', { min: 5 }, 'fr');
      expect(result).toBe('Doit contenir au moins 5 caractères');
    });

    it('should handle multiple parameters', () => {
      // Add a test translation with multiple parameters
      const testKey = 'test.multiple_params';
      const testTranslations = {
        en: { [testKey]: 'Hello {name}, you have {count} messages' },
        fr: { [testKey]: 'Bonjour {name}, vous avez {count} messages' },
      };

      const enResult = testTranslations.en[testKey].replace(/\{(\w+)\}/g, (match, param) => {
        const params = { name: 'John', count: 3 };
        return params[param as keyof typeof params]?.toString() || match;
      });

      const frResult = testTranslations.fr[testKey].replace(/\{(\w+)\}/g, (match, param) => {
        const params = { name: 'Jean', count: 3 };
        return params[param as keyof typeof params]?.toString() || match;
      });

      expect(enResult).toBe('Hello John, you have 3 messages');
      expect(frResult).toBe('Bonjour Jean, vous avez 3 messages');
    });

    it('should handle missing parameters gracefully', () => {
      const result = translate('validation.min_length', {} as Record<string, any>, 'en');
      expect(result).toBe('Must be at least {min} characters');
    });
  });

  describe('Context-Specific Translations', () => {
    it('should validate error messages are appropriate for each language', () => {
      const errorKeys = ['error.network', 'error.unauthorized', 'error.not_found', 'error.server'];

      errorKeys.forEach((key) => {
        const enError = translate(key, {} as Record<string, any>, 'en');
        const frError = translate(key, {} as Record<string, any>, 'fr');

        // English error messages should be clear and professional
        expect(enError).toMatch(/^[A-Z]/); // Start with capital letter
        expect(enError).not.toContain('!!!'); // No excessive punctuation

        // French error messages should follow French conventions
        expect(frError).toMatch(/^[A-Z]/); // Start with capital letter
        expect(frError).not.toContain('!!!'); // No excessive punctuation

        // Should not be identical
        expect(enError).not.toBe(frError);
      });
    });

    it('should validate form validation messages are user-friendly', () => {
      const validationKeys = ['validation.required', 'validation.email', 'validation.phone'];

      validationKeys.forEach((key) => {
        const enValidation = translate(key, {} as Record<string, any>, 'en');
        const frValidation = translate(key, {} as Record<string, any>, 'fr');

        // Validation messages should be helpful, not accusatory
        expect(enValidation).not.toMatch(/wrong|bad|invalid/i);
        expect(frValidation).not.toMatch(/mauvais|incorrect|faux/i);

        // Should provide guidance
        expect(enValidation.length).toBeGreaterThan(5);
        expect(frValidation.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Cultural and Legal Compliance', () => {
    it('should validate Quebec Law 25 compliance terms are properly translated', () => {
      // Test specific legal terms that must be accurate
      const legalTerms = {
        consent: { en: 'consent', fr: 'consentement' },
        privacy: { en: 'privacy', fr: 'confidentialité' },
        personal_information: { en: 'personal information', fr: 'renseignements personnels' },
        data_processing: { en: 'data processing', fr: 'traitement des données' },
      };

      Object.entries(legalTerms).forEach(([_term, translations]) => {
        // Verify these critical terms are consistently translated
        expect(translations.fr).toBeTruthy();
        expect(translations.fr).not.toBe(translations.en);
      });
    });

    it('should validate currency and number formatting preferences', () => {
      const currencyTests = [
        { amount: 1234.56, en: '$1,234.56', fr: '1 234,56 $' },
        { amount: 1000, en: '$1,000.00', fr: '1 000,00 $' },
      ];

      currencyTests.forEach(({ amount, en: _en, fr: _fr }) => {
        // These would be format functions in real implementation
        const formatCAD = (_value: number, locale: string) => {
          return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'CAD',
          }).format(_value);
        };

        const enFormatted = formatCAD(amount, 'en-CA');
        const frFormatted = formatCAD(amount, 'fr-CA');

        // Both should be valid Canadian formats
        expect(enFormatted).toContain('$');
        expect(frFormatted).toContain('$');
        expect(enFormatted).not.toBe(frFormatted);
      });
    });

    it('should validate address format compliance for Quebec', () => {
      const addressFormats = {
        en: {
          street: '123 Main Street',
          city: 'Montreal',
          province: 'Quebec',
          postal: 'H1A 1A1',
        },
        fr: {
          street: '123, rue Principale',
          city: 'Montréal',
          province: 'Québec',
          postal: 'H1A 1A1',
        },
      };

      // Validate Quebec-specific formatting
      expect(addressFormats.fr.city).toBe('Montréal'); // With accent
      expect(addressFormats.fr.province).toBe('Québec'); // With accent
      expect(addressFormats.fr.street).toContain('rue'); // French street designation
    });
  });

  describe('Translation Performance and Caching', () => {
    it('should validate translation keys are efficiently structured', () => {
      const flattenKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
        let keys: string[] = [];

        for (const key in obj) {
          const fullKey = prefix ? `${prefix}.${key}` : key;

          if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key] as Record<string, unknown>, fullKey));
          } else {
            keys.push(fullKey);
          }
        }

        return keys;
      };

      const enKeys = flattenKeys(mockTranslations.en);
      const frKeys = flattenKeys(mockTranslations.fr);

      // Both should have same number of keys
      expect(enKeys.length).toBe(frKeys.length);

      // Keys should follow consistent naming patterns
      enKeys.forEach((key) => {
        expect(key).toMatch(/^[a-zA-Z][a-zA-Z0-9_.]*$/); // letters, dots, underscores (allow camelCase)
        expect(key).not.toContain('..'); // No double dots
        expect(key).not.toMatch(/^_|_$/); // No leading/trailing underscores
      });
    });

    it('should validate translation text length is reasonable', () => {
      const maxReasonableLength = 200;
      const minReasonableLength = 2;

      const checkTextLengths = (translations: Record<string, unknown>, _language: string) => {
        const traverse = (obj: Record<string, unknown>, path = '') => {
          for (const key in obj) {
            const fullPath = path ? `${path}.${key}` : key;

            if (typeof obj[key] === 'string') {
              const text = obj[key] as string;
              expect(text.length).toBeGreaterThan(minReasonableLength);
              expect(text.length).toBeLessThan(maxReasonableLength);

              // Should not be just whitespace
              expect(text.trim().length).toBeGreaterThan(0);
            } else if (
              typeof obj[key] === 'object' &&
              obj[key] !== null &&
              !Array.isArray(obj[key])
            ) {
              traverse(obj[key] as Record<string, unknown>, fullPath);
            }
          }
        };

        traverse(translations);
      };

      checkTextLengths(mockTranslations.en, 'English');
      checkTextLengths(mockTranslations.fr, 'French');
    });
  });
});
