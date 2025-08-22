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
    
    // Date/Time
    'date.days_ago': '{count} day ago|{count} days ago',
    'date.months': {
      'january': 'January',
      'february': 'February', 
      'march': 'March'
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
    
    // Translation keys validation
    'translation.keys.validation': 'Translation keys validation',
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
    
    // Date/Time
    'date.days_ago': 'Il y a {count} jour|Il y a {count} jours',
    'date.months': {
      'january': 'Janvier',
      'february': 'Février',
      'march': 'Mars'
    },
    
    // Form validation
    'validation.required': 'Ce champ est requis',
    'validation.min_length': 'Doit contenir au moins {min} caractères',
    'validation.max_length': 'Doit contenir au maximum {max} caractères', 
    'validation.email': 'Veuillez entrer une adresse courriel valide',
    
    // Error messages
    'error.network': 'Erreur réseau. Veuillez réessayer.',
    'error.unauthorized': 'Vous n\'êtes pas autorisé à effectuer cette action.',
    'error.not_found': 'La ressource demandée n\'a pas été trouvée.',
    'error.server': 'Une erreur serveur inattendue s\'est produite.',
    
    // Success messages
    'success.created': 'Créé avec succès',
    'success.updated': 'Mis à jour avec succès',
    'success.deleted': 'Supprimé avec succès',
  }
};

export const translate = (_key: string, _params: Record<string, any> = {}, lang: string = 'en'): string => {
  const translations = mockTranslations[lang as keyof typeof mockTranslations] || mockTranslations.en;
  let translation = translations[key as keyof typeof translations];
  
  if (!translation) {
    return `[Missing translation: ${key}]`;
  }
  
  // Replace parameters in translation
  Object.keys(_params).forEach(param => {
    translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });
  
  return translation;
};

export const hasTranslation = (_key: string, lang: string = 'en'): boolean => {
  const translations = mockTranslations[lang as keyof typeof mockTranslations] || mockTranslations.en;
  return key in translations;
};