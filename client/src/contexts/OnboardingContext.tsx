/**
 * OnboardingContext — in-app tour engine (Task #1572).
 *
 * Uses driver.js under the hood. The provider:
 *  - Fetches /api/onboarding/me on first render to determine which tours
 *    the user has not yet seen.
 *  - Automatically starts any tour where status='not_started' or
 *    seenVersion < latestVersion.
 *  - Persists progress to /api/onboarding/progress after each step.
 *  - Renders a "Resume tour" floater when a tour is in_progress and the
 *    user navigates away mid-tour.
 *  - Renders copy in the user's language (FR/EN, fallback FR).
 *  - Is a no-op when the onboarding flag is disabled (see client/src/lib/onboarding-flag.ts).
 *
 * Keyboard navigation: driver.js handles Tab/Esc/Enter natively.
 *
 * Bug fixes (Task #1642):
 *  1. Step index clamping: use d.getActiveIndex() instead of indexOf(step) to
 *     avoid sending currentStep: -1 to the server (which 400s).
 *  2. API failures are surfaced via console.warn instead of swallowed silently.
 *     Cache invalidation always runs (try/finally) so the catalog refreshes
 *     even when persistence fails transiently.
 *  3. Tours with an entryPath navigate to that route before launching so
 *     Start/Restart from /settings/onboarding lands on the right page first.
 *  4. Zero eligible steps → friendly toast + status 'skipped' (not 'completed').
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import type { TourContent } from '@/content/onboarding/smoke';
import { ALL_TOURS } from '@/content/onboarding/smoke';
import { useToast } from '@/hooks/use-toast';

import { ONBOARDING_ENABLED } from '@/lib/onboarding-flag';

interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  activeTourId: string | null;
  hasResumable: boolean;
  start: (tourId: string) => void;
  restart: (tourId: string) => void;
  dismiss: () => void;
  skipAll: () => void;
  resume: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  isActive: false,
  currentStep: 0,
  activeTourId: null,
  hasResumable: false,
  start: () => {},
  restart: () => {},
  dismiss: () => {},
  skipAll: () => {},
  resume: () => {},
});

export function useOnboarding(): OnboardingContextType {
  return useContext(OnboardingContext);
}

interface OnboardingProviderProps {
  children: ReactNode;
}

interface TourProgress {
  tourId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  currentStep: number;
  seenVersion: number;
  latestVersion: number;
  hasNewContent: boolean;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { language } = useLanguage();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [hasResumable, setHasResumable] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const activeTourRef = useRef<TourContent | null>(null);
  const progressRef = useRef<TourProgress[]>([]);
  const hasAutoStarted = useRef(false);
  // True when the next driver.destroy() call is a pause-for-navigation, not a
  // user dismissal or a normal completion. Pause must preserve activeTourId /
  // activeTourRef so resume() can relaunch from the saved step.
  const pausingForNavRef = useRef(false);
  // Last step index seen via onHighlighted, used to resume after a navigation
  // pause when progressRef has not yet been refreshed.
  const lastStepIndexRef = useRef(0);
  // FIFO queue of pending tour ids waiting to run. Runs one at a time; when
  // the active tour completes we shift the next pending tour and start it.
  // Skipped or in-flight tours are excluded at enqueue time.
  const pendingQueueRef = useRef<string[]>([]);
  // When start/restart needs to navigate before launching, the pending tour
  // is stored here and consumed by the location effect after the route change.
  const pendingTourStartRef = useRef<{ tourId: string; fromStep: number } | null>(null);

  const t = useCallback(
    (text: { fr: string; en: string }) =>
      language === 'en' ? text.en : text.fr,
    [language],
  );

  const persistProgress = useCallback(
    async (
      tourId: string,
      status: 'not_started' | 'in_progress' | 'completed' | 'skipped',
      step: number,
      seenVersion: number,
    ) => {
      try {
        await apiRequest('POST', '/api/onboarding/progress', {
          tourId,
          status,
          currentStep: step,
          seenVersion,
        });
      } catch (err) {
        console.warn(
          '[Onboarding] persistProgress failed — tour will still advance.',
          { tourId, status, step, seenVersion },
          err,
        );
      } finally {
        // Always refresh the catalog so the UI reflects the latest state,
        // even when the POST failed transiently.
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding/me'] });
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding/catalog'] });
      }
    },
    [],
  );

  const runTour = useCallback(
    (tour: TourContent, startFromStep = 0) => {
      if (!ONBOARDING_ENABLED) return;

      const lang = language === 'en' ? 'en' : 'fr';
      const latestVersion =
        progressRef.current.find((p) => p.tourId === tour.tourId)?.latestVersion ?? 1;

      // Honor per-step visibleIf predicates (Task #1590 M.4): steps whose
      // predicate returns false are silently skipped, e.g. when the targeted
      // UI element isn't rendered for the current user/page.  Predicates are
      // evaluated synchronously at tour-start time.
      const eligibleSteps = tour.steps.filter(
        (s) => typeof s.visibleIf !== 'function' || s.visibleIf(),
      );

      if (eligibleSteps.length === 0) {
        // The tour has no renderable steps in the current context. Show a
        // friendly toast and mark the tour as skipped rather than silently
        // completing it (which would both 400 and confuse the user).
        toast({
          title: language === 'en' ? 'Tour not available' : 'Visite non disponible',
          description:
            language === 'en'
              ? 'This tour requires features that aren\'t available in your current setup.'
              : 'Cette visite nécessite des fonctionnalités non disponibles dans votre configuration.',
        });
        persistProgress(tour.tourId, 'skipped', 0, latestVersion);
        // Advance the pending queue so chained tours continue to run even
        // when a tour is skipped due to missing anchors (same logic as the
        // completion branch in onDestroyStarted).
        const nextId = pendingQueueRef.current.shift();
        if (nextId) {
          const nextTour = ALL_TOURS.find((tt) => tt.tourId === nextId);
          if (nextTour) {
            setTimeout(() => runTour(nextTour, 0), 250);
          }
        }
        return;
      }

      const steps: DriveStep[] = eligibleSteps.map((step) => ({
        element: step.anchor,
        popover: {
          title: step.title[lang as 'fr' | 'en'],
          description: step.description[lang as 'fr' | 'en'],
          side: step.placement ?? 'bottom',
          align: 'start',
        },
      }));

      if (driverRef.current) {
        driverRef.current.destroy();
      }

      // `d` is referenced by the callbacks below via closure. By the time
      // driver.js calls onHighlighted/onDestroyStarted, `d` is already assigned.
      let d: Driver;
      d = driver({
        steps,
        animate: true,
        showButtons: ['next', 'previous', 'close'],
        allowClose: true,
        onHighlighted: () => {
          // Use driver's canonical cursor instead of indexOf(step) which can
          // return -1 when driver.js doesn't preserve object references.
          const raw = d.getActiveIndex() ?? 0;
          const idx = Math.max(0, Math.min(raw, eligibleSteps.length - 1));
          setCurrentStep(idx);
          lastStepIndexRef.current = idx;
          persistProgress(tour.tourId, 'in_progress', idx, latestVersion);
        },
        onDestroyStarted: () => {
          const currentIdx = d.getActiveIndex() ?? 0;
          const clampedIdx = Math.max(0, Math.min(currentIdx, eligibleSteps.length - 1));
          const isLast = clampedIdx >= eligibleSteps.length - 1;
          const isPausingForNav = pausingForNavRef.current;
          pausingForNavRef.current = false;

          if (isLast) {
            persistProgress(
              tour.tourId,
              'completed',
              eligibleSteps.length - 1,
              latestVersion,
            );
          }
          setIsActive(false);
          driverRef.current = null;

          // Preserve tour identity on a navigation-pause so resume() can relaunch.
          // For user dismissal / natural completion, clear it and run the next
          // tour in the pending queue (if any) so role catalogs play sequentially.
          if (!isPausingForNav) {
            setActiveTourId(null);
            activeTourRef.current = null;

            if (isLast) {
              // Drain the queue head and start the next eligible tour.
              const nextId = pendingQueueRef.current.shift();
              if (nextId) {
                const nextTour = ALL_TOURS.find((tt) => tt.tourId === nextId);
                if (nextTour) {
                  setTimeout(() => runTour(nextTour, 0), 250);
                }
              }
            }
          }
        },
      });

      driverRef.current = d;
      activeTourRef.current = tour;
      setActiveTourId(tour.tourId);
      setIsActive(true);
      setHasResumable(false);

      if (startFromStep > 0) {
        d.drive(startFromStep);
      } else {
        d.drive();
      }
    },
    [language, persistProgress, toast],
  );

  const start = useCallback(
    (tourId: string) => {
      const tour = ALL_TOURS.find((t) => t.tourId === tourId);
      if (!tour) return;

      // If the tour has an entry page and we're not already there, navigate
      // first. The location effect will pick up pendingTourStartRef and
      // launch the tour after the destination page renders.
      if (tour.entryPath && location !== tour.entryPath) {
        pendingTourStartRef.current = { tourId, fromStep: 0 };
        setLocation(tour.entryPath);
        return;
      }

      runTour(tour, 0);
    },
    [runTour, location, setLocation],
  );

  const restart = useCallback(
    async (tourId: string) => {
      try {
        await apiRequest('POST', '/api/onboarding/restart', { tourId });
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding/me'] });
      } catch (err) {
        console.warn('[Onboarding] restart API call failed', { tourId }, err);
      }
      start(tourId);
    },
    [start],
  );

  const dismiss = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }
  }, []);

  const skipAll = useCallback(async () => {
    dismiss();
    for (const tour of ALL_TOURS) {
      await persistProgress(tour.tourId, 'skipped', 0, 1);
    }
  }, [dismiss, persistProgress]);

  const resume = useCallback(() => {
    // Resolve the tour to resume in this priority order:
    //  1. activeTourRef (set when paused for navigation)
    //  2. activeTourId (set from /me's in_progress row at boot)
    const targetTour =
      activeTourRef.current ??
      (activeTourId ? ALL_TOURS.find((t) => t.tourId === activeTourId) ?? null : null);

    if (!targetTour) return;

    // Pick the most accurate step index available: live highlight cursor first,
    // then the latest persisted progress row.
    const persisted = progressRef.current.find((p) => p.tourId === targetTour.tourId);
    const stepIndex =
      lastStepIndexRef.current > 0 ? lastStepIndexRef.current : persisted?.currentStep ?? 0;

    runTour(targetTour, stepIndex);
  }, [activeTourId, runTour]);

  useEffect(() => {
    if (!ONBOARDING_ENABLED || hasAutoStarted.current) return;

    let cancelled = false;
    async function fetchAndAutoStart() {
      try {
        const res = await apiRequest('GET', '/api/onboarding/me');
        const data = (await res.json()) as { progress: TourProgress[] };
        if (cancelled) return;
        progressRef.current = data.progress ?? [];

        const inProgress = data.progress?.find((p) => p.status === 'in_progress');
        if (inProgress) {
          setHasResumable(true);
          setActiveTourId(inProgress.tourId);
        }

        // Build the FIFO queue of tours that should auto-play: never seen, or
        // updated content (seenVersion < latestVersion). Skipped tours are
        // honored. Order follows /api/onboarding/me's response order so the
        // server controls priority for upcoming role catalogs.
        const pending = (data.progress ?? []).filter(
          (p) =>
            (p.status === 'not_started' || p.hasNewContent) &&
            p.status !== 'skipped',
        );

        if (pending.length > 0) {
          // Pop the first eligible tour we know about; queue the rest.
          let firstTour: TourContent | undefined;
          const queue: string[] = [];
          for (const p of pending) {
            const tour = ALL_TOURS.find((t) => t.tourId === p.tourId);
            if (!tour) continue;
            if (!firstTour) {
              firstTour = tour;
            } else {
              queue.push(tour.tourId);
            }
          }
          pendingQueueRef.current = queue;

          if (firstTour) {
            hasAutoStarted.current = true;
            const tourToStart = firstTour;
            setTimeout(() => {
              if (!cancelled) runTour(tourToStart, 0);
            }, 800);
          } else {
            hasAutoStarted.current = true;
          }
        } else {
          hasAutoStarted.current = true;
        }
      } catch {
        hasAutoStarted.current = true;
      }
    }

    fetchAndAutoStart();
    return () => {
      cancelled = true;
    };
  }, [runTour]);

  useEffect(() => {
    // After navigating to a tour's entryPath, launch the pending tour.
    // This must run before the pause-for-navigation logic below so that
    // intentional Start/Restart navigations don't pause immediately.
    if (pendingTourStartRef.current) {
      const { tourId, fromStep } = pendingTourStartRef.current;
      pendingTourStartRef.current = null;
      const tour = ALL_TOURS.find((t) => t.tourId === tourId);
      if (tour) {
        // Small delay allows the destination page's DOM to settle before
        // driver.js tries to find anchors.
        setTimeout(() => runTour(tour, fromStep), 400);
      }
      return;
    }

    if (isActive && driverRef.current) {
      setHasResumable(true);
      // Mark this as a pause so onDestroyStarted preserves activeTourRef/Id
      // and resume() can relaunch the tour after navigation.
      pausingForNavRef.current = true;
      driverRef.current.destroy();
      setIsActive(false);
    }
  }, [location]);

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStep,
        activeTourId,
        hasResumable,
        start,
        restart,
        dismiss,
        skipAll,
        resume,
      }}
    >
      {children}
      {hasResumable && !isActive && (
        <ResumeTourFloater onResume={resume} onDismiss={() => setHasResumable(false)} />
      )}
    </OnboardingContext.Provider>
  );
}

function ResumeTourFloater({
  onResume,
  onDismiss,
}: {
  onResume: () => void;
  onDismiss: () => void;
}) {
  const { language } = useLanguage();
  const resumeLabel = language === 'en' ? 'Resume tour' : 'Reprendre la visite';
  const dismissLabel = language === 'en' ? 'Dismiss' : 'Ignorer';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        background: 'hsl(var(--background))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
        {language === 'en' ? 'Tour paused' : 'Visite en pause'}
      </span>
      <button
        onClick={onResume}
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          background: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          border: 'none',
          borderRadius: '0.375rem',
          padding: '0.375rem 0.75rem',
          cursor: 'pointer',
        }}
      >
        {resumeLabel}
      </button>
      <button
        onClick={onDismiss}
        style={{
          fontSize: '0.8125rem',
          background: 'transparent',
          border: '1px solid hsl(var(--border))',
          borderRadius: '0.375rem',
          padding: '0.375rem 0.75rem',
          cursor: 'pointer',
          color: 'hsl(var(--muted-foreground))',
        }}
      >
        {dismissLabel}
      </button>
    </div>
  );
}
