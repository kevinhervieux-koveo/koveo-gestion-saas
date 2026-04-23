/**
 * Jest Global Setup - Enhanced Test Infrastructure
 * Comprehensive test setup with MSW, polyfills, and optimized mocking
 */

// Database mocks are now handled entirely through Jest's moduleNameMapper
// No direct require needed - Jest will handle module resolution automatically

import '@testing-library/jest-dom';
import { afterEach, beforeAll, afterAll } from '@jest/globals';
import { cleanup } from '@testing-library/react';

// Ensure jest-dom matchers are properly typed
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
    }
  }
}

// =============================================================================
// MSW SERVER SETUP - DISABLED DUE TO V2 COMPATIBILITY ISSUES
// =============================================================================

// MSW v2 has complex polyfill requirements for Node.js environment
// Keeping it disabled for now to focus on core test stabilization

// Mock server object for tests that might reference it
const mockServer = {
  listen: jest.fn(),
  close: jest.fn(),
  resetHandlers: jest.fn(),
  use: jest.fn(),
};

// Export mock server for backward compatibility
export const server = mockServer;

// Setup hooks without MSW
beforeAll(() => {
  console.log('✅ Test setup: MSW disabled, focusing on core test fixes');
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

// Note: Jest timeout is configured in jest.config.cjs (15000ms)
// Keeping setup focused on environment configuration

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

// Note: import.meta.env issues are now handled via Jest moduleNameMapper mocking
// Components that use import.meta.env are mocked in __mocks__ directory
// This approach avoids syntax errors in CommonJS Jest environment

// Web Streams API polyfills - Enhanced for environment compatibility
try {
  if (typeof TransformStream === 'undefined') {
    const streams = require('stream/web');
    (global as any).TransformStream = streams.TransformStream;
  }
  
  if (typeof ReadableStream === 'undefined') {
    const streams = require('stream/web');
    (global as any).ReadableStream = streams.ReadableStream;
  }
  
  if (typeof WritableStream === 'undefined') {
    const streams = require('stream/web');
    (global as any).WritableStream = streams.WritableStream;
  }
} catch (error) {
  console.log('Web Streams API polyfills not available, skipping');
}

// Add BroadcastChannel polyfill
if (typeof BroadcastChannel === 'undefined') {
  (global as any).BroadcastChannel = class {
    constructor(name: string) {}
    postMessage(message: any) {}
    addEventListener(event: string, handler: Function) {}
    removeEventListener(event: string, handler: Function) {}
    close() {}
  };
}

// Additional polyfills for fetch and Request/Response APIs
if (typeof Request === 'undefined') {
  (global as any).Request = class MockRequest {
    constructor(input: any, init?: any) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
    }
    url: string;
    method: string;
  };
}

if (typeof Response === 'undefined') {
  (global as any).Response = class MockResponse {
    constructor(body?: any, init?: any) {
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
    }
    status: number;
    statusText: string;
    json() { return Promise.resolve({}); }
    text() { return Promise.resolve(''); }
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

// =============================================================================
// NAVIGATION AND ROUTER MOCKING ENHANCEMENTS
// =============================================================================

// Enhanced Location object mock that prevents navigation errors
const createMockLocation = (initialPath = '/', initialSearch = '') => {
  const mockLocation = {
    href: `http://localhost:3000${initialPath}${initialSearch}`,
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: initialPath,
    search: initialSearch,
    hash: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    toString: jest.fn(() => `http://localhost:3000${initialPath}${initialSearch}`)
  };
  
  return mockLocation;
};

// Export the mock factory for tests to use
(global as any).__createMockLocation = createMockLocation;

// Mock History API to prevent JSDOM navigation errors  
const createMockHistory = () => ({
  length: 1,
  state: null,
  scrollRestoration: 'auto',
  pushState: jest.fn(),
  replaceState: jest.fn(),
  go: jest.fn(),
  back: jest.fn(),
  forward: jest.fn()
});

// Only define history if it's not already properly mocked
if (typeof window !== 'undefined' && (!window.history || !window.history.pushState || typeof window.history.pushState !== 'function')) {
  Object.defineProperty(window, 'history', {
    value: createMockHistory(),
    writable: true,
    configurable: true
  });
}

// Mock navigation API to prevent "Not implemented" errors
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'navigation', {
    value: {
      navigate: jest.fn().mockResolvedValue(undefined),
      reload: jest.fn().mockResolvedValue(undefined),
      canGoBack: false,
      canGoForward: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    },
    writable: true,
    configurable: true
  });
}

// Mock PopStateEvent for navigation events
(global as any).PopStateEvent = class MockPopStateEvent extends Event {
  constructor(type: string, eventInitDict?: any) {
    super(type, eventInitDict);
    this.state = eventInitDict?.state || null;
  }
  state: any;
};

// Mock matchMedia for responsive design tests
if (typeof window !== 'undefined') {
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
}

// Mock scrollTo for navigation tests
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
}

