// Import jest-dom matchers for React Testing Library
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// React 19 compatibility - configure React testing environment
import { configure } from '@testing-library/react';

configure({
  // React 19 uses concurrent rendering by default
  // Adjust testing library to work better with React 19's concurrent features
  asyncUtilTimeout: 5000,
});

// MSW Server setup - try different import methods for better compatibility
let server: any;

try {
  // Try ES module import first
  const mswModule = require('./mocks/server');
  server = mswModule.server;
} catch (error) {
  try {
    // Fallback for ES module environment
    import('./mocks/server.js').then(module => {
      server = module.server;
    });
  } catch (fallbackError) {
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
