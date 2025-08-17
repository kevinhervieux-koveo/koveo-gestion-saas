import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

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
