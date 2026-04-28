/**
 * Task #1653 — Regression: tour popover stays visible below the fixed top bar.
 *
 * driver.js calls `element.scrollIntoView()` to bring the highlighted element
 * into view, which doesn't account for fixed/sticky topbars.  After each
 * highlight, OnboardingContext should detect any pinned topbar in the DOM and
 * scroll the highlighted element down by that offset (plus a small padding)
 * so the popover/highlight is never occluded.
 *
 * This test mounts the real OnboardingProvider, simulates driver.js calling
 * onHighlighted with a highlighted element that sits underneath a fixed
 * <header>, and asserts that window.scrollBy is called with a negative
 * `top` (i.e. scroll up so the element moves down in the viewport).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

const mockGetActiveIndex = jest.fn(() => 0);
let capturedOnHighlighted: ((...args: any[]) => void) | null = null;

jest.mock('driver.js', () => ({
  driver: jest.fn((config: any) => {
    capturedOnHighlighted = config.onHighlighted;
    const instance = {
      drive: jest.fn(() => {
        if (config.onHighlighted) config.onHighlighted(null, null, null);
      }),
      destroy: jest.fn(() => {
        if (config.onDestroyStarted) config.onDestroyStarted();
      }),
      getActiveIndex: mockGetActiveIndex,
      moveNext: jest.fn(),
    };
    return instance;
  }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(async (method: string) => {
    if (method === 'GET') return { json: async () => ({ progress: [] }) };
    return { json: async () => ({}) };
  }),
  queryClient: { invalidateQueries: jest.fn(), getQueryCache: () => ({ getAll: () => [] }) },
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
import { ALL_TOURS } from '@/content/onboarding/smoke';

function TourStarter({ onReady }: { onReady: (ctx: any) => void }) {
  const ctx = useOnboarding();
  useEffect(() => { onReady(ctx); }, []);
  return null;
}

/**
 * Stub a fixed topbar at the top of the viewport (80px tall).
 */
function installFakeTopbar() {
  const header = document.createElement('header');
  header.setAttribute('data-test-topbar', 'true');
  Object.defineProperty(header, 'getBoundingClientRect', {
    value: () => ({
      top: 0,
      bottom: 80,
      left: 0,
      right: 1024,
      width: 1024,
      height: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  // jsdom's getComputedStyle returns position 'static' by default; pin it
  // explicitly so getTopbarBottom() considers it.
  header.style.position = 'fixed';
  header.style.top = '0px';
  document.body.appendChild(header);
  return header;
}

/**
 * Insert a target element whose first onboarding step's anchor matches it.
 * The element pretends to sit at viewport top (rect.top = 10), i.e. underneath
 * the 80px-tall topbar.
 */
function installFakeAnchor(selector: string) {
  // The selector is `[data-onboarding="manager.core.greeting"]` (or similar).
  // Strip the brackets to get the attribute name + value.
  const match = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
  if (!match) throw new Error(`unsupported selector for fake anchor: ${selector}`);
  const [, attrName, attrValue] = match;
  const el = document.createElement('div');
  el.setAttribute(attrName, attrValue);
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      top: 10,
      bottom: 50,
      left: 100,
      right: 300,
      width: 200,
      height: 40,
      x: 100,
      y: 10,
      toJSON: () => ({}),
    }),
  });
  document.body.appendChild(el);
  return el;
}

