import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { X, Info, MousePointer, FileText, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useHelp } from '@/contexts/HelpContext';
import { getHelpContent, getText } from '@/config/help-content';
import { useLanguage } from '@/hooks/use-language';

/**
 * Help overlay that displays contextual help information for the current page
 */
export function HelpOverlay() {
  const { isHelpOpen } = useHelp();
  const [location] = useLocation();
  const { language } = useLanguage();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Prevent clicks when help is open
  useEffect(() => {
    if (isHelpOpen) {
      // Prevent all clicks when help is open (except help UI buttons)
      const preventClicks = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // Allow clicks on help button (toggles help on/off)
        if (target.closest('[data-testid="button-help-toggle"]')) {
          return; // Allow help button clicks to toggle
        }

        // Allow clicks on collapse button
        if (target.closest('[data-testid="button-collapse-help"]')) {
          return; // Allow collapse button clicks
        }

        // Allow clicks ONLY on the help card (not other dialogs/popovers)
        // Check if the click is within the specific help overlay ref
        if (overlayRef.current && overlayRef.current.contains(target)) {
          return; // Allow interaction with help card only
        }

        // Prevent all other clicks from doing anything (including Select dropdowns, popovers, etc.)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      };
      
      // Also prevent pointer events on the page to block hover states that can trigger dropdowns
      const preventPointerEvents = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        
        // Allow pointer events on help UI
        if (target.closest('[data-testid="button-help-toggle"]') || 
            target.closest('[data-testid="button-collapse-help"]') ||
            (overlayRef.current && overlayRef.current.contains(target))) {
          return;
        }

        // Check if it's a Radix Select trigger or content (these are interactive elements we want to block)
        if (target.closest('[role="combobox"]') || 
            target.closest('[data-radix-popper-content-wrapper]') ||
            target.closest('[data-radix-select-viewport]')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      };

      document.addEventListener('click', preventClicks, true); // Use capture phase
      document.addEventListener('mousedown', preventClicks, true);
      document.addEventListener('mouseup', preventClicks, true);
      document.addEventListener('pointerdown', preventPointerEvents, true);
      document.addEventListener('pointerup', preventPointerEvents, true);
      
      return () => {
        document.removeEventListener('click', preventClicks, true);
        document.removeEventListener('mousedown', preventClicks, true);
        document.removeEventListener('mouseup', preventClicks, true);
        document.removeEventListener('pointerdown', preventPointerEvents, true);
        document.removeEventListener('pointerup', preventPointerEvents, true);
      };
    }
  }, [isHelpOpen]);

  if (!isHelpOpen) return null;

  const helpContent = getHelpContent(location);

  if (!helpContent) {
    return (
      <>
        {/* Backdrop - visual only, doesn't block pointer events */}
        <div 
          className="fixed inset-0 bg-black/20 z-[60]" 
          style={{ pointerEvents: 'none' }}
        />
        
        <div 
          ref={overlayRef}
          className="fixed inset-0 pointer-events-none z-[70] flex items-start justify-end p-4 pt-20"
          role="dialog"
          aria-modal="false"
          aria-labelledby="help-title"
        >
          <Card className="w-full max-w-md pointer-events-auto shadow-2xl">
          <CardHeader>
            <CardTitle id="help-title" className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              {language === 'fr' ? 'Aide' : 'Help'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              {language === 'fr' 
                ? "Le contenu d'aide n'est pas encore disponible pour cette page."
                : 'Help content is not yet available for this page.'
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'fr'
                ? "Vous pouvez naviguer vers d'autres pages en utilisant le menu de la barre latérale, ou si vous avez besoin d'aide spécifique pour cette page, veuillez contacter le support."
                : 'You can navigate to other pages using the sidebar menu, or if you need assistance with this page specifically, please contact support.'
              }
            </p>
            <div className="flex gap-2 pt-2">
              <Badge variant="outline">{language === 'fr' ? 'Conseil' : 'Tip'}</Badge>
              <div className="text-sm text-muted-foreground">
                {language === 'fr'
                  ? <>Cliquez sur le bouton <Badge variant="outline" className="mx-1">?</Badge> pour fermer cette boîte de dialogue d'aide</>
                  : <>Click the <Badge variant="outline" className="mx-1">?</Badge> button to close this help dialog</>
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop - visual only, doesn't block pointer events */}
      <div className="fixed inset-0 bg-black/20 z-[60] pointer-events-none" />
      
      <div 
        ref={overlayRef}
        className="fixed inset-0 pointer-events-none z-[70] flex items-start justify-end p-4 pt-20"
        role="dialog"
        aria-modal="false"
        aria-labelledby="help-title"
      >
        <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto shadow-2xl">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-start justify-between gap-4 w-full">
              <div className="flex-1">
                <CardTitle id="help-title" className="text-2xl mb-2">{getText(helpContent.title, language)}</CardTitle>
                {!isCollapsed && (
                  <CardDescription className="text-base">
                    {getText(helpContent.description, language)}
                  </CardDescription>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                data-testid="button-collapse-help"
                className="shrink-0"
                aria-label={isCollapsed ? 'Expand help' : 'Collapse help'}
              >
                {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
              </Button>
            </div>
          </CardHeader>

        {!isCollapsed && (
          <ScrollArea className="flex-1 overflow-auto">
            <CardContent className="space-y-6 pb-6 px-6">
            {/* Goals and How to Use */}
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {language === 'fr' ? 'OBJECTIFS' : 'GOALS'}
                </h3>
                <p className="text-sm">{getText(helpContent.goal, language)}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {language === 'fr' ? 'COMMENT UTILISER' : 'HOW TO USE'}
                </h3>
                <p className="text-sm">{getText(helpContent.howToUse, language)}</p>
              </div>
            </div>

            {/* Buttons Section */}
            {helpContent.buttons && helpContent.buttons.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MousePointer className="h-4 w-4" />
                    {language === 'fr' ? 'Boutons & Actions' : 'Buttons & Actions'}
                  </h3>
                  <div className="space-y-2">
                    {helpContent.buttons.map((button, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Badge variant="outline" className="shrink-0 mt-0.5">
                          {getText(button.label, language)}
                        </Badge>
                        <p className="text-sm text-muted-foreground flex-1">
                          {getText(button.description, language)}
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
                    {language === 'fr' ? 'Champs de Formulaire' : 'Form Fields'}
                  </h3>
                  <div className="space-y-2">
                    {helpContent.formFields.map((field, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{getText(field.label, language)}</Badge>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">
                              {language === 'fr' ? 'Requis' : 'Required'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex-1">
                          {getText(field.description, language)}
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
                    {language === 'fr' ? 'Pages Connexes' : 'Related Pages'}
                  </h3>
                  <div className="space-y-2">
                    {helpContent.relationships.map((relationship, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Badge variant="secondary" className="shrink-0 mt-0.5">
                          {getText(relationship.page, language)}
                        </Badge>
                        <p className="text-sm text-muted-foreground flex-1">
                          {getText(relationship.description, language)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </ScrollArea>
        )}

        {!isCollapsed && (
          <div className="px-6 py-4 border-t bg-muted/20 shrink-0">
            <div className="text-xs text-muted-foreground text-center">
              {language === 'fr' 
                ? <>Cliquez sur le bouton <Badge variant="outline" className="mx-1">?</Badge> à tout moment pour obtenir de l'aide sur la page actuelle</>
                : <>Click the <Badge variant="outline" className="mx-1">?</Badge> button anytime to get help with the current page</>
              }
            </div>
          </div>
        )}
      </Card>
    </div>
    </>
  );
}
