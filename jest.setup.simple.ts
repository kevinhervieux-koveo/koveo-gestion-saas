// Simplified Jest setup file - minimal mocking to prevent hanging
import '@testing-library/jest-dom';
import React from 'react';

// Fix Node.js environment issues for integration tests
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Set test environment variables
process.env.TEST_TYPE = 'unit';
process.env.USE_MOCK_DB = 'true';
process.env.NODE_ENV = 'test';

// Mock fetch for tests
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: [] }),
    text: async () => '{"success": true, "data": []}'
  })
);

// Mock basic browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock storage
const createMockStorage = () => ({
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(() => null),
});

Object.defineProperty(window, 'sessionStorage', {
  value: createMockStorage(),
});

Object.defineProperty(window, 'localStorage', {
  value: createMockStorage(),
});

// Mock basic hooks with proper ES module export
jest.mock('@/hooks/use-language', () => {
  const mockUseLanguage = () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: jest.fn(),
    toggleLanguage: jest.fn(),
  });
  
  return {
    __esModule: true,
    useLanguage: mockUseLanguage,
    LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
    default: mockUseLanguage,
  };
});

jest.mock('@/hooks/use-toast', () => ({
  __esModule: true,
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-auth', () => ({
  __esModule: true,
  useAuth: () => ({
    user: { id: '1', username: 'test', role: 'admin' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

// Mock useMobileMenu hook
jest.mock('@/hooks/use-mobile-menu', () => ({
  __esModule: true,
  useMobileMenu: () => ({
    isMobileMenuOpen: false,
    toggleMobileMenu: jest.fn(),
  }),
}));

// Mock drizzle-zod to fix compatibility issues
jest.mock('drizzle-zod', () => ({
  createInsertSchema: jest.fn().mockImplementation(() => ({
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
    omit: jest.fn().mockReturnThis(),
    extend: jest.fn().mockReturnThis(),
  })),
  createSelectSchema: jest.fn().mockImplementation(() => ({
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
  })),
}));

// Mock database operations simply
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
  asc: jest.fn(),
}));

// Mock database connection
const mockDb = {
  query: jest.fn().mockResolvedValue([]),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }])
    }))
  })),
  select: jest.fn(() => ({
    from: jest.fn(() => Promise.resolve([]))
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve({ affectedRows: 1 }))
    }))
  })),
  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve({ affectedRows: 1 }))
  })),
};

jest.mock('./server/db', () => ({
  db: mockDb,
  default: mockDb
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('mock-hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock query client
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({ success: true, data: [] }),
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

// Note: Server API route mocks are handled via moduleNameMapper in Jest config