describe('OnboardingContext — topbar-aware scroll correction (Task #1653)', () => {
  let scrollBySpy: jest.SpiedFunction<typeof window.scrollBy>;
  let originalRAF: typeof window.requestAnimationFrame;
  const installedNodes: HTMLElement[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnHighlighted = null;
    mockGetActiveIndex.mockReturnValue(0);
    __setLocation('/');

    // Run rAF callbacks synchronously so the deferred scroll correction
    // executes within the test before assertions.
    originalRAF = window.requestAnimationFrame;
    (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    scrollBySpy = jest
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => undefined as any);
  });

  afterEach(() => {
    scrollBySpy.mockRestore();
    (window as any).requestAnimationFrame = originalRAF;
    while (installedNodes.length) installedNodes.pop()!.remove();
    document.body.innerHTML = '';
  });

  it('scrolls the page up so the highlighted element clears the fixed topbar', async () => {
    jest.useFakeTimers();
    try {
      installedNodes.push(installFakeTopbar());

      // Find a real tour to drive so eligibleSteps[0] resolves to something.
      const tour = ALL_TOURS[0];
      expect(tour).toBeTruthy();
      installedNodes.push(installFakeAnchor(tour.steps[0].anchor));

      let capturedCtx: any = null;
      await act(async () => {
        render(
          <OnboardingProvider>
            <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
          </OnboardingProvider>,
        );
      });

      await act(async () => {
        capturedCtx.start(tour.tourId);
      });

      // Drain the ~60ms timeout used to let driver.js's scroll settle.
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(scrollBySpy).toHaveBeenCalled();
      });

      // The element sits at top=10 underneath an 80px topbar; after a 16px
      // pad the required top is 96, so we must scroll up by at least 86px
      // (top of element moves down by that amount → window scrollBy is
      // negative).
      const calls = scrollBySpy.mock.calls;
      const last = calls[calls.length - 1][0] as ScrollToOptions;
      expect(last.top).toBeLessThan(0);
      expect(Math.abs(last.top!)).toBeGreaterThanOrEqual(80);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does NOT scroll when no fixed topbar is present', async () => {
    jest.useFakeTimers();
    try {
      // No header installed.
      const tour = ALL_TOURS[0];
      installedNodes.push(installFakeAnchor(tour.steps[0].anchor));

      let capturedCtx: any = null;
      await act(async () => {
        render(
          <OnboardingProvider>
            <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
          </OnboardingProvider>,
        );
      });

      await act(async () => {
        capturedCtx.start(tour.tourId);
      });

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // The anchor sits at top=10. With no topbar the requiredTop is just the
      // 16px default padding, so a 6px correction may still happen — but it
      // must be modest (≤ 16px). The strict regression we care about is that
      // a phantom 80+ px scroll does NOT occur.
      for (const [opts] of scrollBySpy.mock.calls) {
        const o = opts as ScrollToOptions;
        if (typeof o.top === 'number') {
          expect(Math.abs(o.top)).toBeLessThanOrEqual(16);
        }
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('does NOT mistake a non-fixed in-flow <header> for a topbar', async () => {
    // Regression: an earlier draft of getTopbarBottom() treated ANY <header>
    // element near the top of the viewport as a pinned topbar.  A normal
    // page header that scrolls with content (no fixed/sticky position) must
    // NOT trigger a large scroll correction.
    jest.useFakeTimers();
    try {
      // Install a header whose getComputedStyle reports `position: static`.
      const header = document.createElement('header');
      // Explicitly empty style → jsdom getComputedStyle returns 'static'.
      Object.defineProperty(header, 'getBoundingClientRect', {
        value: () => ({
          top: 0,
          bottom: 80,
          left: 0,
          right: 1024,
          width: 1024,
          height: 80,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      document.body.appendChild(header);
      installedNodes.push(header);

      const tour = ALL_TOURS[0];
      installedNodes.push(installFakeAnchor(tour.steps[0].anchor));

      let capturedCtx: any = null;
      await act(async () => {
        render(
          <OnboardingProvider>
            <TourStarter onReady={(ctx) => { capturedCtx = ctx; }} />
          </OnboardingProvider>,
        );
      });

      await act(async () => {
        capturedCtx.start(tour.tourId);
      });

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // No 80px correction should happen because the in-flow header isn't
      // pinned (computed position is 'static'). A small ≤16px correction for
      // the default padding is acceptable.
      for (const [opts] of scrollBySpy.mock.calls) {
        const o = opts as ScrollToOptions;
        if (typeof o.top === 'number') {
          expect(Math.abs(o.top)).toBeLessThanOrEqual(16);
        }
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
