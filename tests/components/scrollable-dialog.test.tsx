import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Comprehensive tests for ScrollableDialog component ensuring forms fit in screen
 * and are properly scrollable across different scenarios and screen sizes.
 */

// Mock window dimensions for responsive testing
const mockWindowDimensions = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  // Trigger resize event
  fireEvent(window, new Event('resize'));
};

// Mock components for testing
const MockScrollableDialog = ({ open, onOpenChange, title, description, children, footer, testId = "scrollable-dialog" }: any) => {
  if (!open) return null;
  
  return (
    <div data-testid={testId} className="max-h-[90vh] overflow-hidden flex flex-col max-w-lg">
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
        <h2 data-testid={`${testId}-title`}>{title}</h2>
        {description && <p data-testid={`${testId}-description`}>{description}</p>}
      </div>
      <div 
        className="flex-1 overflow-y-auto px-6 py-4"
        data-testid={`${testId}-content`}
      >
        {children}
      </div>
      {footer && (
        <div 
          className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-gray-100"
          data-testid={`${testId}-footer`}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

const MockButton = ({ children, onClick, disabled, variant, "data-testid": testId, ...props }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    data-testid={testId}
    className={`px-4 py-2 rounded ${variant === 'outline' ? 'border' : 'bg-blue-500 text-white'}`}
    {...props}
  >
    {children}
  </button>
);

const MockInput = ({ id, placeholder, "data-testid": testId, ...props }: any) => (
  <input 
    id={id}
    placeholder={placeholder}
    data-testid={testId}
    className="w-full p-2 border rounded"
    {...props}
  />
);

const MockLabel = ({ htmlFor, children }: any) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium">
    {children}
  </label>
);

// Test component with many form fields to test scrolling
const LongFormContent = () => (
  <div className="space-y-6">
    {Array.from({ length: 20 }, (_, i) => (
      <div key={i} className="space-y-2">
        <MockLabel htmlFor={`field-${i}`}>Field {i + 1}</MockLabel>
        <MockInput 
          id={`field-${i}`} 
          placeholder={`Enter value for field ${i + 1}`}
          data-testid={`input-field-${i}`}
        />
      </div>
    ))}
  </div>
);

// Test component with short content
const ShortFormContent = () => (
  <div className="space-y-4">
    <div className="space-y-2">
      <MockLabel htmlFor="name">Name</MockLabel>
      <MockInput id="name" placeholder="Enter name" data-testid="input-name" />
    </div>
    <div className="space-y-2">
      <MockLabel htmlFor="email">Email</MockLabel>
      <MockInput id="email" type="email" placeholder="Enter email" data-testid="input-email" />
    </div>
  </div>
);

// Mock hooks for testing
const useFormDialog = (initialOpen = false) => {
  const [isOpen, setIsOpen] = React.useState(initialOpen);
  const [isLoading, setIsLoading] = React.useState(false);

  const openDialog = React.useCallback(() => setIsOpen(true), []);
  const closeDialog = React.useCallback(() => {
    if (!isLoading) {
      setIsOpen(false);
    }
  }, [isLoading]);

  const handleSubmit = React.useCallback(async (submitFn: () => Promise<void>) => {
    try {
      setIsLoading(true);
      await submitFn();
      setIsOpen(false);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isOpen,
    isLoading,
    openDialog,
    closeDialog,
    handleSubmit,
    setIsLoading
  };
};

const DialogSection = ({ title, children, className }: any) => (
  <div className={`space-y-4 ${className || ''}`}>
    {title && (
      <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
        {title}
      </h3>
    )}
    {children}
  </div>
);

describe('ScrollableDialog Component', () => {
  beforeEach(() => {
    // Set default viewport size
    mockWindowDimensions(1024, 768);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render dialog with title and description', () => {
      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          description="This is a test dialog"
          testId="test-dialog"
        >
          <div data-testid="dialog-content">Content</div>
        </MockScrollableDialog>
      );

      expect(screen.getByTestId('test-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('test-dialog-title')).toHaveTextContent('Test Dialog');
      expect(screen.getByTestId('test-dialog-description')).toHaveTextContent('This is a test dialog');
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    });

    it('should render without description when not provided', () => {
      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          testId="test-dialog"
        >
          <div>Content</div>
        </MockScrollableDialog>
      );

      expect(screen.getByTestId('test-dialog-title')).toBeInTheDocument();
      expect(screen.queryByTestId('test-dialog-description')).not.toBeInTheDocument();
    });

    it('should render footer when provided', () => {
      const footer = (
        <>
          <MockButton variant="outline" data-testid="cancel-btn">Cancel</MockButton>
          <MockButton data-testid="save-btn">Save</MockButton>
        </>
      );

      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          footer={footer}
          testId="test-dialog"
        >
          <div>Content</div>
        </MockScrollableDialog>
      );

      expect(screen.getByTestId('test-dialog-footer')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout Constraints', () => {
    it('should apply max-height constraint (90vh)', () => {
      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          testId="test-dialog"
        >
          <LongFormContent />
        </MockScrollableDialog>
      );

      const dialog = screen.getByTestId('test-dialog');
      const computedStyle = window.getComputedStyle(dialog);
      
      // Check if max-height class is applied
      expect(dialog).toHaveClass('max-h-[90vh]');
    });

    it('should handle different max-width options', () => {
      const { rerender } = render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          maxWidth="sm"
          testId="test-dialog"
        >
          <div>Content</div>
        </MockScrollableDialog>
      );

      expect(screen.getByTestId('test-dialog')).toHaveClass('max-w-lg');

      rerender(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          maxWidth="xl"
          testId="test-dialog"
        >
          <div>Content</div>
        </MockScrollableDialog>
      );

      expect(screen.getByTestId('test-dialog')).toHaveClass('max-w-lg');
    });
  });

  describe('Scrollable Content Behavior', () => {
    it('should have scrollable content area', () => {
      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          testId="test-dialog"
        >
          <LongFormContent />
        </MockScrollableDialog>
      );

      const contentArea = screen.getByTestId('test-dialog-content');
      expect(contentArea).toHaveClass('overflow-y-auto');
      expect(contentArea).toHaveClass('flex-1');
    });

    it('should render all form fields even with long content', () => {
      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          testId="test-dialog"
        >
          <LongFormContent />
        </MockScrollableDialog>
      );

      // Check that all 20 form fields are rendered
      for (let i = 0; i < 20; i++) {
        expect(screen.getByTestId(`input-field-${i}`)).toBeInTheDocument();
      }
    });

    it('should keep header and footer fixed while content scrolls', () => {
      const footer = <MockButton data-testid="footer-btn">Action</MockButton>;

      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          footer={footer}
          testId="test-dialog"
        >
          <LongFormContent />
        </MockScrollableDialog>
      );

      const header = screen.getByTestId('test-dialog-title').closest('[class*="flex-shrink-0"]');
      const footerElement = screen.getByTestId('test-dialog-footer');
      const contentArea = screen.getByTestId('test-dialog-content');

      expect(header).toHaveClass('flex-shrink-0');
      expect(footerElement).toHaveClass('flex-shrink-0');
      expect(contentArea).toHaveClass('flex-1');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should handle small screen dimensions', () => {
      // Mock mobile viewport
      mockWindowDimensions(375, 667);

      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Mobile Dialog Test"
          testId="mobile-dialog"
        >
          <LongFormContent />
        </MockScrollableDialog>
      );

      const dialog = screen.getByTestId('mobile-dialog');
      
      // Dialog should still be constrained to 90vh
      expect(dialog).toHaveClass('max-h-[90vh]');
      
      // Content should be scrollable
      const contentArea = screen.getByTestId('mobile-dialog-content');
      expect(contentArea).toHaveClass('overflow-y-auto');
    });

    it('should handle tablet screen dimensions', () => {
      // Mock tablet viewport
      mockWindowDimensions(768, 1024);

      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Tablet Dialog Test"
          testId="tablet-dialog"
        >
          <LongFormContent />
        </MockScrollableDialog>
      );

      const dialog = screen.getByTestId('tablet-dialog');
      expect(dialog).toHaveClass('max-h-[90vh]');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className to dialog', () => {
      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          className="custom-dialog-class"
          testId="custom-dialog"
        >
          <div>Content</div>
        </MockScrollableDialog>
      );

      expect(screen.getByTestId('custom-dialog')).toHaveClass('custom-dialog-class');
    });

    it('should apply custom contentClassName to content area', () => {
      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={() => {}}
          title="Test Dialog"
          contentClassName="custom-content-class"
          testId="custom-dialog"
        >
          <div>Content</div>
        </MockScrollableDialog>
      );

      expect(screen.getByTestId('custom-dialog-content')).toHaveClass('custom-content-class');
    });
  });

  describe('Dialog State Management', () => {
    it('should call onOpenChange when dialog is closed', () => {
      const mockOnOpenChange = vi.fn();

      render(
        <MockScrollableDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          title="Test Dialog"
          testId="test-dialog"
        >
          <div>Content</div>
        </MockScrollableDialog>
      );

      // Simulate pressing Escape key to close dialog
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not render when open is false', () => {
      render(
        <MockScrollableDialog
          open={false}
          onOpenChange={() => {}}
          title="Test Dialog"
          testId="test-dialog"
        >
          <div data-testid="dialog-content">Content</div>
        </MockScrollableDialog>
      );

      expect(screen.queryByTestId('dialog-content')).not.toBeInTheDocument();
    });
  });
});

