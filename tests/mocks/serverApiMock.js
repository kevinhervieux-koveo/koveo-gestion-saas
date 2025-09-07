// Mock for server API routes
module.exports = {
  registerOrganizationRoutes: jest.fn(),
  registerUserRoutes: jest.fn(),
  registerBuildingRoutes: jest.fn(),
  registerDocumentRoutes: jest.fn(),
  registerDemandRoutes: jest.fn(),
  registerRoutes: jest.fn(),
  // Default export for any other route functions
  __esModule: true,
  default: {
    registerOrganizationRoutes: jest.fn(),
    registerUserRoutes: jest.fn(),
    registerBuildingRoutes: jest.fn(),
    registerDocumentRoutes: jest.fn(),
    registerDemandRoutes: jest.fn(),
  }
};