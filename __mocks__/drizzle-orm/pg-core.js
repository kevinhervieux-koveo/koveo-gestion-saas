// Direct mock for drizzle-orm/pg-core to fix schema import issues
const pgEnum = jest.fn().mockImplementation((name, values) => ({
  name,
  enumValues: values,
  enumName: name
}));

const pgTable = jest.fn().mockImplementation((name, schema) => ({
  name,
  ...schema,
  _: { name, columns: schema }
}));

// Enhanced chainable column mock with proper method chaining support
const createChainableColumn = (type, name, options = {}) => {
  const column = {
    type,
    name,
    ...options,
    // Add common column properties
    isColumn: true,
    columnType: type,
    sqlName: name
  };
  
  // Comprehensive list of all drizzle column methods that need to be chainable
  const chainableMethods = [
    'primaryKey', 'notNull', 'unique', 'default', 'references', 
    'onDelete', 'onUpdate', 'array', '$default', '$type',
    // Additional constraint methods
    'check', 'foreignKey', 'index'
  ];
  
  // Create each chainable method that returns a new column instance
  chainableMethods.forEach(method => {
    column[method] = jest.fn((...args) => {
      // Create a new column instance with the applied method
      const newOptions = { ...options, [method]: true };
      if (args.length > 0) {
        newOptions[`${method}Args`] = args;
      }
      const newColumn = createChainableColumn(type, name, newOptions);
      return newColumn;
    });
  });
  
  // Add special methods that may have different behavior
  column.$inferSelect = jest.fn(() => ({}));
  column.$inferInsert = jest.fn(() => ({}));
  
  return column;
};

// Column type constructors with enhanced option handling
const text = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('text', name, options));
const varchar = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('varchar', name, options));
const boolean = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('boolean', name, options));
const timestamp = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('timestamp', name, options));
const integer = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('integer', name, options));
const uuid = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('uuid', name, options));
const serial = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('serial', name, options));
const date = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('date', name, options));
const json = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('json', name, options));

// Special constraint constructors
const primaryKey = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('primaryKey', name, options));
const unique = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('unique', name, options));
const index = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('index', name, options));

// Additional column types that might be used
const decimal = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('decimal', name, options));
const numeric = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('numeric', name, options));
const real = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('real', name, options));
const doublePrecision = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('doublePrecision', name, options));
const bigint = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('bigint', name, options));
const bigserial = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('bigserial', name, options));
const smallint = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('smallint', name, options));
const smallserial = jest.fn().mockImplementation((name, options = {}) => createChainableColumn('smallserial', name, options));

// Special SQL function mocks
const sql = jest.fn().mockImplementation((strings, ...values) => ({
  sql: Array.isArray(strings) ? strings.join('?') : strings,
  params: values
}));

const relations = jest.fn().mockImplementation((table, relationCallback) => ({
  table,
  relations: relationCallback || {}
}));

module.exports = {
  // Core table and enum constructors
  pgEnum,
  pgTable,
  
  // Column types
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  uuid,
  serial,
  date,
  json,
  decimal,
  numeric,
  real,
  doublePrecision,
  bigint,
  bigserial,
  smallint,
  smallserial,
  
  // Constraints
  primaryKey,
  unique,
  index,
  
  // Special functions
  sql,
  relations
};