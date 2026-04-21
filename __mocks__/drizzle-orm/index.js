// Re-export drizzle-orm operators for centralized mocking
const { eq, and, or, sql } = require('../enhanced-database-mock');

module.exports = {
  eq,
  and,
  or,
  sql
};