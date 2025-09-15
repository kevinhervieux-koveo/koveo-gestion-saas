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

// Simple chainable column mock - recursive self-reference approach
const createChainableColumn = (type, name, options = {}) => {
  const column = {
    type,
    name,
    ...options
  };
  
  // Add all chainable methods that return the same object
  const chainableMethods = ['primaryKey', 'notNull', 'unique', 'default', 'references', 'onDelete', 'onUpdate', 'array'];
  
  chainableMethods.forEach(method => {
    column[method] = jest.fn(() => {
      // Return a new object that also has all the chainable methods
      const newColumn = createChainableColumn(type, name, { ...options, [method]: true });
      return newColumn;
    });
  });
  
  return column;
};

const text = jest.fn().mockImplementation((name) => createChainableColumn('text', name));
const varchar = jest.fn().mockImplementation((name, options) => createChainableColumn('varchar', name, options));
const boolean = jest.fn().mockImplementation((name) => createChainableColumn('boolean', name));
const timestamp = jest.fn().mockImplementation((name) => createChainableColumn('timestamp', name));
const integer = jest.fn().mockImplementation((name) => createChainableColumn('integer', name));
const uuid = jest.fn().mockImplementation((name) => createChainableColumn('uuid', name));
const serial = jest.fn().mockImplementation((name) => createChainableColumn('serial', name));
const date = jest.fn().mockImplementation((name) => createChainableColumn('date', name));
const json = jest.fn().mockImplementation((name) => createChainableColumn('json', name));
const primaryKey = jest.fn().mockImplementation(() => createChainableColumn('primaryKey'));
const unique = jest.fn().mockImplementation(() => createChainableColumn('unique'));
const index = jest.fn().mockImplementation(() => createChainableColumn('index'));

module.exports = {
  pgEnum,
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  uuid,
  serial,
  date,
  json,
  primaryKey,
  unique,
  index
};