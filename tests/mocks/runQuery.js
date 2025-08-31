// Mock runQuery function for integration tests
export const runQuery = jest.fn(() => Promise.resolve([]));
global.runQuery = runQuery;