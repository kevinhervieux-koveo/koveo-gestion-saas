// Jest setup file - global test configuration
import '@testing-library/jest-dom';

// Performance: Mock expensive external dependencies
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

// Mock drizzle-orm functions
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
}));

// Mock server config to prevent runtime errors
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

// Comprehensive database mocking to prevent real connections
jest.mock('./server/db', () => {
  // Mock data for consistent test results
  const mockData = {
    users: [
      { id: 'mock-user-1', email: 'test@example.com', username: 'testuser' },
    ],
    organizations: [
      { id: 'mock-org-1', name: 'Test Organization', type: 'syndicate' },
    ],
    invitations: [
      { id: 'mock-invite-1', email: 'test@example.com', role: 'manager' },
    ],
  };

  // Create a proper Drizzle-like chain that handles all operations
  const createMockQueryBuilder = (tableName?: string, defaultResult: any = []) => {
    const mockBuilder = {
      // Query builder methods - all return 'this' for chaining
      from: jest.fn().mockImplementation(() => mockBuilder),
      where: jest.fn().mockImplementation(() => mockBuilder),
      leftJoin: jest.fn().mockImplementation(() => mockBuilder),
      innerJoin: jest.fn().mockImplementation(() => mockBuilder),
      rightJoin: jest.fn().mockImplementation(() => mockBuilder),
      select: jest.fn().mockImplementation(() => mockBuilder),
      set: jest.fn().mockImplementation(() => mockBuilder),
      values: jest.fn().mockImplementation(() => mockBuilder),
      returning: jest.fn().mockImplementation(() => mockBuilder),
      orderBy: jest.fn().mockImplementation(() => mockBuilder),
      limit: jest.fn().mockImplementation(() => mockBuilder),
      offset: jest.fn().mockImplementation(() => mockBuilder),
      groupBy: jest.fn().mockImplementation(() => mockBuilder),
      having: jest.fn().mockImplementation(() => mockBuilder),
      
      // Promise interface - resolves to mock data
      then: jest.fn().mockImplementation((onResolve) => {
        const result = Array.isArray(defaultResult) && defaultResult.length === 0 
          ? (tableName && mockData[tableName] ? mockData[tableName] : defaultResult)
          : defaultResult;
        return Promise.resolve(result).then(onResolve);
      }),
      catch: jest.fn().mockImplementation((onReject) => {
        const result = Array.isArray(defaultResult) && defaultResult.length === 0 
          ? (tableName && mockData[tableName] ? mockData[tableName] : defaultResult)
          : defaultResult;
        return Promise.resolve(result).catch(onReject);
      }),
      finally: jest.fn().mockImplementation((onFinally) => {
        const result = Array.isArray(defaultResult) && defaultResult.length === 0 
          ? (tableName && mockData[tableName] ? mockData[tableName] : defaultResult)
          : defaultResult;
        return Promise.resolve(result).finally(onFinally);
      }),
    };

    return mockBuilder;
  };

  const mockDb = {
    // Mock database operations with table recognition
    query: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockImplementation((table) => {
      console.log('Mock DB insert called with table:', table);
      return createMockQueryBuilder(undefined, [{ 
        id: `mock-record-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
      }]);
    }),
    select: jest.fn().mockImplementation((fields) => {
      console.log('Mock DB select called with fields:', fields);
      return createMockQueryBuilder(undefined, []);
    }),
    update: jest.fn().mockImplementation((table) => {
      console.log('Mock DB update called with table:', table);
      return createMockQueryBuilder(undefined, { affectedRows: 1 });
    }),
    delete: jest.fn().mockImplementation((table) => {
      console.log('Mock DB delete called with table:', table);
      return createMockQueryBuilder(undefined, { affectedRows: 1 });
    }),
    $with: jest.fn().mockImplementation(() => createMockQueryBuilder()),
  };
  
  const mockSql = jest.fn().mockResolvedValue([]);
  
  return {
    db: mockDb,
    sql: mockSql,
    pool: mockSql,
    default: mockDb
  };
});

// Mock server storage completely
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

// Mock optimized DB storage
jest.mock('./server/optimized-db-storage', () => ({
  optimizedDbStorage: {
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

// Keep shared schema available for tests to import types and schemas
// All database operations are mocked above

// Mock email service to prevent actual SendGrid calls during tests
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

// Note: wouter mocking is handled in test-utils.tsx Router provider

// Mock language hook and provider with proper React setup
jest.mock('@/hooks/use-language', () => {
  const React = require('react');
  
  // Create a mock function that always returns the expected structure
  const mockUseLanguage = jest.fn().mockReturnValue({
    t: jest.fn((key: string, options?: any) => {
      // Handle interpolations like t('key', { value: 'test' })
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

// Mock auth provider
jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: '1', username: 'test', role: 'admin' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
  })),
  AuthProvider: ({ children }: any) => children,
}));

// Mock mobile menu provider
jest.mock('@/hooks/use-mobile-menu', () => ({
  useMobileMenu: jest.fn(() => ({
    isOpen: false,
    open: jest.fn(),
    close: jest.fn(),
    toggle: jest.fn(),
  })),
  MobileMenuProvider: ({ children }: any) => children,
}));

// Mock query client with proper TanStack Query setup
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

// Performance: Mock Neon database for faster unit tests
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => {
    const mockSql = jest.fn().mockResolvedValue([{ version: 'Mock PostgreSQL 16.0' }]);
    // Add all the properties that might be accessed during testing
    (mockSql as any).setTypeParser = jest.fn();
    (mockSql as any).arrayMode = false;
    (mockSql as any).fullResults = false;
    return mockSql;
  }),
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(undefined),
  }))
}));

// Mock drizzle-orm completely to prevent any database operations
jest.mock('drizzle-orm/neon-http', () => ({
  drizzle: jest.fn(() => ({
    query: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => ({
        returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
      }))
    })),
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockResolvedValue([]),
        leftJoin: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockResolvedValue([])
        })),
        innerJoin: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockResolvedValue([])
        }))
      }))
    })),
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockResolvedValue({ affectedRows: 0 })
      }))
    })),
    delete: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockResolvedValue({ affectedRows: 0 })
    }))
  }))
}));

// Mock drizzle-orm main functions
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  gt: jest.fn(),
  lt: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
  asc: jest.fn()
}));

// Mock drizzle-zod to prevent schema creation issues
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
import 'whatwg-fetch';

// Mock fetch for network requests in tests
global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
  // Mock successful API responses
  if (url.includes('/api/')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => '{"success": true, "data": []}'
    });
  }
  
  // Default to network request failed for external URLs
  return Promise.reject(new Error('Network request failed'));
});

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

// Database URL is now set in global setup, don't override here

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
