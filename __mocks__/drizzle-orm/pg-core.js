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

// Create chainable column objects with all necessary methods
const createChainableColumn = (type) => {
  const column = {
    type,
    primaryKey: jest.fn(() => column),
    notNull: jest.fn(() => column),
    unique: jest.fn(() => column),
    default: jest.fn(() => column),
    references: jest.fn(() => column),
    onDelete: jest.fn(() => column),
    onUpdate: jest.fn(() => column),
  };
  return column;
};

const text = jest.fn().mockImplementation(() => createChainableColumn('text'));
const varchar = jest.fn().mockImplementation((length) => createChainableColumn('varchar'));
const boolean = jest.fn().mockImplementation(() => createChainableColumn('boolean'));
const timestamp = jest.fn().mockImplementation(() => createChainableColumn('timestamp'));
const integer = jest.fn().mockImplementation(() => createChainableColumn('integer'));
const uuid = jest.fn().mockImplementation(() => createChainableColumn('uuid'));
const serial = jest.fn().mockImplementation(() => createChainableColumn('serial'));
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
  primaryKey,
  unique,
  index
};