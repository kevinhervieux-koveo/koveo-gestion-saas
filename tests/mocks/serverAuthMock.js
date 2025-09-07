// Mock for server authentication module
const storage = {
  getUser: () => Promise.resolve(null),
  createUser: () => Promise.resolve({ id: 'test-user' }),
  updateUser: () => Promise.resolve(true),
  deleteUser: () => Promise.resolve(true),
};

const sql = {};
const db = {};
const pool = {};
const config = {
  database: {
    url: 'mock://database'
  },
  security: {
    sessionSecret: 'test-secret'
  }
};

module.exports = {
  storage,
  sql,
  db,
  pool,
  config
};