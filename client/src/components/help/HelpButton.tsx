import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHelp } from '@/contexts/HelpContext';

/**
 * Floating help button that appears at the bottom right of all pages
 */
export function HelpButton() {
  const { toggleHelp, isHelpOpen } = useHelp();

  return (
    <Button
      onClick={toggleHelp}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-40"
      size="icon"
      variant={isHelpOpen ? 'default' : 'secondary'}
      data-testid="button-help-toggle"
      aria-label="Toggle help"
    >
      <HelpCircle className="h-6 w-6" />
    </Button>
  );
}
