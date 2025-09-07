// Mock for drizzle-orm/pg-core PostgreSQL specific functions
const { createPgCoreMock } = require('./testUtils');

const pgCoreMocks = createPgCoreMock();

// Additional PostgreSQL column types
const date = (name, config = {}) => ({ 
  name, 
  dataType: 'date', 
  ...config,
  primaryKey: function() { return { ...this, isPrimaryKey: true }; },
  notNull: function() { return { ...this, isNotNull: true }; },
  unique: function() { return { ...this, isUnique: true }; },
  array: function() { return { ...this, isArray: true }; },
});

const json = (name, config = {}) => ({ 
  name, 
  dataType: 'json', 
  ...config,
  primaryKey: function() { return { ...this, isPrimaryKey: true }; },
  notNull: function() { return { ...this, isNotNull: true }; },
  unique: function() { return { ...this, isUnique: true }; },
  array: function() { return { ...this, isArray: true }; },
});

module.exports = {
  ...pgCoreMocks,
  date,
  json,
  __esModule: true,
  default: {
    ...pgCoreMocks,
    date,
    json,
  }
};