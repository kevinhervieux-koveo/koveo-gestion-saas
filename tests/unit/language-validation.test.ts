import { JSDOM } from 'jsdom';
import { render } from '@testing-library/react';
import React from 'react';

/**
 * Quebec French Language Validation Test Suite.
 * 
 * This test suite validates that all client-visible text follows Quebec French
 * standards and avoids problematic terms commonly found in property management applications.
 * 
 * Based on Quebec language requirements and 'Termes à éviter' guidelines.
 */

// Terms to avoid (anglicisms and inappropriate terms for Quebec French)
const TERMS_TO_AVOID = {
  // Common anglicisms in property management
  anglicisms: [
    'building', 'suite', 'parking', 'lobby', 'email', 'online', 'website',
    'feedback', 'upgrade', 'downgrade', 'premium', 'standard', 'basic',
    'dashboard', 'login', 'logout', 'password', 'username', 'update',
    'delete', 'submit', 'cancel', 'confirm', 'browse', 'download',
    'upload', 'attachment', 'backup', 'maintenance', 'management',
    'administration', 'application', 'notification', 'validation'
  ],
  
  // France French terms that should use Quebec alternatives
  franceFrench: [
    'logiciel', 'ordinateur', 'courriel', 'télécharger', 'fichier',
    'dossier', 'enregistrer', 'supprimer', 'rechercher', 'trier',
    'paramètres', 'préférences', 'utilisateur', 'mot de passe',
    'connexion', 'déconnexion', 'mise à jour', 'sauvegarde'
  ],
  
  // Technical terms that need Quebec alternatives
  technical: [
    'database', 'server', 'client', 'API', 'URL', 'HTTP', 'SSL',
    'cookie', 'cache', 'bug', 'crash', 'debug', 'patch', 'release'
  ]
};

// Preferred Quebec French terms
const PREFERRED_TERMS = {
  // Property management specific terms
  propertyManagement: {
    'building': 'immeuble',
    'suite': 'appartement',
    'parking': 'stationnement',
    'lobby': 'hall d\'entrée',
    'maintenance': 'entretien',
    'management': 'gestion',
    'tenant': 'locataire',
    'landlord': 'propriétaire',
    'lease': 'bail',
    'rent': 'loyer'
  },
  
  // Technical terms
  technical: {
    'email': 'courriel',
    'website': 'site Web',
    'online': 'en ligne',
    'dashboard': 'tableau de bord',
    'login': 'connexion',
    'logout': 'déconnexion',
    'password': 'mot de passe',
    'username': 'nom d\'utilisateur',
    'update': 'mise à jour',
    'delete': 'supprimer',
    'submit': 'soumettre',
    'cancel': 'annuler',
    'confirm': 'confirmer',
    'browse': 'parcourir',
    'download': 'télécharger',
    'upload': 'téléverser'
  }
};

// Quebec-specific legal and administrative terms
const QUEBEC_LEGAL_TERMS = {
  required: [
    'syndic', 'syndicat', 'copropriété', 'copropriétaire', 'fraction',
    'parties communes', 'parties privatives', 'charges communes',
    'assemblée générale', 'conseil d\'administration', 'budget prévisionnel',
    'contingence', 'fonds de prévoyance'
  ],
  
  avoid: [
    'condominium', 'strata', 'body corporate', 'homeowners association',
    'HOA', 'common elements', 'exclusive use', 'special assessment'
  ]
};

/**
 * Extracts all visible text from a rendered React component.
 * @param container - The HTML element to extract text from.
 * @returns Array of visible text strings.
 */
/**
 * ExtractVisibleText function.
 * @param container
 * @returns Function result.
 */
function extractVisibleText(container: HTMLElement): string[] {
  const textNodes: string[] = [];
  
  /**
   * Traverses DOM nodes to extract text content.
   * @param node - The DOM node to traverse.
   */
  /**
   * Traverse function.
   * @param node
   * @returns Function result.
   */
  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) { // 3 = TEXT_NODE
      const text = node.textContent?.trim();
      if (text) {
        textNodes.push(text);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) { // 1 = ELEMENT_NODE
      const element = node as Element;
      // Skip hidden elements
      const htmlElement = element as HTMLElement;
      if (element.getAttribute('hidden') !== null || 
          htmlElement.style.display === 'none' ||
          htmlElement.style.visibility === 'hidden') {
        return;
      }
      
      // Get text from common text-containing attributes
      const textAttrs = ['title', 'alt', 'placeholder', 'aria-label'];
      textAttrs.forEach(attr => {
        const attrText = element.getAttribute(attr);
        if (attrText) {
          textNodes.push(attrText);
        }
      });
      
      // Traverse children
      node.childNodes.forEach(traverse);
    }
  }
  
  traverse(container);
  return textNodes;
}

/**
 * Validates text against language rules.
 * @param text - The text to validate.
 * @param context - Context information for the validation.
 * @returns Array of validation violations.
 */
