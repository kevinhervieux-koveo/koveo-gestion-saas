/**
 * Mock for server/db.ts - Prevents real database connections during tests
 * This ensures complete database isolation for all tests
 */

// Mock the Neon SQL function with Jest-compatible implementation
const mockSql = jest.fn().mockImplementation(async (strings: any, ...values: any[]) => {
  // Handle template literal calls
  if (Array.isArray(strings) && 'raw' in strings) {
    const query = strings.join('?').toLowerCase();
    
    // Common database queries with realistic responses
    if (query.includes('select version()')) {
      return [{ version: 'PostgreSQL 15.0 (Mock Version)' }];
    }
    if (query.includes('select now()')) {
      return [{ now: new Date().toISOString() }];
    }
    if (query.includes('select 1')) {
      return [{ '?column?': 1 }];
    }
    
    return [];
  }
  
  // Handle direct string calls
  if (typeof strings === 'string') {
    const query = strings.toLowerCase();
    if (query.includes('select')) return [];
    if (query.includes('insert')) return [{ id: 'mock-insert-id', affectedRows: 1 }];
    if (query.includes('update')) return [{ affectedRows: 1 }];
    if (query.includes('delete')) return [{ affectedRows: 1 }];
  }
  
  return [];
});

// Add query method for compatibility
Object.assign(mockSql, {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  end: jest.fn().mockResolvedValue(undefined),
  arrayMode: false,
  fullResults: false,
});

// Mock test data store for tracking invitation states
const mockDataStore = {
  invitations: new Map(),
  users: new Map(),
  organizations: new Map(),
  userOrganizations: new Map(),
  
  // Initialize with test data
  init() {
    // Clear any existing data first
    this.clear();
    
    // Add test organization
    this.organizations.set('mock-org-id-123', {
      id: 'mock-org-id-123',
      name: 'Test Registration Org',
      type: 'syndicate',
      address: '123 Test St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
    });
    
    // Add valid invitation token (main test token)
    this.invitations.set('test-registration-token-123', {
      id: 'mock-invitation-id-123',
      email: 'test-registration@example.com',
      token: 'test-registration-token-123',
      tokenHash: 'mock-token-hash',
      role: 'manager',
      organizationId: 'mock-org-id-123',
      invitedByUserId: 'mock-inviter-id-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending',
    });
    
    // Add expired invitation token for testing expired scenario
    this.invitations.set('expired-invitation-token', {
      id: 'mock-invitation-expired-id',
      email: 'expired@example.com',
      token: 'expired-invitation-token',
      tokenHash: 'expired-token-hash',
      role: 'tenant',
      organizationId: 'mock-org-id-123',
      invitedByUserId: 'mock-inviter-id-123',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago (expired)
      status: 'pending',
    });
    
    // Add already accepted invitation token for testing used scenario
    this.invitations.set('used-invitation-token', {
      id: 'mock-invitation-used-id',
      email: 'used@example.com',
      token: 'used-invitation-token',
      tokenHash: 'used-token-hash',
      role: 'tenant',
      organizationId: 'mock-org-id-123',
      invitedByUserId: 'mock-inviter-id-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (valid expiry)
      status: 'accepted', // Already accepted
      acceptedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      acceptedBy: 'existing-user-id',
    });
    
    // Add invitation token pointing to non-existent organization (for 500 error testing)
    this.invitations.set('invalid-org-token', {
      id: 'mock-invitation-invalid-org-id',
      email: 'invalid-org@example.com',
      token: 'invalid-org-token',
      tokenHash: 'invalid-org-token-hash',
      role: 'manager',
      organizationId: 'non-existent-org-id', // This organization doesn't exist
      invitedByUserId: 'mock-inviter-id-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending',
    });
  },
  
  // Reset to fresh state for each test
  reset() {
    this.clear();
    this.init();
  },
  
  // Set invitation as expired for tests
  setInvitationExpired(token: string) {
    const invitation = this.invitations.get(token);
    if (invitation) {
      invitation.expiresAt = new Date(Date.now() - 1000); // 1 second ago
    }
  },
  
  // Set invitation as accepted for tests
  setInvitationAccepted(token: string) {
    const invitation = this.invitations.get(token);
    if (invitation) {
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      invitation.acceptedBy = 'mock-user-id-123';
    }
  },
  
  // Add user to simulate existing user scenario
  addUser(email: string, userData: any) {
    this.users.set(email, userData);
  },
  
  // Clear data for test cleanup
  clear() {
    this.invitations.clear();
    this.users.clear();
    this.organizations.clear();
    this.userOrganizations.clear();
  }
};

// Don't initialize on module load - tests will call reset()

