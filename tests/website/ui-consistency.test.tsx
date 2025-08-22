import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import HomePage from '@/pages/home';

/**
 * UI Consistency Tests.
 * 
 * Tests to ensure visual and design consistency across the platform.
 * Validates consistent styling, typography, colors, and layout patterns.
 */

/**
 *
 * @param root0
 * @param root0.children
  * @returns Function result.
*/
function TestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('UI Consistency Tests', () => {
  describe('Visual Design Consistency', () => {
    it('should maintain consistent color scheme', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for consistent color usage
      const blueElements = document.querySelectorAll('[class*="blue-"]');
      const primaryButtons = document.querySelectorAll('.bg-blue-600, .bg-blue-700');
      
      expect(primaryButtons.length).toBeGreaterThan(0);
      
      // Primary buttons should use consistent blue colors
      primaryButtons.forEach(button => {
        expect(button.className).toMatch(/bg-blue-(600|700)/);
      });
    });

    it('should use consistent typography hierarchy', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check heading hierarchy
      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      const h3Elements = screen.getAllByRole('heading', { level: 3 });

      // Should have proper heading structure
      expect(h1Elements.length).toBeGreaterThanOrEqual(1);
      expect(h2Elements.length).toBeGreaterThanOrEqual(1);

      // H1 should be largest, followed by H2, etc.
      h1Elements.forEach(h1 => {
        expect(h1.className).toMatch(/text-(4xl|5xl|6xl)/);
      });

      h2Elements.forEach(h2 => {
        expect(h2.className).toMatch(/text-(2xl|3xl|4xl)/);
      });
    });

    it('should maintain consistent spacing patterns', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for consistent padding and margins
      const sections = document.querySelectorAll('section');
      
      sections.forEach(section => {
        const classes = section.className;
        // Should use systematic spacing
        expect(classes).toMatch(/p(y|x|t|b|l|r)?-\d+/);
      });

      // Cards should have consistent padding
      const cards = document.querySelectorAll('[class*="card"]');
      cards.forEach(card => {
        expect(card.className).toMatch(/p-\d+|px-\d+|py-\d+/);
      });
    });
  });

  describe('Component Design Consistency', () => {
    it('should use consistent button styles', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        // Buttons should have consistent base classes
        const classes = button.className;
        
        // Should have proper button styling
        expect(classes).toMatch(/button|btn/); // Base button class
        
        // Primary buttons should be consistent
        if (classes.includes('bg-blue-600')) {
          expect(classes).toMatch(/hover:bg-blue-700/);
        }
        
        // Should have proper padding/sizing
        expect(classes).toMatch(/p(x|y)-\d+/);
      });
    });

    it('should maintain consistent card component styling', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Look for card components
      const cardElements = document.querySelectorAll('[class*="card"]') ||
                          Array.from(document.querySelectorAll('div')).filter(div => 
                            div.className.includes('shadow') || 
                            div.className.includes('border') ||
                            div.className.includes('rounded')
                          );

      if (cardElements.length > 0) {
        cardElements.forEach(card => {
          const classes = card.className;
          
          // Cards should have consistent styling
          expect(classes).toMatch(/rounded|shadow|border/);
          
          // Should have consistent hover effects if applicable
          if (classes.includes('hover:')) {
            expect(classes).toMatch(/transition/);
          }
        });
      }
    });

    it('should use consistent form element styling', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Look for form elements
      const inputs = screen.queryAllByRole('textbox');
      const selects = screen.queryAllByRole('combobox');
      const checkboxes = screen.queryAllByRole('checkbox');

      [...inputs, ...selects, ...checkboxes].forEach(element => {
        const classes = element.className;
        
        // Form elements should have consistent styling
        if (classes) {
          expect(classes).toMatch(/border|rounded|p(x|y)?-\d+/);
        }
      });
    });
  });

  describe('Layout Consistency', () => {
    it('should maintain consistent grid and layout patterns', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for grid layouts
      const gridElements = document.querySelectorAll('[class*="grid"]');
      
      gridElements.forEach(grid => {
        const classes = grid.className;
        
        // Grids should use responsive patterns
        expect(classes).toMatch(/grid|flex/);
        
        // Should have responsive breakpoints
        expect(classes).toMatch(/(sm|md|lg|xl):/);
      });
    });

    it('should use consistent container and max-width patterns', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for consistent container usage
      const containers = document.querySelectorAll('[class*="container"], [class*="max-w"]');
      
      containers.forEach(container => {
        const classes = container.className;
        
        // Should use consistent max-width patterns
        expect(classes).toMatch(/container|max-w-/);
        
        // Should have proper centering
        if (classes.includes('max-w-')) {
          expect(classes).toMatch(/mx-auto/);
        }
      });
    });

    it('should maintain consistent responsive behavior', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for responsive design elements
      const responsiveElements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]');
      
      expect(responsiveElements.length).toBeGreaterThan(0);
      
      // Should follow mobile-first approach
      responsiveElements.forEach(element => {
        const classes = element.className;
        
        // Should use proper breakpoint hierarchy
        if (classes.includes('sm:') && classes.includes('lg:')) {
          // Proper progression of breakpoints
          expect(classes).toMatch(/sm:.*lg:/);
        }
      });
    });
  });

  describe('Accessibility Consistency', () => {
    it('should maintain consistent focus states', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Interactive elements should have focus states
      const interactiveElements = [
        ...screen.getAllByRole('button'),
        ...screen.getAllByRole('link'),
        ...screen.queryAllByRole('textbox'),
      ];

      interactiveElements.forEach(element => {
        // Focus first element to test
        element.focus();
        
        // Should be focusable
        expect(document.activeElement).toBe(element);
        
        // Should have focus styling (via CSS)
        const classes = element.className;
        expect(classes).toMatch(/focus:|focusable|focus-visible/);
      });
    });

    it('should use consistent contrast and readability', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Text elements should have proper contrast classes
      const textElements = document.querySelectorAll('p, span, div');
      
      textElements.forEach(element => {
        const classes = element.className;
        
        if (classes && classes.includes('text-')) {
          // Should use proper text color classes
          expect(classes).toMatch(/text-(gray|black|white|blue)-\d+/);
          
          // Should not use very light text on light backgrounds
          if (classes.includes('text-gray-200')) {
            expect(classes).not.toMatch(/bg-(white|gray-50)/);
          }
        }
      });
    });

    it('should maintain consistent semantic structure', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Should have proper landmark elements
      const main = document.querySelector('main') || document.body;
      expect(main).toBeInTheDocument();

      // Headers should be properly nested
      const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      expect(headers.length).toBeGreaterThan(0);

      // Should have proper heading hierarchy (h1 before h2, etc.)
      let lastLevel = 0;
      headers.forEach(header => {
        const currentLevel = parseInt(header.tagName.charAt(1));
        expect(currentLevel).toBeGreaterThanOrEqual(lastLevel);
        lastLevel = currentLevel;
      });
    });
  });

  describe('Interactive Element Consistency', () => {
    it('should maintain consistent hover effects', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const hoverableElements = document.querySelectorAll('[class*="hover:"]');
      
      hoverableElements.forEach(element => {
        const classes = element.className;
        
        // Hover effects should include transitions
        expect(classes).toMatch(/transition/);
        
        // Common hover patterns should be consistent
        if (classes.includes('hover:bg-')) {
          expect(classes).toMatch(/bg-.*hover:bg-/);
        }
      });
    });

    it('should use consistent loading and disabled states', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check button states
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        // Should not be disabled by default
        expect(button).toBeEnabled();
        
        // Should have consistent disabled styling if applicable
        if (button.hasAttribute('disabled')) {
          expect(button.className).toMatch(/disabled|opacity/);
        }
      });
    });
  });

  describe('Brand Consistency', () => {
    it('should maintain consistent brand colors', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Primary brand color should be blue
      const brandElements = document.querySelectorAll('[class*="blue-"]');
      expect(brandElements.length).toBeGreaterThan(0);

      // Should use consistent blue shades
      const primaryButtons = document.querySelectorAll('.bg-blue-600');
      const hoverButtons = document.querySelectorAll('[class*="hover:bg-blue-7"]');
      
      expect(primaryButtons.length).toBeGreaterThanOrEqual(1);
      expect(hoverButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should use consistent logo and branding elements', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Should have Koveo logo
      const logos = screen.getAllByAltText(/koveo/i);
      expect(logos.length).toBeGreaterThan(0);

      logos.forEach(logo => {
        // Logo should have proper dimensions
        expect(logo).toHaveAttribute('src');
        expect(logo).toHaveAttribute('alt');
        
        // Should be properly sized
        const classes = (logo as HTMLElement).className;
        expect(classes).toMatch(/h-\d+.*w-\d+/);
      });
    });

    it('should maintain consistent voice and tone in text content', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      const pageContent = document.body.textContent || '';
      
      // Should use professional, friendly tone
      expect(pageContent).toMatch(/comprehensive|professional|modern/i);
      
      // Should avoid overly casual language
      expect(pageContent).not.toMatch(/awesome|amazing|incredible|fantastic/i);
      
      // Should maintain Quebec focus
      expect(pageContent).toMatch(/quebec/i);
    });
  });

  describe('Error State Consistency', () => {
    it('should handle error states consistently', () => {
      // Mock error state
      const errorElements = document.querySelectorAll('[class*="error"], [class*="danger"], [class*="red-"]');
      
      // Error styling should be consistent if present
      errorElements.forEach(element => {
        const classes = element.className;
        
        if (classes.includes('text-red')) {
          expect(classes).toMatch(/text-red-\d+/);
        }
        
        if (classes.includes('bg-red')) {
          expect(classes).toMatch(/bg-red-\d+/);
        }
      });
    });

    it('should maintain consistent validation styling', () => {
      // Form validation should be consistent
      const validationElements = document.querySelectorAll('[class*="invalid"], [class*="valid"]');
      
      validationElements.forEach(element => {
        const classes = element.className;
        
        // Validation states should use consistent colors
        if (classes.includes('invalid')) {
          expect(classes).toMatch(/border-red|text-red/);
        }
        
        if (classes.includes('valid')) {
          expect(classes).toMatch(/border-green|text-green/);
        }
      });
    });
  });
});

