// Import jest-dom matchers for React Testing Library
import '@testing-library/jest-dom';

// Extend Jest matchers globally
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeVisible(): R;
      toHaveClass(className: string): R;
      toHaveTextContent(text: string): R;
    }
  }
}
import { jest } from '@jest/globals';

// React 19 compatibility - configure React testing environment
import { configure } from '@testing-library/react';

configure({
  // React 19 uses concurrent rendering by default
  // Adjust testing library to work better with React 19's concurrent features
  asyncUtilTimeout: 5000,
});

// MSW Server setup - conditionally imported to avoid Node.js API issues
let server: any;

try {
  const mswModule = require('./mocks/server');
  server = mswModule.server;
  
  beforeAll(() => {
    server?.listen();
  });

  afterEach(() => {
    server?.resetHandlers();
  });

  afterAll(() => {
    server?.close();
  });
} catch (error) {
  console.warn('MSW server setup failed, tests will run without API mocking:', error);
}

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
