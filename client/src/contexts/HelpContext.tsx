import { createContext, useContext, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { getHelpContent, type HelpButton, type HelpFormField, type HelpContent } from '@/config/help-content';

interface HelpContextType {
  isHelpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  getHelpItemByIdentifier: (identifier: string, type: 'button' | 'formField') => HelpButton | HelpFormField | null;
  getCurrentHelpContent: () => HelpContent | null;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [location] = useLocation();

  const openHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const toggleHelp = useCallback(() => {
    setIsHelpOpen((prev) => !prev);
  }, []);

  const getCurrentHelpContent = useCallback(() => {
    return getHelpContent(location);
  }, [location]);

  const getHelpItemByIdentifier = useCallback((identifier: string, type: 'button' | 'formField'): HelpButton | HelpFormField | null => {
    const helpContent = getHelpContent(location);
    if (!helpContent) return null;

    const normalizedIdentifier = identifier.toLowerCase().trim();

    if (type === 'button' && helpContent.buttons) {
      return helpContent.buttons.find(button => 
        button.label.toLowerCase().includes(normalizedIdentifier) ||
        normalizedIdentifier.includes(button.label.toLowerCase())
      ) || null;
    }

    if (type === 'formField' && helpContent.formFields) {
      return helpContent.formFields.find(field => 
        field.label.toLowerCase().includes(normalizedIdentifier) ||
        normalizedIdentifier.includes(field.label.toLowerCase())
      ) || null;
    }

    return null;
  }, [location]);

  return (
    <HelpContext.Provider value={{ isHelpOpen, openHelp, closeHelp, toggleHelp, getHelpItemByIdentifier, getCurrentHelpContent }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
}

/**
 * Helper function to find matching help content for an element
 */
export function findHelpForElement(
  element: HTMLElement,
  helpContent: HelpContent | null
): { description: string; type: 'button' | 'formField' | 'generic' } | null {
  if (!helpContent) return null;

  // Try to match by data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    // Extract meaningful part from testid (e.g., "button-submit" -> "submit")
    const parts = testId.split('-');
    const identifier = parts.slice(1).join(' ');

    // Try to match with buttons
    if (helpContent.buttons) {
      const button = helpContent.buttons.find(btn =>
        btn.label.toLowerCase().includes(identifier.toLowerCase()) ||
        identifier.toLowerCase().includes(btn.label.toLowerCase())
      );
      if (button) return { description: button.description, type: 'button' };
    }

    // Try to match with form fields
    if (helpContent.formFields) {
      const field = helpContent.formFields.find(f =>
        f.label.toLowerCase().includes(identifier.toLowerCase()) ||
        identifier.toLowerCase().includes(f.label.toLowerCase())
      );
      if (field) return { description: field.description, type: 'formField' };
    }
  }

  // Try to match by text content
  const textContent = element.textContent?.trim().toLowerCase() || '';
  if (textContent) {
    if (helpContent.buttons) {
      const button = helpContent.buttons.find(btn =>
        textContent.includes(btn.label.toLowerCase()) ||
        btn.label.toLowerCase().includes(textContent)
      );
      if (button) return { description: button.description, type: 'button' };
    }

    if (helpContent.formFields) {
      const field = helpContent.formFields.find(f =>
        textContent.includes(f.label.toLowerCase()) ||
        f.label.toLowerCase().includes(textContent)
      );
      if (field) return { description: field.description, type: 'formField' };
    }
  }

  // Try to match by aria-label
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase();
  if (ariaLabel) {
    if (helpContent.buttons) {
      const button = helpContent.buttons.find(btn =>
        ariaLabel.includes(btn.label.toLowerCase()) ||
        btn.label.toLowerCase().includes(ariaLabel)
      );
      if (button) return { description: button.description, type: 'button' };
    }

    if (helpContent.formFields) {
      const field = helpContent.formFields.find(f =>
        ariaLabel.includes(f.label.toLowerCase()) ||
        f.label.toLowerCase().includes(ariaLabel)
      );
      if (field) return { description: field.description, type: 'formField' };
    }
  }

  return null;
}
