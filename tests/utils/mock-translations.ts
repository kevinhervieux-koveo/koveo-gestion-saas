// Mock translation utilities for testing

export const mockTranslations = {
  en: {
    // Common UI elements
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',

    // Demands
    'demands.type.maintenance': 'Maintenance',
    'demands.type.complaint': 'Complaint',
    'demands.type.information': 'Information',
    'demands.type.other': 'Other',
    'demands.status.submitted': 'Submitted',
    'demands.status.under_review': 'Under Review',
    'demands.status.approved': 'Approved',
    'demands.status.in_progress': 'In Progress',
    'demands.status.completed': 'Completed',
    'demands.status.rejected': 'Rejected',
    'demands.status.cancelled': 'Cancelled',

    // Date/Time
    'date.months': {
      january: 'January',
      february: 'February',
      march: 'March',
    },

    // Form validation
    'validation.required': 'This field is required',
    'validation.min_length': 'Must be at least {min} characters',
    'validation.max_length': 'Must be no more than {max} characters',
    'validation.email': 'Please enter a valid email address',

    // Error messages
    'error.network': 'Network error. Please try again.',
    'error.unauthorized': 'You are not authorized to perform this action.',
    'error.not_found': 'The requested resource was not found.',
    'error.server': 'An unexpected server error occurred.',

    // Success messages
    'success.created': 'Successfully created',
    'success.updated': 'Successfully updated',
    'success.deleted': 'Successfully deleted',

    // Feature Requests/Idea Box (snake_case only)
    'idea_box.title': 'Idea Box',
    'idea_box.subtitle': 'Submit and vote on feature suggestions',
    'idea_box.submit_idea': 'Submit Idea',
    'idea_box.search_placeholder': 'Search feature requests...',
    'idea_box.no_features': 'No feature requests found',
    'idea_box.first_submission': 'Be the first to submit a feature request!',
    'idea_box.loading': 'Loading feature requests...',

    'feature_request.create': 'Create Feature Request',
    'feature_request.edit': 'Edit Feature Request',
    'feature_request.title': 'Title',
    'feature_request.description': 'Description',
    'feature_request.need': 'Need',
    'feature_request.category': 'Category',
    'feature_request.status': 'Status',
    'feature_request.upvote': 'Upvote',
    'feature_request.submit_success': 'Feature request submitted successfully',
    'feature_request.update_success': 'Feature request updated successfully',
    'feature_request.delete_success': 'Feature request deleted successfully',
    'feature_request.category.property_management': 'Property Management',
    'feature_request.category.security': 'Security',
    'feature_request.status.completed': 'Completed',

    // Legacy camelCase keys (for backward compatibility)
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
    'featureRequest.status.submitted': 'Submitted',
    'featureRequest.status.underReview': 'Under Review',
    'featureRequest.status.planned': 'Planned',
    'featureRequest.status.inProgress': 'In Progress',
    'featureRequest.status.completed': 'Completed',
    'featureRequest.status.rejected': 'Rejected',
    'featureRequest.upvoteCount': '{count} upvotes',
    'featureRequest.submittedBy': 'Submitted by: {submitter}',

    // Date and time
    'date.days_ago': '{count} day ago|{count} days ago',

    // Translation keys validation
    'translation.keys.validation': 'Translation keys validation',
  },

  fr: {
    // Common UI elements
    'common.save': 'Sauvegarder',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',

    // Demands
    'demands.type.maintenance': 'Entretien',
    'demands.type.complaint': 'Plainte',
    'demands.type.information': 'Information',
    'demands.type.other': 'Autre',
    'demands.status.submitted': 'Soumis',
    'demands.status.under_review': 'En révision',
    'demands.status.approved': 'Approuvé',
    'demands.status.in_progress': 'En cours',
    'demands.status.completed': 'Terminé',
    'demands.status.rejected': 'Rejeté',
    'demands.status.cancelled': 'Annulé',

    // Date/Time
    'date.months': {
      january: 'Janvier',
      february: 'Février',
      march: 'Mars',
    },

    // Form validation
    'validation.required': 'Ce champ est requis',
    'validation.min_length': 'Doit contenir au moins {min} caractères',
    'validation.max_length': 'Doit contenir au maximum {max} caractères',
    'validation.email': 'Veuillez entrer une adresse courriel valide',

    // Error messages
    'error.network': 'Erreur réseau. Veuillez réessayer.',
    'error.unauthorized': "Vous n'êtes pas autorisé à effectuer cette action.",
    'error.not_found': "La ressource demandée n'a pas été trouvée.",
    'error.server': "Une erreur serveur inattendue s'est produite.",

    // Success messages
    'success.created': 'Créé avec succès',
    'success.updated': 'Mis à jour avec succès',
    'success.deleted': 'Supprimé avec succès',

    // Feature Requests/Idea Box (snake_case only)
    'idea_box.title': 'Boîte à idées',
    'idea_box.subtitle': 'Soumettez et votez sur les suggestions de fonctionnalités',
    'idea_box.submit_idea': 'Soumettre une idée',
    'idea_box.search_placeholder': 'Rechercher des demandes de fonctionnalités...',
    'idea_box.no_features': 'Aucune demande de fonctionnalité trouvée',
    'idea_box.first_submission': 'Soyez le premier à soumettre une demande de fonctionnalité !',
    'idea_box.loading': 'Chargement des demandes de fonctionnalités...',

    'feature_request.create': 'Créer une demande de fonctionnalité',
    'feature_request.edit': 'Modifier la demande de fonctionnalité',
    'feature_request.title': 'Titre',
    'feature_request.description': 'Description',
    'feature_request.need': 'Besoin',
    'feature_request.category': 'Catégorie',
    'feature_request.status': 'Statut',
    'feature_request.upvote': 'Voter pour',
    'feature_request.submit_success': 'Demande de fonctionnalité soumise avec succès',
    'feature_request.update_success': 'Demande de fonctionnalité mise à jour avec succès',
    'feature_request.delete_success': 'Demande de fonctionnalité supprimée avec succès',
    'feature_request.category.property_management': 'Gestion immobilière',
    'feature_request.category.security': 'Sécurité',
    'feature_request.status.completed': 'Terminé',

    // Legacy camelCase keys (for backward compatibility)
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
    'featureRequest.status.submitted': 'Soumis',
    'featureRequest.status.underReview': 'En révision',
    'featureRequest.status.planned': 'Planifié',
    'featureRequest.status.inProgress': 'En cours',
    'featureRequest.status.completed': 'Terminé',
    'featureRequest.status.rejected': 'Rejeté',
    'featureRequest.upvoteCount': '{count} vote|{count} votes',
    'featureRequest.submittedBy': 'Soumis par : {submitter}',

    // Date and time
    'date.days_ago': 'Il y a {count} jour|Il y a {count} jours',

    // Translation keys validation
    'translation.keys.validation': 'Validation des clés de traduction',
  },
};

export const translate = (
  key: string,
  params: Record<string, any> = {},
  lang: string = 'en'
): string => {
  const translations = mockTranslations[lang === 'fr' ? 'fr' : 'en'];

  if (!translations[key]) {
    return `[Missing translation: ${key}]`;
  }

  // Handle nested objects (like date.months) by returning the key
  if (typeof translations[key] === 'object') {
    return key;
  }

  // Replace parameters in translation
  let result = translations[key];
  Object.keys(params).forEach((param) => {
    if (param && param.length > 0) {
      result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    }
  });

  return result;
};

export const hasTranslation = (key: string, lang: string = 'en'): boolean => {
  const translations = mockTranslations[lang === 'fr' ? 'fr' : 'en'];
  return translations.hasOwnProperty(key);
};

export const getTranslationKeys = (lang: string = 'en'): string[] => {
  const translations = mockTranslations[lang === 'fr' ? 'fr' : 'en'];
  return Object.keys(translations);
};
