// Database configuration based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';

// Use appropriate database URL based on environment
let databaseUrl;

switch (nodeEnv) {
  case 'production':
    databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must be set in production');
    }
    break;
  case 'development':
    databaseUrl = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
    if (!databaseUrl) {
      databaseUrl = 'postgresql://user:password@localhost:5432/koveo_dev';
    }
    break;
  case 'test':
    databaseUrl = 'postgresql://test:test@localhost:5432/koveo_test';
    break;
  default:
    databaseUrl = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
    break;
}

const config = {
  database: {
    url: databaseUrl
  },
  server: {
    nodeEnv
  }
};

module.exports = { config };