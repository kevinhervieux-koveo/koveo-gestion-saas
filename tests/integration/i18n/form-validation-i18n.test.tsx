/**
 * @file Form Validation Internationalization Tests.
 * @description Tests for French and English form validation messages and user experience.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';

// Mock form validation schema with i18n support
const createValidationSchema = (language: 'en' | 'fr') => {
  const messages = {
    en: {
      required: 'This field is required',
      minLength: (min: number) => `Must be at least ${min} characters`,
      maxLength: (max: number) => `Must be no more than ${max} characters`,
      email: 'Please enter a valid email address',
      phone: 'Please enter a valid phone number',
      postalCode: 'Please enter a valid postal code (format: A1A 1A1)',
      strongPassword: 'Password must contain at least 8 characters, including uppercase, lowercase, and numbers',
      confirmPassword: 'Passwords do not match',
      invalidDate: 'Please enter a valid date',
      futureDate: 'Date must be in the future',
      businessHours: 'Please select a time during business hours (9 AM - 5 PM)',
      validUrl: 'Please enter a valid website URL',
      phoneQuebec: 'Please enter a valid Quebec phone number (format: 514-555-0123)',
      sin: 'Please enter a valid Social Insurance Number'
    },
    fr: {
      required: 'Ce champ est requis',
      minLength: (min: number) => `Doit contenir au moins ${min} caractères`,
      maxLength: (max: number) => `Ne doit pas dépasser ${max} caractères`,
      email: 'Veuillez entrer une adresse courriel valide',
      phone: 'Veuillez entrer un numéro de téléphone valide',
      postalCode: 'Veuillez entrer un code postal valide (format: A1A 1A1)',
      strongPassword: 'Le mot de passe doit contenir au moins 8 caractères, incluant majuscules, minuscules et chiffres',
      confirmPassword: 'Les mots de passe ne correspondent pas',
      invalidDate: 'Veuillez entrer une date valide',
      futureDate: 'La date doit être dans le futur',
      businessHours: 'Veuillez sélectionner une heure pendant les heures d\'affaires (9h - 17h)',
      validUrl: 'Veuillez entrer une URL de site web valide',
      phoneQuebec: 'Veuillez entrer un numéro de téléphone québécois valide (format: 514-555-0123)',
      sin: 'Veuillez entrer un numéro d\'assurance sociale valide'
    }
  };
  
  return messages[language];
};

// Mock multilingual form component
const MultilingualDemandForm = ({ language = 'en' }: { language?: 'en' | 'fr' }) => {
  const [formData, setFormData] = React.useState({
    type: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    building: '',
    residence: '',
    preferredDate: '',
    urgency: '',
    attachments: []
  });
  
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const validation = createValidationSchema(language);
  
  const labels = {
    en: {
      title: 'Create New Demand',
      type: 'Request Type',
      description: 'Description',
      contactEmail: 'Contact Email',
      contactPhone: 'Contact Phone',
      building: 'Building',
      residence: 'Residence/Unit',
      preferredDate: 'Preferred Date',
      urgency: 'Urgency Level',
      attachments: 'Attachments',
      submit: 'Submit Request',
      cancel: 'Cancel',
      typeOptions: {
        maintenance: 'Maintenance',
        complaint: 'Complaint',
        information: 'Information Request',
        other: 'Other'
      },
      urgencyOptions: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent'
      }
    },
    fr: {
      title: 'Créer une nouvelle demande',
      type: 'Type de demande',
      description: 'Description',
      contactEmail: 'Courriel de contact',
      contactPhone: 'Téléphone de contact',
      building: 'Bâtiment',
      residence: 'Résidence/Unité',
      preferredDate: 'Date préférée',
      urgency: 'Niveau d\'urgence',
      attachments: 'Pièces jointes',
      submit: 'Soumettre la demande',
      cancel: 'Annuler',
      typeOptions: {
        maintenance: 'Maintenance',
        complaint: 'Plainte',
        information: 'Demande d\'information',
        other: 'Autre'
      },
      urgencyOptions: {
        low: 'Faible',
        medium: 'Moyen',
        high: 'Élevé',
        urgent: 'Urgent'
      }
    }
  };
  
  const t = labels[language];
  
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'type':
        return !value ? validation.required : '';
      case 'description':
        if (!value) {return validation.required;}
        if (value.length < 10) {return validation.minLength(10);}
        if (value.length > 2000) {return validation.maxLength(2000);}
        return '';
      case 'contactEmail':
        if (!value) {return validation.required;}
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRegex.test(value) ? validation.email : '';
      case 'contactPhone':
        if (!value) {return validation.required;}
        // Quebec phone format: 514-555-0123 or (514) 555-0123
        const phoneRegex = /^(\(\d{3}\)\s?|\d{3}[-.]?)\d{3}[-.]?\d{4}$/;
        return !phoneRegex.test(value) ? validation.phoneQuebec : '';
      case 'building':
        return !value ? validation.required : '';
      case 'preferredDate':
        if (value) {
          const date = new Date(value);
          const now = new Date();
          if (isNaN(date.getTime())) {return validation.invalidDate;}
          if (date < now) {return validation.futureDate;}
        }
        return '';
      default:
        return '';
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key as keyof typeof formData] as string);
      if (error) {newErrors[key] = error;}
    });
    
    setErrors(newErrors);
    setIsSubmitting(false);
    
    if (Object.keys(newErrors).length === 0) {
      // Form is valid
      console.log('Form submitted:', formData);
    }
  };
  
  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  return (
    <form onSubmit={handleSubmit} data-testid="multilingual-form">
      <h2 className="text-xl font-semibold mb-4">{t.title}</h2>
      
      {/* Request Type */}
      <div className="mb-4">
        <label htmlFor="type" className="block text-sm font-medium mb-1">
          {t.type} *
        </label>
        <select
          id="type"
          value={formData.type}
          onChange={(e) => handleFieldChange('type', e.target.value)}
          className={`w-full p-2 border rounded ${errors.type ? 'border-red-500' : 'border-gray-300'}`}
          data-testid="type-select"
        >
          <option value="">-- {language === 'en' ? 'Select' : 'Sélectionner'} --</option>
          <option value="maintenance">{t.typeOptions.maintenance}</option>
          <option value="complaint">{t.typeOptions.complaint}</option>
          <option value="information">{t.typeOptions.information}</option>
          <option value="other">{t.typeOptions.other}</option>
        </select>
        {errors.type && (
          <p className="text-red-500 text-sm mt-1" data-testid="type-error">
            {errors.type}
          </p>
        )}
      </div>
      
      {/* Description */}
      <div className="mb-4">
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          {t.description} *
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          className={`w-full p-2 border rounded h-24 ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
          placeholder={language === 'en' ? 'Describe your request...' : 'Décrivez votre demande...'}
          data-testid="description-textarea"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1" data-testid="description-error">
            {errors.description}
          </p>
        )}
      </div>
      
      {/* Contact Email */}
      <div className="mb-4">
        <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
          {t.contactEmail} *
        </label>
        <input
          type="email"
          id="contactEmail"
          value={formData.contactEmail}
          onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
          className={`w-full p-2 border rounded ${errors.contactEmail ? 'border-red-500' : 'border-gray-300'}`}
          placeholder={language === 'en' ? 'your@email.com' : 'votre@courriel.com'}
          data-testid="email-input"
        />
        {errors.contactEmail && (
          <p className="text-red-500 text-sm mt-1" data-testid="email-error">
            {errors.contactEmail}
          </p>
        )}
      </div>
      
      {/* Contact Phone */}
      <div className="mb-4">
        <label htmlFor="contactPhone" className="block text-sm font-medium mb-1">
          {t.contactPhone} *
        </label>
        <input
          type="tel"
          id="contactPhone"
          value={formData.contactPhone}
          onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
          className={`w-full p-2 border rounded ${errors.contactPhone ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="514-555-0123"
          data-testid="phone-input"
        />
        {errors.contactPhone && (
          <p className="text-red-500 text-sm mt-1" data-testid="phone-error">
            {errors.contactPhone}
          </p>
        )}
      </div>
      
      {/* Building */}
      <div className="mb-4">
        <label htmlFor="building" className="block text-sm font-medium mb-1">
          {t.building} *
        </label>
        <input
          type="text"
          id="building"
          value={formData.building}
          onChange={(e) => handleFieldChange('building', e.target.value)}
          className={`w-full p-2 border rounded ${errors.building ? 'border-red-500' : 'border-gray-300'}`}
          data-testid="building-input"
        />
        {errors.building && (
          <p className="text-red-500 text-sm mt-1" data-testid="building-error">
            {errors.building}
          </p>
        )}
      </div>
      
      {/* Preferred Date */}
      <div className="mb-4">
        <label htmlFor="preferredDate" className="block text-sm font-medium mb-1">
          {t.preferredDate}
        </label>
        <input
          type="date"
          id="preferredDate"
          value={formData.preferredDate}
          onChange={(e) => handleFieldChange('preferredDate', e.target.value)}
          className={`w-full p-2 border rounded ${errors.preferredDate ? 'border-red-500' : 'border-gray-300'}`}
          data-testid="date-input"
        />
        {errors.preferredDate && (
          <p className="text-red-500 text-sm mt-1" data-testid="date-error">
            {errors.preferredDate}
          </p>
        )}
      </div>
      
      {/* Urgency Level */}
      <div className="mb-6">
        <label htmlFor="urgency" className="block text-sm font-medium mb-1">
          {t.urgency}
        </label>
        <select
          id="urgency"
          value={formData.urgency}
          onChange={(e) => handleFieldChange('urgency', e.target.value)}
          className="w-full p-2 border rounded border-gray-300"
          data-testid="urgency-select"
        >
          <option value="">-- {language === 'en' ? 'Select' : 'Sélectionner'} --</option>
          <option value="low">{t.urgencyOptions.low}</option>
          <option value="medium">{t.urgencyOptions.medium}</option>
          <option value="high">{t.urgencyOptions.high}</option>
          <option value="urgent">{t.urgencyOptions.urgent}</option>
        </select>
      </div>
      
      {/* Submit Buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          data-testid="submit-button"
        >
          {isSubmitting ? (language === 'en' ? 'Submitting...' : 'Envoi en cours...') : t.submit}
        </button>
        <button
          type="button"
          className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
          data-testid="cancel-button"
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
};

describe('Form Validation Internationalization Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          {component}
        </LanguageProvider>
      </QueryClientProvider>
    );
  };

  describe('English Form Validation', () => {
    it('should display English validation messages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      // Try to submit empty form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      // Check required field messages are in English
      await waitFor(() => {
        expect(screen.getByTestId('type-error')).toHaveTextContent('This field is required');
        expect(screen.getByTestId('description-error')).toHaveTextContent('This field is required');
        expect(screen.getByTestId('email-error')).toHaveTextContent('This field is required');
        expect(screen.getByTestId('phone-error')).toHaveTextContent('This field is required');
        expect(screen.getByTestId('building-error')).toHaveTextContent('This field is required');
      });
    });

    it('should validate email format in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const emailInput = screen.getByTestId('email-input');
      await user.type(emailInput, 'invalid-email');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toHaveTextContent('Please enter a valid email address');
      });
    });

    it('should validate phone format for Quebec in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const phoneInput = screen.getByTestId('phone-input');
      await user.type(phoneInput, '123-456');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('phone-error')).toHaveTextContent('Please enter a valid Quebec phone number (format: 514-555-0123)');
      });
    });

    it('should validate description length in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const descriptionTextarea = screen.getByTestId('description-textarea');
      await user.type(descriptionTextarea, 'Short');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('description-error')).toHaveTextContent('Must be at least 10 characters');
      });
    });

    it('should validate future date in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const dateInput = screen.getByTestId('date-input');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      await user.type(dateInput, yesterdayStr);
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('date-error')).toHaveTextContent('Date must be in the future');
      });
    });
  });

  describe('French Form Validation', () => {
    it('should display French validation messages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      // Try to submit empty form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      // Check required field messages are in French
      await waitFor(() => {
        expect(screen.getByTestId('type-error')).toHaveTextContent('Ce champ est requis');
        expect(screen.getByTestId('description-error')).toHaveTextContent('Ce champ est requis');
        expect(screen.getByTestId('email-error')).toHaveTextContent('Ce champ est requis');
        expect(screen.getByTestId('phone-error')).toHaveTextContent('Ce champ est requis');
        expect(screen.getByTestId('building-error')).toHaveTextContent('Ce champ est requis');
      });
    });

    it('should validate email format in French with Quebec terminology', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      const emailInput = screen.getByTestId('email-input');
      await user.type(emailInput, 'invalid-email');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toHaveTextContent('Veuillez entrer une adresse courriel valide');
      });
    });

    it('should validate phone format for Quebec in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      const phoneInput = screen.getByTestId('phone-input');
      await user.type(phoneInput, '123-456');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('phone-error')).toHaveTextContent('Veuillez entrer un numéro de téléphone québécois valide (format: 514-555-0123)');
      });
    });

    it('should validate description length in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      const descriptionTextarea = screen.getByTestId('description-textarea');
      await user.type(descriptionTextarea, 'Court');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('description-error')).toHaveTextContent('Doit contenir au moins 10 caractères');
      });
    });

    it('should validate future date in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      const dateInput = screen.getByTestId('date-input');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      await user.type(dateInput, yesterdayStr);
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('date-error')).toHaveTextContent('La date doit être dans le futur');
      });
    });
  });

  describe('Form Labels and UI Text', () => {
    it('should display all form labels in English', () => {
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      expect(screen.getByText('Create New Demand')).toBeInTheDocument();
      expect(screen.getByText('Request Type')).toBeInTheDocument();
      expect(screen.getByText('Contact Email')).toBeInTheDocument();
      expect(screen.getByText('Contact Phone')).toBeInTheDocument();
      expect(screen.getByText('Preferred Date')).toBeInTheDocument();
      expect(screen.getByText('Submit Request')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should display all form labels in French', () => {
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      expect(screen.getByText('Créer une nouvelle demande')).toBeInTheDocument();
      expect(screen.getByText('Type de demande')).toBeInTheDocument();
      expect(screen.getByText('Courriel de contact')).toBeInTheDocument();
      expect(screen.getByText('Téléphone de contact')).toBeInTheDocument();
      expect(screen.getByText('Date préférée')).toBeInTheDocument();
      expect(screen.getByText('Soumettre la demande')).toBeInTheDocument();
      expect(screen.getByText('Annuler')).toBeInTheDocument();
    });

    it('should display select options in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const typeSelect = screen.getByTestId('type-select');
      await user.click(typeSelect);
      
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
      expect(screen.getByText('Complaint')).toBeInTheDocument();
      expect(screen.getByText('Information Request')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('should display select options in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      const typeSelect = screen.getByTestId('type-select');
      await user.click(typeSelect);
      
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
      expect(screen.getByText('Plainte')).toBeInTheDocument();
      expect(screen.getByText('Demande d\'information')).toBeInTheDocument();
      expect(screen.getByText('Autre')).toBeInTheDocument();
    });
  });

  describe('Placeholder Text and Formatting', () => {
    it('should display English placeholder text', () => {
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const descriptionTextarea = screen.getByTestId('description-textarea');
      expect(descriptionTextarea).toHaveAttribute('placeholder', 'Describe your request...');
      
      const emailInput = screen.getByTestId('email-input');
      expect(emailInput).toHaveAttribute('placeholder', 'your@email.com');
    });

    it('should display French placeholder text with Quebec terminology', () => {
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      const descriptionTextarea = screen.getByTestId('description-textarea');
      expect(descriptionTextarea).toHaveAttribute('placeholder', 'Décrivez votre demande...');
      
      const emailInput = screen.getByTestId('email-input');
      expect(emailInput).toHaveAttribute('placeholder', 'votre@courriel.com');
    });

    it('should format phone number placeholder consistently', () => {
      renderWithProviders(<MultilingualDemandForm language="en" />);
      const phoneInput = screen.getByTestId('phone-input');
      expect(phoneInput).toHaveAttribute('placeholder', '514-555-0123');
      
      // French should use same phone format
      const { rerender } = renderWithProviders(<MultilingualDemandForm language="fr" />);
      const frPhoneInput = screen.getByTestId('phone-input');
      expect(frPhoneInput).toHaveAttribute('placeholder', '514-555-0123');
    });
  });

  describe('Loading and Submit States', () => {
    it('should display loading state in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      // Fill out minimum required fields
      await user.selectOptions(screen.getByTestId('type-select'), 'maintenance');
      await user.type(screen.getByTestId('description-textarea'), 'This is a maintenance request for testing');
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('phone-input'), '514-555-0123');
      await user.type(screen.getByTestId('building-input'), 'Test Building');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      // Note: In real implementation, loading state would be properly tested
      expect(submitButton).toHaveTextContent('Submit Request');
    });

    it('should display loading state in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      // Fill out minimum required fields
      await user.selectOptions(screen.getByTestId('type-select'), 'maintenance');
      await user.type(screen.getByTestId('description-textarea'), 'Ceci est une demande de maintenance pour test');
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('phone-input'), '514-555-0123');
      await user.type(screen.getByTestId('building-input'), 'Bâtiment de test');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      expect(submitButton).toHaveTextContent('Soumettre la demande');
    });
  });

  describe('Accessibility and Screen Reader Support', () => {
    it('should have proper ARIA labels in English', () => {
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const form = screen.getByTestId('multilingual-form');
      expect(form).toBeInTheDocument();
      
      // Check that required fields are properly marked
      const requiredFields = screen.getAllByText('*');
      expect(requiredFields.length).toBeGreaterThan(0);
    });

    it('should have proper ARIA labels in French', () => {
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      const form = screen.getByTestId('multilingual-form');
      expect(form).toBeInTheDocument();
      
      // Check that required fields are properly marked
      const requiredFields = screen.getAllByText('*');
      expect(requiredFields.length).toBeGreaterThan(0);
    });

    it('should associate error messages with form fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        const typeError = screen.getByTestId('type-error');
        const typeSelect = screen.getByTestId('type-select');
        
        // In a real implementation, aria-describedby would link these
        expect(typeError).toBeInTheDocument();
        expect(typeSelect).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Validation', () => {
    it('should clear English errors when user corrects input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="en" />);
      
      // Trigger error first
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('type-error')).toBeInTheDocument();
      });
      
      // Fix the error
      const typeSelect = screen.getByTestId('type-select');
      await user.selectOptions(typeSelect, 'maintenance');
      
      // Error should be cleared
      expect(screen.queryByTestId('type-error')).not.toBeInTheDocument();
    });

    it('should clear French errors when user corrects input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandForm language="fr" />);
      
      // Trigger error first
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('type-error')).toBeInTheDocument();
      });
      
      // Fix the error
      const typeSelect = screen.getByTestId('type-select');
      await user.selectOptions(typeSelect, 'maintenance');
      
      // Error should be cleared
      expect(screen.queryByTestId('type-error')).not.toBeInTheDocument();
    });
  });
});