// Simplified database configuration - always use DATABASE_URL
const nodeEnv = process.env.NODE_ENV || 'development';

// Use DATABASE_URL from environment (configured differently in workspace vs deployment)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set');
}

const config = {
  database: {
    url: databaseUrl
  },
  server: {
    nodeEnv
  }
};

export { config };