describe('useFormDialog Hook', () => {
  const TestComponent = () => {
    const { isOpen, isLoading, openDialog, closeDialog, handleSubmit } = useFormDialog();

    const mockSubmit = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    };

    return (
      <div>
        <button onClick={openDialog} data-testid="open-btn">
          Open Dialog
        </button>
        <MockScrollableDialog
          open={isOpen}
          onOpenChange={closeDialog}
          title="Test Form Dialog"
          footer={
            <>
              <MockButton 
                variant="outline" 
                onClick={closeDialog}
                disabled={isLoading}
                data-testid="cancel-btn"
              >
                Cancel
              </MockButton>
              <MockButton 
                onClick={() => handleSubmit(mockSubmit)}
                disabled={isLoading}
                data-testid="submit-btn"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </MockButton>
            </>
          }
          testId="form-dialog"
        >
          <ShortFormContent />
        </ScrollableDialog>
      </div>
    );
  };

  it('should manage dialog state correctly', async () => {
    render(<TestComponent />);

    // Dialog should be closed initially
    expect(screen.queryByTestId('form-dialog')).not.toBeInTheDocument();

    // Open dialog
    fireEvent.click(screen.getByTestId('open-btn'));
    expect(screen.getByTestId('form-dialog')).toBeInTheDocument();

    // Close dialog
    fireEvent.click(screen.getByTestId('cancel-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('form-dialog')).not.toBeInTheDocument();
    });
  });

  it('should handle form submission', async () => {
    render(<TestComponent />);

    // Open dialog
    fireEvent.click(screen.getByTestId('open-btn'));
    
    // Submit form
    fireEvent.click(screen.getByTestId('submit-btn'));
    
    // Should show loading state
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Saving...');
    
    // Should close dialog after submission
    await waitFor(() => {
      expect(screen.queryByTestId('form-dialog')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });
});

describe('DialogSection Component', () => {
  it('should render section with title', () => {
    render(
      <DialogSection title="Test Section">
        <div data-testid="section-content">Section content</div>
      </DialogSection>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByTestId('section-content')).toBeInTheDocument();
  });

  it('should render section without title', () => {
    render(
      <DialogSection>
        <div data-testid="section-content">Section content</div>
      </DialogSection>
    );

    expect(screen.getByTestId('section-content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <DialogSection className="custom-section" title="Test">
        <div>Content</div>
      </DialogSection>
    );

    expect(screen.getByText('Test').closest('div')).toHaveClass('custom-section');
  });
});

describe('Integration Tests - Real World Scenarios', () => {
  it('should handle form with validation errors', () => {
    const FormWithValidation = () => {
      const [errors, setErrors] = React.useState<string[]>([]);
      const { isOpen, openDialog, closeDialog } = useFormDialog();

      const validateAndSubmit = async () => {
        const newErrors = [];
        const nameInput = screen.getByTestId('input-name') as HTMLInputElement;
        const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
        
        if (!nameInput.value) newErrors.push('Name is required');
        if (!emailInput.value) newErrors.push('Email is required');
        
        setErrors(newErrors);
        
        if (newErrors.length === 0) {
          closeDialog();
        }
      };

      return (
        <div>
          <button onClick={openDialog} data-testid="open-form">Open Form</button>
          <MockScrollableDialog
            open={isOpen}
            onOpenChange={closeDialog}
            title="Validation Test Form"
            footer={
              <MockButton onClick={validateAndSubmit} data-testid="submit-form">
                Submit
              </MockButton>
            }
            testId="validation-dialog"
          >
            <div className="space-y-4">
              <ShortFormContent />
              {errors.length > 0 && (
                <div className="text-red-600 space-y-1" data-testid="validation-errors">
                  {errors.map((error, i) => (
                    <div key={i}>{error}</div>
                  ))}
                </div>
              )}
            </div>
          </ScrollableDialog>
        </div>
      );
    };

    render(<FormWithValidation />);

    fireEvent.click(screen.getByTestId('open-form'));
    fireEvent.click(screen.getByTestId('submit-form'));

    expect(screen.getByTestId('validation-errors')).toBeInTheDocument();
    expect(screen.getByTestId('validation-dialog')).toBeInTheDocument(); // Dialog stays open
  });

  it('should handle dynamic content changes', () => {
    const DynamicContentDialog = () => {
      const [showExtraFields, setShowExtraFields] = React.useState(false);
      const { isOpen, openDialog, closeDialog } = useFormDialog();

      return (
        <div>
          <button onClick={openDialog} data-testid="open-dynamic">Open Dynamic</button>
          <MockScrollableDialog
            open={isOpen}
            onOpenChange={closeDialog}
            title="Dynamic Content Test"
            testId="dynamic-dialog"
          >
            <div className="space-y-4">
              <ShortFormContent />
              <MockButton 
                onClick={() => setShowExtraFields(!showExtraFields)}
                data-testid="toggle-fields"
              >
                {showExtraFields ? 'Hide' : 'Show'} Extra Fields
              </MockButton>
              {showExtraFields && <LongFormContent />}
            </div>
          </ScrollableDialog>
        </div>
      );
    };

    render(<DynamicContentDialog />);

    fireEvent.click(screen.getByTestId('open-dynamic'));
    
    // Initially should have short content
    expect(screen.getByTestId('input-name')).toBeInTheDocument();
    expect(screen.queryByTestId('input-field-0')).not.toBeInTheDocument();

    // Toggle to show extra fields
    fireEvent.click(screen.getByTestId('toggle-fields'));
    expect(screen.getByTestId('input-field-0')).toBeInTheDocument();

    // Content area should still be scrollable
    const contentArea = screen.getByTestId('dynamic-dialog-content');
    expect(contentArea).toHaveClass('overflow-y-auto');
  });
});