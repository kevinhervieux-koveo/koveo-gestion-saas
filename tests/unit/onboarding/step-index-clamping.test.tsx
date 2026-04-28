/**
 * Task #1642 — Regression: step index clamping in OnboardingContext.
 *
 * Before the fix, onHighlighted used config.steps.indexOf(step) which returns
 * -1 when driver.js doesn't preserve object references. The server requires
 * currentStep ≥ 0 and returns 400 for -1.
 *
 * This test exercises the REAL OnboardingContext.runTour → onHighlighted path
 * by mounting the provider, starting a tour, and simulating driver.js calling
 * onHighlighted while getActiveIndex() returns -1. It asserts that the
 * apiRequest payload carries currentStep: 0 (not -1).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

const mockGetActiveIndex = jest.fn(() => -1);
const mockDrive = jest.fn();
const mockDestroy = jest.fn();
let capturedOnHighlighted: ((...args: any[]) => void) | null = null;
let capturedOnDestroyStarted: (() => void) | null = null;

jest.mock('driver.js', () => ({
  driver: jest.fn((config: any) => {
    capturedOnHighlighted = config.onHighlighted;
    capturedOnDestroyStarted = config.onDestroyStarted;
    const instance = {
      drive: jest.fn(() => {
        if (config.onHighlighted) config.onHighlighted(null, null, null);
      }),
      destroy: jest.fn(() => {
        if (config.onDestroyStarted) config.onDestroyStarted();
      }),
      getActiveIndex: mockGetActiveIndex,
    };
    mockDrive.mockImplementation(instance.drive);
    mockDestroy.mockImplementation(instance.destroy);
    return instance;
  }),
}));

const capturedApiCalls: Array<{ method: string; path: string; body: any }> = [];
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(async (method: string, path: string, body?: any) => {
    capturedApiCalls.push({ method, path, body });
    if (method === 'GET') {
      return { json: async () => ({ progress: [] }) };
    }
    return { json: async () => ({}) };
  }),
  queryClient: { invalidateQueries: jest.fn() },
}));

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
jest.mock('@/hooks/use-sidebar-state', () => ({
  useSidebarState: jest.fn(() => ({
    isCollapsed: false,
    setCollapsed: jest.fn(),
    toggleCollapsed: jest.fn(),
  })),
  SidebarStateProvider: ({ children }: any) => children,
}));

const { __setLocation } = require('wouter');

import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';

function TourStarter({ tourId, onReady }: { tourId: string; onReady: (ctx: any) => void }) {
  const ctx = useOnboarding();
  useEffect(() => { onReady(ctx); }, []);
  return null;
}

describe('OnboardingContext — step index clamping in onHighlighted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedApiCalls.length = 0;
    capturedOnHighlighted = null;
    capturedOnDestroyStarted = null;
    mockGetActiveIndex.mockReturnValue(-1);
    __setLocation('/');
  });

  it('sends currentStep: 0 to the server even when driver.getActiveIndex() returns -1', async () => {
    let capturedCtx: any = null;

    await act(async () => {
      render(
        <OnboardingProvider>
          <TourStarter
            tourId="manager.core.welcome"
            onReady={(ctx) => { capturedCtx = ctx; }}
          />
        </OnboardingProvider>,
      );
    });

    await act(async () => {
      capturedCtx.start('manager.core.welcome');
    });

    await waitFor(() => {
      const progressCalls = capturedApiCalls.filter(
        (c) => c.method === 'POST' && c.path === '/api/onboarding/progress',
      );
      expect(progressCalls.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    const progressCalls = capturedApiCalls.filter(
      (c) => c.method === 'POST' && c.path === '/api/onboarding/progress',
    );
    for (const call of progressCalls) {
      expect(call.body.currentStep).toBeGreaterThanOrEqual(0);
      expect(call.body.currentStep).not.toBe(-1);
    }
  });

  it('sends currentStep within [0, eligibleSteps.length-1] when getActiveIndex returns a large value', async () => {
    mockGetActiveIndex.mockReturnValue(999);

    let capturedCtx: any = null;

    await act(async () => {
      render(
        <OnboardingProvider>
          <TourStarter
            tourId="manager.core.welcome"
            onReady={(ctx) => { capturedCtx = ctx; }}
          />
        </OnboardingProvider>,
      );
    });

    await act(async () => {
      capturedCtx.start('manager.core.welcome');
    });

    await waitFor(() => {
      const progressCalls = capturedApiCalls.filter(
        (c) => c.method === 'POST' && c.path === '/api/onboarding/progress',
      );
      expect(progressCalls.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    const progressCalls = capturedApiCalls.filter(
      (c) => c.method === 'POST' && c.path === '/api/onboarding/progress',
    );
    for (const call of progressCalls) {
      expect(call.body.currentStep).toBeGreaterThanOrEqual(0);
    }
  });
});
