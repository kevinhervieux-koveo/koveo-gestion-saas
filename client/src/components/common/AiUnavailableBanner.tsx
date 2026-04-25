import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

interface AiUnavailableBannerProps {
  /**
   * Status endpoint to probe. Defaults to the shared
   * `GET /api/ai/status` probe used by the bill extractor, document
   * analyzer, and payment-schedule suggester. The bulk-import page
   * passes its own `/api/admin/bulk-import/ai-status` so it keeps
   * using the admin-gated probe introduced in Task #710.
   */
  statusEndpoint?: string;
  /**
   * Page-specific copy for what the user will see when the analyzer
   * is offline. Defaults to the bill / document / payment wording.
   */
  message?: { en: string; fr: string };
  /**
   * Optional `data-testid` override so tests on different pages can
   * disambiguate which banner instance they are asserting against.
   */
  testId?: string;
}

/**
 * Page-level banner shown when the Gemini-backed AI analyzer is not
 * configured on the deployment (Task #715, generalising the pattern
 * introduced for Bulk Document Import in Task #710).
 *
 * Each affected admin page mounts this once near the top of its
 * content area. It polls a small `/api/ai/status` probe (or a
 * page-specific equivalent) and only renders when the probe explicitly
 * reports `available: false` — while the probe is loading or fails we
 * stay quiet rather than flashing a misleading warning. The banner is
 * dismissible per page visit because admins debugging a broken deploy
 * may want to keep working with stub data and don't need to be
 * reminded on every interaction.
 */
export function AiUnavailableBanner({
  statusEndpoint = '/api/ai/status',
  message,
  testId = 'alert-ai-unavailable',
}: AiUnavailableBannerProps = {}) {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const { data: aiStatus } = useQuery<{ available: boolean }>({
    queryKey: [statusEndpoint],
  });

  const [dismissed, setDismissed] = useState(false);

  // Default to `available: true` so the banner stays hidden while the
  // probe is loading or fails — better to be quiet than to flash a
  // misleading warning. Only render when the probe explicitly reports
  // the analyzer is offline and the admin hasn't dismissed it yet.
  const aiAvailable = aiStatus?.available ?? true;
  if (aiAvailable || dismissed) return null;

  const defaultMessage = {
    en: 'The AI analyzer is not configured on this deployment. AI-powered features on this page (document extraction, suggestions, and confidence scores) will fall back to generic results based on filenames or simple heuristics — no real analysis is performed.',
    fr: "L'analyseur IA n'est pas configuré sur ce déploiement. Les fonctionnalités IA de cette page (extraction de documents, suggestions et scores de confiance) reviendront à des résultats génériques basés sur les noms de fichiers ou de simples heuristiques — aucune analyse réelle n'est effectuée.",
  };
  const copy = message ?? defaultMessage;

  return (
    <Alert
      variant="destructive"
      data-testid={testId}
      className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:[&>svg]:text-amber-100"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{isFr ? 'IA indisponible' : 'AI unavailable'}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{isFr ? copy.fr : copy.en}</p>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDismissed(true)}
            data-testid={`${testId}-dismiss`}
          >
            {isFr ? 'Compris' : 'Got it'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
