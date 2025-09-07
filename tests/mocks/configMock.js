// Mock for server config
module.exports = {
  config: {
    port: 5000,
    environment: 'test',
    database: {
      url: 'mock://test-db',
    },
    session: {
      secret: 'test-secret',
    },
  },
  // Default export
  __esModule: true,
  default: {
    port: 5000,
    environment: 'test',
    database: {
      url: 'mock://test-db',
    },
    session: {
      secret: 'test-secret',
    },
  }
};