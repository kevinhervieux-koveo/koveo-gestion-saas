// For server integration tests, use actual drizzle-orm but mock only what's needed
let actualDrizzleOrm;
try {
  actualDrizzleOrm = jest.requireActual('drizzle-orm');
} catch (e) {
  actualDrizzleOrm = {};
}

// Re-export drizzle-orm operators for centralized mocking
const { eq, and, or, sql, gte, lte } = require('../enhanced-database-mock');

// Additional operators that might be used
const gt = jest.fn().mockImplementation((column, value) => ({
  type: 'gt', column, value
}));

const lt = jest.fn().mockImplementation((column, value) => ({
  type: 'lt', column, value
}));

const isNull = jest.fn().mockImplementation((column) => ({
  type: 'isNull', column
}));

const isNotNull = jest.fn().mockImplementation((column) => ({
  type: 'isNotNull', column
}));

const inArray = jest.fn().mockImplementation((column, values) => ({
  type: 'inArray', column, values
}));

const notInArray = jest.fn().mockImplementation((column, values) => ({
  type: 'notInArray', column, values
}));

const between = jest.fn().mockImplementation((column, min, max) => ({
  type: 'between', column, min, max
}));

const like = jest.fn().mockImplementation((column, pattern) => ({
  type: 'like', column, pattern
}));

const ilike = jest.fn().mockImplementation((column, pattern) => ({
  type: 'ilike', column, pattern
}));

const not = jest.fn().mockImplementation((condition) => ({
  type: 'not', condition
}));

const exists = jest.fn().mockImplementation((query) => ({
  type: 'exists', query
}));

const notExists = jest.fn().mockImplementation((query) => ({
  type: 'notExists', query
}));

// Relations function - for server integration tests, return empty object
// Relations are metadata only and don't affect actual database operations
const relations = jest.fn().mockImplementation((table, relationCallback) => {
  // Call the callback if provided to avoid errors, but don't use the result
  if (typeof relationCallback === 'function') {
    try {
      relationCallback({ one: jest.fn(), many: jest.fn() });
    } catch (e) {
      // Ignore errors in relation definitions
    }
  }
  // Return an empty object - relations are not needed for basic CRUD
  return {};
});

// Ordering functions
const desc = jest.fn().mockImplementation((column) => ({
  type: 'desc', column
}));

const asc = jest.fn().mockImplementation((column) => ({
  type: 'asc', column
}));

// Aggregation functions
const sum = jest.fn().mockImplementation((column) => ({
  type: 'sum', column
}));

const count = jest.fn().mockImplementation((column) => ({
  type: 'count', column
}));

const avg = jest.fn().mockImplementation((column) => ({
  type: 'avg', column
}));

const max = jest.fn().mockImplementation((column) => ({
  type: 'max', column
}));

const min = jest.fn().mockImplementation((column) => ({
  type: 'min', column
}));

// Additional functions the budget API uses
const ne = jest.fn().mockImplementation((column, value) => ({
  type: 'ne', column, value
}));

module.exports = {
  // Basic operators
  eq,
  and,
  or,
  sql,
  gte,
  lte,
  gt,
  lt,
  ne,
  
  // Null checks
  isNull,
  isNotNull,
  
  // Array operators
  inArray,
  notInArray,
  
  // Range operators
  between,
  
  // Pattern matching
  like,
  ilike,
  
  // Logical operators
  not,
  
  // Subquery operators
  exists,
  notExists,
  
  // Ordering functions
  desc,
  asc,
  
  // Aggregation functions
  sum,
  count,
  avg,
  max,
  min,
  
  // Relations
  relations
};