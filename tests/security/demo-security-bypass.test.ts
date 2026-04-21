import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server';
import { enforceDemoSecurity } from '../../server/middleware/demo-security';
import { isOpenDemoUser } from '../../server/rbac';

// Mock the RBAC module
jest.mock('../../server/rbac', () => ({
  isOpenDemoUser: jest.fn(),
  canUserPerformWriteOperation: jest.fn(),
}));

describe('Demo Security Bypass Prevention', () => {
  const mockIsOpenDemoUser = isOpenDemoUser as jest.MockedFunction<typeof isOpenDemoUser>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SECOND ROUND SECURITY FIXES: Query Parameter and Nested Path Bypasses', () => {
    it('should block Open Demo users from GET /api/data?export=1', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/data',
        url: '/api/data?export=1',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/backup?create=true', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/backup',
        url: '/api/backup?create=true'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/sync?trigger=now', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/sync',
        url: '/api/sync?trigger=now'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/users/uuid/run-task', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/users/12345678-1234-1234-1234-123456789abc/run-task'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/buildings/uuid/recalc', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/buildings/12345678-1234-1234-1234-123456789abc/recalc'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/data/reindex', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/data/reindex'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/system/rebuild', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/system/rebuild'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/reports/calculate-stats', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/reports/calculate-stats'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/analytics/process-data', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/analytics/process-data'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Critical Security Tests: GET Endpoints That Mutate State', () => {
    it('should block Open Demo users from GET /api/features/trigger-sync', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/features/trigger-sync'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/bills/123/generate-stats', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/bills/123/generate-stats'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'manage',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/cleanup/orphan-report', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/cleanup/orphan-report'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/data/export', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/data/export'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'export',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/backup/create', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/backup/create'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_RESTRICTED',
          metadata: expect.objectContaining({
            action: 'export',
            isWriteOperation: true
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Second Round Fix: Previously Vulnerable Nested Patterns Now Blocked', () => {
    it('should block nested paths that were previously allowed by broad regex', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const vulnerablePaths = [
        '/api/users/12345678-1234-1234-1234-123456789abc/export-data',
        '/api/buildings/12345678-1234-1234-1234-123456789abc/generate-report',
        '/api/residences/12345678-1234-1234-1234-123456789abc/trigger-sync',
        '/api/bills/12345678-1234-1234-1234-123456789abc/calculate-total',
        '/api/documents/12345678-1234-1234-1234-123456789abc/backup-files'
      ];
      
      for (const path of vulnerablePaths) {
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: path
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      }
    });
  });

  describe('Safe GET Endpoints Should Be Allowed', () => {
    it('should allow Open Demo users to access GET /api/users', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/users'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow Open Demo users to access GET /api/buildings', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/buildings'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow Open Demo users to access GET /api/health', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/health'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('HTTP Method-Based Action Mapping', () => {
    it('should correctly map POST /api/buildings to create action', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'POST',
        path: '/api/buildings'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'create'
          })
        })
      );
    });

    it('should correctly map PUT /api/buildings/123 to update action', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'PUT',
        path: '/api/buildings/123'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'update'
          })
        })
      );
    });

    it('should correctly map DELETE /api/buildings/123 to delete action', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'DELETE',
        path: '/api/buildings/123'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'delete'
          })
        })
      );
    });

    it('should correctly map POST /api/buildings/assign to assign action', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'POST',
        path: '/api/buildings/assign'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'assign'
          })
        })
      );
    });
  });

  describe('THIRD ROUND SECURITY FIXES: Missed Dangerous Verbs', () => {
    // ARCHITECT ORDERED: Test all missed verbs that could bypass security
    const missedDangerousVerbs = [
      '/start', '/stop', '/pause', '/resume', '/toggle', 
      '/enable', '/disable', '/init', '/seed', '/migrate', '/prune'
    ];

    missedDangerousVerbs.forEach(verb => {
      it(`should block Open Demo users from GET /api/users${verb}`, async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: `/api/users${verb}`,
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              action: 'manage',
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it(`should block Open Demo users from GET /api/buildings/uuid${verb}`, async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: `/api/buildings/12345678-1234-1234-1234-123456789abc${verb}`
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              action: 'manage',
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    it('should block Open Demo users from GET /api/data/start-process', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/data/start-process',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/system/toggle-mode', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/system/toggle-mode',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/data/seed-database', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/data/seed-database',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/migration/prune-data', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/migration/prune-data',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('STRUCTURAL VALIDATION: Extra Path Segments Security', () => {
    // ARCHITECT ORDERED: ANY GET with extra path segments beyond allowed patterns = write operation
    
    it('should block Open Demo users from GET /api/users/random-action', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/users/random-action',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block Open Demo users from GET /api/buildings/uuid/any-extra-segment', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/buildings/12345678-1234-1234-1234-123456789abc/any-extra-segment',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Open Demo users to access exact collection paths', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/users',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow Open Demo users to access exact UUID resource paths', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'GET',
        path: '/api/buildings/12345678-1234-1234-1234-123456789abc',
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('PROPERTY-BASED TESTING: Random Verb Generation', () => {
    // ARCHITECT ORDERED: Ensure NO verb bypasses the structural rule
    
    const generateRandomVerb = () => {
      const words = ['action', 'task', 'job', 'work', 'operation', 'command', 'function', 'method'];
      const prefixes = ['do', 'run', 'exec', 'call', 'invoke', 'trigger', 'start', 'stop'];
      const suffixes = ['now', 'sync', 'async', 'fast', 'slow', 'all', 'one', 'many'];
      
      const word = words[Math.floor(Math.random() * words.length)];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      
      return Math.random() > 0.5 ? `${prefix}-${word}` : `${word}-${suffix}`;
    };

    it('should block Open Demo users from all random verbs under /api/users/', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      // Test 10 random verbs
      for (let i = 0; i < 10; i++) {
        const randomVerb = generateRandomVerb();
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: `/api/users/${randomVerb}`,
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      }
    });

    it('should block Open Demo users from all random verbs under /api/buildings/uuid/', async () => {
      mockIsOpenDemoUser.mockResolvedValue(true);
      
      // Test 10 random verbs
      for (let i = 0; i < 10; i++) {
        const randomVerb = generateRandomVerb();
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: `/api/buildings/12345678-1234-1234-1234-123456789abc/${randomVerb}`,
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should fail secure when an error occurs in the middleware', async () => {
      mockIsOpenDemoUser.mockRejectedValue(new Error('Database error'));
      
      const mockReq = {
        user: { id: 'demo-user-id', email: 'demo@example.com' },
        method: 'POST',
        path: '/api/buildings'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
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

  describe('FOURTH ROUND CRITICAL SECURITY FIXES: Query Parameter VALUE Bypasses', () => {
    describe('Value-driven verbs with varied keys', () => {
      it('should block Open Demo users from GET /api/budgets?action=approve', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/budgets',
          url: '/api/budgets?action=approve',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/users?op=delete', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/users',
          url: '/api/users?op=delete',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/buildings?command=start', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/buildings',
          url: '/api/buildings?command=start',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/data?task=migrate', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/data',
          url: '/api/data?task=migrate',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/system?mode=cleanup', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/system',
          url: '/api/system?mode=cleanup',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/reports?do=generate', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/reports',
          url: '/api/reports?do=generate',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Boolean-like dangerous flags', () => {
      it('should block Open Demo users from GET /api/data?approve=true', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/data',
          url: '/api/data?approve=true',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/system?delete=1', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/system',
          url: '/api/system?delete=1',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/features?sync=yes', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/features',
          url: '/api/features?sync=yes',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from GET /api/config?enable=on', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/config',
          url: '/api/config?enable=on',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('URL-encoded dangerous values', () => {
      it('should block Open Demo users from URL-encoded dangerous verbs', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/data',
          url: '/api/data?action=export%20all', // URL-encoded "export all"
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from complex URL-encoded dangerous queries', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/system',
          url: '/api/system?cmd=delete%20--force&confirm=true', // URL-encoded "delete --force"
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Deny-by-default allowlist policy for Demo users', () => {
      it('should block Open Demo users from non-allowlisted query parameters', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/users',
          url: '/api/users?customParam=harmless', // Non-allowlisted parameter
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow Open Demo users with safe allowlisted query parameters', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/users',
          url: '/api/users?page=2&limit=10&sort=name&filter=active',
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        // Should allow safe allowlisted parameters
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should block Open Demo users from dangerous values in allowlisted parameters', async () => {
        mockIsOpenDemoUser.mockResolvedValue(true);
        
        const mockReq = {
          user: { id: 'demo-user-id', email: 'demo@example.com' },
          method: 'GET',
          path: '/api/users',
          url: '/api/users?sort=delete&filter=export', // Dangerous values in allowlisted params
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEMO_RESTRICTED',
            metadata: expect.objectContaining({
              isWriteOperation: true
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Property-based testing for edge cases', () => {
      const dangerousVerbs = [
        'start', 'stop', 'pause', 'resume', 'toggle', 'enable', 'disable',
        'init', 'seed', 'migrate', 'prune', 'export', 'backup', 'approve', 
        'assign', 'delete', 'update', 'create', 'trigger', 'sync', 'refresh', 
        'generate', 'cleanup', 'reset', 'clear', 'flush', 'run', 'execute', 
        'process', 'recalc', 'reindex', 'rebuild', 'calculate', 'compute', 
        'analyze', 'restore', 'activate', 'deactivate'
      ];
      
      const actionKeys = ['action', 'op', 'operation', 'cmd', 'command', 'task', 'mode', 'do', 'perform'];

      dangerousVerbs.slice(0, 10).forEach((verb) => {
        actionKeys.slice(0, 3).forEach((key) => {
          it(`should block Open Demo users from GET /api/test?${key}=${verb}`, async () => {
            mockIsOpenDemoUser.mockResolvedValue(true);
            
            const mockReq = {
              user: { id: 'demo-user-id', email: 'demo@example.com' },
              method: 'GET',
              path: '/api/test',
              url: `/api/test?${key}=${verb}`,
              headers: { 'accept-language': 'en-US,en;q=0.9' }
            };
            const mockRes = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };
            const mockNext = jest.fn();

            const middleware = enforceDemoSecurity();
            await middleware(mockReq as any, mockRes as any, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
              expect.objectContaining({
                code: 'DEMO_RESTRICTED',
                metadata: expect.objectContaining({
                  isWriteOperation: true
                })
              })
            );
            expect(mockNext).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('Non-Demo users should not be affected by strict query validation', () => {
      it('should allow regular users with potentially dangerous query values if path is allowlisted', async () => {
        mockIsOpenDemoUser.mockResolvedValue(false);
        
        const mockReq = {
          user: { id: 'regular-user-id', email: 'user@example.com' },
          method: 'GET',
          path: '/api/users',
          url: '/api/users?customParam=export', // Would be blocked for Demo users
          headers: { 'accept-language': 'en-US,en;q=0.9' }
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const mockNext = jest.fn();

        const middleware = enforceDemoSecurity();
        await middleware(mockReq as any, mockRes as any, mockNext);

        // Regular users should follow standard validation, not strict Demo rules
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Unauthenticated Requests', () => {
    it('should skip demo security checks for unauthenticated requests', async () => {
      const mockReq = {
        user: undefined,
        method: 'POST',
        path: '/api/buildings'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const middleware = enforceDemoSecurity();
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockIsOpenDemoUser).not.toHaveBeenCalled();
    });
  });
});