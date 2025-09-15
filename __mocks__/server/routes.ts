/**
 * Mock for server/routes.ts - Prevents real route imports during tests
 * Provides mock route registration function for testing
 */

// Mock the registerRoutes function
export const registerRoutes = jest.fn().mockImplementation((app: any) => {
  // Mock route registration - doesn't actually set up routes
  console.log('Mock: Registering routes for test');
  
  // Add some basic mock routes for testing
  if (app && app.get && app.post) {
    // Mock invitation validation route
    app.get('/api/invitations/validate/:token', (req: any, res: any) => {
      const { token } = req.params;
      if (token === 'test-registration-token-123') {
        res.json({
          valid: true,
          invitation: {
            id: 'mock-invitation-id-123',
            email: 'test-registration@example.com',
            role: 'manager',
            organizationId: 'mock-org-id-123',
            status: 'pending'
          }
        });
      } else {
        res.status(404).json({
          valid: false,
          message: 'Invitation not found or invalid',
          code: 'INVITATION_NOT_FOUND'
        });
      }
    });

    // Mock invitation acceptance route
    app.post('/api/invitations/accept/:token', (req: any, res: any) => {
      const { token } = req.params;
      const userData = req.body;
      
      if (token === 'test-registration-token-123') {
        if (!userData.firstName || !userData.lastName || !userData.password) {
          return res.status(400).json({
            message: 'First name, last name, and password are required',
            code: 'MISSING_REQUIRED_FIELDS'
          });
        }
        
        if (!userData.dataCollectionConsent || !userData.acknowledgedRights) {
          return res.status(400).json({
            message: 'Data collection consent and privacy rights acknowledgment are required',
            code: 'CONSENT_REQUIRED'
          });
        }

        res.status(201).json({
          message: 'Account created successfully',
          user: {
            id: 'mock-user-id-123',
            username: 'test-registration',
            email: 'test-registration@example.com',
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: 'manager',
            language: userData.language || 'en',
            phone: userData.phone
          }
        });
      } else {
        res.status(404).json({
          message: 'Invitation not found or invalid',
          code: 'INVITATION_NOT_FOUND'
        });
      }
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