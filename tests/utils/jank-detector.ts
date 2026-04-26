/**
 * Jank detector — a lightweight test harness that catches UI jank
 * regressions before they ship.
 *
 * It guards against two failure modes that previously only surfaced through
 * manual browser inspection (see task #1147 / #1163):
 *
 *   1. Synchronous heavy work inside click / change / keystroke handlers.
 *      Chromium prints "[Violation] 'click' handler took N ms" warnings
 *      when a handler exceeds ~50 ms; jsdom does not, so we measure the
 *      synchronous wall-clock duration of fireEvent ourselves and flag any
 *      handler that exceeds the configured threshold.
 *
 *   2. Direct "[Violation] …" messages emitted to the console by a real
 *      browser test runner (puppeteer / playwright). The detector patches
 *      console.warn / console.error and records anything matching the
 *      pattern so those warnings fail the test instead of silently
 *      polluting CI output.
 *
 * Usage:
 *
 *   const detector = installJankDetector({ thresholdMs: 100 });
 *   await detector.runAndMeasure('type in search', () => {
 *     fireEvent.change(input, { target: { value: 'foo' } });
 *   });
 *   detector.assertNoJank();
 *   detector.uninstall();
 *
 * The default threshold mirrors Chromium's own (50 ms) but can be raised
 * via the JANK_THRESHOLD_MS env var when running on a heavily loaded CI
 * machine. The detector is intentionally framework-agnostic so it can be
 * reused by future manager-page jank tests.
 */

const VIOLATION_PATTERN = /\[Violation\]/i;

export interface JankRecord {
  /** Where the violation came from. */
  source: 'console-violation' | 'sync-handler';
  /** Human-readable label supplied by the caller (or the matched message). */
  label: string;
  /** Synchronous wall-clock duration in ms. 0 for console-sourced violations. */
  durationMs: number;
  /** The configured threshold the handler exceeded (sync-handler only). */
  thresholdMs?: number;
}

export interface JankDetectorOptions {
  /**
   * Maximum allowed synchronous duration of any measured user interaction.
   * Defaults to the JANK_THRESHOLD_MS env var, then 50 ms — matching
   * Chromium's own "[Violation]" threshold.
   */
  thresholdMs?: number;
  /**
   * Console methods to monitor. Defaults to ['warn', 'error'] which is
   * where browsers emit the "[Violation]" pattern.
   */
  consoleMethods?: Array<'warn' | 'error' | 'info' | 'log'>;
}

export interface JankDetector {
  /** Record of every violation captured since install / reset. */
  getViolations(): JankRecord[];
  /** Clear the recorded violations without uninstalling the patches. */
  reset(): void;
  /**
   * Run a synchronous interaction (e.g. fireEvent.click) and record a
   * violation when its wall-clock duration exceeds the threshold.
   */
  runAndMeasure(label: string, fn: () => void): JankRecord | null;
  /**
   * Throws a descriptive error if any jank was recorded, otherwise no-op.
   */
  assertNoJank(): void;
  /** Restore the original console methods. Always call in afterEach. */
  uninstall(): void;
  /** Currently configured threshold. Useful for assertions in self-tests. */
  readonly thresholdMs: number;
}

function resolveThreshold(opt?: number): number {
  if (typeof opt === 'number' && Number.isFinite(opt) && opt > 0) return opt;
  const envValue = Number(process.env.JANK_THRESHOLD_MS);
  if (Number.isFinite(envValue) && envValue > 0) return envValue;
  return 50;
}

/**
 * Install the jank detector. Patches console output and returns a handle
 * for measuring interactions and asserting the absence of jank.
 */
export function installJankDetector(options: JankDetectorOptions = {}): JankDetector {
  const thresholdMs = resolveThreshold(options.thresholdMs);
  const methods = options.consoleMethods ?? ['warn', 'error'];
  const violations: JankRecord[] = [];

  const originals: Partial<Record<string, (...args: unknown[]) => void>> = {};

  for (const method of methods) {
    const original = console[method];
    originals[method] = original;
    const wrapped = (...args: unknown[]) => {
      const message = args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
      if (VIOLATION_PATTERN.test(message)) {
        violations.push({
          source: 'console-violation',
          label: message.slice(0, 200),
          durationMs: 0,
        });
      }
      original.call(console, ...args);
    };
    (console as unknown as Record<string, unknown>)[method] = wrapped;
  }

  const detector: JankDetector = {
    thresholdMs,
    getViolations: () => violations.slice(),
    reset: () => {
      violations.length = 0;
    },
    runAndMeasure(label, fn) {
      const start = performance.now();
      try {
        fn();
      } finally {
        const durationMs = performance.now() - start;
        if (durationMs > thresholdMs) {
          const record: JankRecord = {
            source: 'sync-handler',
            label,
            durationMs,
            thresholdMs,
          };
          violations.push(record);
          return record;
        }
      }
      return null;
    },
    assertNoJank() {
      if (violations.length === 0) return;
      const summary = violations
        .map((v) => {
          if (v.source === 'sync-handler') {
            return `  • ${v.label} ran synchronously for ${v.durationMs.toFixed(1)}ms (threshold ${v.thresholdMs}ms)`;
          }
          return `  • ${v.label}`;
        })
        .join('\n');
      throw new Error(
        `Jank detected (${violations.length} violation${violations.length === 1 ? '' : 's'}):\n${summary}\n\n` +
          'Wrap heavy state updates in startTransition / useDeferredValue, ' +
          'or move the work into useMemo / a Suspense boundary so user input ' +
          'stays responsive.',
      );
    },
    uninstall() {
      for (const method of methods) {
        const original = originals[method];
        if (original) {
          (console as unknown as Record<string, unknown>)[method] = original;
        }
      }
    },
  };

  return detector;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