// Mock scrollIntoView for element navigation tests
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
}

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

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'sessionStorage', {
    value: createMockStorage(),
  });

  Object.defineProperty(window, 'localStorage', {
    value: createMockStorage(),
  });
}

// Mock URL.createObjectURL and revokeObjectURL for file handling tests
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Enhanced URLSearchParams mock with full functionality
(global as any).URLSearchParams = class MockURLSearchParams {
  private params: Map<string, string[]> = new Map();

  constructor(init?: string | string[][] | Record<string, string> | URLSearchParams) {
    if (typeof init === 'string') {
      // Parse query string
      const searchParams = init.startsWith('?') ? init.slice(1) : init;
      searchParams.split('&').forEach(pair => {
        if (pair) {
          const [key, value = ''] = pair.split('=');
          this.append(decodeURIComponent(key), decodeURIComponent(value));
        }
      });
    } else if (Array.isArray(init)) {
      init.forEach(([key, value]) => this.append(key, value));
    } else if (init && typeof init === 'object') {
      Object.entries(init).forEach(([key, value]) => this.append(key, value));
    }
  }

  append(name: string, value: string) {
    if (!this.params.has(name)) {
      this.params.set(name, []);
    }
    this.params.get(name)!.push(value);
  }

  delete(name: string) {
    this.params.delete(name);
  }

  get(name: string): string | null {
    const values = this.params.get(name);
    return values ? values[0] : null;
  }

  getAll(name: string): string[] {
    return this.params.get(name) || [];
  }

  has(name: string): boolean {
    return this.params.has(name);
  }

  set(name: string, value: string) {
    this.params.set(name, [value]);
  }

  toString(): string {
    const pairs: string[] = [];
    for (const [name, values] of this.params) {
      for (const value of values) {
        pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
      }
    }
    return pairs.join('&');
  }

  [Symbol.iterator]() {
    const entries: [string, string][] = [];
    for (const [name, values] of this.params) {
      for (const value of values) {
        entries.push([name, value]);
      }
    }
    return entries[Symbol.iterator]();
  }
};

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

// =============================================================================
// COMPREHENSIVE API ROUTE MOCKING SYSTEM - REPLACES MSW
// =============================================================================

