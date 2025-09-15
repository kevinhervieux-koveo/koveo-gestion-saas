/**
 * Jest Global Setup - Enhanced Test Infrastructure
 * Comprehensive test setup with MSW, polyfills, and optimized mocking
 */
import '@testing-library/jest-dom';
import { afterEach, beforeAll, afterAll } from '@jest/globals';
import { setupServer } from 'msw/node';
import { cleanup } from '@testing-library/react';
import { handlers } from './tests/mocks/msw-handlers';

// =============================================================================
// MSW SERVER SETUP
// =============================================================================

// Set up MSW server for API mocking
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn', // Warn about unhandled requests
  });
});

// Reset handlers after each test for isolation
afterEach(() => {
  server.resetHandlers();
  cleanup(); // Clean up React components
  jest.clearAllMocks(); // Clear all mock call history
});

// Close server after all tests
afterAll(() => {
  server.close();
});

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

// Comprehensive test environment variables
const testEnvDefaults = {
  NODE_ENV: 'test',
  TEST_TYPE: 'unit',
  USE_MOCK_DB: 'true',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  VITE_API_URL: 'http://localhost:5000',
  VITE_APP_ENV: 'test',
  SESSION_SECRET: 'test-session-secret-key',
  SENDGRID_API_KEY: 'test-sendgrid-key',
  SENDGRID_FROM_EMAIL: 'test@example.com',
  JWT_SECRET: 'test-jwt-secret',
  BCRYPT_ROUNDS: '1', // Faster bcrypt for tests
  UPLOAD_DIR: './test-uploads',
  MAX_FILE_SIZE: '10485760', // 10MB
  RATE_LIMIT_MAX: '1000',
  RATE_LIMIT_WINDOW: '900000',
};

// Apply test environment defaults
Object.entries(testEnvDefaults).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

// =============================================================================
// PERFORMANCE AND TIMEOUT CONFIGURATION
// =============================================================================

// Performance optimizations
jest.setTimeout(10000); // 10 second timeout per test

// Configure React Query to suppress console errors during tests
// Note: React Query v5 uses a different approach for logger configuration
// This will be handled in individual test files as needed

// =============================================================================
// NODE.JS POLYFILLS FOR TEST ENVIRONMENT
// =============================================================================

// Add Node.js polyfills for test environment
if (!global.setImmediate) {
  (global as any).setImmediate = (fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args);
}
if (!global.clearImmediate) {
  (global as any).clearImmediate = (id: any) => clearTimeout(id);
}

// Add TextEncoder/TextDecoder polyfills for Node.js environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
}

// Web Streams API polyfills for MSW compatibility
if (typeof TransformStream === 'undefined') {
  const { TransformStream } = require('stream/web');
  (global as any).TransformStream = TransformStream;
}

if (typeof ReadableStream === 'undefined') {
  const { ReadableStream } = require('stream/web');
  (global as any).ReadableStream = ReadableStream;
}

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

// =============================================================================
// BROWSER API POLYFILLS AND MOCKS
// =============================================================================

// Mock implementations for browser APIs
(global as any).ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

(global as any).IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
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

// Mock scrollTo for navigation tests
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock scrollIntoView for element navigation tests
Element.prototype.scrollIntoView = jest.fn();

// Mock storage APIs
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
};

Object.defineProperty(window, 'sessionStorage', {
  value: createMockStorage(),
});

Object.defineProperty(window, 'localStorage', {
  value: createMockStorage(),
});

// Mock URL.createObjectURL and revokeObjectURL for file handling tests
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader for file upload tests
(global as any).File = class MockFile {
  constructor(parts: any[], filename: string, properties?: any) {
    return { parts, filename, ...properties };
  }
};

(global as any).FileReader = class MockFileReader {
  result: any = null;
  error: any = null;
  readAsDataURL = jest.fn().mockImplementation(() => {
    this.onload?.({ target: { result: 'data:text/plain;base64,dGVzdA==' } });
  });
  readAsText = jest.fn().mockImplementation(() => {
    this.onload?.({ target: { result: 'test content' } });
  });
  onload: any = null;
  onerror: any = null;
};

// =============================================================================
// EXTERNAL SERVICE MOCKS
// =============================================================================

