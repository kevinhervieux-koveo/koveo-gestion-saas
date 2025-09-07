// Mock for Drizzle ORM functions

const eq = (column, value) => ({ type: 'eq', column, value });
const and = (...conditions) => ({ type: 'and', conditions });
const or = (...conditions) => ({ type: 'or', conditions });
const like = (column, pattern) => ({ type: 'like', column, pattern });
const ilike = (column, pattern) => ({ type: 'ilike', column, pattern });
const inArray = (column, values) => ({ type: 'inArray', column, values });
const notInArray = (column, values) => ({ type: 'notInArray', column, values });
const isNull = (column) => ({ type: 'isNull', column });
const isNotNull = (column) => ({ type: 'isNotNull', column });
const gt = (column, value) => ({ type: 'gt', column, value });
const gte = (column, value) => ({ type: 'gte', column, value });
const lt = (column, value) => ({ type: 'lt', column, value });
const lte = (column, value) => ({ type: 'lte', column, value });
const ne = (column, value) => ({ type: 'ne', column, value });
const between = (column, min, max) => ({ type: 'between', column, min, max });
const notBetween = (column, min, max) => ({ type: 'notBetween', column, min, max });

// SQL helper functions
const sql = {
  raw: (query) => ({ type: 'raw', query }),
  placeholder: (name) => ({ type: 'placeholder', name }),
};

// Import pg-core mock functions
const { createPgCoreMock } = require('./testUtils');
const pgCoreMocks = createPgCoreMock();

// PostgreSQL specific mocks - include here for broader compatibility
const pgEnum = pgCoreMocks.pgEnum;

module.exports = {
  eq,
  and,
  or,
  like,
  ilike,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  gt,
  gte,
  lt,
  lte,
  ne,
  between,
  notBetween,
  sql,
  ...pgCoreMocks,
};