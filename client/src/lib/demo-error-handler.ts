import { toast } from '@/hooks/use-toast';

/**
 * Interface for demo restriction error responses from the backend
 */
interface DemoRestrictionError {
  success: false;
  code: string;
  title: string;
  message: string;
  suggestion: string;
  contact: string;
  messageEn: string;
  messageFr: string;
  metadata?: {
    isDemo: boolean;
    restrictionType: string;
    timestamp: string;
    endpoint: string;
    method: string;
  };
}

/**
 * Checks if an error response is a demo restriction error
 */
export function isDemoRestrictionError(error: any): error is DemoRestrictionError {
  return (
    error &&
    typeof error === 'object' &&
    error.code &&
    (error.code === 'DEMO_RESTRICTED' ||
      error.code === 'DEMO_FILE_UPLOAD_RESTRICTED' ||
      error.code === 'DEMO_BULK_RESTRICTED' ||
      error.code === 'DEMO_EXPORT_RESTRICTED') &&
    error.metadata?.isDemo === true
  );
}

/**
 * Handles demo restriction errors by showing appropriate toast messages
 */
export function handleDemoRestrictionError(error: any, language: 'en' | 'fr' = 'en'): boolean {
  if (!isDemoRestrictionError(error)) {
    return false;
  }

  // Use the message in the appropriate language
  const message = language === 'fr' ? error.messageFr : error.messageEn;
  const title = error.title;
  const suggestion = error.suggestion;

  toast({
    title: title,
    description: `${message} ${suggestion}`,
    variant: 'destructive',
    duration: 8000, // Show longer for demo messages
  });

  return true;
}

/**
 * Generic error handler that checks for demo restrictions first, then falls back to default error handling
 */
export function handleApiError(
  error: any,
  language: 'en' | 'fr' = 'en',
  fallbackMessage?: string
): void {
  // First, try to handle as demo restriction error
  if (handleDemoRestrictionError(error, language)) {
    return;
  }

  // Fallback to generic error handling
  const defaultMessage = 
    language === 'fr' 
      ? 'Une erreur est survenue lors du traitement de la demande.'
      : 'An error occurred while processing the request.';

  toast({
    title: language === 'fr' ? 'Erreur' : 'Error',
    description: error?.message || fallbackMessage || defaultMessage,
    variant: 'destructive',
  });
}

export default {
  isDemoRestrictionError,
  handleDemoRestrictionError,
  handleApiError,
};