// Mock fetch with MSW fallback for non-API requests
global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
  // Let MSW handle /api/ requests
  if (url.includes('/api/')) {
    return fetch(url, options);
  }
  
  // Mock other requests
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: [] }),
    text: async () => '{"success": true, "data": []}'
  });
});

// Mock Google AI service
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

// Mock SendGrid email service
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }]),
}));

// Mock bcrypt for faster tests
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('mock-hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('mock-salt'),
}));

// =============================================================================
// DATABASE AND ORM MOCKS
// =============================================================================

// Mock Drizzle ORM functions first to prevent import issues
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(() => 'mock-eq-condition'),
  and: jest.fn(() => 'mock-and-condition'),
  or: jest.fn(() => 'mock-or-condition'),
  sql: jest.fn(() => 'mock-sql'),
  desc: jest.fn(() => 'mock-desc'),
  asc: jest.fn(() => 'mock-asc'),
  like: jest.fn(() => 'mock-like'),
  ilike: jest.fn(() => 'mock-ilike'),
  inArray: jest.fn(() => 'mock-in-array'),
  notInArray: jest.fn(() => 'mock-not-in-array'),
  isNull: jest.fn(() => 'mock-is-null'),
  isNotNull: jest.fn(() => 'mock-is-not-null'),
  exists: jest.fn(() => 'mock-exists'),
  notExists: jest.fn(() => 'mock-not-exists'),
  count: jest.fn(() => 'mock-count'),
  sum: jest.fn(() => 'mock-sum'),
  avg: jest.fn(() => 'mock-avg'),
  min: jest.fn(() => 'mock-min'),
  max: jest.fn(() => 'mock-max'),
  relations: jest.fn(() => ({})),
  gt: jest.fn(() => 'mock-gt'),
  lt: jest.fn(() => 'mock-lt'),
  gte: jest.fn(() => 'mock-gte'),
  lte: jest.fn(() => 'mock-lte'),
  ne: jest.fn(() => 'mock-ne'),
}));

// Mock Neon database serverless
jest.mock('@neondatabase/serverless', () => {
  const mockSql = jest.fn().mockImplementation(async (strings, ...values) => {
    if (strings && strings[0] && strings[0].includes('SELECT version()')) {
      return [{ version: 'PostgreSQL 15.0 (Mock Version)' }];
    }
    return [];
  });

  Object.assign(mockSql, {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
    arrayMode: false,
    fullResults: false,
  });

  const MockPool = jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
  }));

  const mockNeon = jest.fn().mockImplementation(() => mockSql);

  return {
    __esModule: true,
    neon: mockNeon,
    Pool: MockPool,
    default: mockNeon,
  };
});

// Mock Drizzle database connections
jest.mock('drizzle-orm/neon-serverless', () => {
  const { db, drizzle } = require('./tests/mocks/enhanced-database-mock');
  return {
    __esModule: true,
    drizzle: jest.fn().mockImplementation(() => db),
  };
});

jest.mock('drizzle-orm/neon-http', () => {
  const { db, drizzle } = require('./tests/mocks/enhanced-database-mock');
  return {
    __esModule: true,
    drizzle: jest.fn().mockImplementation(() => db),
  };
});

// Mock database modules
jest.mock('./server/db', () => {
  const { db, sql, pool } = require('./tests/mocks/enhanced-database-mock');
  return {
    db: db,
    sql: sql,
    pool: pool,
    default: db
  };
});

// Mock Drizzle Zod schemas
jest.mock('drizzle-zod', () => ({
  createInsertSchema: jest.fn((table, overrides) => {
    const mockSchema = {
      parse: jest.fn((data) => data),
      safeParse: jest.fn((data) => ({ success: true, data })),
      omit: jest.fn(() => mockSchema),
      extend: jest.fn(() => mockSchema),
      pick: jest.fn(() => mockSchema),
      partial: jest.fn(() => mockSchema)
    };
    return mockSchema;
  }),
  createSelectSchema: jest.fn((table, overrides) => {
    const mockSchema = {
      parse: jest.fn((data) => data),
      safeParse: jest.fn((data) => ({ success: true, data })),
      omit: jest.fn(() => mockSchema),
      extend: jest.fn(() => mockSchema),
      pick: jest.fn(() => mockSchema),
      partial: jest.fn(() => mockSchema)
    };
    return mockSchema;
  })
}));

// =============================================================================
// APPLICATION SERVICE MOCKS
// =============================================================================

