/**
 * Task #1652 — Automated coverage for the cross-page tour navigation engine
 * wired up in Task #1650.
 *
 * Three suites in one file (single jest.mock() set keeps the module graph
 * consistent across the file):
 *
 *  A) `resolveEntryPath` helper — unit tests covering pass-through, the
 *     `:buildingId` placeholder substitution, the multi-key cache scan,
 *     and the fall-back behavior when no buildings are cached.
 *
 *  B) `onNextClick` cross-page branch — integration test that mounts the
 *     real OnboardingProvider, starts the buildings tour, simulates a
 *     "Next" click that should cross from /manager/buildings to
 *     /manager/residences, and asserts that:
 *       - `setLocation` is called with the next step's resolved entryPath
 *       - the previous driver instance is destroyed (pause-for-nav)
 *       - the resumed tour starts on the step whose `id` was queued in
 *         `pendingTourStartRef.fromStepId` (resolved against the new page's
 *         eligibleSteps).
 *
 *  C) Sidebar `preTourCollapsedRef` save-and-restore cycle — verifies that
 *     `setCollapsed(true)` fires when a tour starts and that the user's
 *     prior preference (read from localStorage) is restored when the tour
 *     ends naturally via onDestroyStarted.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

// ── Driver.js mock ─────────────────────────────────────────────────────────
// Each `driver()` call captures its config so tests can invoke the lifecycle
// callbacks (onNextClick / onDestroyStarted / onHighlighted) directly.

interface CapturedDriver {
  config: any;
  drive: jest.Mock;
  destroy: jest.Mock;
  moveNext: jest.Mock;
  getActiveIndex: jest.Mock;
}
const capturedDrivers: CapturedDriver[] = [];
let mockActiveIndex = 0;

jest.mock('driver.js', () => ({
  driver: jest.fn((config: any) => {
    const instance: CapturedDriver = {
      config,
      drive: jest.fn(),
      destroy: jest.fn(),
      moveNext: jest.fn(),
      getActiveIndex: jest.fn(() => mockActiveIndex),
    };
    capturedDrivers.push(instance);
    return instance;
  }),
}));

// ── Mocked queryClient with a controllable getQueryCache ───────────────────
type FakeQuery = { queryKey: unknown[]; state: { data: unknown } };
let fakeQueries: FakeQuery[] = [];
const mockInvalidateQueries = jest.fn();

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(async () => ({ json: async () => ({ progress: [] }) })),
  queryClient: {
    invalidateQueries: (...args: any[]) => mockInvalidateQueries(...args),
    getQueryCache: () => ({ getAll: () => fakeQueries }),
  },
}));

// ── Other context-required mocks ───────────────────────────────────────────
jest.mock('@/hooks/use-language', () => ({ useLanguage: () => ({ language: 'en' }) }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/lib/onboarding-flag', () => ({ ONBOARDING_ENABLED: true }));
jest.mock('@/hooks/use-mobile-menu', () => ({
  useMobileMenu: jest.fn(() => ({
    isMobileMenuOpen: false,
    toggleMobileMenu: jest.fn(),
    closeMobileMenu: jest.fn(),
  })),
  MobileMenuProvider: ({ children }: any) => children,
}));

// Keep a single setCollapsed jest fn so suite C can assert on it.
const sidebarSetCollapsedMock = jest.fn();
jest.mock('@/hooks/use-sidebar-state', () => ({
  useSidebarState: jest.fn(() => ({
    isCollapsed: false,
    setCollapsed: sidebarSetCollapsedMock,
    toggleCollapsed: jest.fn(),
  })),
  SidebarStateProvider: ({ children }: any) => children,
}));

const { __setLocation, __getLocation, __resetMocks } = require('wouter');

// Real imports come AFTER the mocks above so the mocks are wired in.
import {
  OnboardingProvider,
  useOnboarding,
  resolveEntryPath,
} from '@/contexts/OnboardingContext';
import { ALL_TOURS } from '@/content/onboarding/smoke';
import { BUILDINGS_TOUR } from '@/content/onboarding/manager/buildings';

// ─────────────────────────────────────────────────────────────────────────
// Suite A: resolveEntryPath
// ─────────────────────────────────────────────────────────────────────────

describe('resolveEntryPath', () => {
  beforeEach(() => {
    fakeQueries = [];
  });

  it('returns the input unchanged when no :buildingId placeholder is present', () => {
    expect(resolveEntryPath('/manager/buildings')).toBe('/manager/buildings');
    expect(resolveEntryPath('/manager/residences')).toBe('/manager/residences');
    expect(resolveEntryPath('/')).toBe('/');
  });

  it('substitutes :buildingId with the first building id from the cache', () => {
    fakeQueries = [
      {
        queryKey: ['/api/manager/buildings'],
        state: { data: { buildings: [{ id: 'bld-abc' }, { id: 'bld-def' }] } },
      },
    ];
    expect(resolveEntryPath('/manager/buildings/:buildingId/residences')).toBe(
      '/manager/buildings/bld-abc/residences',
    );
  });

  it('finds the cache entry even when the queryKey has extra segments (e.g. organizationId)', () => {
    fakeQueries = [
      {
        // Different key shape that the engine must still recognize.
        queryKey: ['/api/manager/buildings', 'org-1'],
        state: { data: { buildings: [{ id: 'bld-org1-first' }] } },
      },
    ];
    expect(resolveEntryPath('/manager/buildings/:buildingId')).toBe(
      '/manager/buildings/bld-org1-first',
    );
  });

  it('strips the :buildingId segment when no cached buildings are available', () => {
    // No queries cached at all.
    fakeQueries = [];
    expect(resolveEntryPath('/manager/buildings/:buildingId/residences')).toBe(
      '/manager/buildings/residences',
    );
  });

  it('strips the :buildingId segment when cached buildings array is empty', () => {
    fakeQueries = [
      {
        queryKey: ['/api/manager/buildings'],
        state: { data: { buildings: [] } },
      },
    ];
    expect(resolveEntryPath('/manager/buildings/:buildingId')).toBe('/manager/buildings');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Helpers shared by suites B and C
// ─────────────────────────────────────────────────────────────────────────

function TourHarness({ onReady }: { onReady: (ctx: ReturnType<typeof useOnboarding>) => void }) {
  const ctx = useOnboarding();
  useEffect(() => {
    onReady(ctx);
  }, []);
  return null;
}

/**
 * Mounts every `data-onboarding` anchor referenced by the buildings tour so
 * none of the visibleIf predicates filter out steps. Without this the tour
 * would collapse to a single step and the cross-page branch never fires.
 */
