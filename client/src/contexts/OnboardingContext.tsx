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
 *
 * Enhancements (Task #1650):
 *  5. Per-step entryPath: steps can declare their own route; the engine
 *     auto-navigates between pages as the tour advances.
 *  6. Page scrolling: the sidebar drawer is closed on tour start so
 *     body overflow-hidden doesn't block wheel/touch events.
 *  7. Sidebar auto-collapse: the desktop sidebar collapses when a tour starts
 *     and is restored to the user's prior preference when the tour ends.
 *
 * Bug fix (Task #1653):
 *  8. Topbar-aware scroll correction: driver.js calls element.scrollIntoView()
 *     which doesn't account for fixed/sticky top bars.  After each highlight
 *     we measure any pinned topbar in the DOM and scroll the highlighted
 *     element down by that offset so the popover is never occluded.
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
import type { OnboardingStep } from '@/content/onboarding/types';
import { useToast } from '@/hooks/use-toast';
import { useSidebarState } from '@/hooks/use-sidebar-state';
import { useMobileMenu } from '@/hooks/use-mobile-menu';

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

/**
 * Default top offset used when no fixed/sticky topbar is detected. This keeps
 * the highlighted element from sitting flush against the viewport edge after
 * driver.js scrolls it into view.
 */
const DEFAULT_TOPBAR_PADDING_PX = 16;

/**
 * Maximum reasonable height for a topbar.  We ignore any candidate element
 * taller than this so a full-height side-drawer (mobile sidebar overlay) never
 * gets mistaken for a topbar.
 */
const MAX_TOPBAR_HEIGHT_PX = 200;

/**
 * Find the visible bottom edge (in viewport coordinates) of any fixed or
 * sticky topbar pinned to the top of the viewport.  Returns 0 if none.
 *
 * Detection rules:
 *  - The element must be visible and at most MAX_TOPBAR_HEIGHT_PX tall.
 *  - Its top edge must be at (or within 8px of) the viewport top.
 *  - It must be "pinned" — i.e. computed `position` is `fixed` or `sticky`,
 *    OR it carries an explicit topbar marker (`[data-topbar]` or
 *    `[data-onboarding="topbar"]`).  A bare `<header>` that just happens to
 *    be near the top of the viewport (e.g. a normal in-flow page header that
 *    scrolls with content) is NOT treated as a topbar — that would cause
 *    the scroll correction to fire on pages where nothing is actually
 *    occluding the highlight.
 */
function getTopbarBottom(): number {
  if (typeof document === 'undefined') return 0;

  const candidates = new Set<Element>();
  document.querySelectorAll('header').forEach((el) => candidates.add(el));
  // Common topbar markers used in the app layout.
  document
    .querySelectorAll('[data-onboarding="topbar"], [data-topbar], .sticky')
    .forEach((el) => candidates.add(el));

  let maxBottom = 0;
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 || rect.height > MAX_TOPBAR_HEIGHT_PX) continue;
    // Only consider elements anchored at the top of the viewport.
    if (rect.top > 8) continue;
    const hasTopbarMarker =
      el.hasAttribute('data-topbar') ||
      el.getAttribute('data-onboarding') === 'topbar';
    const isPinned =
      style.position === 'fixed' ||
      style.position === 'sticky' ||
      hasTopbarMarker;
    if (!isPinned) continue;
    if (rect.bottom > maxBottom) maxBottom = rect.bottom;
  }
  return maxBottom;
}

/**
 * Walk up from `el` to find the nearest scrollable ancestor.  Falls back to
 * `window` when no inner scroll container is found (page-level scrolling).
 */
