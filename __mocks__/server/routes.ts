/**
 * Mock for server/routes.ts - Provides actual mock routes for testing
 * Implements the invitation endpoints needed for auth tests
 */

// Ensure we use the same global mock instance
const { db } = require('./db');
const bcrypt = require('bcryptjs');

// Helper: Always prefer the global mock data store (set by the auto-mocked db.ts)
// over the local module copy. This ensures the test code and the route handlers
// share the same mockDataStore instance (otherwise mutations like
// setInvitationExpired in tests are invisible to routes).
function getActiveMockDataStore(): any {
  const globalStore = (global as any).__mockDataStore;
  if (globalStore) return globalStore;
  // Fallback to local module's data store (loaded via require above)
  return (db as any)._mockDataStore;
}

// Mock the registerRoutes function with comprehensive auth test support
export const registerRoutes = jest.fn().mockImplementation((app: any) => {
  // Mock route registration with actual route implementations
  console.log('Mock: Registering routes for test');
  
  // Use the global mock data store to ensure same instance as tests
  const globalMockDataStore = (global as any).__mockDataStore;
  const mockDataStore = globalMockDataStore || getActiveMockDataStore();
  
  console.log('Routes: Global mock data store available?', !!globalMockDataStore);
  console.log('Routes: Mock data store available during registration?', !!mockDataStore);
  
  if (mockDataStore && !mockDataStore.invitations.has('test-registration-token-123')) {
    console.log('Routes: Initializing mock data store...');
    mockDataStore.reset();
  }
  
  // Add comprehensive mock routes for auth testing
  if (app && app.get && app.post) {
    // Mock invitation validation route
    app.get('/api/invitations/validate/:token', (req: any, res: any) => {
      const { token } = req.params;
      const mockDataStore = getActiveMockDataStore();
      
      console.log('Route: Validating token:', token);
      
      if (!mockDataStore) {
        console.log('Route: Mock data store not available');
        return res.status(500).json({ error: 'Mock data store not available' });
      }
      
      const invitation = mockDataStore.invitations.get(token);
      console.log('Route: Found invitation:', invitation);
      
      if (!invitation) {
        console.log('Route: Invitation not found');
        return res.status(404).json({
          valid: false,
          message: 'Invitation not found or invalid',
          code: 'INVITATION_NOT_FOUND',
        });
      }
      
      console.log('Route: Checking expiry:', invitation.expiresAt, 'vs', new Date());
      // Check if expired
      if (invitation.expiresAt < new Date()) {
        console.log('Route: Invitation is expired');
        return res.status(410).json({
          valid: false,
          message: 'Invitation has expired',
          code: 'INVITATION_EXPIRED',
        });
      }
      
      console.log('Route: Checking status:', invitation.status);
      // Check if already accepted
      if (invitation.status === 'accepted') {
        console.log('Route: Invitation already accepted');
        return res.status(410).json({
          valid: false,
          message: 'Invitation has already been used',
          code: 'INVITATION_USED',
        });
      }
      
      // Valid invitation
      console.log('Route: Invitation is valid');
      return res.status(200).json({
        valid: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          organizationId: invitation.organizationId,
          status: invitation.status,
        },
      });
    });
    
    // Mock invitation acceptance route
    app.post('/api/invitations/accept/:token', async (req: any, res: any) => {
      const { token } = req.params;
      const userData = req.body;
      
      // Get mock data store from db
      const mockDataStore = getActiveMockDataStore();
      
      if (!mockDataStore) {
        return res.status(500).json({ error: 'Mock data store not available' });
      }
      
      const invitation = mockDataStore.invitations.get(token);
      
      if (!invitation) {
        return res.status(404).json({
          message: 'Invitation not found or invalid',
          code: 'INVITATION_NOT_FOUND'
        });
      }
      
      // Check if invitation is expired
      if (invitation.expiresAt < new Date()) {
        return res.status(410).json({
          message: 'Invitation has expired',
          code: 'INVITATION_EXPIRED'
        });
      }
      
      // Check if invitation is already accepted
      if (invitation.status === 'accepted') {
        return res.status(410).json({
          message: 'Invitation has already been used',
          code: 'INVITATION_USED'
        });
      }
      
      // Validate required fields
      if (!userData.firstName || !userData.lastName || !userData.password) {
        return res.status(400).json({
          message: 'First name, last name, and password are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      // Validate Quebec Law 25 consents
      if (!userData.dataCollectionConsent || !userData.acknowledgedRights) {
        return res.status(400).json({
          message: 'Data collection consent and privacy rights acknowledgment are required',
          code: 'CONSENT_REQUIRED'
        });
      }
      
      // Check if user already exists
      const existingUser = mockDataStore.users.get(invitation.email);
      if (existingUser) {
        return res.status(409).json({
          message: 'User already exists with this email',
          code: 'USER_EXISTS'
        });
      }
      
      // Validate organization exists (handles missing org error scenario)
      const organization = mockDataStore.organizations.get(invitation.organizationId);
      if (!organization) {
        return res.status(500).json({
          message: 'Internal server error during account creation',
          code: 'INVITATION_ACCEPT_ERROR'
        });
      }
      
      // Generate unique user ID
      const userId = `mock-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Hash the password using bcrypt so tests can verify with bcrypt.compare
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create new user
      const newUser = {
        id: userId,
        username: invitation.email.split('@')[0], // Generate username from email
        email: invitation.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: invitation.role,
        language: userData.language || 'en',
        phone: userData.phone,
        isActive: true,
        password: hashedPassword,
        dataCollectionConsent: userData.dataCollectionConsent || false,
        marketingConsent: userData.marketingConsent || false,
        analyticsConsent: userData.analyticsConsent || false,
        thirdPartyConsent: userData.thirdPartyConsent || false,
        acknowledgedRights: userData.acknowledgedRights || false,
      };
      
      // Store user in mock data store
      mockDataStore.users.set(invitation.email, newUser);
      
      // Create organization assignment
      if (!mockDataStore.userOrganizations) {
        mockDataStore.userOrganizations = new Map();
      }
      const userOrgKey = `${userId}-${invitation.organizationId}`;
      mockDataStore.userOrganizations.set(userOrgKey, {
        userId: userId,
        organizationId: invitation.organizationId,
        createdAt: new Date(),
      });
      
      // Mark invitation as accepted
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      invitation.acceptedBy = userId;
      
      // Return success response with complete user data including privacy consents
      res.status(201).json({
        message: 'Account created successfully',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
          language: newUser.language,
          phone: newUser.phone,
          dataCollectionConsent: newUser.dataCollectionConsent,
          marketingConsent: newUser.marketingConsent,
          analyticsConsent: newUser.analyticsConsent,
          thirdPartyConsent: newUser.thirdPartyConsent,
          acknowledgedRights: newUser.acknowledgedRights,
        }
      });
    });
  }
  
  return app;
});

// Mock other route-related functions
export const setupApiRoutes = jest.fn();
export const setupAuthRoutes = jest.fn();
export const setupStaticRoutes = jest.fn();

// Mock middleware setup
export const setupMiddleware = jest.fn();
export const setupErrorHandling = jest.fn();

// Mock route validation
export const validateRoutes = jest.fn().mockReturnValue(true);

// Export default registerRoutes for compatibility  
export default registerRoutes;