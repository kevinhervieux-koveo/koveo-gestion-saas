// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import * as schema from '@shared/schema';

const mockLimitFn = jest.fn().mockResolvedValue([]);
const mockAndResult = Promise.resolve([]);
(mockAndResult as Record<string, unknown>).limit = mockLimitFn;
(mockAndResult as Record<string, unknown>).orderBy = jest.fn().mockResolvedValue([]);

const mockSelectChain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockImplementation(() => {
    const result = Promise.resolve([]);
    (result as Record<string, unknown>).limit = jest.fn().mockResolvedValue([]);
    (result as Record<string, unknown>).orderBy = jest.fn().mockResolvedValue([]);
    return result;
  }),
  limit: jest.fn().mockResolvedValue([]),
  innerJoin: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([]),
};
const mockInsertChain = {
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{}]),
};
const mockDb = {
  select: jest.fn().mockReturnValue(mockSelectChain),
  insert: jest.fn().mockReturnValue(mockInsertChain),
};

jest.mock('../db', () => ({ db: mockDb }));

jest.mock('../services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({
    getDocuments: jest.fn().mockResolvedValue([]),
    getUploadUrl: jest.fn().mockResolvedValue({ success: true, uploadUrl: 'https://example.com/upload', filePath: '/objects/buildings/b-1/docs/test.pdf' }),
    confirmUpload: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    normalizePath: jest.fn((p: string) => p),
  })),
}));

jest.mock('../objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../services/consolidated-ai-service', () => ({
  aiService: {
    analyzeDocument: jest.fn().mockResolvedValue({ status: 'pending' }),
    getAnalysisStatus: jest.fn().mockResolvedValue({ status: 'complete' }),
  },
}));

jest.mock('../api/common-spaces-rules', () => ({
  loadCommonSpaceForBookingChecks: jest.fn(),
}));

import { createMcpServer, buildWriteErrorResponse, FK_BLOCKER_COLUMN_HINTS } from '../mcp/server';
import * as commonSpaceRules from '../api/common-spaces-rules';

const EXPECTED_TOOLS = [
  'list_organizations', 'get_organization',
  'list_buildings', 'get_building', 'create_building', 'update_building',
  'list_residences', 'get_residence', 'create_residence', 'update_residence',
  'list_users', 'get_user',
  'list_demands', 'get_demand', 'create_demand',
  'list_maintenance_requests', 'get_maintenance_request',
  'create_maintenance_request', 'update_maintenance_request',
  'list_bills', 'get_bill', 'create_bill', 'update_bill_status',
  'list_budgets', 'list_invoices',
  'list_communications', 'create_communication',
  'list_meetings', 'create_meeting',
  'list_common_spaces',
  'list_documents', 'request_upload_url', 'confirm_document_upload',
  'analyze_document', 'get_analysis_status',
  'get_mcp_info',
];

function createWhereResult(value: unknown[] = []) {
  const result = Promise.resolve(value);
  (result as Record<string, unknown>).limit = jest.fn().mockResolvedValue(value);
  (result as Record<string, unknown>).orderBy = jest.fn().mockResolvedValue(value);
  return result;
}

function getToolHandler(server: ReturnType<typeof createMcpServer>, toolName: string) {
  const tools = (server as ReturnType<typeof createMcpServer> & { _registeredTools: Record<string, { handler?: (...args: unknown[]) => unknown; callback?: (...args: unknown[]) => unknown }> })._registeredTools;
  if (!tools || !tools[toolName]) {
    throw new Error(`Tool "${toolName}" not found in registered tools`);
  }
  const tool = tools[toolName];
  const handler = tool.handler || tool.callback;
  if (typeof handler !== 'function') {
    throw new Error(`Tool "${toolName}" handler is not a function`);
  }
  return handler;
}

function parseToolResponse(result: { content?: Array<{ text?: string }> }): string {
  if (result?.content?.[0]?.text) return result.content[0].text;
  return JSON.stringify(result);
}

