// Mock for scripts that use import.meta
const scriptMock = {
  productionDemoSync: jest.fn().mockResolvedValue({ success: true }),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  quickSync: jest.fn().mockResolvedValue({ success: true }),
  default: jest.fn()
};

module.exports = scriptMock;