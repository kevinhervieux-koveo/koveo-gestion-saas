// Test utilities for comprehensive mocking

// Create a mock version of pg-core exports to handle imports directly
const createPgCoreMock = () => {
  const pgEnum = (name, values) => {
    // Return a function that creates enum columns
    const enumFunction = (columnName, config = {}) => ({
      name: columnName,
      dataType: 'enum',
      enumName: name,
      enumValues: values,
      ...config,
      primaryKey: function() { return { ...this, isPrimaryKey: true }; },
      notNull: function() { return { ...this, isNotNull: true }; },
      unique: function() { return { ...this, isUnique: true }; },
      default: function(value) { return { ...this, defaultValue: value }; },
      references: function(column) { return { ...this, references: column }; },
      array: function() { return { ...this, isArray: true }; },
    });
    
    // Add metadata to the function
    enumFunction.enumName = name;
    enumFunction.enumValues = values;
    enumFunction._ = {
      brand: 'PgEnum',
      baseType: 'string',
    };
    
    return enumFunction;
  };

  const pgTable = (name, columns) => ({
    _: {
      name,
      brand: 'PgTable',
      columns,
    },
    [name]: columns,
  });

  const varchar = (name, config = {}) => ({ 
    name, 
    dataType: 'varchar', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const text = (name, config = {}) => ({ 
    name, 
    dataType: 'text', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const timestamp = (name, config = {}) => ({ 
    name, 
    dataType: 'timestamp', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    defaultNow: function() { return { ...this, hasDefault: true }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const uuid = (name, config = {}) => ({ 
    name, 
    dataType: 'uuid', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    defaultRandom: function() { return { ...this, hasDefault: true }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const boolean = (name, config = {}) => ({ 
    name, 
    dataType: 'boolean', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const integer = (name, config = {}) => ({ 
    name, 
    dataType: 'integer', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const date = (name, config = {}) => ({ 
    name, 
    dataType: 'date', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const json = (name, config = {}) => ({ 
    name, 
    dataType: 'json', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const jsonb = (name, config = {}) => ({ 
    name, 
    dataType: 'jsonb', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const numeric = (name, config = {}) => ({ 
    name, 
    dataType: 'numeric', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const real = (name, config = {}) => ({ 
    name, 
    dataType: 'real', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const decimal = (name, config = {}) => ({ 
    name, 
    dataType: 'decimal', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const serial = (name, config = {}) => ({ 
    name, 
    dataType: 'serial', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  const bigint = (name, config = {}) => ({ 
    name, 
    dataType: 'bigint', 
    ...config,
    primaryKey: function() { return { ...this, isPrimaryKey: true }; },
    notNull: function() { return { ...this, isNotNull: true }; },
    unique: function() { return { ...this, isUnique: true }; },
    default: function(value) { return { ...this, defaultValue: value }; },
    references: function(column) { return { ...this, references: column }; },
    array: function() { return { ...this, isArray: true }; },
  });

  return {
    pgEnum,
    pgTable,
    varchar,
    text,
    timestamp,
    uuid,
    boolean,
    integer,
    date,
    json,
    jsonb,
    numeric,
    real,
    decimal,
    serial,
    bigint,
  };
};

module.exports = {
  createPgCoreMock,
};