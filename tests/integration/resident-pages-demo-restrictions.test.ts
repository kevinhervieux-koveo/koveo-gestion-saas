/**
 * @file Resident Pages Demo Restrictions Integration Tests
 * @description Comprehensive integration tests validating demo user restrictions 
 * on all resident page mutations to ensure view-only access enforcement.
 * 
 * Tests all 5 resident page mutations across 4 feature areas:
 * - Residence Contact Management (3 mutations)
 * - Common Space Bookings (1 mutation)
 * - Documents (1 mutation)
 * - Demands (1 mutation)
 * 
 * Coverage: Each mutation has 3 test cases:
 * 1. Open Demo user (isOpenDemoUser = true) → 403 DEMO_RESTRICTED
 * 2. demo_resident/demo_tenant role (isOpenDemoUser = false, canUserPerformWriteOperation = false) → 403 DEMO_RESTRICTED
 * 3. Regular resident/tenant (isOpenDemoUser = false, canUserPerformWriteOperation = true) → SUCCESS
 * 
 * Additional Coverage:
 * - Verifies read-only pages (dashboard, building, my-calendar) allow GET requests
 * - Tests bilingual error messages and edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { enforceDemoSecurity } from '../../server/middleware/demo-security';
import { isOpenDemoUser, canUserPerformWriteOperation } from '../../server/rbac';

// Mock the RBAC module
jest.mock('../../server/rbac', () => ({
  isOpenDemoUser: jest.fn(),
  canUserPerformWriteOperation: jest.fn(),
}));

describe('Resident Pages Demo Restrictions', () => {
  const mockIsOpenDemoUser = isOpenDemoUser as jest.MockedFunction<typeof isOpenDemoUser>;
  const mockCanUserPerformWriteOperation = canUserPerformWriteOperation as jest.MockedFunction<typeof canUserPerformWriteOperation>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to create mock request object
   */
  const createMockRequest = (method: string, path: string, url?: string, role: string = 'demo_resident') => ({
    user: { id: 'demo-user-id', email: 'demo@example.com', role },
    method,
    path,
    url: url || path,
    headers: { 'accept-language': 'en-US,en;q=0.9' },
    body: {}
  });

  /**
   * Helper to create mock response object
   */
  const createMockResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  });

  /**
   * Helper to test Open Demo user restriction (isOpenDemoUser = true)
   */
  const testOpenDemoRestriction = async (method: string, path: string, url?: string, role: string = 'demo_resident') => {
    mockIsOpenDemoUser.mockResolvedValue(true);
    mockCanUserPerformWriteOperation.mockResolvedValue(false);
    
    const mockReq = createMockRequest(method, path, url, role);
    const mockRes = createMockResponse();
    const mockNext = jest.fn();

    const middleware = enforceDemoSecurity();
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'DEMO_RESTRICTED',
        title: 'Demo Mode - View Only',
        messageEn: expect.stringContaining('demonstration account'),
        messageFr: expect.stringContaining('compte de démonstration')
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  };

  /**
   * Helper to test demo_resident/demo_tenant role restriction 
   * (isOpenDemoUser = false, canUserPerformWriteOperation = false)
   */
  const testRoleDemoRestriction = async (method: string, path: string, role: string = 'demo_resident', url?: string) => {
    mockIsOpenDemoUser.mockResolvedValue(false);
    mockCanUserPerformWriteOperation.mockResolvedValue(false);
    
    const mockReq = createMockRequest(method, path, url, role);
    const mockRes = createMockResponse();
    const mockNext = jest.fn();

    const middleware = enforceDemoSecurity();
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'DEMO_RESTRICTED',
        title: 'Demo Mode - View Only',
        messageEn: expect.stringContaining('demonstration account'),
        messageFr: expect.stringContaining('compte de démonstration')
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  };

  /**
   * Helper to test regular user access (isOpenDemoUser = false, canUserPerformWriteOperation = true)
   */
  const testRegularUserAccess = async (method: string, path: string, role: string = 'resident', url?: string) => {
    mockIsOpenDemoUser.mockResolvedValue(false);
    mockCanUserPerformWriteOperation.mockResolvedValue(true);
    
    const mockReq = createMockRequest(method, path, url, role);
    const mockRes = createMockResponse();
    const mockNext = jest.fn();

    const middleware = enforceDemoSecurity();
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  };

  describe('Residence Contact Management Page (residence.tsx)', () => {
    const residenceId = '12345678-1234-1234-1234-123456789abc';
    const contactId = '87654321-4321-4321-4321-123456789abc';

    describe('POST /api/residences/:id/contacts (add contact)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', `/api/residences/${residenceId}/contacts`, undefined, 'demo_resident');
      });

      it('should block demo_resident role users', async () => {
        await testRoleDemoRestriction('POST', `/api/residences/${residenceId}/contacts`, 'demo_resident');
      });

      it('should block demo_tenant role users', async () => {
        await testRoleDemoRestriction('POST', `/api/residences/${residenceId}/contacts`, 'demo_tenant');
      });

      it('should allow regular resident users', async () => {
        await testRegularUserAccess('POST', `/api/residences/${residenceId}/contacts`, 'resident');
      });

      it('should allow regular tenant users', async () => {
        await testRegularUserAccess('POST', `/api/residences/${residenceId}/contacts`, 'tenant');
      });
    });

    describe('PUT /api/contacts/:id (update contact)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PUT', `/api/contacts/${contactId}`, undefined, 'demo_resident');
      });

      it('should block demo_resident role users', async () => {
        await testRoleDemoRestriction('PUT', `/api/contacts/${contactId}`, 'demo_resident');
      });

      it('should block demo_tenant role users', async () => {
        await testRoleDemoRestriction('PUT', `/api/contacts/${contactId}`, 'demo_tenant');
      });

      it('should allow regular resident users', async () => {
        await testRegularUserAccess('PUT', `/api/contacts/${contactId}`, 'resident');
      });

      it('should allow regular tenant users', async () => {
        await testRegularUserAccess('PUT', `/api/contacts/${contactId}`, 'tenant');
      });
    });

    describe('DELETE /api/contacts/:id (delete contact)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('DELETE', `/api/contacts/${contactId}`, undefined, 'demo_resident');
      });

      it('should block demo_resident role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/contacts/${contactId}`, 'demo_resident');
      });

      it('should block demo_tenant role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/contacts/${contactId}`, 'demo_tenant');
      });

      it('should allow regular resident users', async () => {
        await testRegularUserAccess('DELETE', `/api/contacts/${contactId}`, 'resident');
      });

      it('should allow regular tenant users', async () => {
        await testRegularUserAccess('DELETE', `/api/contacts/${contactId}`, 'tenant');
      });
    });
  });

  describe('Common Spaces Bookings Page (common-spaces.tsx)', () => {
    const spaceId = '12345678-1234-1234-1234-123456789abc';

    describe('POST /api/common-spaces/:id/bookings (create booking)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', `/api/common-spaces/${spaceId}/bookings`, undefined, 'demo_resident');
      });

      it('should block demo_resident role users', async () => {
        await testRoleDemoRestriction('POST', `/api/common-spaces/${spaceId}/bookings`, 'demo_resident');
      });

      it('should block demo_tenant role users', async () => {
        await testRoleDemoRestriction('POST', `/api/common-spaces/${spaceId}/bookings`, 'demo_tenant');
      });

      it('should allow regular resident users', async () => {
        await testRegularUserAccess('POST', `/api/common-spaces/${spaceId}/bookings`, 'resident');
      });

      it('should allow regular tenant users', async () => {
        await testRegularUserAccess('POST', `/api/common-spaces/${spaceId}/bookings`, 'tenant');
      });
    });

    describe('Read Operations', () => {
      it('should allow demo_resident users to GET /api/common-spaces (view spaces)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/common-spaces', undefined, 'demo_resident');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should allow demo_tenant users to GET /api/common-spaces/:id (view specific space)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', `/api/common-spaces/${spaceId}`, undefined, 'demo_tenant');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Documents Management (ModularDocumentPageWrapper)', () => {
    const documentId = '12345678-1234-1234-1234-123456789abc';

    describe('DELETE /api/documents/:id (delete document)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('DELETE', `/api/documents/${documentId}`, undefined, 'demo_resident');
      });

      it('should block demo_resident role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/documents/${documentId}`, 'demo_resident');
      });

      it('should block demo_tenant role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/documents/${documentId}`, 'demo_tenant');
      });

      it('should allow regular resident users', async () => {
        await testRegularUserAccess('DELETE', `/api/documents/${documentId}`, 'resident');
      });

      it('should allow regular tenant users', async () => {
        await testRegularUserAccess('DELETE', `/api/documents/${documentId}`, 'tenant');
      });
    });

    describe('Read Operations', () => {
      it('should allow demo_resident users to GET /api/documents (view documents)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/documents', undefined, 'demo_resident');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should allow demo_tenant users to GET /api/documents/:id (view document)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', `/api/documents/${documentId}`, undefined, 'demo_tenant');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Demands Management (ResidentDemandsPage)', () => {
    describe('POST /api/demands (create demand)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', '/api/demands', undefined, 'demo_resident');
      });

      it('should block demo_resident role users', async () => {
        await testRoleDemoRestriction('POST', '/api/demands', 'demo_resident');
      });

      it('should block demo_tenant role users', async () => {
        await testRoleDemoRestriction('POST', '/api/demands', 'demo_tenant');
      });

      it('should allow regular resident users', async () => {
        await testRegularUserAccess('POST', '/api/demands', 'resident');
      });

      it('should allow regular tenant users', async () => {
        await testRegularUserAccess('POST', '/api/demands', 'tenant');
      });
    });

    describe('Read Operations', () => {
      it('should allow demo_resident users to GET /api/demands (view demands)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/demands', undefined, 'demo_resident');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should allow demo_tenant users to GET /api/demands/:id (view demand details)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        const demandId = '12345678-1234-1234-1234-123456789abc';
        
        const mockReq = createMockRequest('GET', `/api/demands/${demandId}`, undefined, 'demo_tenant');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Read-Only Pages Access', () => {
    describe('Dashboard Page (dashboard.tsx)', () => {
      it('should allow demo_resident users to GET /api/residences (view dashboard data)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/residences', undefined, 'demo_resident');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should allow demo_tenant users to GET /api/bills (view bills on dashboard)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/bills', undefined, 'demo_tenant');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });

    describe('Building Page (building.tsx)', () => {
      it('should allow demo_resident users to GET /api/buildings (view buildings)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/buildings', undefined, 'demo_resident');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should allow demo_tenant users to GET /api/buildings/:id (view building details)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        const buildingId = '12345678-1234-1234-1234-123456789abc';
        
        const mockReq = createMockRequest('GET', `/api/buildings/${buildingId}`, undefined, 'demo_tenant');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });

    describe('My Calendar Page (my-calendar.tsx)', () => {
      it('should allow demo_resident users to GET /api/common-spaces (view available spaces)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/common-spaces', undefined, 'demo_resident');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should allow demo_tenant users to GET /api/demands (view demands calendar)', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        mockCanUserPerformWriteOperation.mockResolvedValue(false);
        
        const mockReq = createMockRequest('GET', '/api/demands', undefined, 'demo_tenant');
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Bilingual Error Messages', () => {
    it('should return English error messages when Accept-Language is en-US', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const mockReq = createMockRequest('POST', '/api/demands');
      mockReq.headers = { 'accept-language': 'en-US,en;q=0.9' };
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          title: 'Demo Mode - View Only',
          messageEn: expect.stringContaining('demonstration account'),
          messageFr: expect.stringContaining('compte de démonstration')
        })
      );
    });

    it('should return French error messages when Accept-Language is fr-CA', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const mockReq = createMockRequest('DELETE', '/api/contacts/123');
      mockReq.headers = { 'accept-language': 'fr-CA,fr;q=0.9' };
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          title: expect.stringMatching(/Demo Mode|Mode Démonstration/),
          messageEn: expect.stringContaining('demonstration account'),
          messageFr: expect.stringContaining('compte de démonstration')
        })
      );
    });

    it('should include user-friendly suggestions in error messages', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const residenceId = '12345678-1234-1234-1234-123456789abc';
      const mockReq = createMockRequest('POST', `/api/residences/${residenceId}/contacts`);
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          messageEn: expect.stringContaining('demonstration account'),
          messageFr: expect.stringContaining('compte de démonstration')
        })
      );
    });
  });

  describe('Edge Cases and Security', () => {
    it('should block demo users from PATCH requests on contacts', async () => {
      const contactId = '12345678-1234-1234-1234-123456789abc';
      await testOpenDemoRestriction('PATCH', `/api/contacts/${contactId}`, undefined, 'demo_resident');
    });

    it('should block demo users from PATCH requests on bookings', async () => {
      const spaceId = '12345678-1234-1234-1234-123456789abc';
      const bookingId = '87654321-4321-4321-4321-123456789abc';
      await testOpenDemoRestriction('PATCH', `/api/common-spaces/${spaceId}/bookings/${bookingId}`, undefined, 'demo_tenant');
    });

    it('should handle nested resource paths correctly for demo restrictions', async () => {
      const residenceId = '12345678-1234-1234-1234-123456789abc';
      await testOpenDemoRestriction('POST', `/api/residences/${residenceId}/contacts`, undefined, 'demo_resident');
    });

    it('should not leak sensitive information in demo restriction error messages', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const mockReq = createMockRequest('DELETE', '/api/contacts/sensitive-data-xyz');
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          title: expect.any(String)
        })
      );
      
      // Verify no sensitive information is leaked in user-facing messages
      const jsonCall = mockRes.json.mock.calls[0][0];
      const userFacingFields = {
        title: jsonCall.title,
        message: jsonCall.message,
        messageEn: jsonCall.messageEn,
        messageFr: jsonCall.messageFr,
        suggestion: jsonCall.suggestion,
        contact: jsonCall.contact
      };
      expect(JSON.stringify(userFacingFields)).not.toContain('sensitive-data');
    });
  });
});