/**
 * UI Consistency Validation Utilities.
 */
export const UI_CONSISTENCY_RULES = {
  colors: {
    primary: 'blue-600',
    primaryHover: 'blue-700',
    success: 'green-600',
    _error: 'red-600',
    warning: 'yellow-600',
    neutral: 'gray-600',
  },
  
  typography: {
    h1: ['text-4xl', 'text-5xl', 'text-6xl'],
    h2: ['text-2xl', 'text-3xl', 'text-4xl'],
    h3: ['text-lg', 'text-xl', 'text-2xl'],
    body: ['text-sm', 'text-base', 'text-lg'],
  },
  
  spacing: {
    container: ['container', 'max-w-4xl', 'max-w-6xl', 'max-w-7xl'],
    section: ['py-8', 'py-12', 'py-16', 'py-20'],
    element: ['p-4', 'p-6', 'p-8', 'px-4', 'py-4'],
  },
  
  components: {
    button: ['px-4', 'py-2', 'rounded', 'font-medium'],
    card: ['rounded', 'shadow', 'p-6'],
    input: ['border', 'rounded', 'px-3', 'py-2'],
  },
};

/**
 *
 * @param element
 */
export function validateUIConsistency(element: HTMLElement): {
  isConsistent: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const classes = element.className;
  
  // Check button consistency
  if (element.tagName === 'BUTTON') {
    if (!classes.includes('px-') || !classes.includes('py-')) {
      violations.push('Button lacks consistent padding');
    }
    
    if (classes.includes('bg-blue-600') && !classes.includes('hover:bg-blue-700')) {
      violations.push('Primary button lacks consistent hover state');
    }
  }
  
  // Check heading consistency
  if (/^H[1-6]$/.test(element.tagName)) {
    if (!classes.includes('text-')) {
      violations.push('Heading lacks text size class');
    }
  }
  
  // Check interactive element focus states
  if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
    if (!classes.includes('focus:') && !classes.includes('focusable')) {
      violations.push('Interactive element lacks focus state');
    }
  }
  
  return {
    isConsistent: violations.length === 0,
    violations,
  };
}

/**
 *
 * @param document
 */
export function checkColorConsistency(document: Document): {
  isConsistent: boolean;
  colorUsage: Record<string, number>;
  inconsistencies: string[];
} {
  const colorUsage: Record<string, number> = {};
  const inconsistencies: string[] = [];
  
  // Count color usage
  document.querySelectorAll('[class*="blue-"], [class*="red-"], [class*="green-"]').forEach(element => {
    const classes = element.className;
    const colorMatches = classes.match(/(blue|red|green|yellow)-\d+/g);
    
    colorMatches?.forEach(color => {
      colorUsage[color] = (colorUsage[color] || 0) + 1;
    });
  });
  
  // Check for inconsistencies
  const primaryColors = Object.keys(colorUsage).filter(color => color.startsWith('blue-'));
  if (primaryColors.length > 3) {
    inconsistencies.push('Too many primary color variations used');
  }
  
  return {
    isConsistent: inconsistencies.length === 0,
    colorUsage,
    inconsistencies,
  };
}