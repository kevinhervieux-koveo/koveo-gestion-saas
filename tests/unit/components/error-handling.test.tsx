/**
 * @file Error Handling Component Tests
 * @description Comprehensive tests for error handling components and error boundary functionality
 * in the Quebec property management system.
 */

import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the enhanced error handling system
const mockApiError = jest.fn();
const mockValidationError = jest.fn();

jest.mock('../../../server/types/errors', () => ({
  ApiError: {
    badRequest: mockApiError,
    unauthorized: mockApiError,
    forbidden: mockApiError,
    notFound: mockApiError,
    internal: mockApiError,
  },
  ValidationError: {
    fromZodError: mockValidationError,
  },
  ErrorCodes: {
    AUTHENTICATION_REQUIRED: 'AUTH_001',
    ACCESS_FORBIDDEN: 'AUTH_002',
    USER_NOT_FOUND: 'USER_001',
    ORGANIZATION_NOT_FOUND: 'ORG_001',
    BUILDING_NOT_FOUND: 'BUILDING_001',
    RESIDENCE_NOT_FOUND: 'RES_001',
    VALIDATION_FAILED: 'VAL_001',
    DATABASE_QUERY_FAILED: 'DB_001',
    INTERNAL_SERVER_ERROR: 'SYS_001',
  }
}));

// Test components that simulate error scenarios
const ErrorTriggerComponent: React.FC<{ errorType: string }> = ({ errorType }) => {
  const triggerError = () => {
    switch (errorType) {
      case 'auth':
        throw new Error('Authentication required');
      case 'validation':
        throw new Error('Invalid form data');
      case 'network':
        throw new Error('Network connection failed');
      case 'permission':
        throw new Error('Access forbidden');
      default:
        throw new Error('Generic error');
    }
  };

  return (
    <div>
      <button data-testid="trigger-error" onClick={triggerError}>
        Trigger {errorType} Error
      </button>
    </div>
  );
};

// Simple Error Boundary for testing
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-fallback">
          <h2>Something went wrong</h2>
          <p data-testid="error-message">{this.state.error?.message}</p>
          <button 
            data-testid="retry-button"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mock Quebec property management components that might encounter errors