function findScrollableAncestor(el: HTMLElement): HTMLElement | Window {
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

/**
 * After driver.js scrolls a highlighted element into view, ensure it sits
 * below any fixed top bar.  Driver.js calls `element.scrollIntoView()` which
 * doesn't account for fixed overlays, so on small viewports (or when a step
 * targets an element near the top of the page) the popover/highlight can be
 * hidden under the topbar.  We measure the topbar height at runtime and
 * scroll the relevant container up by the deficit, then dispatch a `scroll`
 * event so driver.js repositions the popover.
 *
 * Task #1653.
 */
function applyTopbarScrollCorrection(anchor: string): void {
  if (typeof document === 'undefined') return;
  let target: HTMLElement | null;
  try {
    target = document.querySelector(anchor) as HTMLElement | null;
  } catch {
    // Invalid selector — bail silently.
    return;
  }
  if (!target) return;

  const topbarBottom = getTopbarBottom();
  const requiredTop = topbarBottom + DEFAULT_TOPBAR_PADDING_PX;
  const rect = target.getBoundingClientRect();
  if (rect.top >= requiredTop) return;

  const offset = requiredTop - rect.top;
  const scrollable = findScrollableAncestor(target);
  if (scrollable === window) {
    window.scrollBy({ top: -offset, behavior: 'auto' });
  } else {
    (scrollable as HTMLElement).scrollTop -= offset;
    // Driver.js only listens to `window` scroll events to reposition the
    // popover, so nudge it here when we scrolled an inner container.
    window.dispatchEvent(new Event('scroll'));
  }
}

/**
 * Resolve a step entryPath that may contain placeholders.
 * Currently supports `:buildingId` which is substituted with the first
 * building id found in the manager's query cache at call time.
 *
 * The buildings endpoint may be cached under several query key variants
 * (e.g. with or without an `organizationId` segment).  We scan all matching
 * queries so the resolution works regardless of which variant was populated.
 *
 * Response shape from `/api/manager/buildings`: `{ buildings: [...] }`
 */
export function resolveEntryPath(entryPath: string): string {
  if (!entryPath.includes(':buildingId')) return entryPath;
  try {
    // Scan all query-cache entries whose key starts with '/api/manager/buildings'
    // to handle key variants like ['/api/manager/buildings'] and
    // ['/api/manager/buildings', organizationId].
    const allQueries = queryClient.getQueryCache().getAll();
    for (const q of allQueries) {
      const key = q.queryKey;
      if (Array.isArray(key) && key[0] === '/api/manager/buildings') {
        // Server response is `{ buildings: Array<{ id: string; ... }> }`
        const data = q.state.data as { buildings?: Array<{ id: string }> } | undefined;
        const firstId = data?.buildings?.[0]?.id;
        if (firstId) return entryPath.replace(':buildingId', firstId);
      }
    }
  } catch {
    // query cache unavailable — strip the placeholder segment so the path
    // still resolves to a navigable route (e.g. /manager/buildings).
  }
  return entryPath.replace(/\/:buildingId/g, '').replace(/:buildingId/g, '');
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { language } = useLanguage();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCollapsed } = useSidebarState();
  const { closeMobileMenu } = useMobileMenu();

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
  const pendingTourStartRef = useRef<{
    tourId: string;
    fromStep: number;
    /** Optional step id (from OnboardingStep.id) to resume from. When set the
     *  location effect re-evaluates eligibleSteps on the new page and finds
     *  the index that matches this id, so cross-page indices stay correct. */
    fromStepId?: string;
  } | null>(null);

  // Stable refs so runTour callbacks always see the latest values without
  // being listed in useCallback deps (which would recreate the driver too often).
  const locationRef = useRef(location);
  const setCollapsedRef = useRef(setCollapsed);
  const closeMobileMenuRef = useRef(closeMobileMenu);

  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { setCollapsedRef.current = setCollapsed; }, [setCollapsed]);
  useEffect(() => { closeMobileMenuRef.current = closeMobileMenu; }, [closeMobileMenu]);

  // Remembers the sidebar collapsed state that was in place before the tour
  // started so we can restore it afterwards.
  const preTourCollapsedRef = useRef<boolean | null>(null);

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

      // ── Sidebar / mobile-menu management ─────────────────────────────────
      // On first call for this tour run, remember the current sidebar state and
      // collapse so tour highlights have more room. The user's preference is
      // restored in onDestroyStarted when the tour truly ends.
      if (preTourCollapsedRef.current === null) {
        const currentCollapsed =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('sidebar-collapsed') === 'true'
            : false;
        preTourCollapsedRef.current = currentCollapsed;
        setCollapsedRef.current(true);
        closeMobileMenuRef.current();
      }

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
        // Restore sidebar since the tour is ending immediately (no navigation pause)
        if (preTourCollapsedRef.current !== null) {
          setCollapsedRef.current(preTourCollapsedRef.current);
          preTourCollapsedRef.current = null;
        }
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
        // ── Cross-page navigation (Task #1650 Step 2) ────────────────────
        // Intercept the next-button click so we can navigate to the next
        // step's page before driver.js advances the highlight.
        //
        // IMPORTANT: We must scan the ORIGINAL tour.steps ordering rather
        // than eligibleSteps, because cross-page steps are filtered OUT of
        // eligibleSteps (their visibleIf returns false on the current page).
        // If we only look at eligibleSteps[nextIdx] we would never see the
        // cross-page steps and would skip them silently.
        onNextClick: () => {
          const currentIdx = d.getActiveIndex() ?? 0;
          const clampedIdx = Math.max(0, Math.min(currentIdx, eligibleSteps.length - 1));
          const currentStep = eligibleSteps[clampedIdx];

          // Find the current step in the original (unfiltered) ordering.
          const allSteps = tour.steps as OnboardingStep[];
          const currentOriginalIdx = allSteps.findIndex((s) => s.id === currentStep.id);

          // Scan original ordering to find the first "actionable" step after
          // the current one.  A step is actionable if it is either:
          //   (a) on a different route  → cross-page navigation needed, or
          //   (b) on the same route AND visible → let driver.js advance.
          // Steps on the same route with visibleIf=false are skipped.
          //
          // Path inheritance: if a step declares no entryPath, it inherits the
          // last RESOLVED path from the previous step in original order.  This
          // is more faithful to the schema contract than falling back to
          // tour.entryPath directly.
          let lastResolvedPath = locationRef.current;
          for (let i = currentOriginalIdx + 1; i < allSteps.length; i++) {
            const s = allSteps[i];
            const sPath = s.entryPath
              ? resolveEntryPath(s.entryPath)
              : lastResolvedPath;
            lastResolvedPath = sPath;

            if (sPath && sPath !== locationRef.current) {
              // (a) Cross-page: pause driver, navigate, resume on new page.
              pendingTourStartRef.current = {
                tourId: tour.tourId,
                fromStep: clampedIdx,
                fromStepId: s.id,
              };
              pausingForNavRef.current = true;
              d.destroy();
              setLocation(sPath);
              return;
            }

            // (b) Same page: if this step is in the current eligible set,
            // driver.js already knows about it — let it advance normally.
            if (eligibleSteps.some((es) => es.id === s.id)) {
              d.moveNext();
              return;
            }

            // Same page but not visible (visibleIf=false) → skip, keep scanning.
          }

          // No more steps anywhere – let driver.js finish the tour.
          d.moveNext();
        },
        onHighlighted: () => {
          // Use driver's canonical cursor instead of indexOf(step) which can
          // return -1 when driver.js doesn't preserve object references.
          const raw = d.getActiveIndex() ?? 0;
          const idx = Math.max(0, Math.min(raw, eligibleSteps.length - 1));
          setCurrentStep(idx);
          lastStepIndexRef.current = idx;
          persistProgress(tour.tourId, 'in_progress', idx, latestVersion);

          // Task #1653 — driver.js's native scrollIntoView() doesn't account
          // for our fixed/sticky top bar.  Once the highlight has rendered,
          // nudge the scroll position so the popover and highlight sit fully
          // below the topbar.  We schedule on rAF + a small timeout so any
          // pending smooth-scroll animation has a chance to settle first.
          const anchor = eligibleSteps[idx]?.anchor;
          if (anchor && typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
              window.setTimeout(() => applyTopbarScrollCorrection(anchor), 60);
            });
          }
        },
        onDestroyStarted: () => {
          const currentIdx = d.getActiveIndex() ?? 0;
          const clampedIdx = Math.max(0, Math.min(currentIdx, eligibleSteps.length - 1));
          const isLast = clampedIdx >= eligibleSteps.length - 1;
          const isPausingForNav = pausingForNavRef.current;
          pausingForNavRef.current = false;

          if (isLast && !isPausingForNav) {
            persistProgress(
              tour.tourId,
              'completed',
              eligibleSteps.length - 1,
              latestVersion,
            );
          }
          setIsActive(false);
          driverRef.current = null;

          // Restore the sidebar to the user's pre-tour preference when the
          // tour truly ends (not on an intermediate navigation pause).
          if (!isPausingForNav && preTourCollapsedRef.current !== null) {
            setCollapsedRef.current(preTourCollapsedRef.current);
            preTourCollapsedRef.current = null;
          }

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
    [language, persistProgress, toast, setLocation],
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
    // After navigating to a tour's entryPath (or a per-step entryPath), launch
    // the pending tour. This must run before the pause-for-navigation logic
    // below so that intentional Start/Restart navigations don't pause immediately.
    if (pendingTourStartRef.current) {
      const { tourId, fromStepId } = pendingTourStartRef.current;
      pendingTourStartRef.current = null;
      const tour = ALL_TOURS.find((t) => t.tourId === tourId);
      if (tour) {
        // After navigating, wait for React to render the new page, then
        // poll for the target anchor up to ~1 s before launching so we
        // don't start driver.js before the element is in the DOM.
        const launch = async () => {
          // Re-apply sidebar/drawer state in case the user re-opened them
          // while the navigation was in flight.
          setCollapsedRef.current(true);
          closeMobileMenuRef.current();

          // Initial settle delay — gives React time to mount the new page.
          await new Promise<void>((r) => setTimeout(r, 300));

          // Re-evaluate eligibleSteps on the new page and find the correct
          // index for the target step. This keeps cross-page indices valid
          // even when the eligible set differs between pages.
          const eligible = (tour.steps as OnboardingStep[]).filter(
            (s) => typeof s.visibleIf !== 'function' || s.visibleIf(),
          );

          let startIdx = 0;
          if (fromStepId) {
            const found = eligible.findIndex((s) => s.id === fromStepId);
            if (found >= 0) {
              startIdx = found;
            } else {
              // The target step's anchor is not visible on this page (its
              // visibleIf predicate returned false). Fall forward to the
              // first eligible step that comes after fromStepId in the
              // original tour.steps ordering — this is the "fall through to
              // the existing visibleIf skip behavior" described in the task.
              const originalIds = (tour.steps as OnboardingStep[]).map((s) => s.id);
              const fromOriginalIdx = originalIds.indexOf(fromStepId);
              const nextAfterFrom = eligible.findIndex((s) => {
                const pos = originalIds.indexOf(s.id);
                return pos > fromOriginalIdx;
              });
              startIdx = nextAfterFrom >= 0 ? nextAfterFrom : 0;
            }
          }

          // Poll for the target anchor: up to ~700 ms in 50 ms increments.
          // This handles pages that render their key elements asynchronously
          // (e.g. after a data fetch). If the anchor never appears, we fall
          // forward to the first step whose anchor IS in the DOM.
          if (eligible[startIdx]) {
            const targetAnchor = eligible[startIdx].anchor;
            const deadline = Date.now() + 700;
            while (!document.querySelector(targetAnchor) && Date.now() < deadline) {
              await new Promise<void>((r) => setTimeout(r, 50));
            }
            // After polling: if the target is still absent, scan forward for
            // any visible step so the tour keeps moving instead of hanging.
            if (!document.querySelector(targetAnchor)) {
              const firstVisible = eligible.findIndex(
                (s, i) => i >= startIdx && document.querySelector(s.anchor),
              );
              if (firstVisible >= 0) startIdx = firstVisible;
            }
          }

          runTour(tour, startIdx);
        };
        launch();
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
