// Import jest-dom matchers for React Testing Library
import '@testing-library/jest-dom';
import { jest, beforeAll, afterEach, afterAll, expect } from '@jest/globals';

// React 19 compatibility - configure React testing environment
import { configure } from '@testing-library/react';

configure({
  // React 19 uses concurrent rendering by default
  // Adjust testing library to work better with React 19's concurrent features
  asyncUtilTimeout: 10000,
  // Make testing more stable
  testIdAttribute: 'data-testid',
});

// MSW Server setup - try different import methods for better compatibility
let server: any;

try {
  // Try different import methods for MSW server
  try {
    const mswModule = require('./mocks/server');
    server = mswModule.server;
  } catch (requireError) {
    // MSW server not available - tests will run without API mocking
    console.warn('MSW server setup skipped, tests will run without API mocking');
  }
} catch (_error) {
  console.warn('MSW server setup failed, tests will run without API mocking');
}

beforeAll(() => {
  server?.listen();
});

afterEach(() => {
  server?.resetHandlers();
});

afterAll(() => {
  server?.close();
});

// Layout polyfills are installed as real classes/functions (not jest.fn()
// mocks) so they survive `jest.resetAllMocks()` / `jest.restoreAllMocks()`
// calls in test suites. Radix UI primitives (Switch, Select, Dialog, ...)
// call `new ResizeObserver(cb).observe(node)` during layout effects; if the
// polyfill were a `jest.fn()` whose implementation got wiped by a mock reset,
// every subsequent render would crash with
// "resizeObserver.observe is not a function".
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverPolyfill {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver = ResizeObserverPolyfill as any;

class IntersectionObserverPolyfill {
  root: Element | null = null;
  rootMargin: string = '';
  thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
global.IntersectionObserver = IntersectionObserverPolyfill as any;

// Global test configuration for DOM APIs
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => [],
  },
  writable: true,
});

// Mock DOM APIs that may be missing in test environment
Object.defineProperty(global, 'File', {
  value: class MockFile {
    name: string;
    size: number;
    type: string;
    constructor(chunks: BlobPart[], filename: string, options?: FilePropertyBag) {
      this.name = filename;
      this.size = 0;
      this.type = options?.type || '';
    }
  },
  writable: true,
});

Object.defineProperty(global, 'FormData', {
  value: class MockFormData {
    private data = new Map<string, unknown>();
    append(name: string, _value: unknown) {
      this.data.set(name, _value);
    }
    get(name: string) {
      return this.data.get(name);
    }
  },
  writable: true,
});

// Mock Node and Element for DOM testing
Object.defineProperty(global, 'Node', {
  value: {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
  },
  writable: true,
});

Object.defineProperty(global, 'Element', {
  value: class MockElement {
    tagName: string = '';
    nodeType: number = 1;
  },
  writable: true,
});

// Global error handling for tests
global.error = jest.fn();