// Comprehensive API route handlers map for realistic test responses
const apiRouteHandlers: Record<string, (url: string, options?: any) => Promise<any>> = {
  // Auth routes
  '/api/auth/user': async (url, options) => {
    if (options?.method === 'GET') {
      // Return null for unauthenticated, user data for authenticated
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser@example.com',
        email: 'testuser@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        language: 'en',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return mockUser;
    }
    return null;
  },
  '/api/auth/login': async (url, options) => ({
    success: true,
    user: {
      id: 'test-user-id',
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin'
    }
  }),
  '/api/auth/logout': async () => ({ success: true }),
  '/api/auth/register': async () => ({ 
    success: true, 
    user: { id: 'new-user-id', email: 'newuser@example.com' } 
  }),
  
  // Users routes
  '/api/users': async () => ({ 
    success: true, 
    data: [
      { id: 'user1', email: 'user1@example.com', role: 'resident' },
      { id: 'user2', email: 'user2@example.com', role: 'manager' }
    ] 
  }),
  '/api/users/me': async () => ({
    success: true,
    data: {
      id: 'test-user-id',
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User'
    }
  }),
  '/api/users/me/change-password': async () => ({ success: true }),
  '/api/users/me/data-export': async () => ({ success: true, data: 'export-data' }),
  '/api/users/me/delete-account': async () => ({ success: true }),
  '/api/users/orphans': async () => ({ success: true, data: [] }),
  
  // Organizations routes
  '/api/organizations': async () => ({ 
    success: true, 
    data: [{ id: 'org1', name: 'Test Organization' }] 
  }),
  
  // Buildings routes
  '/api/buildings': async () => ({ 
    success: true, 
    data: [{ id: 'building1', name: 'Test Building', address: '123 Test St' }] 
  }),
  
  // Residences routes
  '/api/residences': async () => ({ 
    success: true, 
    data: [{ id: 'residence1', unitNumber: '101', buildingId: 'building1' }] 
  }),
  
  // Documents routes
  '/api/documents': async () => ({ 
    success: true, 
    data: [{ id: 'doc1', name: 'Test Document', type: 'contract' }] 
  }),
  
  // Bills/Invoices routes
  '/api/bills': async () => ({ 
    success: true, 
    data: [{ id: 'bill1', amount: 100.00, description: 'Test Bill' }] 
  }),
  '/api/invoices': async () => ({ 
    success: true, 
    data: [{ id: 'invoice1', amount: 200.00, description: 'Test Invoice' }] 
  }),
  '/api/invoices/extract-data': async () => ({ 
    success: true, 
    data: { amount: 150.00, description: 'Extracted Invoice' } 
  }),
  
  // Demands routes
  '/api/demands': async () => ({ 
    success: true, 
    data: [{ id: 'demand1', title: 'Test Demand', status: 'open' }] 
  }),
  
  // Features routes
  '/api/features': async (url) => {
    const isRoadmap = url.includes('roadmap=true');
    return { 
      success: true, 
      data: [{ 
        id: 'feature1', 
        title: 'Test Feature', 
        status: isRoadmap ? 'planned' : 'active' 
      }] 
    };
  },
  '/api/features/trigger-sync': async () => ({ success: true }),
  
  // Bug reports routes
  '/api/bugs': async () => ({ 
    success: true, 
    data: [{ id: 'bug1', title: 'Test Bug', status: 'open' }] 
  }),
  
  // Feature requests routes
  '/api/feature-requests': async () => ({ 
    success: true, 
    data: [{ id: 'fr1', title: 'Test Feature Request', votes: 5 }] 
  }),
  
  // Upload routes
  '/api/upload': async () => ({ 
    success: true, 
    fileId: 'uploaded-file-id',
    path: '/uploads/test-file.pdf' 
  }),
  
  // AI Analysis routes
  '/api/ai/analyze-document': async () => ({ 
    success: true, 
    analysis: { type: 'contract', confidence: 0.95, summary: 'Test document analysis' } 
  }),
  
  // Company/Story routes
  '/api/company/history': async () => ({ 
    success: true, 
    data: { founded: '2023', milestones: ['Launch', 'Growth'] } 
  }),
  
  // Common spaces routes
  '/api/common-spaces': async () => ({ 
    success: true, 
    data: [{ id: 'space1', name: 'Pool Area', available: true }] 
  }),
  
  // Contacts routes
  '/api/contacts': async () => ({ 
    success: true, 
    data: [{ id: 'contact1', name: 'John Doe', type: 'resident' }] 
  }),
  
  // Permissions routes
  '/api/permissions': async () => ({ 
    success: true, 
    data: [{ id: 'perm1', name: 'view_documents', granted: true }] 
  }),
  
  // Demo management routes
  '/api/demo-management': async () => ({ success: true, data: { demoActive: true } }),
  
  // Trial request routes
  '/api/trial-request': async () => ({ success: true, message: 'Trial requested' }),
  
  // Quality metrics routes
  '/api/quality-metrics': async () => ({ 
    success: true, 
    data: { score: 85, trends: 'improving' } 
  }),
  
  // Law 25 compliance routes
  '/api/law25-compliance': async () => ({ 
    success: true, 
    data: { compliant: true, lastAudit: new Date().toISOString() } 
  })
};

