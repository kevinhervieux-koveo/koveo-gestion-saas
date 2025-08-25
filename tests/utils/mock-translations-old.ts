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
    'date.days_ago': '{count} day ago|{count} days ago',
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

    // Feature Requests/Idea Box
    'idea_box.title': 'Idea Box',
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
    'idea_box.subtitle': 'Submit and vote on feature suggestions',
    'idea_box.submit_idea': 'Submit Idea',
    'idea_box.search_placeholder': 'Search feature requests...',
    'idea_box.no_features': 'No feature requests found',
    'feature_request.category.property_management': 'Property Management',
    'feature_request.category.security': 'Security',
    'feature_request.status.completed': 'Completed',
    'idea_box.first_submission': 'Be the first to submit a feature request!',
    'idea_box.loading': 'Loading feature requests...',

    // Feature Request Form (converted to snake_case)

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

    // Translation keys validation
    'translation.keys.validation': 'Translation keys validation',

    // Additional missing translations
    'featureRequest.create': 'Create Feature Request',
    'idea_box.title': 'Idea Box',
  },
  fr: {
    // Common UI elements
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',

    // Demands
    'demands.type.maintenance': 'Maintenance',
    'demands.type.complaint': 'Plainte',
    'demands.type.information': 'Information',
    'demands.type.other': 'Autre',
    'demands.status.submitted': 'Soumis',
    'demands.status.under_review': 'En révision',
    'demands.status.approved': 'Approuvé',
    'demands.status.in_progress': 'En cours',
    'demands.status.completed': 'Complété',
    'demands.status.rejected': 'Rejeté',
    'demands.status.cancelled': 'Annulé',

    // Feature Requests/Idea Box
    'idea_box.title': 'Boîte à idées',
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
    'idea_box.subtitle': 'Soumettez et votez sur les suggestions de fonctionnalités',
    'idea_box.submit_idea': 'Soumettre une idée',
    'idea_box.search_placeholder': 'Rechercher des demandes de fonctionnalités...',
    'idea_box.no_features': 'Aucune demande de fonctionnalité trouvée',
    'feature_request.category.property_management': 'Gestion immobilière',
    'feature_request.category.security': 'Sécurité',
    'feature_request.status.completed': 'Terminé',
    'idea_box.first_submission': 'Soyez le premier à soumettre une demande de fonctionnalité !',
    'idea_box.loading': 'Chargement des demandes de fonctionnalités...',

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

    // Date/Time
    'date.days_ago': 'Il y a {count} jour|Il y a {count} jours',
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

    // Translation keys validation
    'translation.keys.validation': 'Validation des clés de traduction',

    // Additional missing translations
    'featureRequest.create': 'Créer une demande de fonctionnalité',
    'idea_box.title': 'Boîte à idées',
  },
};

export const translate = (
  key: string,
  params: Record<string, any> = {},
  lang: string = 'en'
): string => {
  const translations = mockTranslations[lang === 'fr' ? 'fr' : 'en'];

  // Translation function working correctly - debug removed

  const translation = translations[key];

  if (translation === undefined) {
    return `[Missing translation: ${key}]`;
  }

  // Handle nested objects (like date.months) by returning the key
  if (typeof translation === 'object') {
    return key;
  }

  // Replace parameters in translation
  let result = translation;
  Object.keys(params).forEach((param) => {
    result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });

  return result;
};

export const hasTranslation = (key: string, lang: string = 'en'): boolean => {
  const translations = mockTranslations[lang === 'fr' ? 'fr' : 'en'];
  return key in translations;
};
