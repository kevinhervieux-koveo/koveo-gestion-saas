// Universal mock for all server modules to prevent ES module import issues

// Database mocks
const db = {};
const pool = {};
const sql = {};

// Storage mocks
const storage = {
  getUser: () => Promise.resolve(null),
  createUser: () => Promise.resolve({ id: 'test-user' }),
  updateUser: () => Promise.resolve(true),
  deleteUser: () => Promise.resolve(true),
  getUsers: () => Promise.resolve([]),
  getOrganizations: () => Promise.resolve([]),
  getUserByEmail: () => Promise.resolve(null),
  getBuildings: () => Promise.resolve([]),
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
const config = {
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
const isAuthenticated = (req, res, next) => {
  req.user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    role: 'admin',
    organizationId: 'test-org-id'
  };
  next();
};

const requireRole = (role) => (req, res, next) => {
  req.user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    role: role || 'admin',
    organizationId: 'test-org-id'
  };
  next();
};

// API route mocks
const router = {
  get: () => {},
  post: () => {},
  put: () => {},
  delete: () => {},
  use: () => {}
};

// Email service mock
const EmailService = class {
  constructor() {}
  sendPasswordReset() { return Promise.resolve({ success: true }); }
  sendInvitation() { return Promise.resolve({ success: true }); }
  sendNotification() { return Promise.resolve({ success: true }); }
};

// Routes registration mocks
const registerRoutes = () => {};
const registerAuthRoutes = () => {};
const registerUserRoutes = () => {};
const registerOrganizationRoutes = () => {};
const registerBuildingRoutes = () => {};
const registerResidenceRoutes = () => {};
const registerInvoiceRoutes = () => {};
const registerDemoRoutes = () => {};
const registerDocumentRoutes = () => {};
const registerDemandRoutes = () => {};
const registerMaintenanceRoutes = () => {};
const registerNotificationRoutes = () => {};
const registerCalendarRoutes = () => {};
const registerBillRoutes = () => {};
const registerCommonSpaceRoutes = () => {};
const registerFeatureRequestRoutes = () => {};
const registerAiMonitoringRoutes = () => {};

// RBAC mock functions
const requireOrganizationAccess = () => {};
const requireBuildingAccess = () => {};
const requireResidenceAccess = () => {};

// Storage interface mock
const getOrganizations = () => Promise.resolve([]);
const getUserByEmail = () => Promise.resolve(null);
const getBuildings = () => Promise.resolve([]);

// CommonJS exports
module.exports = {
  db,
  pool,
  sql,
  storage,
  config,
  isAuthenticated,
  requireRole,
  router,
  EmailService,
  registerRoutes,
  registerAuthRoutes,
  registerUserRoutes,
  registerOrganizationRoutes,
  registerBuildingRoutes,
  registerResidenceRoutes,
  registerInvoiceRoutes,
  registerDemoRoutes,
  registerDocumentRoutes,
  registerDemandRoutes,
  registerMaintenanceRoutes,
  registerNotificationRoutes,
  registerCalendarRoutes,
  registerBillRoutes,
  registerCommonSpaceRoutes,
  registerFeatureRequestRoutes,
  registerAiMonitoringRoutes,
  requireOrganizationAccess,
  requireBuildingAccess,
  requireResidenceAccess,
  getOrganizations,
  getUserByEmail,
  getBuildings
};