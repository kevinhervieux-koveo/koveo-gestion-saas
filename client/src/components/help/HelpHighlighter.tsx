import { useEffect, useState, useCallback, memo, useRef } from 'react';
import { useHelp, findHelpForElement } from '@/contexts/HelpContext';
import { useLanguage } from '@/hooks/use-language';

interface HighlightedElement {
  element: HTMLElement;
  description: string;
  type: 'button' | 'formField' | 'generic';
}

/**
 * HelpHighlighter component that highlights interactive elements when help is open
 * and shows tooltips with descriptions on hover
 */
export const HelpHighlighter = memo(function HelpHighlighter() {
  const { isHelpOpen, getCurrentHelpContent } = useHelp();
  const { language } = useLanguage();
  const [highlightedElements, setHighlightedElements] = useState<HighlightedElement[]>([]);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);

  // Scan for interactive elements
  const scanInteractiveElements = useCallback(() => {
    if (!isHelpOpen) {
      setHighlightedElements([]);
      return;
    }

    const helpContent = getCurrentHelpContent();
    const interactiveSelectors = [
      'button:not([data-testid="button-help-toggle"]):not([data-testid="button-close-help"]):not([data-testid="button-collapse-help"])',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[data-testid^="button-"]:not([data-testid="button-help-toggle"]):not([data-testid="button-close-help"]):not([data-testid="button-collapse-help"])',
      '[data-testid^="input-"]',
      '[data-testid^="link-"]',
    ];

    const elements = document.querySelectorAll<HTMLElement>(interactiveSelectors.join(','));
    const highlighted: HighlightedElement[] = [];

    // Bilingual generic message
    const genericMessage = language === 'fr' 
      ? 'Élément interactif - cliquez pour effectuer une action'
      : 'Interactive element - click for action';

    elements.forEach((element) => {
      // Skip if element is within the help overlay
      if (element.closest('[role="dialog"]')) return;
      
      // Skip sidebar navigation elements
      if (element.closest('aside') || element.closest('[class*="sidebar"]') || element.closest('nav[class*="Sidebar"]')) return;

      // Try to find help content for this element
      const helpInfo = findHelpForElement(element, helpContent, language);

      if (helpInfo) {
        highlighted.push({
          element,
          description: helpInfo.description,
          type: helpInfo.type,
        });
      } else {
        // Still highlight but with generic message
        highlighted.push({
          element,
          description: genericMessage,
          type: 'generic',
        });
      }
    });

    setHighlightedElements(highlighted);
  }, [isHelpOpen, getCurrentHelpContent, language]);

  // Set up MutationObserver to detect dynamically added elements
  useEffect(() => {
    if (!isHelpOpen) return;

    const observer = new MutationObserver(() => {
      scanInteractiveElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [isHelpOpen, scanInteractiveElements]);

  // Initial scan when help opens
  useEffect(() => {
    scanInteractiveElements();
  }, [isHelpOpen, scanInteractiveElements]);

  // Add/remove highlight classes to elements
  useEffect(() => {
    // Store event handlers for cleanup
    const elementHandlers = new Map<HTMLElement, {
      mouseenter: () => void;
      mouseleave: () => void;
    }>();

    highlightedElements.forEach(({ element, type }) => {
      // Add highlight class based on type
      const highlightClass = type === 'generic' 
        ? 'help-highlight-generic' 
        : type === 'button'
        ? 'help-highlight-button'
        : 'help-highlight-field';

      element.classList.add(highlightClass);
      
      // Create and store event handlers for tooltips
      const handleMouseEnter = () => {
        setHoveredElement(element);
      };
      const handleMouseLeave = () => {
        // Hide tooltip when leaving element (no delay)
        setHoveredElement(null);
      };

      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);

      // Store handlers for cleanup
      elementHandlers.set(element, {
        mouseenter: handleMouseEnter,
        mouseleave: handleMouseLeave,
      });

      element.setAttribute('data-help-highlighted', 'true');
    });

    // Cleanup function - properly remove event listeners
    return () => {
      highlightedElements.forEach(({ element }) => {
        // Remove event listeners using stored handlers
        const handlers = elementHandlers.get(element);
        if (handlers) {
          element.removeEventListener('mouseenter', handlers.mouseenter);
          element.removeEventListener('mouseleave', handlers.mouseleave);
        }

        // Remove CSS classes and attributes
        element.classList.remove('help-highlight-generic', 'help-highlight-button', 'help-highlight-field');
        element.removeAttribute('data-help-highlighted');
      });
      
      // Clear the handlers map
      elementHandlers.clear();
      // Don't clear hoveredElement during cleanup - preserve tooltip state
    };
  }, [highlightedElements]);

  if (!isHelpOpen) return null;

  return (
    <>
      <style>{`
        .help-highlight-button {
          position: relative;
          z-index: 65;
          animation: help-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.3);
          border-radius: 0.375rem;
          transition: box-shadow 0.2s ease-in-out;
          cursor: not-allowed !important;
        }

        .help-highlight-field {
          position: relative;
          z-index: 65;
          animation: help-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.5), 0 0 0 4px rgba(34, 197, 94, 0.3);
          border-radius: 0.375rem;
          transition: box-shadow 0.2s ease-in-out;
          cursor: not-allowed !important;
        }

        .help-highlight-generic {
          position: relative;
          z-index: 65;
          animation: help-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.5), 0 0 0 4px rgba(148, 163, 184, 0.3);
          border-radius: 0.375rem;
          transition: box-shadow 0.2s ease-in-out;
          cursor: not-allowed !important;
        }

        .help-highlight-button:hover,
        .help-highlight-field:hover,
        .help-highlight-generic:hover {
          animation: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.7), 0 0 0 6px rgba(59, 130, 246, 0.4);
          z-index: 65;
        }

        @keyframes help-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
      `}</style>

      {/* Render tooltips for hovered elements */}
      {hoveredElement && (() => {
        const highlightedInfo = highlightedElements.find(h => h.element === hoveredElement);
        if (!highlightedInfo) return null;
        
        const rect = hoveredElement.getBoundingClientRect();
        
        // Calculate position to keep tooltip on screen
        const tooltipOffset = 80; // Distance from element (increased for better spacing)
        const minTopMargin = 20; // Minimum space from top of viewport
        const estimatedTooltipHeight = 60; // Estimated tooltip height
        
        let top = rect.top - tooltipOffset;
        let left = rect.left + rect.width / 2;
        let isBelow = false;
        
        // Check if tooltip would go off top of screen
        if (top < minTopMargin) {
          // Position below element instead
          top = rect.bottom + 30;
          isBelow = true;
        }
        
        // Check if tooltip would go off bottom of screen when positioned below
        if (isBelow && (top + estimatedTooltipHeight) > window.innerHeight - 20) {
          // Force it above even if tight
          top = rect.top - tooltipOffset;
          isBelow = false;
        }
        
        // Ensure tooltip stays within viewport horizontally
        const tooltipMaxWidth = 400;
        const viewportWidth = window.innerWidth;
        const minLeftMargin = 10;
        const maxRightMargin = viewportWidth - 10;
        
        // Adjust left position if tooltip would go off screen
        let adjustedLeft = left;
        if (left - tooltipMaxWidth / 2 < minLeftMargin) {
          adjustedLeft = tooltipMaxWidth / 2 + minLeftMargin;
        } else if (left + tooltipMaxWidth / 2 > maxRightMargin) {
          adjustedLeft = maxRightMargin - tooltipMaxWidth / 2;
        }
        
        return (
          <div
            style={{
              position: 'fixed',
              top: `${top}px`,
              left: `${adjustedLeft}px`,
              transform: 'translateX(-50%)',
              zIndex: 99999,
              pointerEvents: 'none',
              maxWidth: `${tooltipMaxWidth}px`,
              width: 'max-content',
            }}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg shadow-2xl border-2 border-blue-400"
          >
            <p className="text-sm font-medium">
              {highlightedInfo.description}
            </p>
            {/* Prominent arrow pointing to element */}
            <div 
              style={{
                position: 'absolute',
                bottom: isBelow ? 'auto' : '-10px',
                top: isBelow ? '-10px' : 'auto',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '20px',
                height: '20px',
                backgroundColor: 'rgb(37, 99, 235)',
                borderRight: isBelow ? 'none' : '2px solid rgb(96, 165, 250)',
                borderBottom: isBelow ? 'none' : '2px solid rgb(96, 165, 250)',
                borderTop: isBelow ? '2px solid rgb(96, 165, 250)' : 'none',
                borderLeft: isBelow ? '2px solid rgb(96, 165, 250)' : 'none',
              }}
            />
            {/* Line connecting arrow to element */}
            <div
              style={{
                position: 'absolute',
                bottom: isBelow ? 'auto' : '-25px',
                top: isBelow ? '-25px' : 'auto',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '2px',
                height: '15px',
                backgroundColor: 'rgb(96, 165, 250)',
              }}
            />
          </div>
        );
      })()}
    </>
  );
});
