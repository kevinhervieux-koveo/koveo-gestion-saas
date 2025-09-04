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

// Performance: Mock database for unit tests to avoid network calls
jest.mock('./server/db', () => {
  const mockDb = {
    query: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => ({
        returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
      }))
    })),
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockResolvedValue([])
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
  };
  
  const mockSql = jest.fn().mockResolvedValue([]);
  
  return {
    db: mockDb,
    sql: mockSql,
    pool: mockSql,
  };
});

// Don't mock the shared schema - let tests import real schema objects
// The database operations themselves are mocked through ./server/db mock

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

// Mock React Router hooks for component tests
jest.mock('wouter', () => ({
  useLocation: jest.fn(() => ['/', jest.fn()]),
  useParams: jest.fn(() => ({})),
  useRoute: jest.fn(() => [false, {}]),
  Link: jest.fn(({ children }: any) => children),
  Route: jest.fn(({ children }: any) => children),
  Switch: jest.fn(({ children }: any) => children),
  Router: jest.fn(({ children }: any) => children),
  Redirect: jest.fn(() => null),
}));

// Mock language hook and provider
jest.mock('@/hooks/use-language', () => ({
  useLanguage: jest.fn(() => ({
    t: jest.fn((key: string) => key), // Return the key as translation
    language: 'en',
    setLanguage: jest.fn(),
  })),
  LanguageProvider: ({ children }: any) => children,
}));

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

// Mock query client
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({ success: true, data: [] }),
  queryClient: {
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  },
}));

// Performance: Mock Neon database for faster unit tests
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => {
    const { mockSql } = require('./tests/mocks/database');
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
