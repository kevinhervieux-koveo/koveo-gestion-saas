// Import jest-dom matchers for React Testing Library
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Explicitly import Jest DOM matchers for TypeScript
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare global {
  namespace jest {
    interface Matchers<R = void>
      extends TestingLibraryMatchers<typeof expect.stringContaining, R> {}
  }
}

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
  // Try ES module import first
  const mswModule = require('./mocks/server');
  server = mswModule.server;
} catch (_error) {
  try {
    // Fallback for ES module environment
    import('./mocks/server.js').then((module) => {
      server = module.server;
    });
  } catch (___fallbackError) {
    console.warn('MSW server setup failed, tests will run without API mocking');
  }
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

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
})) as any;

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
