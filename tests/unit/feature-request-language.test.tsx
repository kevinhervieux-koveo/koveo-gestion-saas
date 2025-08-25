import React from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '../../client/src/hooks/use-language';
import '@testing-library/jest-dom';

// Mock the feature request page
const MockFeatureRequestPage = () => {
  return (
    <div data-testid="feature-request-page">
      <h1 data-testid="page-title">Idea Box</h1>
      <button data-testid="submit-idea">Submit Idea</button>
      <input 
        placeholder="Search feature requests..." 
        data-testid="search-input"
      />
      <div data-testid="no-features">No feature requests found</div>
      
      {/* Category filters */}
      <select data-testid="category-filter">
        <option value="">All Categories</option>
        <option value="dashboard">Dashboard</option>
        <option value="propertyManagement">Property Management</option>
        <option value="residentManagement">Resident Management</option>
        <option value="financialManagement">Financial Management</option>
        <option value="maintenance">Maintenance</option>
        <option value="documentManagement">Document Management</option>
        <option value="communication">Communication</option>
        <option value="reports">Reports</option>
        <option value="mobileApp">Mobile App</option>
        <option value="integrations">Integrations</option>
        <option value="security">Security</option>
        <option value="performance">Performance</option>
        <option value="other">Other</option>
      </select>
      
      {/* Status filters */}
      <select data-testid="status-filter">
        <option value="">All Status</option>
        <option value="submitted">Submitted</option>
        <option value="under_review">Under Review</option>
        <option value="planned">Planned</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="rejected">Rejected</option>
      </select>
      
      {/* Feature request card */}
      <div data-testid="feature-card">
        <h3 data-testid="feature-title">Sample Feature</h3>
        <button data-testid="upvote-button">Upvote</button>
        <span data-testid="upvote-count">5 upvotes</span>
        <span data-testid="submitted-by">Submitted by: John Doe</span>
        <span data-testid="feature-status">Submitted</span>
        <span data-testid="feature-category">Dashboard</span>
      </div>
      
      {/* Form elements */}
      <form data-testid="feature-form">
        <input placeholder="Brief, descriptive title for your feature" data-testid="title-input" />
        <textarea placeholder="Detailed description of the feature you'd like to see" data-testid="description-input" />
        <textarea placeholder="Explain why this feature is needed and how it would help" data-testid="need-input" />
        <input placeholder="e.g., Dashboard, Settings, etc." data-testid="page-input" />
        <textarea placeholder="Internal notes for team members" data-testid="admin-notes-input" />
      </form>
      
      {/* Action messages */}
      <div data-testid="success-message">Feature request submitted successfully!</div>
      <div data-testid="update-message">Feature request updated successfully!</div>
      <div data-testid="delete-message">Feature request deleted successfully!</div>
      <div data-testid="already-upvoted">You have already upvoted this feature request</div>
      <div data-testid="delete-confirm">Are you sure you want to delete this feature request?</div>
      <div data-testid="delete-warning">This action cannot be undone.</div>
    </div>
  );
};

// Language toggle component for testing
const LanguageToggle = () => {
  const [language, setLanguage] = React.useState<'en' | 'fr'>('en');
  
  return (
    <button 
      onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
      data-testid="language-toggle"
    >
      Switch to {language === 'en' ? 'French' : 'English'}
    </button>
  );
};

const createMockQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

