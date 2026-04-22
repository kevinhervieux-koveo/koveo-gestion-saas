/**
 * Mock for drizzle-orm - Provides mock query builder functions for tests
 */

// Mock the eq function that's used in auth tests
export const eq = jest.fn().mockImplementation((column: any, value: any) => {
  return {
    type: 'condition',
    column,
    value,
    operator: 'eq',
    toString: () => `${column?.name || 'column'} = ${value}`
  };
});

// Mock other common drizzle-orm functions that might be used
export const and = jest.fn().mockImplementation((...conditions: any[]) => ({
  type: 'and',
  conditions,
  toString: () => conditions.join(' AND ')
}));

export const or = jest.fn().mockImplementation((...conditions: any[]) => ({
  type: 'or', 
  conditions,
  toString: () => conditions.join(' OR ')
}));

export const gt = jest.fn().mockImplementation((column: any, value: any) => ({
  type: 'condition',
  column,
  value,
  operator: 'gt',
  toString: () => `${column?.name || 'column'} > ${value}`
}));

export const lt = jest.fn().mockImplementation((column: any, value: any) => ({
  type: 'condition',
  column,
  value,
  operator: 'lt',
  toString: () => `${column?.name || 'column'} < ${value}`
}));

export const gte = jest.fn().mockImplementation((column: any, value: any) => ({
  type: 'condition',
  column,
  value,
  operator: 'gte',
  toString: () => `${column?.name || 'column'} >= ${value}`
}));

export const lte = jest.fn().mockImplementation((column: any, value: any) => ({
  type: 'condition',
  column,
  value,
  operator: 'lte',
  toString: () => `${column?.name || 'column'} <= ${value}`
}));

export const isNull = jest.fn().mockImplementation((column: any) => ({
  type: 'condition',
  column,
  operator: 'isNull',
  toString: () => `${column?.name || 'column'} IS NULL`
}));

export const isNotNull = jest.fn().mockImplementation((column: any) => ({
  type: 'condition',
  column,
  operator: 'isNotNull',
  toString: () => `${column?.name || 'column'} IS NOT NULL`
}));

export const like = jest.fn().mockImplementation((column: any, pattern: any) => ({
  type: 'condition',
  column,
  value: pattern,
  operator: 'like',
  toString: () => `${column?.name || 'column'} LIKE ${pattern}`
}));

export const ilike = jest.fn().mockImplementation((column: any, pattern: any) => ({
  type: 'condition',
  column,
  value: pattern,
  operator: 'ilike',
  toString: () => `${column?.name || 'column'} ILIKE ${pattern}`
}));

// Mock ordering functions
export const asc = jest.fn().mockImplementation((column: any) => ({
  type: 'order',
  column,
  direction: 'asc',
  toString: () => `${column?.name || 'column'} ASC`
}));

export const desc = jest.fn().mockImplementation((column: any) => ({
  type: 'order',
  column,
  direction: 'desc',
  toString: () => `${column?.name || 'column'} DESC`
}));

// Mock aggregate functions
export const count = jest.fn().mockImplementation((column?: any) => ({
  type: 'aggregate',
  function: 'count',
  column: column || '*',
  toString: () => `COUNT(${column?.name || '*'})`
}));

export const sum = jest.fn().mockImplementation((column: any) => ({
  type: 'aggregate',
  function: 'sum',
  column,
  toString: () => `SUM(${column?.name || 'column'})`
}));

export const avg = jest.fn().mockImplementation((column: any) => ({
  type: 'aggregate',
  function: 'avg',
  column,
  toString: () => `AVG(${column?.name || 'column'})`
}));

export const max = jest.fn().mockImplementation((column: any) => ({
  type: 'aggregate',
  function: 'max',
  column,
  toString: () => `MAX(${column?.name || 'column'})`
}));

export const min = jest.fn().mockImplementation((column: any) => ({
  type: 'aggregate',
  function: 'min',
  column,
  toString: () => `MIN(${column?.name || 'column'})`
}));

// Mock SQL placeholder functions
export const placeholder = jest.fn().mockImplementation((name: string) => ({
  type: 'placeholder',
  name,
  toString: () => `$${name}`
}));

export const sql = jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => ({
  type: 'sql',
  strings,
  values,
  toString: () => strings.join('?')
}));

// Mock transaction functions
export const inArray = jest.fn().mockImplementation((column: any, values: any[]) => ({
  type: 'condition',
  column,
  values,
  operator: 'in',
  toString: () => `${column?.name || 'column'} IN (${values.join(', ')})`
}));

export const notInArray = jest.fn().mockImplementation((column: any, values: any[]) => ({
  type: 'condition',
  column,
  values,
  operator: 'notIn',
  toString: () => `${column?.name || 'column'} NOT IN (${values.join(', ')})`
}));

// Lightweight stub for `relations` so schema files that declare relations
// (e.g. shared/schemas/maintenance.ts) can be loaded under jest without
// pulling in the real drizzle-orm internals.
export const relations = jest.fn().mockImplementation((table: any, fn: any) => ({
  table,
  config:
    typeof fn === 'function'
      ? fn({
          one: jest.fn(() => ({ type: 'one' })),
          many: jest.fn(() => ({ type: 'many' })),
        })
      : {},
}));

// Export everything as default for compatibility
export default {
  eq,
  and,
  or,
  gt,
  lt,
  gte,
  lte,
  isNull,
  isNotNull,
  like,
  ilike,
  asc,
  desc,
  count,
  sum,
  avg,
  max,
  min,
  placeholder,
  sql,
  inArray,
  notInArray
};