// Mock Drizzle database instance with comprehensive query builder support
const mockDb = {
  // Create realistic query builders that handle auth test scenarios
  select: jest.fn().mockImplementation(() => {
    const queryBuilder = {
      from: jest.fn().mockImplementation((table: any) => {
        const fromBuilder = {
          where: jest.fn().mockImplementation((condition: any) => {
            const whereBuilder = {
              limit: jest.fn().mockImplementation(() => {
                // Handle invitation queries
                if (table && (table._ && table._.name === 'invitations')) {
                  // Check all invitations for various test scenarios
                  const allInvitations = Array.from(mockDataStore.invitations.values());
                  return Promise.resolve(allInvitations.length > 0 ? [allInvitations[0]] : []);
                }
                
                // Handle user queries - look for users by email
                if (table && (table._ && table._.name === 'users')) {
                  const allUsers = Array.from(mockDataStore.users.values());
                  return Promise.resolve(allUsers.length > 0 ? [allUsers[0]] : []);
                }
                
                // Handle userOrganizations queries
                if (table && (table._ && table._.name === 'userOrganizations' || table._.name === 'user_organizations')) {
                  const allUserOrgs = Array.from(mockDataStore.userOrganizations.values());
                  return Promise.resolve(allUserOrgs);
                }
                
                return Promise.resolve([]);
              }),
              then: function(callback: any) {
                return this.limit().then(callback);
              }
            };
            return whereBuilder;
          }),
          orderBy: jest.fn().mockResolvedValue([]),
          limit: jest.fn().mockResolvedValue([]),
          offset: jest.fn().mockResolvedValue([]),
          then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([]).then(onFulfilled, onRejected); }
        };
        return fromBuilder;
      }),
      where: jest.fn().mockResolvedValue([]),
      then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([]).then(onFulfilled, onRejected); }
    };
    return queryBuilder;
  }),
  
  insert: jest.fn().mockImplementation((table: any) => ({
    into: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockImplementation(() => {
          // Handle user creation
          if (table._ && table._.name === 'users') {
            return Promise.resolve([{
              id: 'mock-user-id-123',
              username: 'test-registration',
              email: 'test-registration@example.com',
              firstName: 'Test',
              lastName: 'User',
              role: 'manager',
              language: 'en',
              isActive: true,
              password: 'mock-hashed-password',
              dataCollectionConsent: true,
              marketingConsent: false,
              analyticsConsent: true,
              thirdPartyConsent: false,
              acknowledgedRights: true,
            }]);
          }
          
          // Handle organization creation
          if (table._ && table._.name === 'organizations') {
            return Promise.resolve([mockDataStore.organizations.get('mock-org-id-123')]);
          }
          
          return Promise.resolve([{ id: 'mock-id' }]);
        }),
        then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([{ id: 'mock-id' }]).then(onFulfilled, onRejected); }
      }),
      then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([{ id: 'mock-id' }]).then(onFulfilled, onRejected); }
    }),
    values: jest.fn().mockImplementation((data: any) => ({
      returning: jest.fn().mockImplementation(() => {
        // Handle user creation with actual data
        if (table._ && table._.name === 'users') {
          return Promise.resolve([{
            id: 'mock-user-id-123',
            username: data.username || 'test-registration',
            email: data.email || 'test-registration@example.com',
            firstName: data.firstName || 'Test',
            lastName: data.lastName || 'User',
            role: data.role || 'manager',
            language: data.language || 'en',
            phone: data.phone,
            isActive: true,
            password: 'mock-hashed-password',
            dataCollectionConsent: data.dataCollectionConsent || false,
            marketingConsent: data.marketingConsent || false,
            analyticsConsent: data.analyticsConsent || false,
            thirdPartyConsent: data.thirdPartyConsent || false,
            acknowledgedRights: data.acknowledgedRights || false,
          }]);
        }
        
        return Promise.resolve([{ id: 'mock-id' }]);
      }),
      then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([{ id: 'mock-id' }]).then(onFulfilled, onRejected); }
    })),
    then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([{ id: 'mock-id' }]).then(onFulfilled, onRejected); }
  })),
  
  update: jest.fn().mockImplementation((table: any) => ({
    set: jest.fn().mockImplementation((data: any) => ({
      where: jest.fn().mockImplementation((condition: any) => {
        // Handle invitation updates
        if (table._ && table._.name === 'invitations') {
          const invitation = mockDataStore.invitations.get('test-registration-token-123');
          if (invitation) {
            Object.assign(invitation, data);
          }
          return Promise.resolve([invitation]);
        }
        
        return Promise.resolve([{ id: 'mock-id' }]);
      }),
      returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
      then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([{ id: 'mock-id' }]).then(onFulfilled, onRejected); }
    })),
    where: jest.fn().mockResolvedValue([]),
    then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([]).then(onFulfilled, onRejected); }
  })),
  
  delete: jest.fn().mockImplementation((table: any) => ({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
      then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([{ affectedRows: 1 }]).then(onFulfilled, onRejected); }
    }),
    where: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    then: function(onFulfilled: any, onRejected: any) { return Promise.resolve([{ affectedRows: 1 }]).then(onFulfilled, onRejected); }
  })),
  
  // Expose mock data store for test manipulation
  _mockDataStore: mockDataStore,
  
  // Reset method for test isolation
  _resetMocks() {
    // Clear Jest mock call history
    this.select.mockClear();
    this.insert.mockClear();
    this.update.mockClear();
    this.delete.mockClear();
    
    // Reset mock data store to fresh state with test data
    mockDataStore.reset();
    
    // Ensure the mock data store is accessible
    this._mockDataStore = mockDataStore;
  },
  
  // Direct access method for tests to modify state
  getMockDataStore() {
    return mockDataStore;
  }
};

// Mock eq function from drizzle-orm to prevent import errors
const mockEq = jest.fn().mockImplementation(() => 'mock-condition');

// Initialize mock data store immediately and make it globally accessible
mockDataStore.reset();

// Export mocked database components with guaranteed global reference
export const sql = mockSql;
export const db = mockDb;
export const pool = mockSql;

// Mock drizzle-orm functions
export const eq = mockEq;

// Mock config to prevent real config loading
export const config = {
  database: {
    url: 'mock://test-database-url'
  },
  server: {
    isProduction: false
  }
};

// Ensure global access to the same mock instance
(global as any).__mockDb = mockDb;
(global as any).__mockDataStore = mockDataStore;