// Mock server configuration
jest.mock('./server/config/index', () => ({
  config: {
    server: {
      port: 5000,
      isProduction: false,
      nodeEnv: 'test',
    },
    database: {
      url: 'mock://test-database',
      getRuntimeDatabaseUrl: jest.fn(() => 'mock://test-database'),
    },
    session: {
      secret: 'test-secret',
    },
    email: {
      apiKey: 'test-key',
      fromEmail: 'test@example.com',
    },
    quebec: {
      defaultLanguage: 'fr',
      supportedLanguages: ['en', 'fr'],
      requireBilingual: true,
      law25Compliance: true,
    },
  },
  default: {
    server: {
      port: 5000,
      isProduction: false,
      nodeEnv: 'test',
    },
    database: {
      url: 'mock://test-database',
      getRuntimeDatabaseUrl: jest.fn(() => 'mock://test-database'),
    },
    session: {
      secret: 'test-secret',
    },
    email: {
      apiKey: 'test-key',
      fromEmail: 'test@example.com',
    },
    quebec: {
      defaultLanguage: 'fr',
      supportedLanguages: ['en', 'fr'],
      requireBilingual: true,
      law25Compliance: true,
    },
  },
}));

// Mock storage services
jest.mock('./server/storage', () => ({
  storage: {
    create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    findById: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
  default: {
    create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    findById: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  }
}));

jest.mock('./server/optimized-db-storage', () => {
  const { testUtils } = require('./tests/mocks/enhanced-database-mock');
  return {
    optimizedDbStorage: {
      create: jest.fn().mockImplementation(async (data) => {
        return testUtils.createTestData('unknown', data);
      }),
      findById: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ success: true }),
      delete: jest.fn().mockResolvedValue({ success: true }),
    },
    default: {
      create: jest.fn().mockImplementation(async (data) => {
        return testUtils.createTestData('unknown', data);
      }),
      findById: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ success: true }),
      delete: jest.fn().mockResolvedValue({ success: true }),
    }
  };
});

// Mock email service
jest.mock('./server/services/email-service', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendInvitationEmail: jest.fn().mockResolvedValue(true),
    sendTestEmail: jest.fn().mockResolvedValue(true),
    sendReminderEmail: jest.fn().mockResolvedValue(true),
  },
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendInvitationEmail: jest.fn().mockResolvedValue(true),
    sendTestEmail: jest.fn().mockResolvedValue(true),
    sendReminderEmail: jest.fn().mockResolvedValue(true),
  }))
}));

// =============================================================================
// FRONTEND AND REACT MOCKS
// =============================================================================

// Mock React hooks and providers
jest.mock('@/hooks/use-language', () => {
  const React = require('react');
  
  const mockUseLanguage = jest.fn().mockReturnValue({
    t: jest.fn((key: string, options?: any) => {
      if (options && typeof options === 'object') {
        let result = key;
        Object.keys(options).forEach(k => {
          result = result.replace(new RegExp(`{{${k}}}`, 'g'), options[k]);
        });
        return result;
      }
      return key;
    }),
    language: 'en',
    setLanguage: jest.fn(),
  });
  
  return {
    useLanguage: mockUseLanguage,
    LanguageProvider: ({ children }: { children: React.ReactNode }) => 
      React.createElement('div', { 'data-testid': 'language-provider' }, children),
  };
});

jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: '1', username: 'test', role: 'admin' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
  })),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-mobile-menu', () => ({
  useMobileMenu: jest.fn(() => ({
    isOpen: false,
    open: jest.fn(),
    close: jest.fn(),
    toggle: jest.fn(),
  })),
  MobileMenuProvider: ({ children }: any) => children,
}));

// Mock React Query client
jest.mock('@/lib/queryClient', () => {
  const { QueryClient } = require('@tanstack/react-query');
  const mockQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: jest.fn().mockResolvedValue([]),
      },
    },
  });
  
  return {
    apiRequest: jest.fn().mockResolvedValue({ success: true, data: [] }),
    queryClient: mockQueryClient,
  };
});

// =============================================================================
// UTILITY FUNCTIONS FOR TESTS
// =============================================================================

// Global test utilities
global.runQuery = jest.fn(() => Promise.resolve([]));

// Import whatwg-fetch for fetch polyfill
import 'whatwg-fetch';
