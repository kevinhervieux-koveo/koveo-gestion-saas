// Database configuration based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';

// Use appropriate database URL based on environment
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  switch (nodeEnv) {
    case 'production':
      throw new Error('DATABASE_URL must be set in production');
    case 'test':
      databaseUrl = 'postgresql://test:test@localhost:5432/koveo_test';
      break;
    case 'development':
    default:
      // In development, use the provisioned Replit database
      databaseUrl = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/koveo_dev';
      break;
  }
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