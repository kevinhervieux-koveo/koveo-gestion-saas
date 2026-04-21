import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { getTableName } from 'drizzle-orm';

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

import { createMcpServer } from '../mcp/server';

const EXPECTED_TOOLS = [
  'list_organizations', 'get_organization',
  'list_buildings', 'get_building', 'create_building',
  'list_residences', 'get_residence', 'create_residence',
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
    type UpdateCall = { table: 'demands' | 'unknown' };
    let deleteCalls: DeleteCall[];
    let updateCalls: UpdateCall[];
    let deleteReturnings: Array<unknown[]>;
    let residenceDeleteReturning: unknown[];
    let demandsClearedReturning: unknown[];
    let throwOnTable: DeleteCall['table'] | null;
    let txError: Error | null;

    function tableNameFor(t: unknown): DeleteCall['table'] {
      let name: string | undefined;
      try {
        name = getTableName(t as Parameters<typeof getTableName>[0]);
      } catch {
        name = undefined;
      }
      switch (name) {
        case 'invoices': return 'invoices';
        case 'documents': return 'documents';
        case 'building_elements': return 'buildingElements';
        case 'maintenance_requests': return 'maintenanceRequests';
        case 'demands': return 'demands';
        case 'user_residences': return 'userResidences';
        case 'residences': return 'residences';
        default: return 'unknown';
      }
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
          const name = tableNameFor(table) as UpdateCall['table'];
          updateCalls.push({ table: name });
          return {
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue(demandsClearedReturning),
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
      expect(updateCalls.map(c => c.table)).toEqual(['demands']);
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
      expect(text).toContain('Failed to delete residence res-1');
      expect(text).toContain('foreign key constraint');
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
  });

  describe('get_mcp_info buildSha resolution order', () => {
    function parseInfo(result: unknown) {
      return JSON.parse(parseToolResponse(result as { content?: Array<{ text?: string }> }));
    }

    const ENV_KEYS = ['REPLIT_DEPLOYMENT_ID', 'REPL_DEPLOYMENT_ID', 'SOURCE_VERSION'] as const;
    let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

    beforeEach(() => {
      savedEnv = {};
      for (const k of ENV_KEYS) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }
    });

    afterEach(() => {
      for (const k of ENV_KEYS) {
        if (savedEnv[k] === undefined) {
          delete process.env[k];
        } else {
          process.env[k] = savedEnv[k];
        }
      }
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

    it('prefers REPLIT_DEPLOYMENT_ID over git when set', async () => {
      process.env.REPLIT_DEPLOYMENT_ID = 'deploy-abc-123';
      const info = await loadAndCallInfo();
      expect(info.buildSha).toBe('deploy-abc-123');
    });

    it('prefers REPL_DEPLOYMENT_ID when REPLIT_DEPLOYMENT_ID is unset', async () => {
      process.env.REPL_DEPLOYMENT_ID = 'repl-deploy-xyz';
      const info = await loadAndCallInfo();
      expect(info.buildSha).toBe('repl-deploy-xyz');
    });

    it('prefers SOURCE_VERSION when other deploy env vars are unset', async () => {
      process.env.SOURCE_VERSION = 'src-ver-789';
      const info = await loadAndCallInfo();
      expect(info.buildSha).toBe('src-ver-789');
    });

    it('falls back to git short HEAD (or "unknown") when no deploy env vars are set', async () => {
      const info = await loadAndCallInfo();
      expect(typeof info.buildSha).toBe('string');
      // Either a 7-ish char git short SHA, or "unknown" when git is unavailable.
      expect(info.buildSha as string).toMatch(/^[0-9a-f]{4,40}$|^unknown$/);
      // Critically, it must not equal one of the deploy markers we cleared.
      expect(info.buildSha).not.toBe('deploy-abc-123');
    });
  });

  describe('Get Analysis Status', () => {
    it('should return completed status for synchronous analysis', async () => {
      const handler = getToolHandler(server, 'get_analysis_status');
      const result = await handler({ role: 'admin', analysisId: 'doc-path' }, {});
      const text = parseToolResponse(result);
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('completed');
      expect(parsed.analysisId).toBe('doc-path');
    });
  });
});
