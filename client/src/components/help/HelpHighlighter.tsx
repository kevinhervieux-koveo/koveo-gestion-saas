import { useEffect, useState, useCallback, memo } from 'react';
import { useHelp, findHelpForElement } from '@/contexts/HelpContext';

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

    elements.forEach((element) => {
      // Skip if element is within the help overlay
      if (element.closest('[role="dialog"]')) return;

      // Try to find help content for this element
      const helpInfo = findHelpForElement(element, helpContent);

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
          description: 'Interactive element - click for action',
          type: 'generic',
        });
      }
    });

    setHighlightedElements(highlighted);
  }, [isHelpOpen, getCurrentHelpContent]);

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
      setHoveredElement(null);
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
        
        return (
          <div
            style={{
              position: 'fixed',
              top: rect.top - 40,
              left: rect.left + rect.width / 2,
              transform: 'translateX(-50%)',
              zIndex: 10000,
              pointerEvents: 'none',
            }}
            className="px-3 py-2 bg-popover text-popover-foreground rounded-md shadow-md border"
          >
            <p className="text-sm whitespace-nowrap">
              {highlightedInfo.description}
            </p>
          </div>
        );
      })()}
    </>
  );
});
