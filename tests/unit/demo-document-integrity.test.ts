import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockDbLimit = jest.fn();
const mockDbWhere = jest.fn(() => ({ limit: mockDbLimit }));
const mockDbFrom = jest.fn(() => ({ where: mockDbWhere }));
const mockDbSelect = jest.fn(() => ({ from: mockDbFrom }));

jest.mock('../../server/db', () => ({
  db: { select: mockDbSelect },
}));

const mockGetObjectEntityFile = jest.fn();
class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
  }
}

jest.mock('../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({
    getObjectEntityFile: mockGetObjectEntityFile,
  })),
  ObjectNotFoundError,
}));

jest.mock('../../shared/schema', () => ({
  documents: { filePath: 'documents.file_path' },
  bills: { filePath: 'bills.file_path' },
  bugs: { filePath: 'bugs.file_path' },
  featureRequests: { filePath: 'feature_requests.file_path' },
}));

import { DemoManagementService } from '../../server/services/demo-management-service';

describe('DemoManagementService.checkSeededDocumentIntegrity', () => {
  beforeEach(() => {
    mockDbLimit.mockReset();
    mockGetObjectEntityFile.mockReset();
  });

  it('returns healthy when all sampled files exist', async () => {
    mockDbLimit.mockResolvedValue([{ filePath: '/objects/buildings/b1/bills/f.pdf' }]);
    mockGetObjectEntityFile.mockResolvedValue({} as never);

    const report = await DemoManagementService.checkSeededDocumentIntegrity(1);
    expect(report.healthy).toBe(true);
    expect(report.totalMissing).toBe(0);
    expect(report.errors).toEqual([]);
  });

  it('reports unhealthy with missing paths when files are absent', async () => {
    mockDbLimit.mockResolvedValue([{ filePath: '/objects/buildings/b1/bills/missing.pdf' }]);
    mockGetObjectEntityFile.mockRejectedValue(new ObjectNotFoundError());

    const report = await DemoManagementService.checkSeededDocumentIntegrity(1);
    expect(report.healthy).toBe(false);
    expect(report.totalMissing).toBeGreaterThan(0);
    expect(report.remediation).toMatch(/seed script/i);
  });

  it('does NOT falsely report healthy when a query fails unexpectedly', async () => {
    // Every table query throws a non-"relation missing" error.
    mockDbLimit.mockRejectedValue(new Error('connection refused'));

    const report = await DemoManagementService.checkSeededDocumentIntegrity(1);
    expect(report.healthy).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0].error).toMatch(/connection refused/);
    expect(report.remediation).toMatch(/probe failed/i);
  });

  it('classifies non-ObjectNotFoundError storage failures as errors, not missing', async () => {
    mockDbLimit.mockResolvedValue([{ filePath: '/objects/bill.pdf' }]);
    mockGetObjectEntityFile.mockRejectedValue(new Error('bucket auth failed'));

    const report = await DemoManagementService.checkSeededDocumentIntegrity(1);
    expect(report.healthy).toBe(false);
    expect(report.totalMissing).toBe(0);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors.some((e) => /bucket auth failed/.test(e.error))).toBe(true);
    expect(report.remediation).toMatch(/probe failed/i);
  });

  it('skips sources whose table does not exist (relation missing)', async () => {
    const relMissing = Object.assign(new Error('relation "bugs" does not exist'), {
      code: '42P01',
    });
    // First 2 sources OK, 3rd throws "relation does not exist", 4th OK.
    mockDbLimit
      .mockResolvedValueOnce([{ filePath: '/objects/doc1.pdf' }])
      .mockResolvedValueOnce([{ filePath: '/objects/bill1.pdf' }])
      .mockRejectedValueOnce(relMissing)
      .mockResolvedValueOnce([{ filePath: '/objects/feature1.pdf' }]);
    mockGetObjectEntityFile.mockResolvedValue({} as never);

    const report = await DemoManagementService.checkSeededDocumentIntegrity(1);
    expect(report.healthy).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.totalSampled).toBe(3);
  });
});
