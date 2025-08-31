// Database configuration for development and testing
const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/koveo_test'
  },
  server: {
    nodeEnv: process.env.NODE_ENV || 'development'
  }
};

module.exports = { config };