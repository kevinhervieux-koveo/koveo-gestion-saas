/**
 * Task #1642 — Regression: start(tourId) navigates to entryPath when needed.
 *
 * Before the fix, start() called runTour() immediately on whatever page was
 * active. When called from /settings/onboarding, none of the tour anchors
 * existed in the DOM, so the visibleIf predicates filtered out all steps and
 * the tour collapsed to a single unanchored popover (or 0 popovers).
 *
 * The fix adds an `entryPath` field to TourContent and makes start() navigate
 * to that route before launching the tour. The pending tour is stored in
 * pendingTourStartRef and consumed by the location effect once the navigation
 * completes.
 *
 * This file contains two suites:
 *
 *  A) Static content assertions — every shipped tour has an `entryPath`, and
 *     the expected route values match the app's routing table. These ensure
 *     the navigation guard always has data to act on.
 *
 *  B) Runtime behaviour tests — render the real OnboardingProvider, call
 *     start() from a mismatched route, and assert that:
 *       - driver() constructor is NOT called immediately (deferred launch), and
 *       - driver() constructor IS called immediately when already on entryPath.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

// ── Mock driver.js ───────────────────────────────────────────────────────────
const mockDriverConstructor = jest.fn();
jest.mock('driver.js', () => ({
  driver: jest.fn((...args: any[]) => {
    mockDriverConstructor(...args);
    return {
      drive: jest.fn(),
      destroy: jest.fn(),
      getActiveIndex: jest.fn(() => 0),
    };
  }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(async () => ({ json: async () => ({ progress: [] }) })),
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock('@/hooks/use-language', () => ({ useLanguage: () => ({ language: 'en' }) }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/lib/onboarding-flag', () => ({ ONBOARDING_ENABLED: true }));

const { __setLocation } = require('wouter');

import { ALL_TOURS } from '@/content/onboarding/smoke';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';

// Helper that renders OnboardingProvider and exposes the context value.
function TourStarter({ onReady }: { onReady: (ctx: ReturnType<typeof useOnboarding>) => void }) {
  const ctx = useOnboarding();
  useEffect(() => { onReady(ctx); }, []);
  return null;
}

const SETTINGS_ONBOARDING_PATH = '/settings/onboarding';

// ── Suite A: static content assertions ──────────────────────────────────────

describe('TourContent.entryPath — presence and expected values', () => {
  describe('every shipped tour must declare an entryPath', () => {
    it.each(ALL_TOURS.map((t) => [t.tourId, t.entryPath]))(
      '%s has a non-empty entryPath',
      (_tourId, entryPath) => {
        expect(typeof entryPath).toBe('string');
        expect((entryPath as string).length).toBeGreaterThan(0);
      },
    );
  });

  describe('entryPath values match expected app routes', () => {
    const byId = Object.fromEntries(ALL_TOURS.map((t) => [t.tourId, t.entryPath]));

    it('smoke tour → /', () => expect(byId['onboarding.smoke']).toBe('/'));
    it('welcome tour → /', () => expect(byId['manager.core.welcome']).toBe('/'));
    it('buildings tour → /buildings', () => expect(byId['manager.core.buildings']).toBe('/buildings'));
    it('invitations tour → /invitations', () => expect(byId['manager.core.invitations']).toBe('/invitations'));
    it('financials tour → /buildings', () => expect(byId['manager.core.financials']).toBe('/buildings'));
    it('requests tour → /demands', () => expect(byId['manager.core.requests']).toBe('/demands'));
    it('communications tour → /communications', () => expect(byId['manager.core.communications']).toBe('/communications'));
    it('settings tour → /settings', () => expect(byId['manager.core.settings']).toBe('/settings'));
  });

  describe('every tour requires navigation when started from the catalog page', () => {
    it.each(ALL_TOURS.map((t) => [t.tourId, t.entryPath]))(
      '%s has an entryPath that differs from /settings/onboarding',
      (_tourId, entryPath) => {
        expect(entryPath).not.toBe(SETTINGS_ONBOARDING_PATH);
      },
    );
  });
});

// ── Suite B: runtime start() behaviour ──────────────────────────────────────

describe('OnboardingProvider.start() — deferred vs immediate launch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT call driver() immediately when started from the wrong route', async () => {
    // Start from /settings/onboarding while the welcome tour expects /
    __setLocation(SETTINGS_ONBOARDING_PATH);

    let capturedCtx: ReturnType<typeof useOnboarding> | null = null;

    await act(async () => {
      render(
        <OnboardingProvider>
          <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
        </OnboardingProvider>,
      );
    });

    mockDriverConstructor.mockClear();

    await act(async () => {
      capturedCtx!.start('manager.core.welcome');
    });

    // driver() must NOT be called yet — the tour is pending navigation to /
    expect(mockDriverConstructor).not.toHaveBeenCalled();
  });

  it('calls driver() immediately when already on the tour entryPath', async () => {
    // The welcome tour's entryPath is /, so starting from / should launch
    __setLocation('/');

    let capturedCtx: ReturnType<typeof useOnboarding> | null = null;

    await act(async () => {
      render(
        <OnboardingProvider>
          <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
        </OnboardingProvider>,
      );
    });

    mockDriverConstructor.mockClear();

    await act(async () => {
      capturedCtx!.start('manager.core.welcome');
    });

    // driver() must be called — location already matches entryPath
    expect(mockDriverConstructor).toHaveBeenCalled();
  });

  it('sets location to entryPath when navigation is needed', async () => {
    __setLocation(SETTINGS_ONBOARDING_PATH);

    const { __getLocation } = require('wouter');
    let capturedCtx: ReturnType<typeof useOnboarding> | null = null;

    await act(async () => {
      render(
        <OnboardingProvider>
          <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
        </OnboardingProvider>,
      );
    });

    await act(async () => {
      capturedCtx!.start('manager.core.buildings');
    });

    // After start(), location should have been updated to the tour's entryPath
    expect(__getLocation()).toBe('/buildings');
  });

  it('launches driver after the pending navigation completes (location effect)', async () => {
    // Start from the wrong route to force deferred launch.
    __setLocation(SETTINGS_ONBOARDING_PATH);

    let capturedCtx: ReturnType<typeof useOnboarding> | null = null;

    const { rerender } = render(
      <OnboardingProvider>
        <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
      </OnboardingProvider>,
    );

    await act(async () => {});

    mockDriverConstructor.mockClear();

    // start() from wrong route → deferred; navigate is called → mockLocation = '/buildings'
    await act(async () => {
      capturedCtx!.start('manager.core.buildings');
    });

    expect(mockDriverConstructor).not.toHaveBeenCalled();

    // Simulate route change completing: re-render the same tree so the
    // location effect in OnboardingProvider sees the updated location value.
    await act(async () => {
      rerender(
        <OnboardingProvider>
          <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
        </OnboardingProvider>,
      );
    });

    // The location effect schedules runTour via setTimeout(400ms).
    // waitFor polls until driver() fires (up to 2s).
    await waitFor(() => {
      expect(mockDriverConstructor).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
});