function mountBuildingsTourAnchors() {
  const ids = [
    'nav.buildings',
    'buildings.new-btn',
    'building.residences-tab',
    'residences.new-btn',
    'residence.link-user-btn',
    'residence.row-unlink-btn',
    'building.delete-btn',
  ];
  const root = document.createElement('div');
  for (const id of ids) {
    const el = document.createElement('div');
    el.setAttribute('data-onboarding', id);
    root.appendChild(el);
  }
  document.body.appendChild(root);
  return () => {
    document.body.removeChild(root);
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Suite B: onNextClick cross-page branch
// ─────────────────────────────────────────────────────────────────────────

describe('OnboardingContext — onNextClick cross-page navigation', () => {
  let cleanupAnchors: (() => void) | null = null;

  beforeEach(() => {
    capturedDrivers.length = 0;
    mockActiveIndex = 0;
    fakeQueries = [];
    sidebarSetCollapsedMock.mockClear();
    __resetMocks();
    cleanupAnchors = mountBuildingsTourAnchors();
  });

  afterEach(() => {
    cleanupAnchors?.();
    cleanupAnchors = null;
  });

  it('navigates to the next step entryPath, destroys the active driver, and resumes from fromStepId', async () => {
    // The buildings tour expects /manager/buildings.  Steps 0-2 share that
    // route; step 3 ('bld.create-residence') jumps to /manager/residences.
    __setLocation('/manager/buildings');

    let capturedCtx: ReturnType<typeof useOnboarding> | null = null;
    const renderTree = (
      <OnboardingProvider>
        <TourHarness onReady={(ctx) => { capturedCtx = ctx; }} />
      </OnboardingProvider>
    );

    let rerender: (ui: React.ReactElement) => void;
    await act(async () => {
      const result = render(renderTree);
      rerender = result.rerender;
    });

    // Sanity: tour has the cross-page step we depend on.
    const crossStep = BUILDINGS_TOUR.steps.find((s) => s.id === 'bld.create-residence');
    expect(crossStep?.entryPath).toBe('/manager/residences');

    await act(async () => {
      capturedCtx!.start('manager.core.buildings');
    });

    // The first driver instance is the one launched on /manager/buildings.
    const firstDriver = capturedDrivers[capturedDrivers.length - 1];
    expect(firstDriver).toBeDefined();

    // Position the active index on 'bld.residences-tab' (index 2 of the
    // eligible steps when all anchors are mounted) so the engine's scan
    // forward lands on 'bld.create-residence' which is on /manager/residences.
    mockActiveIndex = 2;

    // Trigger the engine's onNextClick branch directly.
    await act(async () => {
      firstDriver.config.onNextClick();
    });

    // The engine paused the active driver and asked the router to navigate.
    expect(firstDriver.destroy).toHaveBeenCalled();
    expect(__getLocation()).toBe('/manager/residences');

    // The wouter mock updates location synchronously but does not push a
    // re-render through React. Re-render the provider so its location effect
    // observes the new value and consumes pendingTourStartRef.
    await act(async () => {
      rerender!(
        <OnboardingProvider>
          <TourHarness onReady={(ctx) => { capturedCtx = ctx; }} />
        </OnboardingProvider>,
      );
    });

    // The location effect schedules runTour after a short settle delay.
    // Wait for a brand-new driver instance to appear.
    await waitFor(() => {
      expect(capturedDrivers.length).toBeGreaterThan(1);
    }, { timeout: 2000 });

    const resumedDriver = capturedDrivers[capturedDrivers.length - 1];
    expect(resumedDriver).not.toBe(firstDriver);

    // The resumed driver was constructed with steps that include the
    // bld.create-residence anchor, and `drive(startIdx)` was called with the
    // index that maps to that step within the new page's eligible steps.
    expect(resumedDriver.drive).toHaveBeenCalled();
    const driveArg = resumedDriver.drive.mock.calls[0]?.[0];

    // Reproduce the engine's eligibleSteps filtering on the new page so the
    // expected index is independent of the tour's exact ordering.
    const eligibleOnResume = BUILDINGS_TOUR.steps.filter(
      (s) => typeof s.visibleIf !== 'function' || s.visibleIf(),
    );
    const expectedIdx = eligibleOnResume.findIndex((s) => s.id === 'bld.create-residence');
    expect(expectedIdx).toBeGreaterThanOrEqual(0);
    expect(driveArg).toBe(expectedIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Suite C: sidebar preTourCollapsedRef save-and-restore cycle
// ─────────────────────────────────────────────────────────────────────────

describe('OnboardingContext — sidebar collapse save-and-restore', () => {
  let cleanupAnchors: (() => void) | null = null;

  beforeEach(() => {
    capturedDrivers.length = 0;
    mockActiveIndex = 0;
    sidebarSetCollapsedMock.mockClear();
    __resetMocks();
    window.localStorage.clear();
    cleanupAnchors = mountBuildingsTourAnchors();
  });

  afterEach(() => {
    cleanupAnchors?.();
    cleanupAnchors = null;
    window.localStorage.clear();
  });

  it('collapses the sidebar on tour start and restores the prior preference on natural completion', async () => {
    // User had the sidebar EXPANDED before the tour.
    window.localStorage.setItem('sidebar-collapsed', 'false');
    __setLocation('/manager/buildings');

    let capturedCtx: ReturnType<typeof useOnboarding> | null = null;

    await act(async () => {
      render(
        <OnboardingProvider>
          <TourHarness onReady={(ctx) => { capturedCtx = ctx; }} />
        </OnboardingProvider>,
      );
    });

    sidebarSetCollapsedMock.mockClear();

    await act(async () => {
      capturedCtx!.start('manager.core.buildings');
    });

    // First post-start call must collapse the sidebar.
    expect(sidebarSetCollapsedMock).toHaveBeenCalled();
    expect(sidebarSetCollapsedMock.mock.calls[0]?.[0]).toBe(true);

    // Drive the tour to its last step and trigger natural completion.
    const activeDriver = capturedDrivers[capturedDrivers.length - 1];
    expect(activeDriver).toBeDefined();

    const eligibleCount = BUILDINGS_TOUR.steps.filter(
      (s) => typeof s.visibleIf !== 'function' || s.visibleIf(),
    ).length;
    mockActiveIndex = eligibleCount - 1;

    sidebarSetCollapsedMock.mockClear();

    await act(async () => {
      activeDriver.config.onDestroyStarted();
    });

    // The engine must restore the user's pre-tour preference (false here).
    expect(sidebarSetCollapsedMock).toHaveBeenCalledWith(false);
  });

  it('restores collapsed=true when that was the user pre-tour preference', async () => {
    // User had the sidebar COLLAPSED before the tour.
    window.localStorage.setItem('sidebar-collapsed', 'true');
    __setLocation('/manager/buildings');

    let capturedCtx: ReturnType<typeof useOnboarding> | null = null;

    await act(async () => {
      render(
        <OnboardingProvider>
          <TourHarness onReady={(ctx) => { capturedCtx = ctx; }} />
        </OnboardingProvider>,
      );
    });

    sidebarSetCollapsedMock.mockClear();

    await act(async () => {
      capturedCtx!.start('manager.core.buildings');
    });

    // Tour-start branch still calls setCollapsed(true) — the user's
    // preference is captured separately for restoration.
    expect(sidebarSetCollapsedMock).toHaveBeenCalledWith(true);

    const activeDriver = capturedDrivers[capturedDrivers.length - 1];
    const eligibleCount = BUILDINGS_TOUR.steps.filter(
      (s) => typeof s.visibleIf !== 'function' || s.visibleIf(),
    ).length;
    mockActiveIndex = eligibleCount - 1;

    sidebarSetCollapsedMock.mockClear();

    await act(async () => {
      activeDriver.config.onDestroyStarted();
    });

    // Pre-tour preference (true) must be restored.
    expect(sidebarSetCollapsedMock).toHaveBeenCalledWith(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Suite D: every shipped tour exposes a deterministic step graph
// ─────────────────────────────────────────────────────────────────────────
// Light static guard: ensure the tours we built navigation logic around
// still expose unique step ids (the engine's fromStepId resolution depends
// on this) and that any per-step entryPath references a non-empty path.

describe('Onboarding tour content — invariants the navigation engine relies on', () => {
  it.each(ALL_TOURS.map((t) => [t.tourId, t]))(
    '%s has unique step ids and valid per-step entryPaths',
    (_tourId, tour: any) => {
      const ids = tour.steps.map((s: any) => s.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);

      for (const step of tour.steps) {
        if (step.entryPath !== undefined) {
          expect(typeof step.entryPath).toBe('string');
          expect((step.entryPath as string).length).toBeGreaterThan(0);
        }
      }
    },
  );
});