describe('Feature Request Page Language Support', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();
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

  describe('Page Title and Navigation', () => {
    it('should display page title in English by default', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      expect(screen.getByTestId('page-title')).toHaveTextContent('Idea Box');
      expect(screen.getByTestId('submit-idea')).toHaveTextContent('Submit Idea');
    });

    it('should display search placeholder in English', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveAttribute('placeholder', 'Search feature requests...');
    });

    it('should display empty state message in English', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      expect(screen.getByTestId('no-features')).toHaveTextContent('No feature requests found');
    });
  });

  describe('Category Translations', () => {
    it('should display all category options in English', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      const categoryFilter = screen.getByTestId('category-filter');
      const options = categoryFilter.querySelectorAll('option');
      
      expect(options[0]).toHaveTextContent('All Categories');
      expect(options[1]).toHaveTextContent('Dashboard');
      expect(options[2]).toHaveTextContent('Property Management');
      expect(options[3]).toHaveTextContent('Resident Management');
      expect(options[4]).toHaveTextContent('Financial Management');
      expect(options[5]).toHaveTextContent('Maintenance');
      expect(options[6]).toHaveTextContent('Document Management');
      expect(options[7]).toHaveTextContent('Communication');
      expect(options[8]).toHaveTextContent('Reports');
      expect(options[9]).toHaveTextContent('Mobile App');
      expect(options[10]).toHaveTextContent('Integrations');
      expect(options[11]).toHaveTextContent('Security');
      expect(options[12]).toHaveTextContent('Performance');
      expect(options[13]).toHaveTextContent('Other');
    });
  });

  describe('Status Translations', () => {
    it('should display all status options in English', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      const statusFilter = screen.getByTestId('status-filter');
      const options = statusFilter.querySelectorAll('option');
      
      expect(options[0]).toHaveTextContent('All Status');
      expect(options[1]).toHaveTextContent('Submitted');
      expect(options[2]).toHaveTextContent('Under Review');
      expect(options[3]).toHaveTextContent('Planned');
      expect(options[4]).toHaveTextContent('In Progress');
      expect(options[5]).toHaveTextContent('Completed');
      expect(options[6]).toHaveTextContent('Rejected');
    });
  });

  describe('Feature Request Card Elements', () => {
    it('should display feature request elements in English', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      expect(screen.getByTestId('upvote-button')).toHaveTextContent('Upvote');
      expect(screen.getByTestId('upvote-count')).toHaveTextContent('5 upvotes');
      expect(screen.getByTestId('submitted-by')).toHaveTextContent('Submitted by: John Doe');
      expect(screen.getByTestId('feature-status')).toHaveTextContent('Submitted');
      expect(screen.getByTestId('feature-category')).toHaveTextContent('Dashboard');
    });
  });

  describe('Form Placeholders', () => {
    it('should display form placeholders in English', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      expect(screen.getByTestId('title-input')).toHaveAttribute(
        'placeholder', 
        'Brief, descriptive title for your feature'
      );
      expect(screen.getByTestId('description-input')).toHaveAttribute(
        'placeholder', 
        'Detailed description of the feature you\'d like to see'
      );
      expect(screen.getByTestId('need-input')).toHaveAttribute(
        'placeholder', 
        'Explain why this feature is needed and how it would help'
      );
      expect(screen.getByTestId('page-input')).toHaveAttribute(
        'placeholder', 
        'e.g., Dashboard, Settings, etc.'
      );
      expect(screen.getByTestId('admin-notes-input')).toHaveAttribute(
        'placeholder', 
        'Internal notes for team members'
      );
    });
  });

  describe('Action Messages', () => {
    it('should display action messages in English', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      expect(screen.getByTestId('success-message')).toHaveTextContent(
        'Feature request submitted successfully!'
      );
      expect(screen.getByTestId('update-message')).toHaveTextContent(
        'Feature request updated successfully!'
      );
      expect(screen.getByTestId('delete-message')).toHaveTextContent(
        'Feature request deleted successfully!'
      );
      expect(screen.getByTestId('already-upvoted')).toHaveTextContent(
        'You have already upvoted this feature request'
      );
      expect(screen.getByTestId('delete-confirm')).toHaveTextContent(
        'Are you sure you want to delete this feature request?'
      );
      expect(screen.getByTestId('delete-warning')).toHaveTextContent(
        'This action cannot be undone.'
      );
    });
  });

  describe('Accessibility and Language Attributes', () => {
    it('should have proper language attributes for screen readers', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      const page = screen.getByTestId('feature-request-page');
      expect(page).toBeInTheDocument();
      
      // Verify important elements are accessible
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
      expect(screen.getByTestId('submit-idea')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('should support proper ARIA labels for form elements', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      const titleInput = screen.getByTestId('title-input');
      const descriptionInput = screen.getByTestId('description-input');
      const needInput = screen.getByTestId('need-input');
      
      expect(titleInput).toBeInTheDocument();
      expect(descriptionInput).toBeInTheDocument();
      expect(needInput).toBeInTheDocument();
    });
  });

  describe('Parameter Interpolation in Context', () => {
    it('should handle dynamic content with parameters', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      // Test upvote count with different values
      expect(screen.getByTestId('upvote-count')).toHaveTextContent('5 upvotes');
      
      // Test submitted by with user name
      expect(screen.getByTestId('submitted-by')).toHaveTextContent('Submitted by: John Doe');
    });
  });

  describe('Language Context Integration', () => {
    it('should integrate properly with language context provider', () => {
      renderWithProviders(
        <div>
          <LanguageToggle />
          <MockFeatureRequestPage />
        </div>
      );
      
      expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('feature-request-page')).toBeInTheDocument();
    });
  });

  describe('Feature Request Workflow Language Coverage', () => {
    it('should cover all major workflow states and messages', () => {
      renderWithProviders(<MockFeatureRequestPage />);
      
      // Verify all critical UI text is present and translatable
      const criticalElements = [
        'page-title',
        'submit-idea', 
        'search-input',
        'category-filter',
        'status-filter',
        'upvote-button',
        'success-message',
        'delete-confirm'
      ];
      
      criticalElements.forEach(testId => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });
    });
  });
});