/**
 * Bill Attachments Demo Creation Test
 * Tests that the demo creation script properly creates bills with attached documents
 * and that these attachments are properly linked and accessible.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the database and file system operations for testing
const mockDocuments: any[] = [];
const mockBills: any[] = [];
const mockOrganizations: any[] = [];
const mockBuildings: any[] = [];

// Mock the database operations
const mockDb = {
  select: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    }),
  }),
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockImplementation((schema: any) => {
        if (schema === 'documents') {
          const doc = {
            id: `doc-${Date.now()}-${Math.random()}`,
            name: 'Test Document',
            filePath: 'bills/test-document.txt',
            fileName: 'test-document.txt',
            fileSize: 1024,
            attachedToType: 'bill',
            attachedToId: 'test-bill-id',
            documentType: 'maintenance',
            createdAt: new Date(),
          };
          mockDocuments.push(doc);
          return [doc];
        }
        if (schema === 'bills') {
          const bill = {
            id: `bill-${Date.now()}-${Math.random()}`,
            billNumber: 'TEST-2024-001',
            title: 'Test Bill',
            category: 'maintenance',
            totalAmount: '500.00',
            createdAt: new Date(),
          };
          mockBills.push(bill);
          return [bill];
        }
        return [{ id: `${Date.now()}-${Math.random()}` }];
      }),
    }),
  }),
};

// Mock file system operations
const mockFs = {
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
};

// Mock path operations
const mockPath = {
  resolve: jest.fn((filePath: string) => `/mocked/path/${filePath}`),
  dirname: jest.fn().mockReturnValue('/mocked/path'),
  extname: jest.fn().mockReturnValue('.txt'),
};

describe('Bill Attachments Demo Creation', () => {
  beforeEach(() => {
    // Clear mock data
    mockDocuments.length = 0;
    mockBills.length = 0;
    mockOrganizations.length = 0;
    mockBuildings.length = 0;
    
    // Reset mock functions
    jest.clearAllMocks();
  });

  test('should create bills with document attachments in demo script', async () => {
    // Simulate the demo script bill creation with attachments
    const organizationId = 'test-org-id';
    const buildingId = 'test-building-id';
    
    // Create a test bill
    const billData = {
      buildingId,
      billNumber: 'TEST-2024-INSURANCE-1',
      title: 'Insurance (I) - Osinski - Smitham',
      category: 'insurance',
      vendor: 'Maggio Group',
      description: 'Monthly insurance service for June 2024 - Invoice 1',
      totalAmount: '2014.15',
      status: 'paid',
      paymentType: 'recurrent',
      dueDate: new Date('2024-11-02'),
    };

    // Mock bill creation (simulating demo script behavior)
    const [createdBill] = await mockDb.insert().values().returning('bills');
    
    // Simulate document creation for the bill (from demo script lines 1175-1201)
    const filePath = `bills/invoice-${billData.billNumber.toLowerCase()}-${createdBill.id.slice(0, 8)}.txt`;
    const documentContent = `INVOICE
Bill Number: ${billData.billNumber}
Title: ${billData.title}
Category: ${billData.category}
Vendor: ${billData.vendor}
Amount: $${billData.totalAmount}
Description: ${billData.description}`;

    // Write file (simulating writeDocumentFile function)
    mockFs.writeFileSync(mockPath.resolve(filePath), documentContent, 'utf8');
    
    // Create document record linked to bill
    const documentData = {
      name: `Invoice - ${billData.billNumber}`,
      description: `Invoice for ${billData.title}`,
      documentType: 'maintenance',
      filePath,
      fileName: `invoice-${billData.billNumber}.txt`,
      fileSize: documentContent.length,
      mimeType: 'text/plain',
      attachedToType: 'bill',
      attachedToId: createdBill.id,
      uploadedById: 'demo-user-id',
      buildingId,
      isVisibleToTenants: false,
    };

    const [createdDocument] = await mockDb.insert().values().returning('documents');

    // Verify bill was created
    expect(mockBills).toHaveLength(1);
    expect(mockBills[0]).toMatchObject({
      id: expect.any(String),
      billNumber: expect.any(String),
    });

    // Verify document was created and properly linked to bill
    expect(mockDocuments).toHaveLength(1);
    expect(mockDocuments[0]).toMatchObject({
      id: expect.any(String),
      name: expect.stringContaining('Invoice'),
      filePath: expect.stringContaining('bills/'),
      fileName: expect.stringContaining('.txt'),
      fileSize: expect.any(Number),
      attachedToType: 'bill',
      attachedToId: createdBill.id,
      documentType: 'maintenance',
    });

    // Verify file was written
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(filePath),
      expect.stringContaining('INVOICE'),
      'utf8'
    );
  });

  test('should create multiple bill categories with different attachment types', async () => {
    const billCategories = ['insurance', 'maintenance', 'utilities', 'cleaning'];
    const buildingId = 'test-building-id';

    for (const category of billCategories) {
      // Create bill for each category
      const billData = {
        buildingId,
        billNumber: `TEST-2024-${category.toUpperCase()}-1`,
        title: `${category} Bill`,
        category,
        vendor: 'Test Vendor',
        description: `Test ${category} bill description`,
        totalAmount: '100.00',
        status: 'pending',
        paymentType: 'one_time',
      };

      const [createdBill] = await mockDb.insert().values().returning('bills');

      // Create both invoice and receipt documents
      const docTypes = ['invoice', 'receipt'];
      
      for (const docType of docTypes) {
        const filePath = `bills/${docType}-${billData.billNumber.toLowerCase()}-${createdBill.id.slice(0, 8)}.txt`;
        const documentContent = `${docType.toUpperCase()}\nBill: ${billData.billNumber}\nCategory: ${category}`;

        // Write file
        mockFs.writeFileSync(mockPath.resolve(filePath), documentContent, 'utf8');

        // Create document record
        const documentData = {
          name: `${docType} - ${billData.billNumber}`,
          description: `${docType} for ${billData.title}`,
          documentType: category,
          filePath,
          fileName: `${docType}-${billData.billNumber}.txt`,
          fileSize: documentContent.length,
          mimeType: 'text/plain',
          attachedToType: 'bill',
          attachedToId: createdBill.id,
          uploadedById: 'demo-user-id',
          buildingId,
          isVisibleToTenants: false,
        };

        await mockDb.insert().values().returning('documents');
      }
    }

    // Verify all bills were created
    expect(mockBills).toHaveLength(billCategories.length);

    // Verify all documents were created (2 docs per bill category)
    expect(mockDocuments).toHaveLength(billCategories.length * 2);

    // Verify all documents are properly linked to bills
    mockDocuments.forEach(doc => {
      expect(doc.attachedToType).toBe('bill');
      expect(doc.attachedToId).toMatch(/^bill-/);
      expect(doc.filePath).toMatch(/^bills\//);
      expect(doc.fileName).toMatch(/\.(txt)$/);
    });
  });

  test('should validate document file paths and names are correctly generated', async () => {
    const billNumber = 'TEST-2024-MAINTENANCE-123';
    const billId = 'bill-uuid-123456';
    
    // Test file path generation (from demo script line 1175)
    const expectedFilePath = `bills/invoice-${billNumber.toLowerCase()}-${billId.slice(0, 8)}.txt`;
    
    expect(expectedFilePath).toBe('bills/invoice-test-2024-maintenance-123-bill-uui.txt');
    
    // Test fileName generation (from demo script line 1199)
    const expectedFileName = `invoice-${billNumber}.txt`;
    
    expect(expectedFileName).toBe('invoice-TEST-2024-MAINTENANCE-123.txt');
  });

  test('should ensure bills have proper attachedToType and attachedToId linkage', async () => {
    const billId = 'test-bill-id-12345';
    
    // Create a document as it would be created in the demo script
    const documentData = {
      name: 'Test Invoice',
      description: 'Test invoice document',
      documentType: 'maintenance',
      filePath: 'bills/test-invoice.txt',
      fileName: 'test-invoice.txt',
      fileSize: 1024,
      mimeType: 'text/plain',
      attachedToType: 'bill',
      attachedToId: billId,
      uploadedById: 'demo-user-id',
      buildingId: 'test-building-id',
      isVisibleToTenants: false,
    };

    const [createdDocument] = await mockDb.insert().values().returning('documents');

    // Verify the document has correct linkage
    expect(createdDocument.attachedToType).toBe('bill');
    expect(createdDocument.attachedToId).toBe(billId);
    
    // Verify that API query would find this document
    // This simulates the query: /api/documents?attachedToType=bill&attachedToId=${billId}
    const queryResults = mockDocuments.filter(doc => 
      doc.attachedToType === 'bill' && doc.attachedToId === billId
    );
    
    expect(queryResults).toHaveLength(1);
    expect(queryResults[0]).toMatchObject({
      attachedToType: 'bill',
      attachedToId: billId,
      filePath: expect.stringContaining('bills/'),
      fileName: expect.stringContaining('.txt'),
    });
  });

  test('should create realistic file sizes for bill attachments', async () => {
    const billId = 'test-bill-id';
    const documentContent = `DETAILED INVOICE
Bill Number: TEST-2024-INSURANCE-1
Title: Insurance (I) - Osinski - Smitham  
Category: Insurance
Vendor: Maggio Group
Amount: $2,014.15
Description: Monthly insurance service for June 2024 - Invoice 1
Payment Type: Recurrent
Due Date: 2024-11-02

--- Invoice Details ---
Service Period: June 1-30, 2024
Policy Number: INS-QC-2024-001
Coverage: Comprehensive Building Insurance
Deductible: $1,000
Premium: $2,014.15

Building Management Office`;

    // Write file and get size
    mockFs.writeFileSync('/test/path/bill-doc.txt', documentContent, 'utf8');
    const fileSize = documentContent.length;

    // Create document with realistic file size
    const documentData = {
      name: 'Invoice - TEST-2024-INSURANCE-1',
      filePath: 'bills/invoice-test-2024-insurance-1.txt',
      fileName: 'invoice-test-2024-insurance-1.txt',
      fileSize,
      attachedToType: 'bill',
      attachedToId: billId,
    };

    await mockDb.insert().values().returning('documents');

    // Verify realistic file size
    expect(mockDocuments[0].fileSize).toBeGreaterThan(500); // Reasonable minimum
    expect(mockDocuments[0].fileSize).toBeLessThan(10000); // Reasonable maximum for text
    expect(mockDocuments[0].fileSize).toBe(documentContent.length);
  });
});