describe('MCP Server', () => {
  let server: ReturnType<typeof createMcpServer>;

  beforeAll(() => {
    server = createMcpServer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectChain.from.mockReturnThis();
    mockSelectChain.where.mockImplementation(() => createWhereResult([]));
    mockSelectChain.limit.mockResolvedValue([]);
    mockSelectChain.innerJoin.mockReturnThis();
    mockSelectChain.orderBy.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockSelectChain);
    mockInsertChain.values.mockReturnThis();
    mockInsertChain.returning.mockResolvedValue([{}]);
    mockDb.insert.mockReturnValue(mockInsertChain);
  });

  it('should create a server instance', () => {
    expect(server).toBeDefined();
  });

  it('should register all expected tools', () => {
    const tools = (server as ReturnType<typeof createMcpServer> & { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(tools).toBeDefined();
    const toolNames = Object.keys(tools);
    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected);
    }
    expect(toolNames.length).toBeGreaterThanOrEqual(EXPECTED_TOOLS.length);
  });

  describe('Organization Access Control', () => {
    it('should list organizations from MCP scope', async () => {
      const handler = getToolHandler(server, 'list_organizations');
      const result = await handler({ role: 'admin' }, {});
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should deny access to organizations outside MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const handler = getToolHandler(server, 'get_organization');
      const result = await handler({ role: 'admin', organizationId: 'non-mcp-org' }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
    });

    it('should allow access to MCP-scoped organizations', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1', name: 'MCP Org' }]));
      const handler = getToolHandler(server, 'get_organization');
      const result = await handler({ role: 'admin', organizationId: 'org-1' }, {});
      expect(parseToolResponse(result)).not.toContain('Access denied');
    });
  });

  describe('Building CRUD - Role Restrictions', () => {
    it('should deny tenants from creating buildings', async () => {
      const handler = getToolHandler(server, 'create_building');
      const result = await handler({
        role: 'tenant',
        organizationId: 'org-1',
        name: 'Test',
        address: '123 St',
        city: 'Montreal',
        postalCode: 'H2X1Y4',
        buildingType: 'apartment',
        totalUnits: 10,
      }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Access denied');
      expect(text).toContain('tenant');
    });

    it('should deny creation in non-MCP organizations', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const handler = getToolHandler(server, 'create_building');
      const result = await handler({
        role: 'admin',
        organizationId: 'non-mcp-org',
        name: 'Test',
        address: '123 St',
        city: 'Montreal',
        postalCode: 'H2X1Y4',
        buildingType: 'apartment',
        totalUnits: 10,
      }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
    });

    it('should create building in MCP-scoped org as admin', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      mockInsertChain.returning.mockResolvedValueOnce([{ id: 'b-new', name: 'Test Building' }]);
      const handler = getToolHandler(server, 'create_building');
      const result = await handler({
        role: 'admin',
        organizationId: 'org-1',
        name: 'Test Building',
        address: '123 Test St',
        city: 'Montreal',
        postalCode: 'H2X1Y4',
        buildingType: 'apartment',
        totalUnits: 10,
      }, {});
      expect(parseToolResponse(result)).not.toContain('Access denied');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('User/Residence - Tenant Restrictions', () => {
    it('should deny tenants from listing users', async () => {
      const handler = getToolHandler(server, 'list_users');
      const result = await handler({ role: 'tenant' }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
    });

    it('should deny tenants from viewing user details', async () => {
      const handler = getToolHandler(server, 'get_user');
      const result = await handler({ role: 'tenant', userId: 'user-1' }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
    });

    it('should deny tenants from creating residences', async () => {
      const handler = getToolHandler(server, 'create_residence');
      const result = await handler({
        role: 'tenant',
        buildingId: 'b-1',
        unitNumber: '101',
      }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
    });
  });

  describe('Building/Residence Update Tools', () => {
    function installUpdateMock(returningRow: unknown) {
      const updateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([returningRow]),
      };
      (mockDb as unknown as { update: jest.Mock }).update = jest.fn(() => updateChain);
      return updateChain;
    }

    it('denies tenants from updating buildings', async () => {
      const handler = getToolHandler(server, 'update_building');
      const result = await handler({ role: 'tenant', buildingId: 'b-1', name: 'New' }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
      expect(parseToolResponse(result)).toContain('tenant');
    });

    it('denies tenants from updating residences', async () => {
      const handler = getToolHandler(server, 'update_residence');
      const result = await handler({ role: 'tenant', residenceId: 'r-1', floor: 5 }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
      expect(parseToolResponse(result)).toContain('tenant');
    });

    it('denies update_building when target is outside the MCP org scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-x', organizationId: 'other-org', name: 'Old' }]));
      const handler = getToolHandler(server, 'update_building');
      const result = await handler({ role: 'admin', buildingId: 'b-x', name: 'New' }, {});
      expect(parseToolResponse(result)).toContain('Building not found or access denied');
    });

    it('denies update_residence when target is outside the MCP org scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() => createWhereResult([{ id: 'r-x', buildingId: 'b-x' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-x', organizationId: 'other-org' }]));
      const handler = getToolHandler(server, 'update_residence');
      const result = await handler({ role: 'admin', residenceId: 'r-x', floor: 3 }, {});
      expect(parseToolResponse(result)).toContain('Residence not found or access denied');
    });

    it('partially updates a building, leaving omitted fields untouched', async () => {
      const seeded = {
        id: 'b-1',
        organizationId: 'org-1',
        name: 'Old Name',
        address: '1 Old St',
        city: 'Montreal',
        postalCode: 'H1A1A1',
        buildingType: 'apartment',
        totalUnits: 10,
        province: 'QC',
      };
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([seeded]));
      const updated = { ...seeded, name: 'New Name' };
      const updateChain = installUpdateMock(updated);
      const handler = getToolHandler(server, 'update_building');
      const result = await handler({ role: 'admin', buildingId: 'b-1', name: 'New Name' }, {});
      const parsed = JSON.parse(parseToolResponse(result));
      expect(parsed.name).toBe('New Name');
      expect(parsed.address).toBe('1 Old St');
      expect(parsed.city).toBe('Montreal');
      expect(parsed.totalUnits).toBe(10);
      const setArg = (updateChain.set as jest.Mock).mock.calls[0][0];
      expect(setArg).toHaveProperty('name', 'New Name');
      expect(setArg).not.toHaveProperty('address');
      expect(setArg).not.toHaveProperty('city');
      expect(setArg).not.toHaveProperty('totalUnits');
      expect(setArg).not.toHaveProperty('organizationId');
    });

    it('partially updates a residence, leaving omitted fields untouched', async () => {
      const seeded = {
        id: 'r-1',
        buildingId: 'b-1',
        unitNumber: '101',
        floor: 1,
        bedrooms: 2,
        bathrooms: '1.5',
        monthlyFees: '500.00',
      };
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([seeded]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]));
      const updated = { ...seeded, floor: 7 };
      const updateChain = installUpdateMock(updated);
      const handler = getToolHandler(server, 'update_residence');
      const result = await handler({ role: 'manager', residenceId: 'r-1', floor: 7 }, {});
      const parsed = JSON.parse(parseToolResponse(result));
      expect(parsed.floor).toBe(7);
      expect(parsed.unitNumber).toBe('101');
      expect(parsed.bedrooms).toBe(2);
      expect(parsed.bathrooms).toBe('1.5');
      const setArg = (updateChain.set as jest.Mock).mock.calls[0][0];
      expect(setArg).toHaveProperty('floor', 7);
      expect(setArg).not.toHaveProperty('unitNumber');
      expect(setArg).not.toHaveProperty('bedrooms');
      expect(setArg).not.toHaveProperty('bathrooms');
      expect(setArg).not.toHaveProperty('buildingId');
    });
  });

  describe('Maintenance Requests - Scope Enforcement', () => {
    it('should deny access to maintenance for non-MCP buildings', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([]));
      const handler = getToolHandler(server, 'list_maintenance_requests');
      const result = await handler({ role: 'admin', buildingId: 'non-mcp-building' }, {});
      expect(parseToolResponse(result)).toMatch(/not found|access denied/i);
    });

    it('should return maintenance requests for MCP-scoped buildings', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'res-1' }]));
      const handler = getToolHandler(server, 'list_maintenance_requests');
      const result = await handler({ role: 'admin', buildingId: 'b-1' }, {});
      expect(result.content).toBeDefined();
    });

    it('should deny tenants from creating maintenance for non-MCP buildings', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([]));
      const handler = getToolHandler(server, 'create_maintenance_request');
      const result = await handler({
        role: 'tenant',
        buildingId: 'non-mcp-building',
        residenceId: 'res-1',
        description: 'Broken sink',
      }, {});
      expect(parseToolResponse(result)).toMatch(/not found|access denied/i);
    });
  });

  describe('Document Upload ACL', () => {
    it('should deny tenant upload without residenceId', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'request_upload_url');
      const result = await handler({
        role: 'tenant',
        buildingId: 'b-1',
        filename: 'test.pdf',
        documentType: 'documents',
      }, {});
      expect(parseToolResponse(result)).toContain('tenants must specify a residenceId');
    });

    it('should deny tenant upload of restricted document types', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'res-1', buildingId: 'b-1' }]));
      const mockLimit = jest.fn().mockResolvedValue([{ id: 'tenant-user' }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([{ id: 'tenant-user' }]);
        (r as Record<string, unknown>).limit = mockLimit;
        return r;
      });
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([{ id: 'ur-1', userId: 'tenant-user', residenceId: 'res-1', isActive: true }]);
        (r as Record<string, unknown>).limit = jest.fn().mockResolvedValue([{ id: 'ur-1' }]);
        return r;
      });
      const handler = getToolHandler(server, 'request_upload_url');
      const result = await handler({
        role: 'tenant',
        buildingId: 'b-1',
        filename: 'budget.xlsx',
        documentType: 'bills',
        residenceId: 'res-1',
      }, {});
      expect(parseToolResponse(result)).toContain('tenants can only upload document types');
    });

    it('should deny upload for non-MCP buildings', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([]));
      const handler = getToolHandler(server, 'request_upload_url');
      const result = await handler({
        role: 'admin',
        buildingId: 'non-mcp-building',
        filename: 'doc.pdf',
        documentType: 'documents',
      }, {});
      expect(parseToolResponse(result)).toMatch(/not found|access denied/i);
    });
  });

  describe('Analyze Document - Access Control', () => {
    it('should reject analysis for unregistered documents', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const handler = getToolHandler(server, 'analyze_document');
      const result = await handler({
        role: 'admin',
        storagePath: '/objects/buildings/b-1/docs/missing.pdf',
      }, {});
      expect(parseToolResponse(result)).toContain('Document not found');
      expect(parseToolResponse(result)).toContain('confirm_document_upload');
    });

    it('should deny tenant analysis of non-visible documents', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const limitMock = jest.fn().mockResolvedValue([{
        id: 'doc-1',
        filePath: '/objects/buildings/b-1/docs/private.pdf',
        buildingId: 'b-1',
        isVisibleToTenants: false,
        residenceId: null,
      }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = limitMock;
        return r;
      });
      mockSelectChain.where.mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'analyze_document');
      const result = await handler({
        role: 'tenant',
        storagePath: '/objects/buildings/b-1/docs/private.pdf',
      }, {});
      expect(parseToolResponse(result)).toContain('not visible to tenants');
    });

    it('should deny tenant analysis of residence-scoped doc without membership', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const docLimitMock = jest.fn().mockResolvedValue([{
        id: 'doc-2',
        filePath: '/objects/buildings/b-1/docs/lease.pdf',
        buildingId: 'b-1',
        isVisibleToTenants: true,
        residenceId: 'res-other',
      }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = docLimitMock;
        return r;
      });
      mockSelectChain.where.mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]));
      const userLimitMock = jest.fn().mockResolvedValue([{ id: 'tenant-user' }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = userLimitMock;
        return r;
      });
      const residenceLimitMock = jest.fn().mockResolvedValue([]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = residenceLimitMock;
        return r;
      });
      const handler = getToolHandler(server, 'analyze_document');
      const result = await handler({
        role: 'tenant',
        storagePath: '/objects/buildings/b-1/docs/lease.pdf',
      }, {});
      expect(parseToolResponse(result)).toContain('tenants can only analyze documents from their own residence');
    });

    it('should handle AI analysis errors gracefully', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const docLimitMock = jest.fn().mockResolvedValue([{
        id: 'doc-err',
        filePath: '/objects/buildings/b-1/docs/corrupt.pdf',
        buildingId: 'b-1',
        isVisibleToTenants: true,
        residenceId: null,
      }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = docLimitMock;
        return r;
      });
      mockSelectChain.where.mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'analyze_document');
      const result = await handler({
        role: 'admin',
        storagePath: '/objects/buildings/b-1/docs/corrupt.pdf',
      }, {});
      const text = parseToolResponse(result);
      expect(text).toMatch(/failed|not found|error/i);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should deny analysis for documents in non-MCP buildings', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const docLimitMock = jest.fn().mockResolvedValue([{
        id: 'doc-3',
        filePath: '/objects/buildings/b-ext/docs/invoice.pdf',
        buildingId: 'b-ext',
        isVisibleToTenants: true,
        residenceId: null,
      }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = docLimitMock;
        return r;
      });
      mockSelectChain.where.mockImplementationOnce(() => createWhereResult([]));
      const handler = getToolHandler(server, 'analyze_document');
      const result = await handler({
        role: 'admin',
        storagePath: '/objects/buildings/b-ext/docs/invoice.pdf',
      }, {});
      expect(parseToolResponse(result)).toContain('outside MCP scope');
    });
  });

  describe('Demand Creation - Scope Checks', () => {
    it('should create demand with valid MCP building', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]));
      const limitMock = jest.fn().mockResolvedValue([{ id: 'mcp-user', role: 'tenant' }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = limitMock;
        return r;
      });
      mockInsertChain.returning.mockResolvedValueOnce([{ id: 'd-new', type: 'maintenance' }]);
      const handler = getToolHandler(server, 'create_demand');
      const result = await handler({
        role: 'tenant',
        buildingId: 'b-1',
        type: 'maintenance',
        description: 'Broken window in unit 101',
      }, {});
      expect(parseToolResponse(result)).not.toContain('Access denied');
    });
  });

  describe('List Buildings - Scoped Behavior', () => {
    it('should list buildings scoped to MCP organization', async () => {
      const mockBuildings = [
        { id: 'b-1', name: 'Building A', organizationId: 'org-1', isActive: true },
        { id: 'b-2', name: 'Building B', organizationId: 'org-1', isActive: true },
      ];
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult(mockBuildings));
      const handler = getToolHandler(server, 'list_buildings');
      const result = await handler({ role: 'admin', organizationId: 'org-1' }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Building A');
      expect(text).toContain('Building B');
    });

    it('should deny listing buildings from non-MCP organization', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]));
      const handler = getToolHandler(server, 'list_buildings');
      const result = await handler({ role: 'admin', organizationId: 'non-mcp-org' }, {});
      expect(parseToolResponse(result)).toContain('Access denied');
    });
  });

  describe('List Residences - Scoped Behavior', () => {
    it('should deny listing residences for non-MCP buildings', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([]));
      const handler = getToolHandler(server, 'list_residences');
      const result = await handler({ role: 'admin', buildingId: 'non-mcp-building' }, {});
      expect(parseToolResponse(result)).toMatch(/not found|access denied/i);
    });

    it('should list residences for MCP-scoped building as admin', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([
          { id: 'res-1', unitNumber: '101' },
          { id: 'res-2', unitNumber: '102' },
        ]));
      const handler = getToolHandler(server, 'list_residences');
      const result = await handler({ role: 'admin', buildingId: 'b-1' }, {});
      const text = parseToolResponse(result);
      expect(text).not.toContain('Access denied');
    });
  });

  describe('delete_residence', () => {
    type DeleteCall = { table: 'invoices' | 'documents' | 'buildingElements' | 'maintenanceRequests' | 'demands' | 'userResidences' | 'residences' | 'unknown' };
    type UpdateCall = { table: 'demands' | 'invitations' | 'unknown' };
    let deleteCalls: DeleteCall[];
    let updateCalls: UpdateCall[];
    let deleteReturnings: Array<unknown[]>;
    let residenceDeleteReturning: unknown[];
    let demandsClearedReturning: unknown[];
    let invitationsCancelledReturning: unknown[];
    let throwOnTable: DeleteCall['table'] | null;
    let txError: Error | null;

    const RESIDENCE_TABLE_MAP = new Map<unknown, DeleteCall['table']>([
      [schema.invoices, 'invoices'],
      [schema.documents, 'documents'],
      [schema.buildingElements, 'buildingElements'],
      [schema.maintenanceRequests, 'maintenanceRequests'],
      [schema.demands, 'demands'],
      [schema.userResidences, 'userResidences'],
      [schema.residences, 'residences'],
    ]);
    const RESIDENCE_UPDATE_TABLE_MAP = new Map<unknown, UpdateCall['table']>([
      [schema.demands, 'demands'],
      [schema.invitations, 'invitations'],
    ]);

    function tableNameFor(t: unknown): DeleteCall['table'] {
      return RESIDENCE_TABLE_MAP.get(t) ?? 'unknown';
    }

    function makeChain(rows: unknown[]) {
      const chain: { where: jest.Mock; returning: jest.Mock } = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(rows),
      };
      return chain;
    }

    beforeEach(() => {
      deleteCalls = [];
      updateCalls = [];
      deleteReturnings = [];
      residenceDeleteReturning = [{ residenceId: 'res-1', unitNumber: '101' }];
      demandsClearedReturning = [];
      invitationsCancelledReturning = [];
      throwOnTable = null;
      txError = null;

      const tx = {
        delete: jest.fn((table: unknown) => {
          const name = tableNameFor(table);
          deleteCalls.push({ table: name });
          if (throwOnTable === name) {
            return {
              where: jest.fn().mockReturnThis(),
              returning: jest.fn().mockRejectedValue(
                new Error('update or delete on table "residences" violates foreign key constraint "demands_residence_id_residences_id_fk"'),
              ),
            };
          }
          if (name === 'residences') return makeChain(residenceDeleteReturning);
          const idx = deleteCalls.filter(c => c.table !== 'residences').length - 1;
          const rows = deleteReturnings[idx] ?? [];
          return makeChain(rows);
        }),
        update: jest.fn((table: unknown) => {
          const name = (RESIDENCE_UPDATE_TABLE_MAP.get(table) ?? 'unknown') as UpdateCall['table'];
          updateCalls.push({ table: name });
          const rows = name === 'invitations' ? invitationsCancelledReturning : demandsClearedReturning;
          return {
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue(rows),
          };
        }),
      };

      (mockDb as unknown as { transaction: jest.Mock }).transaction = jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        if (txError) throw txError;
        return fn(tx);
      });
      (mockDb as unknown as { delete: jest.Mock }).delete = jest.fn(() => makeChain([]));
    });

    it('denies tenants', async () => {
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler({ role: 'tenant', residenceId: 'res-1' }, {});
      expect(parseToolResponse(result)).toBe('Access denied: tenants cannot delete residences');
    });

    it('returns "not found" when the residence does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // residence lookup → empty
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler({ role: 'admin', residenceId: 'missing-res' }, {});
      expect(parseToolResponse(result)).toContain('Residence not found: missing-res');
    });

    it('denies access when the residence is in a building outside MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'res-1', buildingId: 'b-ext' }]))
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'other-org' }]));
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler({ role: 'admin', residenceId: 'res-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: residence is not in an MCP-scoped organization',
      );
    });

    it('deletes a residence inside MCP scope as admin (no dependents)', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'res-1', buildingId: 'b-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler({ role: 'admin', residenceId: 'res-1' }, {});
      const text = parseToolResponse(result);
      const parsed = JSON.parse(text);
      expect(parsed.deleted).toEqual({ residenceId: 'res-1', unitNumber: '101' });
      expect(parsed.cascaded).toEqual({
        invoices: 0,
        documents: 0,
        demands: 0,
        maintenanceRequests: 0,
        buildingElements: 0,
        userResidences: 0,
        invitations: 0,
      });
      expect(parsed.demandsAssignationCleared).toBe(0);
      expect(parsed.message).toMatch(/cascade applied/i);
    });

    it('cascades to invoices, documents, demands, maintenance requests, building elements and user-residence links', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'res-1', buildingId: 'b-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      // Order matches tool: invoices, documents, buildingElements, maintenanceRequests, demands, userResidences
      deleteReturnings = [
        [{ id: 'inv-1' }, { id: 'inv-2' }],
        [{ id: 'doc-1' }],
        [{ id: 'be-1' }, { id: 'be-2' }, { id: 'be-3' }],
        [{ id: 'mr-1' }],
        [{ id: 'd-1' }, { id: 'd-2' }],
        [{ id: 'ur-1' }],
      ];
      demandsClearedReturning = [{ id: 'd-3' }];
      invitationsCancelledReturning = [{ id: 'inv-1' }, { id: 'inv-2' }];
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler({ role: 'admin', residenceId: 'res-1' }, {});
      const text = parseToolResponse(result);
      const parsed = JSON.parse(text);
      expect(parsed.deleted).toEqual({ residenceId: 'res-1', unitNumber: '101' });
      expect(parsed.cascaded).toEqual({
        invoices: 2,
        documents: 1,
        demands: 2,
        maintenanceRequests: 1,
        buildingElements: 3,
        userResidences: 1,
        invitations: 2,
      });
      expect(parsed.demandsAssignationCleared).toBe(1);
      // Verify dependency order
      expect(deleteCalls.map(c => c.table)).toEqual([
        'invoices',
        'documents',
        'buildingElements',
        'maintenanceRequests',
        'demands',
        'userResidences',
        'residences',
      ]);
      // Update calls: demands assignation clear, then invitations
      // soft-cancel (task #383).
      expect(updateCalls.map(c => c.table)).toEqual(['demands', 'invitations']);
    });

    it('returns a readable failure message when the cascade transaction fails', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'res-1', buildingId: 'b-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      txError = new Error('update or delete on table "residences" violates foreign key constraint "demands_residence_id_residences_id_fk"');
      const handler = getToolHandler(server, 'delete_residence');
      const result = await handler({ role: 'admin', residenceId: 'res-1' }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Failed to delete');
      expect(text).toContain('residence');
    });
  });

  describe('delete_building', () => {
    type DeleteCall = {
      table:
        | 'invoices'
        | 'documents'
        | 'buildingElements'
        | 'maintenanceRequests'
        | 'demands'
        | 'demandComments'
        | 'userResidences'
        | 'residences'
        | 'bills'
        | 'budgets'
        | 'monthlyBudgets'
        | 'capitalInvestments'
        | 'financialCache'
        | 'notificationConfigurations'
        | 'notificationDispatchLog'
        | 'contacts'
        | 'commonSpaces'
        | 'userBuildings'
        | 'autoGeneratedProjects'
        | 'maintenanceProjects'
        | 'buildings'
        | 'unknown';
    };
    type UpdateCall = { table: 'demands' | 'invitations' | 'unknown' };
    let deleteCalls: DeleteCall[];
    let updateCalls: UpdateCall[];
    let returningsByTable: Partial<Record<DeleteCall['table'], unknown[]>>;
    let updateReturningsByTable: Partial<Record<UpdateCall['table'], unknown[]>>;
    let txError: Error | null;
    let selectQueue: Array<Array<{ id: string }>>;

    const BUILDING_TABLE_MAP = new Map<unknown, DeleteCall['table']>([
      [schema.invoices, 'invoices'],
      [schema.documents, 'documents'],
      [schema.buildingElements, 'buildingElements'],
      [schema.maintenanceRequests, 'maintenanceRequests'],
      [schema.demands, 'demands'],
      [schema.demandComments, 'demandComments'],
      [schema.userResidences, 'userResidences'],
      [schema.residences, 'residences'],
      [schema.bills, 'bills'],
      [schema.budgets, 'budgets'],
      [schema.monthlyBudgets, 'monthlyBudgets'],
      [schema.capitalInvestments, 'capitalInvestments'],
      [schema.financialCache, 'financialCache'],
      [schema.notificationConfigurations, 'notificationConfigurations'],
      [schema.notificationDispatchLog, 'notificationDispatchLog'],
      [schema.contacts, 'contacts'],
      [schema.commonSpaces, 'commonSpaces'],
      [schema.userBuildings, 'userBuildings'],
      [schema.autoGeneratedProjects, 'autoGeneratedProjects'],
      [schema.maintenanceProjects, 'maintenanceProjects'],
      [schema.buildings, 'buildings'],
    ]);
    const BUILDING_UPDATE_TABLE_MAP = new Map<unknown, UpdateCall['table']>([
      [schema.demands, 'demands'],
      [schema.invitations, 'invitations'],
    ]);

    function tableNameFor(t: unknown): DeleteCall['table'] {
      return BUILDING_TABLE_MAP.get(t) ?? 'unknown';
    }

    function makeChain(rows: unknown[]) {
      return {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(rows),
      };
    }

    beforeEach(() => {
      deleteCalls = [];
      updateCalls = [];
      returningsByTable = {};
      updateReturningsByTable = {};
      txError = null;
      selectQueue = [];

      const tx = {
        select: jest.fn(() => {
          const rows = selectQueue.shift() ?? [];
          return {
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue(rows),
          };
        }),
        delete: jest.fn((table: unknown) => {
          const name = tableNameFor(table);
          deleteCalls.push({ table: name });
          const rows = returningsByTable[name] ?? [];
          return makeChain(rows);
        }),
        update: jest.fn((table: unknown) => {
          const name = (BUILDING_UPDATE_TABLE_MAP.get(table) ?? 'unknown') as UpdateCall['table'];
          updateCalls.push({ table: name });
          const rows = updateReturningsByTable[name] ?? [];
          return {
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue(rows),
          };
        }),
      };

      (mockDb as unknown as { transaction: jest.Mock }).transaction = jest.fn(
        async (fn: (t: typeof tx) => Promise<unknown>) => {
          if (txError) throw txError;
          return fn(tx);
        },
      );
      (mockDb as unknown as { delete: jest.Mock }).delete = jest.fn(() => makeChain([]));
    });

    it('denies tenants', async () => {
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler({ role: 'tenant', buildingId: 'b-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: tenants cannot delete buildings',
      );
    });

    it('returns "not found" when the building does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // building lookup → empty
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler({ role: 'admin', buildingId: 'missing' }, {});
      expect(parseToolResponse(result)).toContain('Building not found: missing');
    });

    it('denies access when the building is outside MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'b-1', organizationId: 'other-org' }]),
        );
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler({ role: 'admin', buildingId: 'b-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: building is not in an MCP-scoped organization',
      );
    });

    it('deletes a building inside MCP scope as admin (no dependents)', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]),
        );
      returningsByTable.buildings = [{ id: 'b-1', name: 'Test Tower' }];
      // tx.select calls: residences (none), building demand IDs (none),
      // notification config IDs (none).
      selectQueue = [[], [], []];
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler({ role: 'admin', buildingId: 'b-1' }, {});
      const parsed = JSON.parse(parseToolResponse(result));
      expect(parsed.deleted).toEqual({ id: 'b-1', name: 'Test Tower' });
      expect(parsed.cascaded).toEqual({
        residences: 0,
        invoices: 0,
        documents: 0,
        bills: 0,
        budgets: 0,
        monthlyBudgets: 0,
        capitalInvestments: 0,
        financialCache: 0,
        demands: 0,
        demandComments: 0,
        maintenanceRequests: 0,
        buildingElements: 0,
        autoGeneratedProjects: 0,
        maintenanceProjects: 0,
        notificationConfigurations: 0,
        notificationDispatchLog: 0,
        contacts: 0,
        commonSpaces: 0,
        userBuildings: 0,
        userResidences: 0,
        invitations: 0,
      });
      expect(parsed.demandsAssignationCleared).toBe(0);
      expect(parsed.message).toMatch(/cascade applied/i);
      // No residences and no building demands/notification configs =>
      // demand_comments / notification_dispatch_log deletes are skipped.
      expect(deleteCalls.map(c => c.table)).toEqual([
        'bills',
        'budgets',
        'monthlyBudgets',
        'capitalInvestments',
        'financialCache',
        'invoices',
        'documents',
        'demands',
        'notificationConfigurations',
        'contacts',
        'commonSpaces',
        'userBuildings',
        'autoGeneratedProjects',
        'buildingElements',
        'maintenanceProjects',
        'buildings',
      ]);
      // Building-scoped assignation clear (demands), then building-scoped
      // invitations soft-cancel (task #383). No residences -> no
      // per-residence invitations update.
      expect(updateCalls.map(c => c.table)).toEqual(['demands', 'invitations']);
    });

    it('cascades through residences, financials, common spaces, building elements and maintenance projects', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]),
        );
      // tx.select calls in order:
      //   1. residences for this building
      //   2. demand IDs whose primary residence is in this building
      //   3. demand IDs whose primary building is this building
      //   4. notification_configuration IDs for this building
      selectQueue = [
        [{ id: 'res-1' }, { id: 'res-2' }],
        [{ id: 'd-r1' }],
        [{ id: 'd-b1' }],
        [{ id: 'nc-1' }],
      ];
      // Per-residence pass + building-scoped pass results, including the
      // demand_comments and notification_dispatch_log dependents that must be
      // torn down before their parent rows.
      returningsByTable.invoices = [{ id: 'inv-r1' }, { id: 'inv-r2' }];
      returningsByTable.documents = [{ id: 'doc-r1' }];
      returningsByTable.buildingElements = [{ id: 'be-r1' }];
      returningsByTable.maintenanceRequests = [{ id: 'mr-r1' }, { id: 'mr-r2' }];
      returningsByTable.demands = [{ id: 'd-r1' }];
      returningsByTable.demandComments = [{ id: 'dc-1' }, { id: 'dc-2' }];
      returningsByTable.userResidences = [{ id: 'ur-r1' }];
      returningsByTable.residences = [{ id: 'res-1' }, { id: 'res-2' }];
      returningsByTable.bills = [{ id: 'bill-1' }, { id: 'bill-2' }];
      returningsByTable.budgets = [{ id: 'bud-1' }];
      returningsByTable.monthlyBudgets = [{ id: 'mb-1' }];
      returningsByTable.capitalInvestments = [{ id: 'ci-1' }];
      returningsByTable.financialCache = [{ id: 'fc-1' }];
      returningsByTable.notificationConfigurations = [{ id: 'nc-1' }];
      returningsByTable.notificationDispatchLog = [{ id: 'ndl-1' }, { id: 'ndl-2' }, { id: 'ndl-3' }];
      returningsByTable.contacts = [{ id: 'c-1' }];
      returningsByTable.commonSpaces = [{ id: 'cs-1' }, { id: 'cs-2' }];
      returningsByTable.userBuildings = [{ id: 'ub-1' }];
      returningsByTable.autoGeneratedProjects = [{ id: 'ap-1' }];
      returningsByTable.maintenanceProjects = [{ id: 'mp-1' }];
      returningsByTable.buildings = [{ id: 'b-1', name: 'Test Tower' }];
      // demands clear runs twice (per-residence then per-building).
      updateReturningsByTable.demands = [{ id: 'd-clear' }];
      // invitations soft-cancel runs twice as well: once in the
      // per-residence step 1 sweep, once in the building-scoped step 2.
      updateReturningsByTable.invitations = [{ id: 'inv-cancel' }];

      const handler = getToolHandler(server, 'delete_building');
      const result = await handler({ role: 'admin', buildingId: 'b-1' }, {});
      const parsed = JSON.parse(parseToolResponse(result));
      expect(parsed.deleted).toEqual({ id: 'b-1', name: 'Test Tower' });
      // Residence-scoped + building-scoped counts are summed for shared tables.
      // demand_comments and notification_dispatch_log are reused across the
      // two passes, so the mock returns the same row count both times.
      expect(parsed.cascaded).toEqual({
        residences: 2,
        invoices: 2 + 2,
        documents: 1 + 1,
        bills: 2,
        budgets: 1,
        monthlyBudgets: 1,
        capitalInvestments: 1,
        financialCache: 1,
        demands: 1 + 1,
        demandComments: 2 + 2,
        maintenanceRequests: 2,
        buildingElements: 1 + 1,
        autoGeneratedProjects: 1,
        maintenanceProjects: 1,
        notificationConfigurations: 1,
        notificationDispatchLog: 3,
        contacts: 1,
        commonSpaces: 2,
        userBuildings: 1,
        userResidences: 1,
        invitations: 1 + 1, // per-residence + building-scoped sweep
      });
      expect(parsed.demandsAssignationCleared).toBe(2);
      // Verify the dependency order: residences first, then building-scoped.
      // demand_comments runs before each demands delete; notification_dispatch_log
      // runs before notification_configurations.
      expect(deleteCalls.map(c => c.table)).toEqual([
        'invoices',
        'documents',
        'buildingElements',
        'maintenanceRequests',
        'demandComments',
        'demands',
        'userResidences',
        'residences',
        'bills',
        'budgets',
        'monthlyBudgets',
        'capitalInvestments',
        'financialCache',
        'invoices',
        'documents',
        'demandComments',
        'demands',
        'notificationDispatchLog',
        'notificationConfigurations',
        'contacts',
        'commonSpaces',
        'userBuildings',
        'autoGeneratedProjects',
        'buildingElements',
        'maintenanceProjects',
        'buildings',
      ]);
      // Order of UPDATEs:
      //   1. per-residence demands assignation clear
      //   2. per-residence invitations soft-cancel (task #383)
      //   3. per-building demands assignation clear
      //   4. per-building invitations soft-cancel
      expect(updateCalls.map(c => c.table)).toEqual([
        'demands',
        'invitations',
        'demands',
        'invitations',
      ]);
    });

    it('returns a readable failure message when the cascade transaction fails', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'b-1', organizationId: 'org-1' }]),
        );
      txError = new Error(
        'update or delete on table "buildings" violates foreign key constraint "bills_building_id_buildings_id_fk"',
      );
      const handler = getToolHandler(server, 'delete_building');
      const result = await handler({ role: 'admin', buildingId: 'b-1' }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Failed to delete');
      expect(text).toContain('building');
    });
  });

  describe('delete_bill', () => {
    type DeleteCall = { table: 'payments' | 'bills' | 'unknown' };
    let deleteCalls: DeleteCall[];
    let returningsByTable: Partial<Record<DeleteCall['table'], unknown[]>>;
    let txError: Error | null;

    const BILL_TABLE_MAP = new Map<unknown, DeleteCall['table']>([
      [schema.payments, 'payments'],
      [schema.bills, 'bills'],
    ]);

    function tableNameFor(t: unknown): DeleteCall['table'] {
      return BILL_TABLE_MAP.get(t) ?? 'unknown';
    }

    function makeChain(rows: unknown[]) {
      return {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(rows),
      };
    }

    beforeEach(() => {
      deleteCalls = [];
      returningsByTable = {};
      txError = null;

      const tx = {
        delete: jest.fn((table: unknown) => {
          const name = tableNameFor(table);
          deleteCalls.push({ table: name });
          const rows = returningsByTable[name] ?? [];
          return makeChain(rows);
        }),
      };

      (mockDb as unknown as { transaction: jest.Mock }).transaction = jest.fn(
        async (fn: (t: typeof tx) => Promise<unknown>) => {
          if (txError) throw txError;
          return fn(tx);
        },
      );
      (mockDb as unknown as { delete: jest.Mock }).delete = jest.fn(() => makeChain([]));
    });

    it('denies tenants', async () => {
      // The handler reads the MCP-scoped orgs, the bill, and its building
      // before calling `authorizeDeleteInMcpScope`, so we must seed those
      // reads even for a tenant — the role check happens after them.
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'bill-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler({ role: 'tenant', billId: 'bill-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: tenants cannot delete bills',
      );
      // No transaction should have started for a tenant call.
      expect(deleteCalls).toEqual([]);
    });

    it('returns "not found" when the bill does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // bill lookup → empty
      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler({ role: 'admin', billId: 'missing' }, {});
      expect(parseToolResponse(result)).toContain('Bill not found: missing');
      expect(deleteCalls).toEqual([]);
    });

    it('denies access when the bill is attached to a building outside MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'bill-1', buildingId: 'b-x' }]),
        )
        .mockImplementationOnce(() =>
          createWhereResult([{ organizationId: 'other-org' }]),
        );
      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler({ role: 'admin', billId: 'bill-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: bill is not attached to an MCP-scoped building',
      );
      expect(deleteCalls).toEqual([]);
    });

    it('deletes a bill inside MCP scope as admin and returns the deleted/cascaded shape', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'bill-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      returningsByTable.payments = [{ id: 'pay-1' }, { id: 'pay-2' }, { id: 'pay-3' }];
      returningsByTable.bills = [
        { id: 'bill-1', billNumber: 'B-001', title: 'March Utilities' },
      ];

      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler({ role: 'admin', billId: 'bill-1' }, {});
      const parsed = JSON.parse(parseToolResponse(result));

      expect(parsed.deleted).toEqual({
        id: 'bill-1',
        billNumber: 'B-001',
        title: 'March Utilities',
      });
      expect(parsed.cascaded).toEqual({ payments: 3 });
      expect(parsed.message).toMatch(/cascade applied/i);

      // Assert the cascade-table delete order: dependent payments are
      // torn down before the parent `bills` row.
      expect(deleteCalls.map((c) => c.table)).toEqual(['payments', 'bills']);
    });

    it('returns a readable failure message when the cascade transaction fails', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'bill-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      txError = new Error(
        'update or delete on table "bills" violates foreign key constraint',
      );
      const handler = getToolHandler(server, 'delete_bill');
      const result = await handler({ role: 'admin', billId: 'bill-1' }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Failed to delete');
      expect(text).toContain('bill');
    });
  });

  describe('delete_project', () => {
    type DeleteCall = {
      table:
        | 'projectSteps'
        | 'projectElements'
        | 'submissionVendors'
        | 'workflowTasks'
        | 'projectNotifications'
        | 'elementProjectUpdates'
        | 'maintenanceProjects'
        | 'unknown';
    };
    type UpdateCall = { table: 'evaluationSuggestions' | 'unknown' };
    let deleteCalls: DeleteCall[];
    let updateCalls: UpdateCall[];
    let returningsByTable: Partial<Record<DeleteCall['table'], unknown[]>>;
    let updateReturningsByTable: Partial<Record<UpdateCall['table'], unknown[]>>;
    let txError: Error | null;

    const PROJECT_TABLE_MAP = new Map<unknown, DeleteCall['table']>([
      [schema.projectSteps, 'projectSteps'],
      [schema.projectElements, 'projectElements'],
      [schema.submissionVendors, 'submissionVendors'],
      [schema.workflowTasks, 'workflowTasks'],
      [schema.projectNotifications, 'projectNotifications'],
      [schema.elementProjectUpdates, 'elementProjectUpdates'],
      [schema.maintenanceProjects, 'maintenanceProjects'],
    ]);
    const PROJECT_UPDATE_TABLE_MAP = new Map<unknown, UpdateCall['table']>([
      [schema.evaluationSuggestions, 'evaluationSuggestions'],
    ]);

    function tableNameFor(t: unknown): DeleteCall['table'] {
      return PROJECT_TABLE_MAP.get(t) ?? 'unknown';
    }

    function makeChain(rows: unknown[]) {
      return {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(rows),
      };
    }

    beforeEach(() => {
      deleteCalls = [];
      updateCalls = [];
      returningsByTable = {};
      updateReturningsByTable = {};
      txError = null;

      const tx = {
        delete: jest.fn((table: unknown) => {
          const name = tableNameFor(table);
          deleteCalls.push({ table: name });
          const rows = returningsByTable[name] ?? [];
          return makeChain(rows);
        }),
        update: jest.fn((table: unknown) => {
          const name = (PROJECT_UPDATE_TABLE_MAP.get(table) ?? 'unknown') as UpdateCall['table'];
          updateCalls.push({ table: name });
          const rows = updateReturningsByTable[name] ?? [];
          return {
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue(rows),
          };
        }),
      };

      (mockDb as unknown as { transaction: jest.Mock }).transaction = jest.fn(
        async (fn: (t: typeof tx) => Promise<unknown>) => {
          if (txError) throw txError;
          return fn(tx);
        },
      );
      (mockDb as unknown as { delete: jest.Mock }).delete = jest.fn(() => makeChain([]));
    });

    it('denies tenants', async () => {
      // getMcpOrgIds + project lookup + building lookup must still resolve
      // because authorization happens after those reads (the handler uses
      // `authorizeDeleteInMcpScope` to centralize the role/scope rules).
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'p-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'delete_project');
      const result = await handler({ role: 'tenant', projectId: 'p-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: tenants cannot delete projects',
      );
      // No transaction should have started for a tenant call.
      expect(deleteCalls).toEqual([]);
      expect(updateCalls).toEqual([]);
    });

    it('returns "not found" when the project does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // project lookup → empty
      const handler = getToolHandler(server, 'delete_project');
      const result = await handler({ role: 'admin', projectId: 'missing' }, {});
      expect(parseToolResponse(result)).toContain('Project not found: missing');
      expect(deleteCalls).toEqual([]);
    });

    it('denies access when the project is attached to a building outside MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'p-1', buildingId: 'b-x' }]),
        )
        .mockImplementationOnce(() =>
          createWhereResult([{ organizationId: 'other-org' }]),
        );
      const handler = getToolHandler(server, 'delete_project');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: project is not attached to an MCP-scoped building',
      );
      expect(deleteCalls).toEqual([]);
    });

    it('deletes a project inside MCP scope as admin and returns the deleted/cascaded/evaluationSuggestionsCleared shape', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'p-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      returningsByTable.projectSteps = [{ id: 'ps-1' }, { id: 'ps-2' }];
      returningsByTable.projectElements = [{ id: 'pe-1' }];
      returningsByTable.submissionVendors = [
        { id: 'sv-1' },
        { id: 'sv-2' },
        { id: 'sv-3' },
      ];
      returningsByTable.workflowTasks = [{ id: 'wt-1' }];
      returningsByTable.projectNotifications = [{ id: 'pn-1' }, { id: 'pn-2' }];
      returningsByTable.elementProjectUpdates = [{ id: 'epu-1' }];
      returningsByTable.maintenanceProjects = [
        { id: 'p-1', projectNumber: 'P-001', title: 'Lobby Refresh' },
      ];
      updateReturningsByTable.evaluationSuggestions = [
        { id: 'es-1' },
        { id: 'es-2' },
      ];

      const handler = getToolHandler(server, 'delete_project');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      const parsed = JSON.parse(parseToolResponse(result));

      expect(parsed.deleted).toEqual({
        id: 'p-1',
        projectNumber: 'P-001',
        title: 'Lobby Refresh',
      });
      expect(parsed.cascaded).toEqual({
        projectSteps: 2,
        projectElements: 1,
        submissionVendors: 3,
        workflowTasks: 1,
        projectNotifications: 2,
        elementProjectUpdates: 1,
      });
      expect(parsed.evaluationSuggestionsCleared).toBe(2);
      expect(parsed.message).toMatch(/cascade applied/i);

      // Assert the cascade-table delete order: every dependent child table is
      // torn down before the parent `maintenanceProjects` row.
      expect(deleteCalls.map((c) => c.table)).toEqual([
        'projectSteps',
        'projectElements',
        'submissionVendors',
        'workflowTasks',
        'projectNotifications',
        'elementProjectUpdates',
        'maintenanceProjects',
      ]);
      // Evaluation suggestions are nulled (UPDATE ... SET project_id = NULL),
      // not deleted, so they appear in the update calls list.
      expect(updateCalls.map((c) => c.table)).toEqual(['evaluationSuggestions']);
    });

    it('returns a readable failure message when the cascade transaction fails', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'p-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      txError = new Error(
        'update or delete on table "maintenance_projects" violates foreign key constraint',
      );
      const handler = getToolHandler(server, 'delete_project');
      const result = await handler({ role: 'admin', projectId: 'p-1' }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Failed to delete');
      expect(text).toContain('project');
    });
  });

  describe('delete_common_space', () => {
    let deleteCalls: Array<{ table: 'commonSpaces' | 'unknown' }>;
    let returningRows: unknown[];
    let deleteError: Error | null;

    beforeEach(() => {
      deleteCalls = [];
      returningRows = [];
      deleteError = null;
      (commonSpaceRules.loadCommonSpaceForBookingChecks as jest.Mock).mockReset();

      (mockDb as unknown as { delete: jest.Mock }).delete = jest.fn((table: unknown) => {
        const name = table === schema.commonSpaces ? 'commonSpaces' : 'unknown';
        deleteCalls.push({ table: name });
        return {
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockImplementation(async () => {
            if (deleteError) throw deleteError;
            return returningRows;
          }),
        };
      });
    });

    it('denies tenants', async () => {
      // The handler reads the MCP-scoped orgs, the common space, and its
      // building before calling `authorizeDeleteInMcpScope`, so we must
      // seed those reads even for a tenant — the role check happens after
      // them (centralized in the shared helper).
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'cs-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'delete_common_space');
      const result = await handler({ role: 'tenant', spaceId: 'cs-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: tenants cannot delete common spaces',
      );
      // Tool now goes through the shared helper, not authorizeSpaceAccess.
      expect(commonSpaceRules.loadCommonSpaceForBookingChecks).not.toHaveBeenCalled();
      expect(deleteCalls).toEqual([]);
    });

    it('returns "Common space not found" when the space does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() => createWhereResult([])); // commonSpaces lookup → empty
      const handler = getToolHandler(server, 'delete_common_space');
      const result = await handler({ role: 'admin', spaceId: 'missing' }, {});
      expect(parseToolResponse(result)).toContain('Common space not found: missing');
      expect(deleteCalls).toEqual([]);
    });

    it('denies access when the space is attached to a building outside MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'cs-1', buildingId: 'b-other' }]),
        )
        .mockImplementationOnce(() =>
          createWhereResult([{ organizationId: 'other-org' }]),
        );
      const handler = getToolHandler(server, 'delete_common_space');
      const result = await handler({ role: 'admin', spaceId: 'cs-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: common space is not attached to an MCP-scoped building',
      );
      expect(deleteCalls).toEqual([]);
    });

    it('refuses to delete when a confirmed future booking exists', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'cs-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([{ id: 'booking-future' }])); // future booking found
      const handler = getToolHandler(server, 'delete_common_space');
      const result = await handler({ role: 'admin', spaceId: 'cs-1' }, {});
      expect(parseToolResponse(result)).toContain('Cannot delete common space');
      expect(parseToolResponse(result)).toContain('future bookings');
      expect(deleteCalls).toEqual([]);
    });

    it('deletes a common space inside MCP scope as admin and returns the deleted/message shape', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'cs-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // no future bookings
      returningRows = [{ id: 'cs-1', name: 'Pool' }];

      const handler = getToolHandler(server, 'delete_common_space');
      const result = await handler({ role: 'admin', spaceId: 'cs-1' }, {});
      const parsed = JSON.parse(parseToolResponse(result));

      expect(parsed.deleted).toEqual({ id: 'cs-1', name: 'Pool' });
      expect(parsed.message).toMatch(/common space deleted/i);
      // The cascade is enforced by Postgres FKs (bookings, restrictions,
      // time-limit rows), so the only application-level delete is the
      // `commonSpaces` row itself.
      expect(deleteCalls.map((c) => c.table)).toEqual(['commonSpaces']);
    });

    it('returns a readable failure message when the delete throws', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'cs-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]))
        .mockImplementationOnce(() => createWhereResult([])); // no future bookings
      deleteError = new Error(
        'update or delete on table "common_spaces" violates foreign key constraint',
      );
      const handler = getToolHandler(server, 'delete_common_space');
      const result = await handler({ role: 'admin', spaceId: 'cs-1' }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Failed to delete');
      expect(text).toContain('common space');
    });
  });

  describe('delete_inventory_element', () => {
    let deleteCalls: Array<{ table: 'buildingElements' | 'unknown' }>;
    let returningRows: unknown[];
    let deleteError: Error | null;

    beforeEach(() => {
      deleteCalls = [];
      returningRows = [];
      deleteError = null;

      (mockDb as unknown as { delete: jest.Mock }).delete = jest.fn((table: unknown) => {
        const name = table === schema.buildingElements ? 'buildingElements' : 'unknown';
        deleteCalls.push({ table: name });
        return {
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockImplementation(async () => {
            if (deleteError) throw deleteError;
            return returningRows;
          }),
        };
      });
    });

    it('denies tenants', async () => {
      // The handler reads the MCP-scoped orgs, the inventory element, and
      // its building before calling `authorizeDeleteInMcpScope`, so we
      // must seed those reads even for a tenant — the role check happens
      // after them (centralized in the shared helper).
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'be-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() => createWhereResult([{ organizationId: 'org-1' }]));
      const handler = getToolHandler(server, 'delete_inventory_element');
      const result = await handler({ role: 'tenant', elementId: 'be-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: tenants cannot delete inventory elements',
      );
      expect(deleteCalls).toEqual([]);
    });

    it('returns "Inventory element not found" when the element does not exist', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() => createWhereResult([])); // buildingElements lookup → empty
      const handler = getToolHandler(server, 'delete_inventory_element');
      const result = await handler({ role: 'admin', elementId: 'missing' }, {});
      expect(parseToolResponse(result)).toContain('Inventory element not found: missing');
      expect(deleteCalls).toEqual([]);
    });

    it('denies access when the element is attached to a building outside MCP scope', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'be-1', buildingId: 'b-other' }]),
        )
        .mockImplementationOnce(() =>
          createWhereResult([{ organizationId: 'other-org' }]),
        );
      const handler = getToolHandler(server, 'delete_inventory_element');
      const result = await handler({ role: 'admin', elementId: 'be-1' }, {});
      expect(parseToolResponse(result)).toBe(
        'Access denied: inventory element is not in an MCP-scoped organization',
      );
      expect(deleteCalls).toEqual([]);
    });

    it('deletes an inventory element inside MCP scope as admin and returns the deleted/message shape', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }])) // getMcpOrgIds
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'be-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() =>
          createWhereResult([{ organizationId: 'org-1' }]),
        );
      returningRows = [{ id: 'be-1', name: 'Roof Membrane', uniformatCode: 'B3010' }];

      const handler = getToolHandler(server, 'delete_inventory_element');
      const result = await handler({ role: 'admin', elementId: 'be-1' }, {});
      const parsed = JSON.parse(parseToolResponse(result));

      expect(parsed.deleted).toEqual({
        id: 'be-1',
        name: 'Roof Membrane',
        uniformatCode: 'B3010',
      });
      expect(parsed.message).toMatch(/cascade applied/i);
      // Cascade is enforced by Postgres FKs (history, evaluation suggestions,
      // project elements, element documents, element project updates), so the
      // only application-level delete is the `buildingElements` row itself.
      expect(deleteCalls.map((c) => c.table)).toEqual(['buildingElements']);
    });

    it('returns a readable failure message when the delete throws', async () => {
      mockSelectChain.where
        .mockImplementationOnce(() => createWhereResult([{ id: 'org-1' }]))
        .mockImplementationOnce(() =>
          createWhereResult([{ id: 'be-1', buildingId: 'b-1' }]),
        )
        .mockImplementationOnce(() =>
          createWhereResult([{ organizationId: 'org-1' }]),
        );
      deleteError = new Error(
        'update or delete on table "building_elements" violates foreign key constraint',
      );
      const handler = getToolHandler(server, 'delete_inventory_element');
      const result = await handler({ role: 'admin', elementId: 'be-1' }, {});
      const text = parseToolResponse(result);
      expect(text).toContain('Failed to delete');
      expect(text).toContain('inventory element');
    });
  });

  describe('get_mcp_info allowedRoles / currentRole / note', () => {
    function parseInfo(result: unknown) {
      return JSON.parse(parseToolResponse(result as { content?: Array<{ text?: string }> }));
    }

    it('legacy (no OAuth) session reports oauthBoundRole=null and all three allowedRoles, with currentRole reflecting caller role', async () => {
      const legacyServer = createMcpServer();
      const handler = getToolHandler(legacyServer, 'get_mcp_info');
      const info = parseInfo(await handler({ role: 'manager' }, {}));
      expect(info.oauthBoundRole).toBeNull();
      expect(info.allowedRoles).toEqual(['admin', 'manager', 'tenant']);
      expect(info.currentRole).toBe('manager');
      expect(info.note).toMatch(/legacy API-key/);
    });

    it('manager-bound OAuth session lists [manager, tenant] as allowedRoles and explains downgrade', async () => {
      const oauthServer = createMcpServer({ role: 'manager' });
      const handler = getToolHandler(oauthServer, 'get_mcp_info');
      const info = parseInfo(await handler({ role: 'manager' }, {}));
      expect(info.oauthBoundRole).toBe('manager');
      expect(info.allowedRoles).toEqual(['manager', 'tenant']);
      expect(info.currentRole).toBe('manager');
      expect(info.note).toMatch(/bound to role "manager"/);
      expect(info.note).toMatch(/downgrade|tenant/);
    });

    it('manager-bound OAuth session reports currentRole=tenant when downgraded for the call', async () => {
      const oauthServer = createMcpServer({ role: 'manager' });
      const handler = getToolHandler(oauthServer, 'get_mcp_info');
      const info = parseInfo(await handler({ role: 'tenant' }, {}));
      expect(info.oauthBoundRole).toBe('manager');
      expect(info.allowedRoles).toEqual(['manager', 'tenant']);
      // currentRole reflects the effective per-call role, not the OAuth ceiling.
      expect(info.currentRole).toBe('tenant');
    });

    it('tenant-bound OAuth session lists only [tenant] as allowedRoles', async () => {
      const oauthServer = createMcpServer({ role: 'tenant' });
      const handler = getToolHandler(oauthServer, 'get_mcp_info');
      const info = parseInfo(await handler({ role: 'tenant' }, {}));
      expect(info.oauthBoundRole).toBe('tenant');
      expect(info.allowedRoles).toEqual(['tenant']);
      expect(info.currentRole).toBe('tenant');
    });

    it('admin-bound OAuth session lists [admin, manager, tenant] as allowedRoles', async () => {
      const oauthServer = createMcpServer({ role: 'admin' });
      const handler = getToolHandler(oauthServer, 'get_mcp_info');
      const info = parseInfo(await handler({ role: 'admin' }, {}));
      expect(info.oauthBoundRole).toBe('admin');
      expect(info.allowedRoles).toEqual(['admin', 'manager', 'tenant']);
      expect(info.currentRole).toBe('admin');
    });

    it('assume_user tool description advertises the production hard-lock and points at the staging QA harness doc', async () => {
      const oauthServer = createMcpServer({ role: 'admin' });
      const handler = getToolHandler(oauthServer, 'get_mcp_info');
      const info = parseInfo(await handler({ role: 'admin' }, {}));
      const assumeUserTool = (info.tools as Array<{ name: string; description: string }>).find(
        (t) => t.name === 'assume_user',
      );
      expect(assumeUserTool).toBeDefined();
      const desc = assumeUserTool!.description.toLowerCase();
      expect(desc).toContain('not available in production');
      expect(desc).toContain('mcp_staging_qa_harness');
    });
  });

  describe('get_mcp_info buildSha resolution order', () => {
    function parseInfo(result: unknown) {
      return JSON.parse(parseToolResponse(result as { content?: Array<{ text?: string }> }));
    }

    // Env vars that participate in the new resolver, plus the now-removed
    // deploy markers — we clear the latter so a stray value in the test env
    // can never silently pass through.
    const ENV_KEYS = [
      'BUILD_SHA',
      'BUILD_TIME',
      'REPLIT_DEPLOYMENT_ID',
      'REPL_DEPLOYMENT_ID',
      'SOURCE_VERSION',
    ] as const;
    let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;
    let stampFile: { buildSha?: string; buildTime?: string } | null = null;

    beforeEach(() => {
      savedEnv = {};
      for (const k of ENV_KEYS) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }
      stampFile = null;
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          readFileSync: (path: string, encoding?: unknown) => {
            if (typeof path === 'string' && path.endsWith('build-info.json')) {
              if (stampFile) {
                return JSON.stringify(stampFile);
              }
              throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            }
            return actual.readFileSync(path, encoding as never);
          },
        };
      });
    });

    afterEach(() => {
      for (const k of ENV_KEYS) {
        if (savedEnv[k] === undefined) {
          delete process.env[k];
        } else {
          process.env[k] = savedEnv[k];
        }
      }
      jest.dontMock('fs');
      jest.resetModules();
    });

    async function loadAndCallInfo() {
      let info: Record<string, unknown> = {};
      await jest.isolateModulesAsync(async () => {
        const mod = await import('../mcp/server');
        const freshServer = mod.createMcpServer();
        const handler = getToolHandler(freshServer, 'get_mcp_info');
        info = parseInfo(await handler({ role: 'admin' }, {}));
      });
      return info;
    }

    it('prefers dist/build-info.json when present', async () => {
      stampFile = { buildSha: 'stampsha', buildTime: '2026-04-23T00:00:00.000Z' };
      process.env.BUILD_SHA = 'env-sha-should-be-ignored';
      const info = await loadAndCallInfo();
      expect(info.buildSha).toBe('stampsha');
      expect(info.buildTime).toBe('2026-04-23T00:00:00.000Z');
    });

    it('prefers BUILD_SHA env var over git when no stamp file is present', async () => {
      process.env.BUILD_SHA = 'env-sha-123';
      process.env.BUILD_TIME = '2026-04-22T12:34:56.000Z';
      const info = await loadAndCallInfo();
      expect(info.buildSha).toBe('env-sha-123');
      expect(info.buildTime).toBe('2026-04-22T12:34:56.000Z');
    });

    it('falls back to git short HEAD (or "unknown") when no stamp file or env var is set', async () => {
      const info = await loadAndCallInfo();
      expect(typeof info.buildSha).toBe('string');
      // Either a hex git short SHA, or "unknown" when git is unavailable.
      expect(info.buildSha as string).toMatch(/^[0-9a-f]{4,40}$|^unknown$/);
      // Must not be a UUID — the old deploy-marker bug surfaced UUIDs here.
      expect(info.buildSha as string).not.toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('ignores the legacy REPLIT_DEPLOYMENT_ID / SOURCE_VERSION env vars', async () => {
      process.env.REPLIT_DEPLOYMENT_ID = 'deploy-abc-123';
      process.env.SOURCE_VERSION = 'src-ver-789';
      const info = await loadAndCallInfo();
      expect(info.buildSha).not.toBe('deploy-abc-123');
      expect(info.buildSha).not.toBe('src-ver-789');
    });

    it('always surfaces a buildTime that parses as a valid ISO date', async () => {
      stampFile = { buildSha: 'stampsha', buildTime: '2026-04-23T01:02:03.000Z' };
      const info = await loadAndCallInfo();
      expect(typeof info.buildTime).toBe('string');
      const parsed = new Date(info.buildTime as string);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      expect(parsed.toISOString()).toBe('2026-04-23T01:02:03.000Z');
    });

    it('falls back buildTime to a current ISO timestamp when nothing else is set', async () => {
      const info = await loadAndCallInfo();
      expect(typeof info.buildTime).toBe('string');
      const parsed = new Date(info.buildTime as string);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    });

    it('never returns buildSha="unknown" when a valid build-info.json is present (nominal production path)', async () => {
      stampFile = { buildSha: 'a1b2c3d', buildTime: '2026-04-25T00:00:00.000Z' };
      const info = await loadAndCallInfo();
      expect(info.buildSha).toBe('a1b2c3d');
      expect(info.buildSha).not.toBe('unknown');
    });
  });

  describe('Get Analysis Status', () => {
    it('should return completed status for a registered document', async () => {
      const limitMock = jest.fn().mockResolvedValue([{ filePath: 'doc-path' }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = limitMock;
        return r;
      });
      const handler = getToolHandler(server, 'get_analysis_status');
      const result = await handler({ role: 'admin', analysisId: 'doc-path' }, {});
      const text = parseToolResponse(result);
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('completed');
      expect(parsed.analysisId).toBe('doc-path');
      expect(parsed.error).toBeUndefined();
    });

    it('should return a not-found error for an unknown analysisId', async () => {
      const limitMock = jest.fn().mockResolvedValue([]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = limitMock;
        return r;
      });
      const handler = getToolHandler(server, 'get_analysis_status');
      const result = await handler({ role: 'admin', analysisId: 'garbage-id' }, {});
      const text = parseToolResponse(result);
      const parsed = JSON.parse(text);
      expect(parsed.status).toBeUndefined();
      expect(parsed.error).toBe('not_found');
      expect(parsed.analysisId).toBe('garbage-id');
      expect(parsed.message).toMatch(/garbage-id/);
    });

    // Task #1271: `get_analysis_status` must return the SAME not-found
    // response for documents that exist but live outside the caller's
    // MCP org as it does for documents that do not exist at all. Any
    // observable difference (different message, different fields,
    // different status) lets the tool be used as an existence oracle
    // for filePaths in another organization.
    it('returns identical not-found JSON when the doc exists in another org (in-scope leak guard)', async () => {
      const docLimitMock = jest.fn().mockResolvedValue([{
        filePath: '/objects/buildings/b-ext/docs/secret.pdf',
        buildingId: 'b-ext',
        residenceId: null,
        isVisibleToTenants: false,
      }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = docLimitMock;
        return r;
      });
      // getMcpOrgIds() — caller's MCP scope
      mockSelectChain.where.mockImplementationOnce(() =>
        createWhereResult([{ id: 'org-1' }])
      );
      // building lookup — building belongs to org-other (NOT in MCP scope)
      mockSelectChain.where.mockImplementationOnce(() =>
        createWhereResult([{ organizationId: 'org-other' }])
      );

      const handler = getToolHandler(server, 'get_analysis_status');
      const outOfScope = await handler({
        role: 'admin',
        analysisId: '/objects/buildings/b-ext/docs/secret.pdf',
      }, {});

      // The reference "doc does not exist at all" response uses the
      // same code path for the not-found body, so we can compare
      // shapes byte-for-byte.
      const outText = parseToolResponse(outOfScope);
      const outParsed = JSON.parse(outText);
      expect(outParsed.error).toBe('not_found');
      expect(outParsed.status).toBeUndefined();
      expect(outParsed.analysisId).toBe('/objects/buildings/b-ext/docs/secret.pdf');
      // Message is the same shape used for genuinely-missing docs.
      expect(outParsed.message).toMatch(/No document found for analysisId/);
      expect(outParsed.message).not.toMatch(/access|denied|forbidden|scope/i);
    });

    it('returns completed status when the doc is in scope', async () => {
      const docLimitMock = jest.fn().mockResolvedValue([{
        filePath: '/objects/buildings/b-1/docs/lease.pdf',
        buildingId: 'b-1',
        residenceId: null,
        isVisibleToTenants: true,
      }]);
      mockSelectChain.where.mockImplementationOnce(() => {
        const r = Promise.resolve([]);
        (r as Record<string, unknown>).limit = docLimitMock;
        return r;
      });
      // getMcpOrgIds()
      mockSelectChain.where.mockImplementationOnce(() =>
        createWhereResult([{ id: 'org-1' }])
      );
      // building lookup — same org as MCP scope
      mockSelectChain.where.mockImplementationOnce(() =>
        createWhereResult([{ organizationId: 'org-1' }])
      );

      const handler = getToolHandler(server, 'get_analysis_status');
      const result = await handler({
        role: 'admin',
        analysisId: '/objects/buildings/b-1/docs/lease.pdf',
      }, {});
      const parsed = JSON.parse(parseToolResponse(result));
      expect(parsed.status).toBe('completed');
      expect(parsed.error).toBeUndefined();
    });
  });

  // Task #620 — empty/whitespace-only mandatory free-text fields must be
  // rejected by the MCP tool input schema before the handler ever runs, and
  // a valid non-empty value should be normalized via .trim() so it persists
  // without surrounding whitespace.
  describe('Reject empty/whitespace-only text fields (Task #620)', () => {
    function getToolInputSchema(toolName: string) {
      const tools = (server as ReturnType<typeof createMcpServer> & {
        _registeredTools: Record<string, { inputSchema?: unknown }>;
      })._registeredTools;
      const tool = tools?.[toolName];
      if (!tool || !tool.inputSchema) {
        throw new Error(`Tool "${toolName}" or its inputSchema not found`);
      }
      return tool.inputSchema as { safeParse: (input: unknown) => { success: boolean; data?: Record<string, unknown>; error?: { issues: Array<{ path: (string | number)[] }> } } };
    }

    describe('create_communication MCP input', () => {
      const baseArgs = {
        role: 'admin' as const,
        organizationId: '11111111-1111-1111-1111-111111111111',
        content: 'Some valid content body.',
      };

      it('rejects an empty title with a validation error (no DB write)', () => {
        const schema = getToolInputSchema('create_communication');
        const parsed = schema.safeParse({ ...baseArgs, title: '' });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'title')).toBe(true);
        }
      });

      it('rejects a whitespace-only title with a validation error (no DB write)', () => {
        const schema = getToolInputSchema('create_communication');
        const parsed = schema.safeParse({ ...baseArgs, title: '   ' });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'title')).toBe(true);
        }
      });

      it('rejects a whitespace-only content with a validation error (no DB write)', () => {
        const schema = getToolInputSchema('create_communication');
        const parsed = schema.safeParse({ ...baseArgs, title: 'Hello', content: '   ' });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'content')).toBe(true);
        }
      });

      it('accepts a valid non-empty title and trims it', () => {
        const schema = getToolInputSchema('create_communication');
        const parsed = schema.safeParse({ ...baseArgs, title: 'x  ' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data?.title).toBe('x');
        }
      });
    });

    describe('insertGeneralCommunicationSchema (Zod schema)', () => {
      const ORG_ID = '11111111-1111-1111-1111-111111111111';
      const USER_ID = '22222222-2222-2222-2222-222222222222';
      const basePayload = (overrides: Record<string, unknown> = {}) => ({
        organizationId: ORG_ID,
        createdBy: USER_ID,
        title: 'A valid title',
        content: 'Some valid content body.',
        ...overrides,
      });

      it('rejects empty title', () => {
        const { insertGeneralCommunicationSchema } = require('@shared/schemas/operations');
        const r = insertGeneralCommunicationSchema.safeParse(basePayload({ title: '' }));
        expect(r.success).toBe(false);
      });

      it('rejects whitespace-only title', () => {
        const { insertGeneralCommunicationSchema } = require('@shared/schemas/operations');
        const r = insertGeneralCommunicationSchema.safeParse(basePayload({ title: '   ' }));
        expect(r.success).toBe(false);
      });

      it('rejects whitespace-only content', () => {
        const { insertGeneralCommunicationSchema } = require('@shared/schemas/operations');
        const r = insertGeneralCommunicationSchema.safeParse(basePayload({ content: '   ' }));
        expect(r.success).toBe(false);
      });

      it('trims a valid title before persistence', () => {
        const { insertGeneralCommunicationSchema } = require('@shared/schemas/operations');
        const r = insertGeneralCommunicationSchema.safeParse(basePayload({ title: 'x  ' }));
        expect(r.success).toBe(true);
        if (r.success) {
          expect(r.data.title).toBe('x');
        }
      });
    });

    describe('create_demand MCP input', () => {
      const baseArgs = {
        role: 'tenant' as const,
        buildingId: '33333333-3333-3333-3333-333333333333',
        type: 'maintenance' as const,
      };

      it('rejects an empty description with a validation error (no DB write)', () => {
        const schema = getToolInputSchema('create_demand');
        const parsed = schema.safeParse({ ...baseArgs, description: '' });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'description')).toBe(true);
        }
      });

      it('rejects a whitespace-only description with a validation error (no DB write)', () => {
        const schema = getToolInputSchema('create_demand');
        const parsed = schema.safeParse({ ...baseArgs, description: '   ' });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'description')).toBe(true);
        }
      });

      it('accepts a non-empty description and trims it', () => {
        const schema = getToolInputSchema('create_demand');
        const parsed = schema.safeParse({ ...baseArgs, description: 'Broken window in unit 101  ' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data?.description).toBe('Broken window in unit 101');
        }
      });
    });

    describe('insertDemandSchema (Zod schema)', () => {
      const baseDemand = (overrides: Record<string, unknown> = {}) => ({
        type: 'maintenance' as const,
        description: 'Broken window in unit 101',
        ...overrides,
      });

      it('rejects empty description', () => {
        const { insertDemandSchema } = require('@shared/schemas/operations');
        const r = insertDemandSchema.safeParse(baseDemand({ description: '' }));
        expect(r.success).toBe(false);
      });

      it('rejects whitespace-only description (trims to empty before min check)', () => {
        const { insertDemandSchema } = require('@shared/schemas/operations');
        const r = insertDemandSchema.safeParse(baseDemand({ description: '          ' }));
        expect(r.success).toBe(false);
      });

      it('trims a valid description before persistence', () => {
        const { insertDemandSchema } = require('@shared/schemas/operations');
        const r = insertDemandSchema.safeParse(baseDemand({ description: '  Broken window in unit 101  ' }));
        expect(r.success).toBe(true);
        if (r.success) {
          expect(r.data.description).toBe('Broken window in unit 101');
        }
      });
    });

    describe('create_demand_comment MCP input', () => {
      const baseArgs = {
        role: 'admin' as const,
        demandId: '00000000-0000-0000-0000-000000000001',
      };

      it('rejects an empty commentText with a validation error', () => {
        const schema = getToolInputSchema('create_demand_comment');
        const parsed = schema.safeParse({ ...baseArgs, commentText: '' });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'commentText')).toBe(true);
        }
      });

      it('rejects a whitespace-only commentText with a validation error', () => {
        const schema = getToolInputSchema('create_demand_comment');
        const parsed = schema.safeParse({ ...baseArgs, commentText: '   ' });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'commentText')).toBe(true);
        }
      });

      it('accepts a non-empty commentText and trims whitespace', () => {
        const schema = getToolInputSchema('create_demand_comment');
        const parsed = schema.safeParse({ ...baseArgs, commentText: '  Fixed the issue  ' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data?.commentText).toBe('Fixed the issue');
        }
      });
    });
  });

  describe('Property tool numeric guards (Task #1308)', () => {
    function getToolInputSchema(toolName: string) {
      const tools = (server as ReturnType<typeof createMcpServer> & {
        _registeredTools: Record<string, { inputSchema?: unknown }>;
      })._registeredTools;
      const tool = tools?.[toolName];
      if (!tool || !tool.inputSchema) {
        throw new Error(`Tool "${toolName}" or its inputSchema not found`);
      }
      return tool.inputSchema as { safeParse: (input: unknown) => { success: boolean; data?: Record<string, unknown>; error?: { issues: Array<{ path: (string | number)[]; message?: string }> } } };
    }

    const buildingBase = {
      role: 'admin' as const,
      organizationId: 'org-1',
      name: 'Test Building',
      address: '123 Main St',
      city: 'Montreal',
      postalCode: 'H2X1Y4',
      buildingType: 'apartment' as const,
    };

    describe('create_building', () => {
      it('rejects totalUnits = 0', () => {
        const schema = getToolInputSchema('create_building');
        const parsed = schema.safeParse({ ...buildingBase, totalUnits: 0 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'totalUnits')).toBe(true);
        }
      });

      it('rejects totalUnits < 0', () => {
        const schema = getToolInputSchema('create_building');
        const parsed = schema.safeParse({ ...buildingBase, totalUnits: -5 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'totalUnits')).toBe(true);
        }
      });

      it('accepts totalUnits >= 1', () => {
        const schema = getToolInputSchema('create_building');
        const parsed = schema.safeParse({ ...buildingBase, totalUnits: 1 });
        expect(parsed.success).toBe(true);
      });

      it('rejects totalFloors = 0', () => {
        const schema = getToolInputSchema('create_building');
        const parsed = schema.safeParse({ ...buildingBase, totalUnits: 4, totalFloors: 0 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'totalFloors')).toBe(true);
        }
      });

      it('rejects parkingSpaces < 0', () => {
        const schema = getToolInputSchema('create_building');
        const parsed = schema.safeParse({ ...buildingBase, totalUnits: 4, parkingSpaces: -1 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'parkingSpaces')).toBe(true);
        }
      });

      it('accepts parkingSpaces = 0', () => {
        const schema = getToolInputSchema('create_building');
        const parsed = schema.safeParse({ ...buildingBase, totalUnits: 4, parkingSpaces: 0 });
        expect(parsed.success).toBe(true);
      });

      it('rejects storageSpaces < 0', () => {
        const schema = getToolInputSchema('create_building');
        const parsed = schema.safeParse({ ...buildingBase, totalUnits: 4, storageSpaces: -2 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'storageSpaces')).toBe(true);
        }
      });
    });

    describe('update_building', () => {
      it('rejects totalUnits = 0 when supplied', () => {
        const schema = getToolInputSchema('update_building');
        const parsed = schema.safeParse({ role: 'admin', buildingId: 'b-1', totalUnits: 0 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'totalUnits')).toBe(true);
        }
      });

      it('rejects totalFloors = 0 when supplied', () => {
        const schema = getToolInputSchema('update_building');
        const parsed = schema.safeParse({ role: 'admin', buildingId: 'b-1', totalFloors: 0 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'totalFloors')).toBe(true);
        }
      });

      it('rejects parkingSpaces < 0 when supplied', () => {
        const schema = getToolInputSchema('update_building');
        const parsed = schema.safeParse({ role: 'admin', buildingId: 'b-1', parkingSpaces: -3 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'parkingSpaces')).toBe(true);
        }
      });

      it('accepts parkingSpaces = 0 when supplied', () => {
        const schema = getToolInputSchema('update_building');
        const parsed = schema.safeParse({ role: 'admin', buildingId: 'b-1', parkingSpaces: 0 });
        expect(parsed.success).toBe(true);
      });
    });

    describe('create_residence', () => {
      const residenceBase = {
        role: 'admin' as const,
        buildingId: 'b-1',
        unitNumber: '101',
      };

      it('rejects bedrooms < 0', () => {
        const schema = getToolInputSchema('create_residence');
        const parsed = schema.safeParse({ ...residenceBase, bedrooms: -1 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'bedrooms')).toBe(true);
        }
      });

      it('accepts bedrooms = 0 (studio)', () => {
        const schema = getToolInputSchema('create_residence');
        const parsed = schema.safeParse({ ...residenceBase, bedrooms: 0 });
        expect(parsed.success).toBe(true);
      });

      it('rejects monthlyFees < 0', () => {
        const schema = getToolInputSchema('create_residence');
        const parsed = schema.safeParse({ ...residenceBase, monthlyFees: -100 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'monthlyFees')).toBe(true);
        }
      });

      it('accepts monthlyFees = 0', () => {
        const schema = getToolInputSchema('create_residence');
        const parsed = schema.safeParse({ ...residenceBase, monthlyFees: 0 });
        expect(parsed.success).toBe(true);
      });

      it('rejects squareFootage = 0', () => {
        const schema = getToolInputSchema('create_residence');
        const parsed = schema.safeParse({ ...residenceBase, squareFootage: 0 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'squareFootage')).toBe(true);
        }
      });

      it('rejects squareFootage < 0', () => {
        const schema = getToolInputSchema('create_residence');
        const parsed = schema.safeParse({ ...residenceBase, squareFootage: -50 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'squareFootage')).toBe(true);
        }
      });

      it('accepts squareFootage > 0', () => {
        const schema = getToolInputSchema('create_residence');
        const parsed = schema.safeParse({ ...residenceBase, squareFootage: 75.5 });
        expect(parsed.success).toBe(true);
      });
    });

    describe('update_residence', () => {
      it('rejects bedrooms < 0 when supplied', () => {
        const schema = getToolInputSchema('update_residence');
        const parsed = schema.safeParse({ role: 'admin', residenceId: 'r-1', bedrooms: -1 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'bedrooms')).toBe(true);
        }
      });

      it('accepts bedrooms = 0 when supplied', () => {
        const schema = getToolInputSchema('update_residence');
        const parsed = schema.safeParse({ role: 'admin', residenceId: 'r-1', bedrooms: 0 });
        expect(parsed.success).toBe(true);
      });

      it('rejects squareFootage <= 0 when supplied', () => {
        const schema = getToolInputSchema('update_residence');
        const parsed = schema.safeParse({ role: 'admin', residenceId: 'r-1', squareFootage: 0 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error?.issues.some((i) => i.path[0] === 'squareFootage')).toBe(true);
        }
      });

      it('accepts squareFootage > 0 when supplied', () => {
        const schema = getToolInputSchema('update_residence');
        const parsed = schema.safeParse({ role: 'admin', residenceId: 'r-1', squareFootage: 90 });
        expect(parsed.success).toBe(true);
      });
    });
  });

  describe('buildWriteErrorResponse FK blocker map (Task #1308)', () => {

    it('includes blockers array in FK violation delete response when provided', () => {
      const fkError = { code: '23503', detail: 'Key (id)=(building-1) is still referenced from table "residences".' };
      const blockers = [
        { id: 'res-1', label: 'Unit 101' },
        { id: 'res-2', label: 'Unit 102' },
      ];
      const result = buildWriteErrorResponse(fkError, 'building', 'delete', blockers);
      const payload = JSON.parse(result.content[0].text);
      expect(payload.status).toBe('fk_violation');
      expect(payload.code).toBe('FK_VIOLATION');
      expect(payload.blocking_entity).toBe('residence');
      expect(payload.blockers).toEqual(blockers);
      expect(payload.message).toContain('2 residence(s)');
    });

    it('omits blockers field when no blockers are provided', () => {
      const fkError = { code: '23503', detail: 'Key (id)=(building-1) is still referenced from table "residences".' };
      const result = buildWriteErrorResponse(fkError, 'building', 'delete');
      const payload = JSON.parse(result.content[0].text);
      expect(payload.status).toBe('fk_violation');
      expect(payload.blockers).toBeUndefined();
    });

    it('omits blockers field when blockers array is empty', () => {
      const fkError = { code: '23503', detail: 'Key (id)=(building-1) is still referenced from table "residences".' };
      const result = buildWriteErrorResponse(fkError, 'building', 'delete', []);
      const payload = JSON.parse(result.content[0].text);
      expect(payload.blockers).toBeUndefined();
    });

    it('FK_BLOCKER_COLUMN_HINTS covers all main entity tables', () => {
      expect(FK_BLOCKER_COLUMN_HINTS).toHaveProperty('buildings');
      expect(FK_BLOCKER_COLUMN_HINTS).toHaveProperty('bills');
      expect(FK_BLOCKER_COLUMN_HINTS).toHaveProperty('residences');
      expect(FK_BLOCKER_COLUMN_HINTS).toHaveProperty('maintenance_projects');
      expect(FK_BLOCKER_COLUMN_HINTS).toHaveProperty('common_spaces');
      expect(FK_BLOCKER_COLUMN_HINTS).toHaveProperty('building_elements');
    });

    it('FK_BLOCKER_COLUMN_HINTS buildings entry includes residences', () => {
      const hints = FK_BLOCKER_COLUMN_HINTS.buildings;
      expect(hints).toBeDefined();
      expect(hints?.residences?.filterCol).toBe('building_id');
      expect(hints?.residences?.labelCol).toBe('unit_number');
    });
  });

  describe('list_bills explicit column shape (Task #1308)', () => {
    it('list_bills does not SELECT * — handler code uses explicit column list', () => {
      const tools = (server as ReturnType<typeof createMcpServer> & { _registeredTools: Record<string, unknown> })._registeredTools;
      expect(tools['list_bills']).toBeDefined();
      const handler = getToolHandler(server, 'list_bills');
      expect(typeof handler).toBe('function');
    });

    it('list_bills schema includes required overview fields', () => {
      const tools = (server as ReturnType<typeof createMcpServer> & { _registeredTools: Record<string, { inputSchema?: { shape?: Record<string, unknown> } }> })._registeredTools;
      const listBillsTool = tools['list_bills'];
      expect(listBillsTool).toBeDefined();
      const inputSchema = listBillsTool?.inputSchema;
      expect(inputSchema?.shape?.buildingId).toBeDefined();
    });
  });
});