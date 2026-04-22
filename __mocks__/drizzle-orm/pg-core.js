// Direct mock for drizzle-orm/pg-core to fix schema import issues
const pgEnum = jest.fn().mockImplementation((name, values) => {
  // Mirror drizzle-orm's real pgEnum, which returns a callable that builds a
  // column when invoked while also exposing enum metadata as properties.
  // Schema files like shared/schemas/core.ts use it both ways
  // (e.g. `userRoleEnum('role')` to declare a column).
  const enumInstance = (columnName) =>
    createChainableColumn('enum', columnName ?? '', { enum: enumInstance });
  // `name` is a read-only property on functions, so attach metadata directly
  // without using Object.assign (which would attempt to overwrite `name`).
  enumInstance.enumValues = values;
  enumInstance.enumName = name;
  return enumInstance;
});

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
  const chainableMethods = ['primaryKey', 'notNull', 'unique', 'default', 'defaultNow', 'references', 'onDelete', 'onUpdate', 'array', 'where', 'on'];
  
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
const jsonb = jest.fn().mockImplementation((name) => createChainableColumn('jsonb', name));
const decimal = jest.fn().mockImplementation((name, options) => createChainableColumn('decimal', name, options));
const numeric = jest.fn().mockImplementation((name, options) => createChainableColumn('numeric', name, options));
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
  jsonb,
  decimal,
  numeric,
  primaryKey,
  unique,
  index
};