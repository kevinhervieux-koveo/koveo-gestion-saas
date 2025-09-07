// Universal mock for all server modules to prevent ES module import issues

// Database mocks
export const db = {};
export const pool = {};
export const sql = {};

// Storage mocks
export const storage = {
  getUser: () => Promise.resolve(null),
  createUser: () => Promise.resolve({ id: 'test-user' }),
  updateUser: () => Promise.resolve(true),
  deleteUser: () => Promise.resolve(true),
  getUsers: () => Promise.resolve([]),
  organizations: {
    getByUser: () => Promise.resolve([]),
    create: () => Promise.resolve({ id: 'test-org' }),
    get: () => Promise.resolve(null),
  },
  buildings: {
    getByOrganization: () => Promise.resolve([]),
    create: () => Promise.resolve({ id: 'test-building' }),
  },
  residences: {
    getByBuilding: () => Promise.resolve([]),
    create: () => Promise.resolve({ id: 'test-residence' }),
  }
};

// Configuration mocks
export const config = {
  database: {
    url: 'mock://database'
  },
  security: {
    sessionSecret: 'test-secret'
  },
  email: {
    host: 'mock-smtp',
    port: 587
  }
};

// Authentication middleware mocks  
export const isAuthenticated = (req, res, next) => {
  req.user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    role: 'admin',
    organizationId: 'test-org-id'
  };
  next();
};

export const requireRole = (role) => (req, res, next) => {
  req.user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    role: role || 'admin',
    organizationId: 'test-org-id'
  };
  next();
};

// API route mocks
export const router = {
  get: () => {},
  post: () => {},
  put: () => {},
  delete: () => {},
  use: () => {}
};

// Default export for compatibility
export default {
  db,
  pool,
  sql,
  storage,
  config,
  isAuthenticated,
  requireRole,
  router
};