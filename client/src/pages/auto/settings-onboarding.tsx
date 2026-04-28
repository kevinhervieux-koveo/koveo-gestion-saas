/**
 * Settings → Help & Onboarding sub-page (Task #1572).
 *
 * Lists all tours visible to the caller's role with:
 *  - Status badge (not started / in progress / completed / skipped)
 *  - Last completed date
 *  - Restart-tour button
 * Plus:
 *  - Restart-all button at the top
 *  - "What's new" section driven by seenVersion < latestVersion
 *
 * Hidden entirely when the onboarding feature flag is off.
 * Auto-registered via the client/src/pages/auto/_register.tsx system.
 */

import type { AutoPageRoute } from './_register';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/hooks/use-language';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { BookOpen, RefreshCw, Sparkles } from 'lucide-react';
import { ALL_TOURS } from '@/content/onboarding/smoke';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

import { ONBOARDING_ENABLED } from '@/lib/onboarding-flag';

export const route: AutoPageRoute = {
  path: '/settings/onboarding',
};

interface TourCatalogEntry {
  tourId: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  stepCount: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  currentStep: number;
  seenVersion: number;
  latestVersion: number;
  completedAt: string | null;
  hasNewContent: boolean;
}

function StatusBadge({ status }: { status: TourCatalogEntry['status'] }) {
  const { language } = useLanguage();
  const labels: Record<TourCatalogEntry['status'], { fr: string; en: string }> = {
    not_started: { fr: 'Non commencé', en: 'Not started' },
    in_progress: { fr: 'En cours', en: 'In progress' },
    completed: { fr: 'Complété', en: 'Completed' },
    skipped: { fr: 'Ignoré', en: 'Skipped' },
  };
  const variants: Record<TourCatalogEntry['status'], 'secondary' | 'default' | 'outline' | 'destructive'> = {
    not_started: 'secondary',
    in_progress: 'default',
    completed: 'default',
    skipped: 'outline',
  };
  return (
    <Badge variant={variants[status]} className={status === 'completed' ? 'bg-green-600 text-white' : ''}>
      {language === 'en' ? labels[status].en : labels[status].fr}
    </Badge>
  );
}

export default function SettingsOnboardingPage() {
  const { language } = useLanguage();
  const { restart, start } = useOnboarding();

  const { data, isLoading, refetch } = useQuery<{ catalog: TourCatalogEntry[] }>({
    queryKey: ['/api/onboarding/catalog'],
    enabled: ONBOARDING_ENABLED,
  });

  const locale = language === 'en' ? enUS : fr;

  const title = language === 'en' ? 'Help & Onboarding' : 'Aide & Démarrage';
  const subtitle =
    language === 'en'
      ? 'Manage your guided tours and see what\'s new'
      : 'Gérez vos visites guidées et découvrez les nouveautés';

  if (!ONBOARDING_ENABLED) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            {language === 'en'
              ? 'Onboarding is currently disabled.'
              : 'Le démarrage guidé est actuellement désactivé.'}
          </p>
        </div>
      </div>
    );
  }

  const catalog = data?.catalog ?? [];
  const hasNewContent = catalog.some((t) => t.hasNewContent);

  const handleRestartAll = async () => {
    for (const tour of catalog) {
      await restart(tour.tourId);
    }
    refetch();
  };

  const handleRestart = async (tourId: string) => {
    await restart(tourId);
    refetch();
  };

  const handleStart = (tourId: string) => {
    start(tourId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title={title} subtitle={subtitle} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {hasNewContent && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-blue-800 dark:text-blue-200">
                  <Sparkles className="h-4 w-4" />
                  {language === 'en' ? "What's new" : 'Nouveautés'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {language === 'en'
                    ? 'Some tours have been updated with new content. Restart them to see what changed.'
                    : "Certaines visites guidées ont été mises à jour. Relancez-les pour découvrir les nouveautés."}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {language === 'en' ? 'Guided tours' : 'Visites guidées'}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestartAll}
              className="flex items-center gap-2"
              data-onboarding="settings.onboarding.restart-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {language === 'en' ? 'Restart all' : 'Relancer tout'}
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-full mb-3" />
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : catalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="rounded-full bg-muted p-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                {language === 'en' ? 'No tours available.' : 'Aucune visite disponible.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {catalog.map((tour) => {
                const tourDef = ALL_TOURS.find((t) => t.tourId === tour.tourId);
                const tourTitle =
                  language === 'en' ? tour.title.en : tour.title.fr;
                const tourDesc =
                  language === 'en' ? tour.description.en : tour.description.fr;

                return (
                  <Card key={tour.tourId} className={tour.hasNewContent ? 'border-blue-300' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">{tourTitle}</p>
                            <StatusBadge status={tour.status} />
                            {tour.hasNewContent && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                {language === 'en' ? 'Updated' : 'Mis à jour'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {tourDesc}
                          </p>
                          {tour.completedAt && (
                            <p className="text-xs text-muted-foreground">
                              {language === 'en' ? 'Completed' : 'Complété'}{' '}
                              {format(new Date(tour.completedAt), 'PPP', { locale })}
                            </p>
                          )}
                          {tour.status === 'in_progress' && (
                            <p className="text-xs text-muted-foreground">
                              {language === 'en'
                                ? `Step ${tour.currentStep + 1} of ${tour.stepCount}`
                                : `Étape ${tour.currentStep + 1} sur ${tour.stepCount}`}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {tour.status === 'not_started' ? (
                            <Button
                              size="sm"
                              onClick={() => handleStart(tour.tourId)}
                            >
                              {language === 'en' ? 'Start' : 'Démarrer'}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestart(tour.tourId)}
                              className="flex items-center gap-1.5"
                            >
                              <RefreshCw className="h-3 w-3" />
                              {language === 'en' ? 'Restart' : 'Relancer'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