// Enhanced fetch mock with comprehensive route handling
(global as any).fetch = jest.fn().mockImplementation(async (url: string, options: any = {}) => {
  const method = options.method || 'GET';
  
  // Handle relative URLs by making them absolute
  const fullUrl = url.startsWith('/') ? `http://localhost:5000${url}` : url;
  const pathname = new URL(fullUrl).pathname;
  
  // Find matching handler by exact match first, then by prefix
  let handler = apiRouteHandlers[pathname];
  if (!handler) {
    // Try to find handler by prefix match for dynamic routes
    const matchingRoute = Object.keys(apiRouteHandlers).find(route => {
      return pathname.startsWith(route) || pathname.includes(route.replace('/api/', ''));
    });
    if (matchingRoute) {
      handler = apiRouteHandlers[matchingRoute];
    }
  }
  
  let responseData;
  if (handler) {
    try {
      responseData = await handler(url, options);
    } catch (error) {
      responseData = { success: false, error: 'Handler error', details: error };
    }
  } else {
    // Default response for unhandled routes
    responseData = { success: true, data: [], message: 'Default mock response' };
  }
  
  // Handle different response types based on status codes
  const status = pathname.includes('404') ? 404 : 
                pathname.includes('401') ? 401 : 
                pathname.includes('error') ? 500 : 200;
  
  const mockResponse = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'Error',
    headers: new Map([['content-type', 'application/json']]),
    json: async () => responseData,
    text: async () => JSON.stringify(responseData),
    blob: async () => new Blob([JSON.stringify(responseData)]),
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(responseData)),
    clone: function() { return { ...this }; }
  };
  
  return Promise.resolve(mockResponse);
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

// Mock problematic Node.js modules that cause test issues
jest.mock('glob', () => ({
  glob: jest.fn().mockResolvedValue([]),
  globSync: jest.fn().mockReturnValue([]),
  Glob: jest.fn().mockImplementation(() => ({
    found: [],
    walk: jest.fn(),
  })),
}));

// =============================================================================
// DATABASE AND ORM MOCKS
// =============================================================================

// Task #163: The previous global jest.mock() calls for `drizzle-orm` and
// `drizzle-orm/pg-core` have been removed. Per Task #153 policy, drizzle-orm
// stubs live opt-in at `tests/manual-mocks/drizzle-orm.ts` and
// `tests/manual-mocks/drizzle-orm/pg-core.js`. Suites that need them must
// declare them inline, e.g.:
//   jest.mock('drizzle-orm', () => require('../manual-mocks/drizzle-orm'));
//   jest.mock('drizzle-orm/pg-core', () => require('../manual-mocks/drizzle-orm/pg-core'));

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

// Task #163: The previous global jest.mock() calls for
// `drizzle-orm/neon-serverless` and `drizzle-orm/neon-http` have been removed.
// Tests rely on the `./server/db` mock below for the `db` instance, and the
// `@neondatabase/serverless` mock above for the underlying Neon driver, so the
// drizzle adapter modules do not need to be globally stubbed. Suites that want
// to mock the adapters must do so inline.

// Mock database modules with simple inline stubs
jest.mock('./server/db', () => {
  const mockSql = jest.fn().mockResolvedValue([]);
  Object.assign(mockSql, {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined)
  });
  
  const mockDb = {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
        then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
      }),
      then: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
        then: jest.fn().mockResolvedValue([])
      }),
      then: jest.fn().mockResolvedValue([])
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({ affectedRows: 1 }),
        then: jest.fn().mockResolvedValue({ affectedRows: 1 })
      }),
      then: jest.fn().mockResolvedValue({ affectedRows: 1 })
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue({ affectedRows: 1 }),
      then: jest.fn().mockResolvedValue({ affectedRows: 1 })
    }),
    transaction: jest.fn().mockImplementation((callback) => callback(mockDb)),
    query: jest.fn().mockResolvedValue([])
  };
  
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined)
  };
  
  return {
    db: mockDb,
    sql: mockSql,
    pool: mockPool,
    default: mockDb
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
  const createMockStorage = () => ({
    create: jest.fn().mockImplementation(async (data) => {
      return { id: `mock-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
    }),
    findById: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  });
  
  return {
    optimizedDbStorage: createMockStorage(),
    default: createMockStorage()
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

// =============================================================================
// ROUTER AND NAVIGATION MOCKS
// =============================================================================

// Mock wouter router hooks for proper navigation testing
jest.mock('wouter', () => {
  const actualWouter = jest.requireActual('wouter');
  return {
    ...actualWouter,
    useParams: jest.fn(() => ({})),
    useLocation: jest.fn(() => ['/', jest.fn()]),
    useRouter: jest.fn(() => ({
      navigate: jest.fn(),
      location: '/',
    })),
    Link: ({ children, to, ...props }: any) => {
      const React = require('react');
      return React.createElement('a', { href: to, ...props }, children);
    },
  };
});

// Note: window.location mocking is handled by JSDOM automatically
// Custom location mocking can be done per-test as needed
