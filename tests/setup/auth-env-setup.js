/**
 * Environment setup for authentication tests
 * Sets up environment variables and test configuration
 */

// Set test environment variables for authentication testing
process.env.NODE_ENV = 'test';
process.env.TEST_TYPE = process.env.TEST_TYPE || 'integration';
process.env.SESSION_SECRET = 'test-session-secret-auth-tests';
process.env.DATABASE_URL = 'mock://test-database-for-auth';

// Control mocking behavior based on test type
if (process.env.TEST_TYPE === 'integration') {
  // For integration tests, use less mocking (real bcrypt, etc.)
  process.env.MOCK_PASSWORDS = 'false';
  process.env.MOCK_SESSIONS = 'false';
  process.env.MOCK_DATABASE = 'true'; // Still mock database but use higher fidelity
} else if (process.env.TEST_TYPE === 'unit') {
  // For unit tests, use more mocking for speed
  process.env.MOCK_PASSWORDS = 'true';
  process.env.MOCK_SESSIONS = 'true';
  process.env.MOCK_DATABASE = 'true';
}

// Set up fetch polyfill for Node.js
if (typeof global.fetch === 'undefined') {
  global.fetch = require('whatwg-fetch').fetch;
}

// Mock console methods that might be noisy in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

// Suppress verbose auth logs in tests unless explicitly enabled
if (!process.env.DEBUG_AUTH_TESTS) {
  console.log = (...args) => {
    const message = args.join(' ');
    if (message.includes('🔗') || message.includes('✅') || message.includes('❌')) {
      // Suppress authentication setup logs in tests
      return;
    }
    originalConsoleLog.apply(console, args);
  };
  
  console.warn = (...args) => {
    const message = args.join(' ');
    if (message.includes('Session') || message.includes('ts-jest')) {
      // Suppress session and ts-jest warnings in tests
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
}

// Set up global test configuration
global.__TEST_CONFIG__ = {
  isAuthTest: true,
  testType: process.env.TEST_TYPE,
  mockPasswords: process.env.MOCK_PASSWORDS === 'true',
  mockSessions: process.env.MOCK_SESSIONS === 'true',
  mockDatabase: process.env.MOCK_DATABASE === 'true',
};