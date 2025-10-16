import { createContext, useContext, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { getHelpContent, getText, type HelpButton, type HelpFormField, type HelpContent } from '@/config/help-content';
import { useLanguage } from '@/hooks/use-language';

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
  const { language } = useLanguage();

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
      return helpContent.buttons.find(button => {
        const labelText = getText(button.label, language).toLowerCase();
        return labelText.includes(normalizedIdentifier) || normalizedIdentifier.includes(labelText);
      }) || null;
    }

    if (type === 'formField' && helpContent.formFields) {
      return helpContent.formFields.find(field => {
        const labelText = getText(field.label, language).toLowerCase();
        return labelText.includes(normalizedIdentifier) || normalizedIdentifier.includes(labelText);
      }) || null;
    }

    return null;
  }, [location, language]);

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
 * @param element The HTML element to find help for
 * @param helpContent The help content for the current page
 * @param language The current language ('en' or 'fr')
 */
export function findHelpForElement(
  element: HTMLElement,
  helpContent: HelpContent | null,
  language: 'en' | 'fr' = 'fr'
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
      const button = helpContent.buttons.find(btn => {
        const labelText = getText(btn.label, language).toLowerCase();
        return labelText.includes(identifier.toLowerCase()) || identifier.toLowerCase().includes(labelText);
      });
      if (button) return { description: getText(button.description, language), type: 'button' };
    }

    // Try to match with form fields
    if (helpContent.formFields) {
      const field = helpContent.formFields.find(f => {
        const labelText = getText(f.label, language).toLowerCase();
        return labelText.includes(identifier.toLowerCase()) || identifier.toLowerCase().includes(labelText);
      });
      if (field) return { description: getText(field.description, language), type: 'formField' };
    }
  }

  // Try to match by text content
  const textContent = element.textContent?.trim().toLowerCase() || '';
  if (textContent) {
    if (helpContent.buttons) {
      const button = helpContent.buttons.find(btn => {
        const labelText = getText(btn.label, language).toLowerCase();
        return textContent.includes(labelText) || labelText.includes(textContent);
      });
      if (button) return { description: getText(button.description, language), type: 'button' };
    }

    if (helpContent.formFields) {
      const field = helpContent.formFields.find(f => {
        const labelText = getText(f.label, language).toLowerCase();
        return textContent.includes(labelText) || labelText.includes(textContent);
      });
      if (field) return { description: getText(field.description, language), type: 'formField' };
    }
  }

  // Try to match by aria-label
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase();
  if (ariaLabel) {
    if (helpContent.buttons) {
      const button = helpContent.buttons.find(btn => {
        const labelText = getText(btn.label, language).toLowerCase();
        return ariaLabel.includes(labelText) || labelText.includes(ariaLabel);
      });
      if (button) return { description: getText(button.description, language), type: 'button' };
    }

    if (helpContent.formFields) {
      const field = helpContent.formFields.find(f => {
        const labelText = getText(f.label, language).toLowerCase();
        return ariaLabel.includes(labelText) || labelText.includes(ariaLabel);
      });
      if (field) return { description: getText(field.description, language), type: 'formField' };
    }
  }

  return null;
}
