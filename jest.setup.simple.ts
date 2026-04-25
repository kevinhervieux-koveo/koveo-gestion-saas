/**
 * Simplified Jest Setup - Focus on core test requirements
 * Removes complex polyfills that may cause hanging issues
 */

import '@testing-library/jest-dom';
import { afterEach, beforeAll, afterAll } from '@jest/globals';
import { cleanup } from '@testing-library/react';

// React 19 requires this flag so React Testing Library and React's scheduler
// know they are running in an act() environment. Without it, async state
// updates triggered from outside React event handlers (e.g. fetch resolutions
// inside useEffect) may not commit during `waitFor` polling, causing flaky
// "stuck on loading" tests.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// =============================================================================
// ESSENTIAL TEST SETUP
// =============================================================================

// Basic test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_TYPE = 'unit';
process.env.USE_MOCK_DB = 'true';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

console.log('🔧 Simplified Jest setup started');

// Setup hooks
beforeAll(() => {
  console.log('✅ Test setup initialized');
});

// Reset state after each test for isolation
afterEach(() => {
  cleanup(); // Clean up React components
  jest.clearAllMocks(); // Clear all mock call history
});

// Cleanup after all tests
afterAll(() => {
  console.log('✅ Test cleanup completed');
});

// =============================================================================
// MINIMAL REQUIRED POLYFILLS
// =============================================================================

// Note: TextEncoder/TextDecoder and fetch are now polyfilled in jest.polyfills.js

// Layout polyfills are installed as real classes (not jest.fn() mocks) so they
// survive `jest.resetAllMocks()` / `jest.restoreAllMocks()` calls in test
// suites. Radix UI primitives (Switch, Select, Dialog, ...) call
// `new ResizeObserver(cb).observe(node)` during layout effects; if the
// polyfill were a `jest.fn()` whose implementation got wiped by a mock reset,
// every subsequent render would crash with
// "resizeObserver.observe is not a function".
class ResizeObserverPolyfill {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(global as any).ResizeObserver = ResizeObserverPolyfill;

// Basic matchMedia polyfill installed as a plain function (not a jest.fn())
// for the same reason as ResizeObserver above.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// =============================================================================
// POINTER EVENT POLYFILLS
// =============================================================================
//
// jsdom (as of v26, the runtime used by these tests) does not implement
// `PointerEvent` nor the `setPointerCapture` / `releasePointerCapture` /
// `hasPointerCapture` methods on `Element`. Any component that uses pointer
// gestures (Radix UI primitives, the Gantt chart drag overlay, etc.) needs
// these to exist, and `fireEvent.pointerDown/Move/Up` from React Testing
// Library silently falls back to a plain `Event` when `PointerEvent` is
// missing — which drops `clientX` / `clientY` / `button`, so components see
// NaN deltas.
//
// Centralising the polyfills here means individual test files do not have to
// copy/paste the same shim (and risk drifting). The `PointerEvent` polyfill
// subclasses `MouseEvent` so coordinate / button / pointerId propagate
// correctly to listeners.
if (typeof Element !== 'undefined') {
  if (typeof Element.prototype.setPointerCapture !== 'function') {
    (Element.prototype as Element & { setPointerCapture: (id: number) => void }).setPointerCapture = function () {};
  }
  if (typeof Element.prototype.releasePointerCapture !== 'function') {
    (Element.prototype as Element & { releasePointerCapture: (id: number) => void }).releasePointerCapture = function () {};
  }
  if (typeof Element.prototype.hasPointerCapture !== 'function') {
    (Element.prototype as Element & { hasPointerCapture: (id: number) => boolean }).hasPointerCapture = function () { return false; };
  }
}

if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined' &&
    typeof MouseEvent !== 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  (globalThis as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
  if (typeof window !== 'undefined') {
    (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
  }
}

console.log('✅ Simplified Jest setup completed');