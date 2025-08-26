// Jest setup file - global test configuration
// Note: @testing-library/jest-dom will be imported by individual test files if needed

// Mock implementations for browser APIs
(global as any).ResizeObserver = function() {
  return {
    observe: function() {},
    unobserve: function() {},
    disconnect: function() {},
  };
};

(global as any).IntersectionObserver = function() {
  return {
    observe: function() {},
    unobserve: function() {},
    disconnect: function() {},
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
  value: function(query: string) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function() {}, // deprecated
      removeListener: function() {}, // deprecated
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() {},
    };
  },
});

// Mock sessionStorage and localStorage
const createMockStorage = () => ({
  getItem: function() { return null; },
  setItem: function() {},
  removeItem: function() {},
  clear: function() {},
  length: 0,
  key: function() { return null; },
});

Object.defineProperty(window, 'sessionStorage', {
  value: createMockStorage(),
});

Object.defineProperty(window, 'localStorage', {
  value: createMockStorage(),
});

// Console error suppression will be handled by individual test files if needed