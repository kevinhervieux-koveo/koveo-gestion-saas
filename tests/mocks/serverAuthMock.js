// Mock for server authentication module
export const storage = {
  getUser: () => Promise.resolve(null),
  createUser: () => Promise.resolve({ id: 'test-user' }),
  updateUser: () => Promise.resolve(true),
  deleteUser: () => Promise.resolve(true),
};

export const sql = {};
export const db = {};
export const pool = {};
export const config = {
  database: {
    url: 'mock://database'
  },
  security: {
    sessionSecret: 'test-secret'
  }
};

export default {
  storage,
  sql,
  db,
  pool,
  config
};