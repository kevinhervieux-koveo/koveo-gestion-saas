// Mock for server middleware
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

export default {
  isAuthenticated,
  requireRole
};