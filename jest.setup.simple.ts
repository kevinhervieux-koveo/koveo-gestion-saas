/**
 * Simplified Jest Setup - Focus on core test requirements
 * Removes complex polyfills that may cause hanging issues
 */

import '@testing-library/jest-dom';
import { afterEach, beforeAll, afterAll } from '@jest/globals';
import { cleanup } from '@testing-library/react';

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

// Basic TextEncoder/TextDecoder for Node.js
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
}

// Enhanced ResizeObserver mock - required for Radix UI components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(global as any).ResizeObserver = ResizeObserverMock;

// Basic matchMedia mock
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

console.log('✅ Simplified Jest setup completed');