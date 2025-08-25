// Mock for import.meta to work in Jest environment

// Set NODE_ENV for tests if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

const importMetaMock = {
  env: {
    DEV: process.env.NODE_ENV === 'development',
    PROD: process.env.NODE_ENV === 'production',
    TEST: process.env.NODE_ENV === 'test',
    MODE: process.env.NODE_ENV || 'test',
    BASE_URL: '/',
    VITE_API_URL: process.env.VITE_API_URL || '/api',
  },
  url: 'file:///mock/url',
};

// Make import.meta available globally for Jest
if (typeof global !== 'undefined') {
  global.import = global.import || {};
  global.import.meta = importMetaMock;
}

module.exports = importMetaMock;
