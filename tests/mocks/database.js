// Import from the unified TypeScript mock implementation
const databaseMock = require('./database');

// For backward compatibility, also export mockQuery
const mockQuery = jest.fn(() => Promise.resolve({ rows: [] }));

module.exports = {
  mockDb: databaseMock.mockDb || databaseMock.default?.mockDb,
  mockSql: databaseMock.mockSql || databaseMock.default?.mockSql,
  mockQuery,
  mockSchemaObject: databaseMock.mockSchemaObject || databaseMock.default?.mockSchemaObject,
};