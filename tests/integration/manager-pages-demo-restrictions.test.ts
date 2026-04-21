/**
 * @file Manager Pages Demo Restrictions Integration Tests
 * @description Comprehensive integration tests validating demo user restrictions 
 * on all manager page mutations to ensure view-only access enforcement.
 * 
 * Tests all 18 manager page mutations across 6 feature areas:
 * - User Management (6 mutations)
 * - Buildings (3 mutations)
 * - Budget (4 mutations)
 * - Bills (2 mutations)
 * - Demands (2 mutations)
 * - Common Spaces (1 mutation)
 * 
 * Coverage: Each mutation has 3 test cases:
 * 1. Open Demo user (isOpenDemoUser = true) → 403 DEMO_RESTRICTED
 * 2. demo_manager role (isOpenDemoUser = false, canUserPerformWriteOperation = false) → 403 DEMO_RESTRICTED
 * 3. Regular manager (isOpenDemoUser = false, canUserPerformWriteOperation = true) → SUCCESS
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { enforceDemoSecurity } from '../../server/middleware/demo-security';
import { isOpenDemoUser, canUserPerformWriteOperation } from '../../server/rbac';

// Mock the RBAC module
jest.mock('../../server/rbac', () => ({
  isOpenDemoUser: jest.fn(),
  canUserPerformWriteOperation: jest.fn(),
}));

describe('Manager Pages Demo Restrictions', () => {
  const mockIsOpenDemoUser = isOpenDemoUser as jest.MockedFunction<typeof isOpenDemoUser>;
  const mockCanUserPerformWriteOperation = canUserPerformWriteOperation as jest.MockedFunction<typeof canUserPerformWriteOperation>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to create mock request object
   */
  const createMockRequest = (method: string, path: string, url?: string, role: string = 'demo_manager') => ({
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
  const testOpenDemoRestriction = async (method: string, path: string, url?: string) => {
    mockIsOpenDemoUser.mockResolvedValue(true);
    mockCanUserPerformWriteOperation.mockResolvedValue(false);
    
    const mockReq = createMockRequest(method, path, url, 'demo_manager');
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
   * Helper to test demo_manager role restriction (isOpenDemoUser = false, canUserPerformWriteOperation = false)
   */
  const testRoleDemoRestriction = async (method: string, path: string, url?: string) => {
    mockIsOpenDemoUser.mockResolvedValue(false);
    mockCanUserPerformWriteOperation.mockResolvedValue(false);
    
    const mockReq = createMockRequest(method, path, url, 'demo_manager');
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
   * Helper to test regular manager access (isOpenDemoUser = false, canUserPerformWriteOperation = true)
   */
  const testRegularManagerAccess = async (method: string, path: string, url?: string) => {
    mockIsOpenDemoUser.mockResolvedValue(false);
    mockCanUserPerformWriteOperation.mockResolvedValue(true);
    
    const mockReq = createMockRequest(method, path, url, 'manager');
    const mockRes = createMockResponse();
    const mockNext = jest.fn();

    const middleware = enforceDemoSecurity();
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  };

  describe('User Management Page (user-management.tsx)', () => {
    const userId = '12345678-1234-1234-1234-123456789abc';

    describe('POST /api/users (create user)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', '/api/users');
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', '/api/users');
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', '/api/users');
      });
    });

    describe('PUT /api/users/:id (update user)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PUT', `/api/users/${userId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('PUT', `/api/users/${userId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('PUT', `/api/users/${userId}`);
      });
    });

    describe('DELETE /api/users/:id (delete user)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('DELETE', `/api/users/${userId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/users/${userId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('DELETE', `/api/users/${userId}`);
      });
    });

    describe('POST /api/users/:id/resend-invitation (resend invitation)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', `/api/users/${userId}/resend-invitation`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', `/api/users/${userId}/resend-invitation`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', `/api/users/${userId}/resend-invitation`);
      });
    });

    describe('POST /api/users/:id/activate (activate user)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', `/api/users/${userId}/activate`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', `/api/users/${userId}/activate`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', `/api/users/${userId}/activate`);
      });
    });

    describe('POST /api/users/:id/deactivate (deactivate user)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', `/api/users/${userId}/deactivate`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', `/api/users/${userId}/deactivate`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', `/api/users/${userId}/deactivate`);
      });
    });
  });

  describe('Buildings Page (buildings.tsx)', () => {
    const buildingId = '12345678-1234-1234-1234-123456789abc';

    describe('POST /api/admin/buildings (create building)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', '/api/admin/buildings');
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', '/api/admin/buildings');
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', '/api/admin/buildings');
      });
    });

    describe('PUT /api/admin/buildings/:id (update building)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PUT', `/api/admin/buildings/${buildingId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('PUT', `/api/admin/buildings/${buildingId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('PUT', `/api/admin/buildings/${buildingId}`);
      });
    });

    describe('DELETE /api/admin/buildings/:id (delete building)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('DELETE', `/api/admin/buildings/${buildingId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/admin/buildings/${buildingId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('DELETE', `/api/admin/buildings/${buildingId}`);
      });
    });
  });

  describe('Budget Page (budget.tsx)', () => {
    const budgetId = '12345678-1234-1234-1234-123456789abc';

    describe('POST /api/budgets (create budget)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', '/api/budgets');
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', '/api/budgets');
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', '/api/budgets');
      });
    });

    describe('PUT /api/budgets/:id (update budget)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PUT', `/api/budgets/${budgetId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('PUT', `/api/budgets/${budgetId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('PUT', `/api/budgets/${budgetId}`);
      });
    });

    describe('DELETE /api/budgets/:id (delete budget)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('DELETE', `/api/budgets/${budgetId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/budgets/${budgetId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('DELETE', `/api/budgets/${budgetId}`);
      });
    });

    describe('PUT /api/budgets/:id/accept (accept budget)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PUT', `/api/budgets/${budgetId}/accept`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('PUT', `/api/budgets/${budgetId}/accept`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('PUT', `/api/budgets/${budgetId}/accept`);
      });
    });
  });

  describe('Bills Page (bills.tsx)', () => {
    const billId = '12345678-1234-1234-1234-123456789abc';

    describe('POST /api/bills (create bill)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', '/api/bills');
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', '/api/bills');
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', '/api/bills');
      });
    });

    describe('PUT /api/bills/:id (update bill)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PUT', `/api/bills/${billId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('PUT', `/api/bills/${billId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('PUT', `/api/bills/${billId}`);
      });
    });

    describe('PATCH /api/bills/:id (update bill status)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PATCH', `/api/bills/${billId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('PATCH', `/api/bills/${billId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('PATCH', `/api/bills/${billId}`);
      });
    });
  });

  describe('Demands Page (demands.tsx)', () => {
    const demandId = '12345678-1234-1234-1234-123456789abc';

    describe('PATCH /api/demands/:id (bulk update status)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('PATCH', `/api/demands/${demandId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('PATCH', `/api/demands/${demandId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('PATCH', `/api/demands/${demandId}`);
      });
    });

    describe('DELETE /api/demands/:id (bulk delete)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('DELETE', `/api/demands/${demandId}`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('DELETE', `/api/demands/${demandId}`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('DELETE', `/api/demands/${demandId}`);
      });
    });
  });

  describe('Common Spaces Stats Page (common-spaces-stats.tsx)', () => {
    const userId = '12345678-1234-1234-1234-123456789abc';

    describe('POST /api/common-spaces/users/:id/time-limits (set time limits)', () => {
      it('should block Open Demo users', async () => {
        await testOpenDemoRestriction('POST', `/api/common-spaces/users/${userId}/time-limits`);
      });

      it('should block demo_manager role users', async () => {
        await testRoleDemoRestriction('POST', `/api/common-spaces/users/${userId}/time-limits`);
      });

      it('should allow regular manager users', async () => {
        await testRegularManagerAccess('POST', `/api/common-spaces/users/${userId}/time-limits`);
      });
    });
  });

  describe('Demo Restriction Error Messages', () => {
    it('should return bilingual error messages for demo restrictions', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const mockReq = createMockRequest('POST', '/api/users');
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Demo Mode - View Only',
          messageEn: expect.stringContaining('demonstration account'),
          messageFr: expect.stringContaining('compte de démonstration'),
          suggestion: expect.stringContaining('contact us'),
          contact: expect.stringContaining('Contact our team')
        })
      );
    });

    it('should include metadata about the restricted operation', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const mockReq = createMockRequest('POST', '/api/admin/buildings');
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            isWriteOperation: true,
            method: 'POST',
            endpoint: '/api/admin/buildings',
            action: 'create'
          })
        })
      );
    });
  });

  describe('Edge Cases and Special Scenarios', () => {
    it('should block demo users with query parameters', async () => {
      await testOpenDemoRestriction('POST', '/api/users', '/api/users?action=create');
    });

    it('should block demo users with nested paths', async () => {
      await testOpenDemoRestriction('POST', '/api/users/12345/activate');
    });

    it('should handle multiple demo restriction checks efficiently', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const endpoints = [
        { method: 'POST', path: '/api/users' },
        { method: 'PUT', path: '/api/buildings/123' },
        { method: 'DELETE', path: '/api/budgets/456' },
        { method: 'PATCH', path: '/api/bills/789' }
      ];

      for (const endpoint of endpoints) {
        const mockReq = createMockRequest(endpoint.method, endpoint.path);
        const mockRes = createMockResponse();
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      }
    });
  });

  describe('Integration with RBAC', () => {
    it('should check isOpenDemoUser for each request', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      mockCanUserPerformWriteOperation.mockResolvedValue(false);
      
      const mockReq = createMockRequest('POST', '/api/users');
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockIsOpenDemoUser).toHaveBeenCalledWith('demo-user-id');
    });

    it('should handle RBAC errors gracefully', async () => {
      mockIsOpenDemoUser.mockRejectedValue(new Error('Database error'));
      
      const mockReq = createMockRequest('POST', '/api/users');
      const mockRes = createMockResponse();
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            errorOccurred: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