/**
 * ValidateText function.
 * @param text
 * @param context
 * @returns Function result.
 */
function validateText(text: string, context: string = ''): Array<{
  type: 'anglicism' | 'france_french' | 'technical' | 'legal_violation' | 'missing_accent';
  term: string;
  suggestion?: string;
  severity: 'error' | 'warning';
  context: string;
}> {
  const violations: Array<{
    type: 'anglicism' | 'france_french' | 'technical' | 'legal_violation' | 'missing_accent';
    term: string;
    suggestion?: string;
    severity: 'error' | 'warning';
    context: string;
  }> = [];
  const lowerText = text.toLowerCase();
  
  // Check for anglicisms
  TERMS_TO_AVOID.anglicisms.forEach(term => {
    if (lowerText.includes(term.toLowerCase())) {
      violations.push({
        type: 'anglicism',
        term,
        suggestion: PREFERRED_TERMS.technical[term] || PREFERRED_TERMS.propertyManagement[term],
        severity: 'error',
        context: context
      });
    }
  });
  
  // Check for France French terms
  TERMS_TO_AVOID.franceFrench.forEach(term => {
    if (lowerText.includes(term.toLowerCase())) {
      violations.push({
        type: 'france_french',
        term,
        severity: 'warning',
        context: context
      });
    }
  });
  
  // Check for prohibited legal terms
  QUEBEC_LEGAL_TERMS.avoid.forEach(term => {
    if (lowerText.includes(term.toLowerCase())) {
      violations.push({
        type: 'legal_violation',
        term,
        severity: 'error',
        context: context
      });
    }
  });
  
  // Check for missing accents in common words
  const accentChecks = [
    { wrong: 'quebec', correct: 'Québec' },
    { wrong: 'montreal', correct: 'Montréal' },
    { wrong: 'proprietaire', correct: 'propriétaire' },
    { wrong: 'copropriete', correct: 'copropriété' },
    { wrong: 'electricite', correct: 'électricité' },
    { wrong: 'securite', correct: 'sécurité' }
  ];
  
  accentChecks.forEach(({ wrong, correct }) => {
    if (lowerText.includes(wrong)) {
      violations.push({
        type: 'missing_accent',
        term: wrong,
        suggestion: correct,
        severity: 'error',
        context: context
      });
    }
  });
  
  return violations;
}

/**
 * Language validation utility class.
 */
class LanguageValidator {
  private violations: Array<{
    type: 'anglicism' | 'france_french' | 'technical' | 'legal_violation' | 'missing_accent';
    term: string;
    suggestion?: string;
    severity: 'error' | 'warning';
    context: string;
  }> = [];
  
  /**
   * Validates a React component for language compliance.
   * @param component - The React component to validate.
   * @param componentName - Name of the component for context.
   */
  validateComponent(component: React.ReactElement, componentName: string): void {
    const { container } = render(component);
    const textNodes = extractVisibleText(container);
    
    textNodes.forEach((text, index) => {
      const context = `${componentName} - Text node ${index + 1}`;
      const textViolations = validateText(text, context);
      this.violations.push(...textViolations);
    });
  }
  
  /**
   * Validates raw HTML content.
   * @param html - The HTML string to validate.
   * @param pageName - Name of the page for context.
   */
  validateHTML(html: string, pageName: string): void {
    const dom = new JSDOM(html);
    const textNodes = extractVisibleText(dom.window.document.body);
    
    textNodes.forEach((text, index) => {
      const context = `${pageName} - HTML Text node ${index + 1}`;
      const textViolations = validateText(text, context);
      this.violations.push(...textViolations);
    });
  }
  
