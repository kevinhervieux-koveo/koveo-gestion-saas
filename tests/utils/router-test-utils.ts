/**
 * Router Test Utilities
 * Helper functions for mocking router state in integration tests
 */

// Import the wouter mock helpers
const wouterMock = require('../../__mocks__/wouter.js');

export interface RouterMockConfig {
  pathname?: string;
  search?: string;
  params?: Record<string, string>;
  navigate?: jest.MockedFunction<any>;
}

/**
 * Safely set up router mock state for tests
 * This prevents JSDOM navigation errors while providing realistic router behavior
 */
export const setupRouterMock = (config: RouterMockConfig = {}) => {
  const {
    pathname = '/',
    search = '',
    params = {},
    navigate = jest.fn()
  } = config;

  // Set wouter mock state
  if (wouterMock.__setLocation) {
    wouterMock.__setLocation(pathname);
  }
  if (wouterMock.__setSearch) {
    wouterMock.__setSearch(search);
  }
  if (wouterMock.__setParams) {
    wouterMock.__setParams(params);
  }

  // Don't try to mock window.location - causes JSDOM navigation errors
  // Instead, rely on wouter mocks to handle routing state

  // Set up URLSearchParams for the search string without causing infinite recursion
  const mockURLSearchParams = new URLSearchParams(search);
  // Don't override global URLSearchParams to avoid recursion issues

  return {
    navigate,
    location: window.location,
    searchParams: mockURLSearchParams
  };
};

/**
 * Reset router mock state to defaults
 */
export const resetRouterMock = () => {
  if (wouterMock.__resetMocks) {
    wouterMock.__resetMocks();
  }
  // Don't try to set up location to avoid JSDOM navigation errors
};

/**
 * Simulate navigation to a new route
 */
export const navigateToRoute = (pathname: string, search: string = '', params: Record<string, string> = {}) => {
  return setupRouterMock({ pathname, search, params });
};

/**
 * Extract parameters from URL search string
 */
export const extractSearchParams = (search: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(search);
  
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  return params;
};

/**
 * Helper for tests that need residence ID from URL
 */
export const setupResidenceRouterMock = (residenceId: string, pathname: string = '/residents/residence/documents') => {
  return setupRouterMock({
    pathname,
    search: `?residenceId=${residenceId}`,
    params: { residenceId }
  });
};

/**
 * Helper for tests that need building ID from URL  
 */
export const setupBuildingRouterMock = (buildingId: string, pathname: string = '/residents/building/documents') => {
  return setupRouterMock({
    pathname,
    search: `?buildingId=${buildingId}`,
    params: { buildingId }
  });
};

/**
 * Helper for manager routes with entity IDs
 */
export const setupManagerRouterMock = (entityId: string, entityType: 'building' | 'residence', basePath: string = '/manager') => {
  const pathname = `${basePath}/${entityType === 'building' ? 'buildings' : 'residences'}/documents`;
  const search = `?${entityType}Id=${entityId}`;
  const params = { [`${entityType}Id`]: entityId };
  
  return setupRouterMock({ pathname, search, params });
};

/**
 * Test helper to verify navigation calls
 */
export const expectNavigationCall = (navigate: jest.MockedFunction<any>, expectedPath: string, expectedOptions?: any) => {
  expect(navigate).toHaveBeenCalledWith(expectedPath, expectedOptions);
};

/**
 * Create a mock navigate function with tracking
 */
export const createMockNavigate = () => {
  const navigate = jest.fn();
  
  navigate.mockImplementation((path: string, options?: any) => {
    // Update the router state when navigate is called
    const [pathname, search] = path.split('?');
    setupRouterMock({
      pathname,
      search: search ? `?${search}` : '',
      params: extractSearchParams(search || '')
    });
  });
  
  return navigate;
};