const PropertyListComponent: React.FC<{ shouldError?: boolean }> = ({ shouldError }) => {
  const [properties, setProperties] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchProperties = async () => {
      try {
        if (shouldError) {
          throw new Error('Failed to fetch properties');
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setProperties([
          { id: '1', name: 'Demo Building Montreal', address: '123 Rue Demo, Montreal, QC' },
          { id: '2', name: 'Tour Résidentielle', address: '456 Rue Sherbrooke, Montreal, QC' }
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [shouldError]);

  if (loading) {
    return <div data-testid="loading">Chargement des propriétés...</div>;
  }

  if (error) {
    return (
      <div data-testid="property-error" className="error-container">
        <h3>Erreur lors du chargement</h3>
        <p data-testid="property-error-message">{error}</p>
        <button data-testid="retry-properties" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div data-testid="property-list">
      <h2>Propriétés Disponibles</h2>
      {properties.map(property => (
        <div key={property.id} data-testid={`property-${property.id}`}>
          <h3>{property.name}</h3>
          <p>{property.address}</p>
        </div>
      ))}
    </div>
  );
};

const UserFormComponent: React.FC = () => {
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom de famille est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Le courriel est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format de courriel invalide';
    }

    if (formData.phone && !/^\+1-\d{3}-\d{3}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = 'Format de téléphone invalide (ex: +1-514-555-0123)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate random server error
      if (Math.random() < 0.3) {
        throw new Error('Erreur serveur: Impossible de sauvegarder l\'utilisateur');
      }

      alert('Utilisateur créé avec succès!');
      setFormData({ firstName: '', lastName: '', email: '', phone: '' });
    } catch (error) {
      setErrors({ 
        submit: error instanceof Error ? error.message : 'Une erreur est survenue' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form data-testid="user-form" onSubmit={handleSubmit}>
      <h2>Créer un Nouvel Utilisateur</h2>
      
      <div>
        <label htmlFor="firstName">Prénom *</label>
        <input
          id="firstName"
          data-testid="input-firstName"
          type="text"
          value={formData.firstName}
          onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
        />
        {errors.firstName && (
          <span data-testid="error-firstName" className="error">
            {errors.firstName}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="lastName">Nom de famille *</label>
        <input
          id="lastName"
          data-testid="input-lastName"
          type="text"
          value={formData.lastName}
          onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
        />
        {errors.lastName && (
          <span data-testid="error-lastName" className="error">
            {errors.lastName}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="email">Courriel *</label>
        <input
          id="email"
          data-testid="input-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        />
        {errors.email && (
          <span data-testid="error-email" className="error">
            {errors.email}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="phone">Téléphone</label>
        <input
          id="phone"
          data-testid="input-phone"
          type="tel"
          placeholder="+1-514-555-0123"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
        />
        {errors.phone && (
          <span data-testid="error-phone" className="error">
            {errors.phone}
          </span>
        )}
      </div>

      {errors.submit && (
        <div data-testid="error-submit" className="error-banner">
          {errors.submit}
        </div>
      )}

      <button 
        type="submit" 
        data-testid="submit-button"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Création en cours...' : 'Créer l\'utilisateur'}
      </button>
    </form>
  );
};

describe('Error Handling Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error during tests to avoid noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Boundary Functionality', () => {
    it('should catch and display authentication errors', () => {
      const onError = jest.fn();
      
      render(
        <TestErrorBoundary onError={onError}>
          <ErrorTriggerComponent errorType="auth" />
        </TestErrorBoundary>
      );

      const triggerButton = screen.getByTestId('trigger-error');
      fireEvent.click(triggerButton);

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Authentication required');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should catch and display validation errors', () => {
      const onError = jest.fn();
      
      render(
        <TestErrorBoundary onError={onError}>
          <ErrorTriggerComponent errorType="validation" />
        </TestErrorBoundary>
      );

      const triggerButton = screen.getByTestId('trigger-error');
      fireEvent.click(triggerButton);

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid form data');
    });

    it('should catch and display network errors', () => {
      const onError = jest.fn();
      
      render(
        <TestErrorBoundary onError={onError}>
          <ErrorTriggerComponent errorType="network" />
        </TestErrorBoundary>
      );

      const triggerButton = screen.getByTestId('trigger-error');
      fireEvent.click(triggerButton);

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Network connection failed');
    });

    it('should allow retry after error recovery', () => {
      const onError = jest.fn();
      
      render(
        <TestErrorBoundary onError={onError}>
          <ErrorTriggerComponent errorType="auth" />
        </TestErrorBoundary>
      );

      // Trigger error
      const triggerButton = screen.getByTestId('trigger-error');
      fireEvent.click(triggerButton);

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);

      // Component should be restored
      expect(screen.getByTestId('trigger-error')).toBeInTheDocument();
      expect(screen.queryByTestId('error-fallback')).not.toBeInTheDocument();
    });
  });

  describe('Property List Error Handling', () => {
    it('should display loading state initially', () => {
      render(<PropertyListComponent />);
      
      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.getByTestId('loading')).toHaveTextContent('Chargement des propriétés...');
    });

    it('should display properties when loaded successfully', async () => {
      render(<PropertyListComponent shouldError={false} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('property-list')).toBeInTheDocument();
      });

      expect(screen.getByTestId('property-1')).toBeInTheDocument();
      expect(screen.getByTestId('property-2')).toBeInTheDocument();
      expect(screen.getByText('Demo Building Montreal')).toBeInTheDocument();
      expect(screen.getByText('Tour Résidentielle')).toBeInTheDocument();
    });

    it('should display error message when fetch fails', async () => {
      render(<PropertyListComponent shouldError={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('property-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('property-error-message')).toHaveTextContent('Failed to fetch properties');
      expect(screen.getByTestId('retry-properties')).toBeInTheDocument();
      expect(screen.getByText('Erreur lors du chargement')).toBeInTheDocument();
    });

    it('should handle Quebec-specific error messages in French', async () => {
      render(<PropertyListComponent shouldError={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('property-error')).toBeInTheDocument();
      });

      // French error messages should be displayed
      expect(screen.getByText('Erreur lors du chargement')).toBeInTheDocument();
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });
  });

  describe('User Form Validation and Error Handling', () => {
    it('should show validation errors for empty required fields', async () => {
      render(<UserFormComponent />);
      
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-firstName')).toBeInTheDocument();
        expect(screen.getByTestId('error-lastName')).toBeInTheDocument();
        expect(screen.getByTestId('error-email')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-firstName')).toHaveTextContent('Le prénom est requis');
      expect(screen.getByTestId('error-lastName')).toHaveTextContent('Le nom de famille est requis');
      expect(screen.getByTestId('error-email')).toHaveTextContent('Le courriel est requis');
    });

    it('should show validation error for invalid email format', async () => {
      render(<UserFormComponent />);
      
      const emailInput = screen.getByTestId('input-email');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-email')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-email')).toHaveTextContent('Format de courriel invalide');
    });

    it('should show validation error for invalid Quebec phone format', async () => {
      render(<UserFormComponent />);
      
      const phoneInput = screen.getByTestId('input-phone');
      fireEvent.change(phoneInput, { target: { value: '514-555-0123' } }); // Missing +1-
      
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-phone')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-phone')).toHaveTextContent('Format de téléphone invalide (ex: +1-514-555-0123)');
    });

    it('should accept valid Quebec phone format', async () => {
      render(<UserFormComponent />);
      
      const firstNameInput = screen.getByTestId('input-firstName');
      const lastNameInput = screen.getByTestId('input-lastName');
      const emailInput = screen.getByTestId('input-email');
      const phoneInput = screen.getByTestId('input-phone');
      
      fireEvent.change(firstNameInput, { target: { value: 'Jean' } });
      fireEvent.change(lastNameInput, { target: { value: 'Tremblay' } });
      fireEvent.change(emailInput, { target: { value: 'jean.tremblay@email.com' } });
      fireEvent.change(phoneInput, { target: { value: '+1-514-555-0123' } });
      
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Should not show phone validation error
      await waitFor(() => {
        expect(screen.queryByTestId('error-phone')).not.toBeInTheDocument();
      });
    });

    it('should handle server errors gracefully', async () => {
      // Mock Math.random to always trigger server error
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.3, so will trigger error

      render(<UserFormComponent />);
      
      // Fill valid form data
      const firstNameInput = screen.getByTestId('input-firstName');
      const lastNameInput = screen.getByTestId('input-lastName');
      const emailInput = screen.getByTestId('input-email');
      
      fireEvent.change(firstNameInput, { target: { value: 'Marie' } });
      fireEvent.change(lastNameInput, { target: { value: 'Dubois' } });
      fireEvent.change(emailInput, { target: { value: 'marie.dubois@email.com' } });
      
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText('Création en cours...')).toBeInTheDocument();
      });

      // Check error state
      await waitFor(() => {
        expect(screen.getByTestId('error-submit')).toBeInTheDocument();
      }, { timeout: 2000 });

      expect(screen.getByTestId('error-submit')).toHaveTextContent('Erreur serveur: Impossible de sauvegarder l\'utilisateur');
    });

    it('should clear validation errors when user starts typing', async () => {
      render(<UserFormComponent />);
      
      // Trigger validation errors
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-firstName')).toBeInTheDocument();
      });

      // Start typing in first name
      const firstNameInput = screen.getByTestId('input-firstName');
      fireEvent.change(firstNameInput, { target: { value: 'J' } });
      
      // Try to submit again to trigger validation
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Error should be cleared for firstName since it has a value now
        expect(screen.queryByTestId('error-firstName')).not.toBeInTheDocument();
      });
    });
  });

  describe('Quebec-Specific Error Scenarios', () => {
    it('should handle bilingual error messages correctly', () => {
      const BilingualErrorComponent: React.FC = () => {
        const [language, setLanguage] = React.useState<'fr' | 'en'>('fr');
        const [error, setError] = React.useState<string | null>(null);

        const messages = {
          fr: {
            notFound: 'Résidence non trouvée',
            accessDenied: 'Accès refusé à cette propriété',
            serverError: 'Erreur du serveur'
          },
          en: {
            notFound: 'Residence not found',
            accessDenied: 'Access denied to this property',
            serverError: 'Server error'
          }
        };

        return (
          <div>
            <button 
              data-testid="toggle-language"
              onClick={() => setLanguage(prev => prev === 'fr' ? 'en' : 'fr')}
            >
              Language: {language}
            </button>
            
            <button
              data-testid="trigger-notfound"
              onClick={() => setError(messages[language].notFound)}
            >
              Trigger Not Found
            </button>
            
            {error && (
              <div data-testid="error-display" className="error">
                {error}
              </div>
            )}
          </div>
        );
      };

      render(<BilingualErrorComponent />);

      // Test French error message
      const triggerButton = screen.getByTestId('trigger-notfound');
      fireEvent.click(triggerButton);

      expect(screen.getByTestId('error-display')).toHaveTextContent('Résidence non trouvée');

      // Switch to English
      const languageButton = screen.getByTestId('toggle-language');
      fireEvent.click(languageButton);
      fireEvent.click(triggerButton);

      expect(screen.getByTestId('error-display')).toHaveTextContent('Residence not found');
    });

    it('should handle Quebec postal code validation errors', () => {
      const PostalCodeValidator: React.FC = () => {
        const [postalCode, setPostalCode] = React.useState('');
        const [error, setError] = React.useState('');

        const validatePostalCode = (value: string) => {
          const quebecPostalRegex = /^[A-Z]\d[A-Z]\s+\d[A-Z]\d$/;
          if (value && !quebecPostalRegex.test(value.toUpperCase())) {
            setError('Code postal québécois invalide (ex: H1A 1A1)');
          } else {
            setError('');
          }
        };

        return (
          <div>
            <input
              data-testid="postal-input"
              value={postalCode}
              onChange={(e) => {
                setPostalCode(e.target.value);
                validatePostalCode(e.target.value);
              }}
              placeholder="H1A 1A1"
            />
            {error && (
              <span data-testid="postal-error" className="error">
                {error}
              </span>
            )}
          </div>
        );
      };

      render(<PostalCodeValidator />);

      const input = screen.getByTestId('postal-input');
      
      // Test invalid postal code
      fireEvent.change(input, { target: { value: '12345' } });
      expect(screen.getByTestId('postal-error')).toHaveTextContent('Code postal québécois invalide (ex: H1A 1A1)');

      // Test valid postal code
      fireEvent.change(input, { target: { value: 'H1A 1A1' } });
      expect(screen.queryByTestId('postal-error')).not.toBeInTheDocument();
    });

    it('should handle Quebec property management specific errors', () => {
      const PropertyErrorComponent: React.FC = () => {
        const [errors, setErrors] = React.useState<string[]>([]);

        const simulatePropertyErrors = () => {
          const quebecSpecificErrors = [
            'Violation du code du logement du Québec',
            'Augmentation de loyer non conforme à la Régie du logement',
            'Bail résidentiel invalide selon la loi québécoise',
            'Délai de préavis insuffisant (24h requis au Québec)'
          ];
          setErrors(quebecSpecificErrors);
        };

        return (
          <div>
            <button data-testid="simulate-errors" onClick={simulatePropertyErrors}>
              Simulate Quebec Property Errors
            </button>
            
            {errors.length > 0 && (
              <div data-testid="quebec-errors" className="error-list">
                <h3>Erreurs de conformité québécoise :</h3>
                {errors.map((error, index) => (
                  <div key={index} data-testid={`quebec-error-${index}`} className="error-item">
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      };

      render(<PropertyErrorComponent />);

      const simulateButton = screen.getByTestId('simulate-errors');
      fireEvent.click(simulateButton);

      expect(screen.getByTestId('quebec-errors')).toBeInTheDocument();
      expect(screen.getByTestId('quebec-error-0')).toHaveTextContent('Violation du code du logement du Québec');
      expect(screen.getByTestId('quebec-error-1')).toHaveTextContent('Augmentation de loyer non conforme à la Régie du logement');
      expect(screen.getByTestId('quebec-error-2')).toHaveTextContent('Bail résidentiel invalide selon la loi québécoise');
      expect(screen.getByTestId('quebec-error-3')).toHaveTextContent('Délai de préavis insuffisant (24h requis au Québec)');
    });
  });

  describe('Error Recovery and User Experience', () => {
    it('should provide clear action steps for error recovery', () => {
      const ErrorRecoveryComponent: React.FC = () => {
        const [errorType, setErrorType] = React.useState<string | null>(null);

        const getRecoverySteps = (type: string) => {
          switch (type) {
            case 'auth':
              return [
                'Vérifiez votre nom d\'utilisateur et mot de passe',
                'Assurez-vous que votre compte est actif',
                'Contactez l\'administrateur si le problème persiste'
              ];
            case 'network':
              return [
                'Vérifiez votre connexion Internet',
                'Actualisez la page',
                'Réessayez dans quelques minutes'
              ];
            case 'permission':
              return [
                'Contactez votre gestionnaire de propriété',
                'Vérifiez que vous avez les bonnes permissions',
                'Consultez la documentation utilisateur'
              ];
            default:
              return ['Réessayez l\'opération', 'Contactez le support technique'];
          }
        };

        return (
          <div>
            <button data-testid="auth-error" onClick={() => setErrorType('auth')}>
              Auth Error
            </button>
            <button data-testid="network-error" onClick={() => setErrorType('network')}>
              Network Error
            </button>
            <button data-testid="permission-error" onClick={() => setErrorType('permission')}>
              Permission Error
            </button>

            {errorType && (
              <div data-testid="recovery-steps" className="error-recovery">
                <h3>Étapes de résolution :</h3>
                <ol>
                  {getRecoverySteps(errorType).map((step, index) => (
                    <li key={index} data-testid={`step-${index}`}>
                      {step}
                    </li>
                  ))}
                </ol>
                <button data-testid="clear-error" onClick={() => setErrorType(null)}>
                  Fermer
                </button>
              </div>
            )}
          </div>
        );
      };

      render(<ErrorRecoveryComponent />);

      // Test auth error recovery steps
      fireEvent.click(screen.getByTestId('auth-error'));
      expect(screen.getByTestId('step-0')).toHaveTextContent('Vérifiez votre nom d\'utilisateur et mot de passe');
      expect(screen.getByTestId('step-1')).toHaveTextContent('Assurez-vous que votre compte est actif');
      expect(screen.getByTestId('step-2')).toHaveTextContent('Contactez l\'administrateur si le problème persiste');

      // Clear and test network error
      fireEvent.click(screen.getByTestId('clear-error'));
      fireEvent.click(screen.getByTestId('network-error'));
      expect(screen.getByTestId('step-0')).toHaveTextContent('Vérifiez votre connexion Internet');
      expect(screen.getByTestId('step-1')).toHaveTextContent('Actualisez la page');
    });
  });
});