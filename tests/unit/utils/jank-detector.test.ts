/**
 * @jest-environment jsdom
 *
 * Self-tests for the jank detector. These act as the regression-meta layer
 * for task #1163: they prove the detector actually flags synchronous
 * heavy work and console "[Violation]" messages so the higher-level
 * integration tests can rely on it.
 */

import { installJankDetector } from '../../utils/jank-detector';

describe('installJankDetector', () => {
  let detector: ReturnType<typeof installJankDetector>;

  afterEach(() => {
    detector?.uninstall();
  });

  it('records nothing for a fast handler', () => {
    detector = installJankDetector({ thresholdMs: 50 });

    const result = detector.runAndMeasure('fast handler', () => {
      // trivial work
      const x = 1 + 1;
      void x;
    });

    expect(result).toBeNull();
    expect(detector.getViolations()).toHaveLength(0);
    expect(() => detector.assertNoJank()).not.toThrow();
  });

  it('flags a synchronous handler that exceeds the threshold', () => {
    detector = installJankDetector({ thresholdMs: 5 });

    const result = detector.runAndMeasure('slow handler', () => {
      // Busy-wait long enough to definitely exceed 5ms even on slow CI.
      const target = performance.now() + 25;
      while (performance.now() < target) {
        // intentional sync busy-wait — simulates jank
      }
    });

    expect(result).not.toBeNull();
    expect(result?.source).toBe('sync-handler');
    expect(result?.durationMs).toBeGreaterThan(5);
    expect(detector.getViolations()).toHaveLength(1);
    expect(() => detector.assertNoJank()).toThrow(/Jank detected/);
    expect(() => detector.assertNoJank()).toThrow(/slow handler/);
  });

  it('captures browser-emitted "[Violation]" console.warn output', () => {
    detector = installJankDetector({ thresholdMs: 50 });

    // Simulate the message Chromium prints in real browser tests.
    console.warn("[Violation] 'click' handler took 312ms");

    const violations = detector.getViolations();
    expect(violations).toHaveLength(1);
    expect(violations[0].source).toBe('console-violation');
    expect(violations[0].label).toContain('[Violation]');
    expect(() => detector.assertNoJank()).toThrow(/Jank detected/);
  });

  it('captures "[Violation]" output from console.error too', () => {
    detector = installJankDetector({ thresholdMs: 50 });
    console.error('[Violation] Forced reflow took 220ms');
    expect(detector.getViolations()).toHaveLength(1);
  });

  it('ignores unrelated console.warn messages', () => {
    detector = installJankDetector({ thresholdMs: 50 });
    console.warn('Just a normal warning');
    expect(detector.getViolations()).toHaveLength(0);
  });

  it('reset() clears recorded violations without uninstalling', () => {
    detector = installJankDetector({ thresholdMs: 1 });
    console.warn('[Violation] something');
    expect(detector.getViolations()).toHaveLength(1);

    detector.reset();
    expect(detector.getViolations()).toHaveLength(0);

    // Still installed: should still capture new violations.
    console.warn('[Violation] again');
    expect(detector.getViolations()).toHaveLength(1);
  });

  it('uninstall() restores the original console methods', () => {
    const originalWarn = console.warn;
    detector = installJankDetector({ thresholdMs: 50 });
    expect(console.warn).not.toBe(originalWarn);

    detector.uninstall();
    expect(console.warn).toBe(originalWarn);
  });

  it('honours the JANK_THRESHOLD_MS environment variable', () => {
    const previous = process.env.JANK_THRESHOLD_MS;
    process.env.JANK_THRESHOLD_MS = '123';
    try {
      detector = installJankDetector();
      expect(detector.thresholdMs).toBe(123);
    } finally {
      if (previous === undefined) {
        delete process.env.JANK_THRESHOLD_MS;
      } else {
        process.env.JANK_THRESHOLD_MS = previous;
      }
    }
  });
});
