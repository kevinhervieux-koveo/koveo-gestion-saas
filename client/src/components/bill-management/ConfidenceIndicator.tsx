import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfidenceIndicatorProps {
  confidence: number | undefined;
  fieldName: string;
  t: (key: string) => string;
}

export function ConfidenceIndicator({ confidence, fieldName, t }: ConfidenceIndicatorProps) {
  if (confidence === undefined) return null;

  const getConfidenceLevel = (conf: number) => {
    if (conf >= 0.8) return 'high';
    if (conf >= 0.6) return 'medium';
    return 'low';
  };

  const level = getConfidenceLevel(confidence);

  if (level === 'high') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCircle className="w-4 h-4 ml-1 text-green-500 inline-block" data-testid={`confidence-high-${fieldName}`} />
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('bills.aiConfidenceHigh') || 'AI is confident about this value'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (level === 'medium') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="w-4 h-4 ml-1 text-yellow-500 inline-block" data-testid={`confidence-medium-${fieldName}`} />
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('bills.aiConfidenceMedium') || 'Please verify this value'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertCircle className="w-4 h-4 ml-1 text-red-500 inline-block" data-testid={`confidence-low-${fieldName}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('bills.aiConfidenceLow') || 'Low confidence - manual review recommended'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