  /**
   * Validates JSON content (for API responses, translations, etc.).
   * @param jsonData - The JSON data to validate.
   * @param dataName - Name of the data source for context.
   */
  validateJSON(jsonData: Record<string, unknown>, dataName: string): void {
    /**
     * Recursively extracts string values from an object.
     * @param obj - Object to extract strings from.
     * @param path - Current path in the object.
     * @returns Array of extracted strings.
     */
    /**
     * ExtractStrings function.
     * @param obj
     * @param path
     * @returns Function result.
     */
    function extractStrings(obj: unknown, path: string = ''): string[] {
      const strings: string[] = [];
      
      if (typeof obj === 'string') {
        strings.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          strings.push(...extractStrings(item, `${path}[${index}]`));
        });
      } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          strings.push(...extractStrings(obj[key], path ? `${path}.${key}` : key));
        });
      }
      
      return strings;
    }
    
    const strings = extractStrings(jsonData);
    strings.forEach((text, index) => {
      const context = `${dataName} - JSON string ${index + 1}`;
      const textViolations = validateText(text, context);
      this.violations.push(...textViolations);
    });
  }
  
  /**
   * Gets all validation violations.
   * @returns Array of all violations found.
   */
  getViolations() {
    return this.violations;
  }
  
  /**
   * Gets violations by severity.
   * @param severity - The severity level to filter by.
   * @returns Array of violations with specified severity.
   */
  getViolationsBySeverity(severity: 'error' | 'warning') {
    return this.violations.filter(v => v.severity === severity);
  }
  
  /**
   * Checks if validation passed (no errors).
   * @returns True if no error violations found.
   */
  isValid(): boolean {
    return this.getViolationsBySeverity('error').length === 0;
  }
  
  /**
   * Generates a validation report.
   * @returns Formatted validation report string.
   */
  generateReport(): string {
    const errors = this.getViolationsBySeverity('error');
    const warnings = this.getViolationsBySeverity('warning');
    
    let report = '=== RAPPORT DE VALIDATION LINGUISTIQUE ===\n\n';
    
    if (errors.length === 0 && warnings.length === 0) {
      report += '✅ Aucune violation détectée. Le contenu respecte les standards du français québécois.\n';
      return report;
    }
    
    if (errors.length > 0) {
      report += `❌ ERREURS (${errors.length}):\n`;
      errors.forEach((error, index) => {
        report += `${index + 1}. [${error.type.toUpperCase()}] "${error.term}"`;
        if (error.suggestion) {
          report += ` → Suggestion: "${error.suggestion}"`;
        }
        report += `\n   Contexte: ${error.context}\n\n`;
      });
    }
    
    if (warnings.length > 0) {
      report += `⚠️  AVERTISSEMENTS (${warnings.length}):\n`;
      warnings.forEach((warning, index) => {
        report += `${index + 1}. [${warning.type.toUpperCase()}] "${warning.term}"`;
        if (warning.suggestion) {
          report += ` → Suggestion: "${warning.suggestion}"`;
        }
        report += `\n   Contexte: ${warning.context}\n\n`;
      });
    }
    
    return report;
  }
  
  /**
   * Resets the validator state.
   */
  reset(): void {
    this.violations = [];
  }
}

// Jest test utilities
describe('Quebec French Language Validation', () => {
  let validator: LanguageValidator;
  
  beforeEach(() => {
    validator = new LanguageValidator();
  });
  
  it('should detect anglicisms in text content', () => {
    const testText = 'Please login to access your building dashboard';
    const violations = validateText(testText, 'Test context');
    
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'anglicism',
          term: 'login',
          suggestion: 'connexion'
        }),
        expect.objectContaining({
          type: 'anglicism',
          term: 'building',
          suggestion: 'immeuble'
        }),
        expect.objectContaining({
          type: 'anglicism',
          term: 'dashboard',
          suggestion: 'tableau de bord'
        })
      ])
    );
  });
  
  it('should detect missing accents in Quebec French terms', () => {
    const testText = 'Bienvenue au Quebec, proprietaire de copropriete';
    const violations = validateText(testText, 'Test context');
    
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'missing_accent',
          term: 'quebec',
          suggestion: 'Québec'
        }),
        expect.objectContaining({
          type: 'missing_accent',
          term: 'proprietaire',
          suggestion: 'propriétaire'
        }),
        expect.objectContaining({
          type: 'missing_accent',
          term: 'copropriete',
          suggestion: 'copropriété'
        })
      ])
    );
  });
  
  it('should detect prohibited legal terms', () => {
    const testText = 'Contact your HOA or condominium association';
    const violations = validateText(testText, 'Test context');
    
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'legal_violation',
          term: 'HOA'
        }),
        expect.objectContaining({
          type: 'legal_violation',
          term: 'condominium'
        })
      ])
    );
  });
  
  it('should validate JSON content for translations', () => {
    const testTranslations = {
      buttons: {
        login: 'Login',
        submit: 'Submit'
      },
      messages: {
        welcome: 'Welcome to your building dashboard'
      }
    };
    
    validator.validateJSON(testTranslations, 'translations.json');
    const violations = validator.getViolations();
    
    expect(violations.length).toBeGreaterThan(0);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'anglicism',
          term: 'login'
        }),
        expect.objectContaining({
          type: 'anglicism',
          term: 'building'
        })
      ])
    );
  });
  
  it('should generate comprehensive validation report', () => {
    const testText = 'Please login to your building dashboard in Quebec';
    const violations = validateText(testText, 'Test page');
    // Reset validator and add violations for testing
    (validator as any).violations = violations;
    
    const report = validator.generateReport();
    
    expect(report).toContain('RAPPORT DE VALIDATION LINGUISTIQUE');
    expect(report).toContain('ERREURS');
    expect(report).toContain('login');
    expect(report).toContain('building');
    expect(report).toContain('quebec');
  });
  
  it('should pass validation for proper Quebec French text', () => {
    const validText = 'Veuillez vous connecter à votre tableau de bord de gestion d\'immeuble au Québec';
    const violations = validateText(validText, 'Test context');
    
    expect(violations).toHaveLength(0);
  });
});

// Export for use in other test files
export { validateText, PREFERRED_TERMS, QUEBEC_LEGAL_TERMS };
export const testLanguageValidator = new LanguageValidator();