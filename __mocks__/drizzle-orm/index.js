// Re-export drizzle-orm operators for centralized mocking
const { eq, and, or, sql } = require('../enhanced-database-mock');

// Lightweight stub for `relations` so schema files that declare relations
// (e.g. shared/schemas/maintenance.ts) can be loaded under jest without
// pulling in the real drizzle-orm internals.
const relations = jest.fn().mockImplementation((table, fn) => ({
  table,
  config: typeof fn === 'function'
    ? fn({
        one: jest.fn(() => ({ type: 'one' })),
        many: jest.fn(() => ({ type: 'many' })),
      })
    : {},
}));

module.exports = {
  eq,
  and,
  or,
  sql,
  relations,
};