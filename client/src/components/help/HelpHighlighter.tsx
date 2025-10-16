import { useEffect, useState, useCallback, memo } from 'react';
import { useHelp, findHelpForElement } from '@/contexts/HelpContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

  // Debounce hover events
  const debouncedSetHovered = useCallback((element: HTMLElement | null) => {
    const timeoutId = setTimeout(() => {
      setHoveredElement(element);
    }, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  // Scan for interactive elements
  const scanInteractiveElements = useCallback(() => {
    if (!isHelpOpen) {
      setHighlightedElements([]);
      return;
    }

    const helpContent = getCurrentHelpContent();
    const interactiveSelectors = [
      'button:not([data-testid="button-help-toggle"]):not([data-testid="button-close-help"])',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[data-testid^="button-"]',
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
      click: (e: Event) => void;
    }>();

    highlightedElements.forEach(({ element, type }) => {
      // Add highlight class based on type
      const highlightClass = type === 'generic' 
        ? 'help-highlight-generic' 
        : type === 'button'
        ? 'help-highlight-button'
        : 'help-highlight-field';

      element.classList.add(highlightClass);
      
      // Create and store event handlers
      const handleMouseEnter = () => debouncedSetHovered(element);
      const handleMouseLeave = () => debouncedSetHovered(null);
      const handleClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
      // Use capture phase to prevent clicks before other handlers
      element.addEventListener('click', handleClick, true);

      // Store handlers for cleanup
      elementHandlers.set(element, {
        mouseenter: handleMouseEnter,
        mouseleave: handleMouseLeave,
        click: handleClick,
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
          element.removeEventListener('click', handlers.click, true);
        }

        // Remove CSS classes and attributes
        element.classList.remove('help-highlight-generic', 'help-highlight-button', 'help-highlight-field');
        element.removeAttribute('data-help-highlighted');
      });
      
      // Clear the handlers map
      elementHandlers.clear();
      setHoveredElement(null);
    };
  }, [highlightedElements, debouncedSetHovered]);

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
        }

        .help-highlight-field {
          position: relative;
          z-index: 65;
          animation: help-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.5), 0 0 0 4px rgba(34, 197, 94, 0.3);
          border-radius: 0.375rem;
          transition: box-shadow 0.2s ease-in-out;
        }

        .help-highlight-generic {
          position: relative;
          z-index: 65;
          animation: help-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.5), 0 0 0 4px rgba(148, 163, 184, 0.3);
          border-radius: 0.375rem;
          transition: box-shadow 0.2s ease-in-out;
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
      {hoveredElement && highlightedElements.find(h => h.element === hoveredElement) && (
        <TooltipProvider>
          <Tooltip open={true}>
            <TooltipTrigger asChild>
              <div 
                style={{
                  position: 'fixed',
                  top: hoveredElement.getBoundingClientRect().top,
                  left: hoveredElement.getBoundingClientRect().left,
                  width: hoveredElement.getBoundingClientRect().width,
                  height: hoveredElement.getBoundingClientRect().height,
                  pointerEvents: 'none',
                  zIndex: 9999,
                }}
              />
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="max-w-xs z-[10000]"
              sideOffset={5}
            >
              <p className="text-sm">
                {highlightedElements.find(h => h.element === hoveredElement)?.description}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
});
