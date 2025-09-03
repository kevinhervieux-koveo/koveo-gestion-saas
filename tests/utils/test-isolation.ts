/**
 * Test isolation utilities for faster test execution
 * Provides clean test environment setup without expensive operations
 */

// Fast test cleanup without database calls
export const fastCleanup = () => {
  // Clear any global state
  if (global.mockDatabase) {
    global.mockDatabase.clear?.();
  }
  
  // Reset timers
  jest.clearAllTimers();
  jest.clearAllMocks();
};

// Mock test user for fast authentication tests
export const createMockTestUser = () => ({
  id: 'test-user-id-12345',
  email: 'test@example.com',
  role: 'resident',
  organizationId: 'test-org-id-12345',
  isActive: true,
});

// Mock test organization
export const createMockTestOrganization = () => ({
  id: 'test-org-id-12345',
  name: 'Test Organization',
  type: 'property_management',
  settings: {},
});

// Fast test database setup (in-memory)
export const setupFastTestDb = () => {
  const mockData = new Map();
  
  return {
    users: mockData,
    organizations: mockData,
    clear: () => mockData.clear(),
    get: (table: string, id: string) => mockData.get(`${table}:${id}`),
    set: (table: string, id: string, data: any) => mockData.set(`${table}:${id}`, data),
  };
};

// Performance: Skip expensive setup operations in unit tests
export const isUnitTest = () => {
  return process.env.TEST_TYPE === 'unit' || 
         expect.getState().testPath?.includes('/unit/');
};

// Performance: Only run expensive operations in integration tests
export const isIntegrationTest = () => {
  return process.env.TEST_TYPE === 'integration' || 
         expect.getState().testPath?.includes('/integration/');
};