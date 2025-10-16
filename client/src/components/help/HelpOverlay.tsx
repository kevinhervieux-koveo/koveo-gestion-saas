import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { X, Info, MousePointer, FileText, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useHelp } from '@/contexts/HelpContext';
import { getHelpContent } from '@/config/help-content';

/**
 * Help overlay that displays contextual help information for the current page
 */
export function HelpOverlay() {
  const { isHelpOpen, closeHelp } = useHelp();
  const [location] = useLocation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close help when navigating to a new page
  useEffect(() => {
    closeHelp();
  }, [location, closeHelp]);

  // Manage focus when help is open
  useEffect(() => {
    if (isHelpOpen) {
      // Focus the close button when overlay opens for keyboard accessibility
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);

      // Handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeHelp();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isHelpOpen, closeHelp]);

  if (!isHelpOpen) return null;

  const helpContent = getHelpContent(location);

  if (!helpContent) {
    return (
      <div 
        ref={overlayRef}
        className="fixed inset-0 pointer-events-none z-50 flex items-start justify-end p-4 pt-20"
        role="dialog"
        aria-modal="false"
        aria-labelledby="help-title"
      >
        <Card className="w-full max-w-md pointer-events-auto shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle id="help-title" className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Help
              </CardTitle>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                onClick={closeHelp}
                data-testid="button-close-help"
                aria-label="Close help"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Help content is not yet available for this page.
            </p>
            <p className="text-sm text-muted-foreground">
              You can navigate to other pages using the sidebar menu, or if you need assistance with this page specifically, please contact support.
            </p>
            <div className="flex gap-2 pt-2">
              <Badge variant="outline">Tip</Badge>
              <div className="text-sm text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">Esc</kbd> to close this help dialog
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 pointer-events-none z-50 flex items-start justify-end p-4 pt-20"
      role="dialog"
      aria-modal="false"
      aria-labelledby="help-title"
    >
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle id="help-title" className="text-2xl mb-2">{helpContent.title}</CardTitle>
              <CardDescription className="text-base">
                {helpContent.description}
              </CardDescription>
            </div>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={closeHelp}
              data-testid="button-close-help"
              className="shrink-0"
              aria-label="Close help"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 px-6">
          <CardContent className="space-y-6 pb-6">
            {/* Goals and How to Use */}
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  GOALS
                </h3>
                <p className="text-sm">{helpContent.goal}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  HOW TO USE
                </h3>
                <p className="text-sm">{helpContent.howToUse}</p>
              </div>
            </div>

            {/* Buttons Section */}
            {helpContent.buttons && helpContent.buttons.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MousePointer className="h-4 w-4" />
                    Buttons & Actions
                  </h3>
                  <div className="space-y-2">
                    {helpContent.buttons.map((button, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Badge variant="outline" className="shrink-0 mt-0.5">
                          {button.label}
                        </Badge>
                        <p className="text-sm text-muted-foreground flex-1">
                          {button.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Form Fields Section */}
            {helpContent.formFields && helpContent.formFields.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Form Fields
                  </h3>
                  <div className="space-y-2">
                    {helpContent.formFields.map((field, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{field.label}</Badge>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex-1">
                          {field.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Relationships Section */}
            {helpContent.relationships && helpContent.relationships.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Related Pages
                  </h3>
                  <div className="space-y-2">
                    {helpContent.relationships.map((relationship, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Badge variant="secondary" className="shrink-0 mt-0.5">
                          {relationship.page}
                        </Badge>
                        <p className="text-sm text-muted-foreground flex-1">
                          {relationship.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground text-center">
            Click the <Badge variant="outline" className="mx-1">?</Badge> button anytime to get help with the current page
          </div>
        </div>
      </Card>
    </div>
  );
}
