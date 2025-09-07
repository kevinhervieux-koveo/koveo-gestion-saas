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
  };
};

module.exports = {
  createPgCoreMock,
};