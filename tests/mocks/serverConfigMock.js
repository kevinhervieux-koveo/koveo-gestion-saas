/**
 * Mock for server config to fix database configuration issues in tests
 */

const mockConfig = {
  server: {
    nodeEnv: 'test',
    isProduction: false,
    port: 5000,
    domain: 'localhost'
  },
  database: {
    url: 'postgresql://test:test@localhost:5432/test',
    getRuntimeDatabaseUrl: jest.fn().mockReturnValue('postgresql://test:test@localhost:5432/test'),
    isDevelopment: true,
    isProduction: false
  },
  session: {
    secret: 'test-session-secret',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  email: {
    sendgridApiKey: 'test-sendgrid-key',
    fromEmail: 'test@example.com'
  }
};

module.exports = {
  config: mockConfig,
  default: mockConfig
};