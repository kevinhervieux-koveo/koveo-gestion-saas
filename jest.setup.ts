// Jest setup file - global test configuration
import '@testing-library/jest-dom';

// Mock Google GenAI to avoid ES module issues
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Mock AI response',
        },
      }),
    }),
  })),
}));
import 'whatwg-fetch';

// Add TransformStream polyfill for MSW compatibility
if (typeof TransformStream === 'undefined') {
  const { TransformStream } = require('stream/web');
  (global as any).TransformStream = TransformStream;
}

// Add ReadableStream polyfill
if (typeof ReadableStream === 'undefined') {
  const { ReadableStream } = require('stream/web');
  (global as any).ReadableStream = ReadableStream;
}

// Add WritableStream polyfill
if (typeof WritableStream === 'undefined') {
  const { WritableStream } = require('stream/web');
  (global as any).WritableStream = WritableStream;
}

// Add BroadcastChannel polyfill for MSW
if (typeof BroadcastChannel === 'undefined') {
  (global as any).BroadcastChannel = class {
    constructor(name: string) {}
    postMessage(message: any) {}
    addEventListener(event: string, handler: Function) {}
    removeEventListener(event: string, handler: Function) {}
    close() {}
  };
}

// Mock runQuery function for integration tests
global.runQuery = jest.fn(() => Promise.resolve([]));

// Set up test database URL if missing
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/koveo_test';
}

// Mock implementations for browser APIs
(global as any).ResizeObserver = function () {
  return {
    observe: function () {},
    unobserve: function () {},
    disconnect: function () {},
  };
};

(global as any).IntersectionObserver = function () {
  return {
    observe: function () {},
    unobserve: function () {},
    disconnect: function () {},
  };
};

// Add TextEncoder/TextDecoder polyfills for Node.js environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: function (query: string) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function () {}, // deprecated
      removeListener: function () {}, // deprecated
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {},
    };
  },
});

// Mock sessionStorage and localStorage
const createMockStorage = () => ({
  getItem: function () {
    return null;
  },
  setItem: function () {},
  removeItem: function () {},
  clear: function () {},
  length: 0,
  key: function () {
    return null;
  },
});

Object.defineProperty(window, 'sessionStorage', {
  value: createMockStorage(),
});

Object.defineProperty(window, 'localStorage', {
  value: createMockStorage(),
});

// Console error suppression will be handled by individual test files if needed
