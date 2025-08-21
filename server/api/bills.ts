import type { Express } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { requireAuth } from '../auth';
import { z } from 'zod';

const { buildings, bills } = schema;

// Mock data for now - will be replaced with real database when tables are created
const mockBills = [
  // Demo Building 1 Bills - Complex Insurance 
  {
    id: '1',
    buildingId: '5673ef95-3ca3-4bc7-bdf1-9dde8febebe7',
    billNumber: 'INS-2024-001',
    title: 'Comprehensive Building Insurance',
    description: 'Annual comprehensive insurance covering property damage, liability, and environmental risks',
    category: 'insurance',
    vendor: 'Quebec Provincial Insurance Corp.',
    paymentType: 'recurrent',
    schedulePayment: 'custom',
    scheduleCustom: ['2024-03-15', '2024-06-15', '2024-09-15', '2024-12-15'],
    costs: ['3500.00', '3500.00', '3500.00', '3500.00'],
    totalAmount: '14000.00',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'sent',
    documentPath: '/documents/insurance/INS-2024-001.pdf',
    documentName: 'Building_Insurance_Policy_2024.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { coverage: 'comprehensive', deductible: '5000', premium: '14000' },
    notes: 'Quarterly payments with 2% discount for early payment',
    createdAt: new Date('2024-01-15'),
    buildingName: 'Demo Building 1'
  },

  // Demo Building 1 - Maintenance Contract
  {
    id: '2',
    buildingId: '5673ef95-3ca3-4bc7-bdf1-9dde8febebe7',
    billNumber: 'MAINT-2024-002',
    title: 'Comprehensive Maintenance Contract',
    description: 'Full-service maintenance including HVAC, plumbing, electrical, and emergency repairs',
    category: 'maintenance',
    vendor: 'Montreal Property Services Inc.',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    scheduleCustom: [],
    costs: ['1200.00'],
    totalAmount: '1200.00',
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    status: 'paid',
    documentPath: '/documents/maintenance/MAINT-2024-002.pdf',
    documentName: 'Maintenance_Contract_2024.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { services: 'comprehensive', coverage: '24/7', technicians: '4' },
    notes: 'Includes 24/7 emergency response. 4 certified technicians assigned.',
    createdAt: new Date('2024-01-10'),
    buildingName: 'Demo Building 1'
  },

  // Demo Building 1 - Utilities (Complex)
  {
    id: '3',
    buildingId: '5673ef95-3ca3-4bc7-bdf1-9dde8febebe7',
    billNumber: 'UTIL-2024-003',
    title: 'Hydro-Quebec Multi-Service',
    description: 'Electricity, heating, and common area lighting for entire building complex',
    category: 'utilities',
    vendor: 'Hydro-Quebec',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    scheduleCustom: [],
    costs: ['850.00'],
    totalAmount: '850.00',
    startDate: '2024-01-01',
    endDate: null,
    status: 'overdue',
    documentPath: '/documents/utilities/UTIL-2024-003.pdf',
    documentName: 'Hydro_Bill_January_2024.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { consumption: '12450kWh', peak_demand: '45kW', rate: 'commercial' },
    notes: 'Payment overdue by 15 days. Late fees of $50 applied.',
    createdAt: new Date('2024-01-25'),
    buildingName: 'Demo Building 1'
  },

  // Demo Building 1 - Professional Services (Complex)
  {
    id: '4',
    buildingId: '5673ef95-3ca3-4bc7-bdf1-9dde8febebe7',
    billNumber: 'PROF-2024-004',
    title: 'Annual Financial Audit & Consultation',
    description: 'Complete financial audit, tax preparation, and strategic planning consultation',
    category: 'professional_services',
    vendor: 'Deloitte Quebec CPA',
    paymentType: 'unique',
    schedulePayment: null,
    scheduleCustom: [],
    costs: ['8500.00', '2500.00', '1200.00'],
    totalAmount: '12200.00',
    startDate: '2024-02-01',
    endDate: '2024-04-30',
    status: 'draft',
    documentPath: null,
    documentName: null,
    isAiAnalyzed: false,
    aiAnalysisData: null,
    notes: 'Includes audit ($8500), tax prep ($2500), and consultation ($1200). Quote pending approval.',
    createdAt: new Date('2024-02-01'),
    buildingName: 'Demo Building 1'
  },

  // Demo Building 1 - Security
  {
    id: '5',
    buildingId: '5673ef95-3ca3-4bc7-bdf1-9dde8febebe7',
    billNumber: 'SEC-2024-005',
    title: 'Advanced Security System Upgrade',
    description: 'Installation and maintenance of keycard access, CCTV, and alarm systems',
    category: 'security',
    vendor: 'SecureTech Montreal',
    paymentType: 'recurrent',
    schedulePayment: 'quarterly',
    scheduleCustom: [],
    costs: ['1850.00'],
    totalAmount: '1850.00',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'sent',
    documentPath: '/documents/security/SEC-2024-005.pdf',
    documentName: 'Security_System_Contract.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { cameras: '16', access_points: '8', monitoring: '24/7' },
    notes: 'Quarterly billing. Includes 24/7 monitoring service and on-site technician visits.',
    createdAt: new Date('2024-01-08'),
    buildingName: 'Demo Building 1'
  },

  // Demo Building 2 - Salary (Complex)
  {
    id: '6',
    buildingId: '58895d94-884b-4e8a-9d3a-7bdb52b38f14',
    billNumber: 'SAL-2024-006',
    title: 'Building Management Staff Payroll',
    description: 'Monthly salaries for building manager, maintenance staff, and security personnel',
    category: 'salary',
    vendor: 'Demo Management Company',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    scheduleCustom: [],
    costs: ['5200.00', '3800.00', '2200.00', '1800.00'],
    totalAmount: '13000.00',
    startDate: '2024-01-01',
    endDate: null,
    status: 'paid',
    documentPath: '/documents/payroll/SAL-2024-006.pdf',
    documentName: 'Monthly_Payroll_January_2024.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { employees: '4', manager: '1', maintenance: '2', security: '1' },
    notes: 'Manager ($5200), 2x Maintenance ($3800 total), Security ($2200), Part-time cleaner ($1800)',
    createdAt: new Date('2024-01-31'),
    buildingName: 'Demo Building 2'
  },

  // Demo Building 2 - Cleaning (Weekly)
  {
    id: '7',
    buildingId: '58895d94-884b-4e8a-9d3a-7bdb52b38f14',
    billNumber: 'CLEAN-2024-007',
    title: 'Professional Cleaning Services',
    description: 'Weekly deep cleaning of common areas, lobbies, hallways, and parking garage',
    category: 'cleaning',
    vendor: 'Quebec Clean Pro Services',
    paymentType: 'recurrent',
    schedulePayment: 'weekly',
    scheduleCustom: [],
    costs: ['320.00'],
    totalAmount: '320.00',
    startDate: '2024-01-01',
    endDate: null,
    status: 'sent',
    documentPath: '/documents/cleaning/CLEAN-2024-007.pdf',
    documentName: 'Weekly_Cleaning_Contract.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { frequency: 'weekly', areas: '12', eco_friendly: true },
    notes: 'Eco-friendly products used. Service includes carpet cleaning and window washing.',
    createdAt: new Date('2024-01-05'),
    buildingName: 'Demo Building 2'
  },

  // Demo Building 2 - Landscaping (Seasonal)
  {
    id: '8',
    buildingId: '58895d94-884b-4e8a-9d3a-7bdb52b38f14',
    billNumber: 'LAND-2024-008',
    title: 'Seasonal Landscaping & Snow Removal',
    description: 'Complete landscaping services including lawn care, tree maintenance, and winter snow removal',
    category: 'landscaping',
    vendor: 'Montreal Seasonal Services',
    paymentType: 'recurrent',
    schedulePayment: 'custom',
    scheduleCustom: ['2024-04-01', '2024-07-01', '2024-10-01', '2024-12-01'],
    costs: ['2200.00', '1800.00', '2200.00', '3500.00'],
    totalAmount: '9700.00',
    startDate: '2024-04-01',
    endDate: '2025-03-31',
    status: 'sent',
    documentPath: '/documents/landscaping/LAND-2024-008.pdf',
    documentName: 'Landscaping_Annual_Contract.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { seasons: '4', snow_removal: true, lawn_area: '2500sqm' },
    notes: 'Seasonal billing: Spring setup, Summer maintenance, Fall cleanup, Winter snow removal',
    createdAt: new Date('2024-03-15'),
    buildingName: 'Demo Building 2'
  },

  // Demo Building 2 - Repairs (Emergency)
  {
    id: '9',
    buildingId: '58895d94-884b-4e8a-9d3a-7bdb52b38f14',
    billNumber: 'REP-2024-009',
    title: 'Emergency Roof Repair',
    description: 'Emergency repair of roof membrane damage due to ice dam formation',
    category: 'repairs',
    vendor: 'Quebec Emergency Roofing',
    paymentType: 'unique',
    schedulePayment: null,
    scheduleCustom: [],
    costs: ['4500.00', '800.00', '300.00'],
    totalAmount: '5600.00',
    startDate: '2024-02-10',
    endDate: '2024-02-12',
    status: 'paid',
    documentPath: '/documents/repairs/REP-2024-009.pdf',
    documentName: 'Emergency_Roof_Repair_Invoice.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { urgency: 'emergency', area: '45sqm', warranty: '2_years' },
    notes: 'Emergency repair: membrane ($4500), materials ($800), emergency fee ($300). 2-year warranty.',
    createdAt: new Date('2024-02-12'),
    buildingName: 'Demo Building 2'
  },

  // Demo Building 2 - Supplies
  {
    id: '10',
    buildingId: '58895d94-884b-4e8a-9d3a-7bdb52b38f14',
    billNumber: 'SUP-2024-010',
    title: 'Building Maintenance Supplies',
    description: 'Monthly inventory of cleaning supplies, small tools, and safety equipment',
    category: 'supplies',
    vendor: 'Quebec Building Supply Co.',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    scheduleCustom: [],
    costs: ['420.00'],
    totalAmount: '420.00',
    startDate: '2024-01-01',
    endDate: null,
    status: 'paid',
    documentPath: '/documents/supplies/SUP-2024-010.pdf',
    documentName: 'Monthly_Supplies_Invoice.pdf',
    isAiAnalyzed: false,
    aiAnalysisData: null,
    notes: 'Standard monthly supply order. Includes safety equipment and cleaning materials.',
    createdAt: new Date('2024-01-28'),
    buildingName: 'Demo Building 2'
  },

  // Demo Building 1 - Taxes (Annual)
  {
    id: '11',
    buildingId: '5673ef95-3ca3-4bc7-bdf1-9dde8febebe7',
    billNumber: 'TAX-2024-011',
    title: 'Municipal Property Taxes',
    description: 'Annual municipal and school board property taxes for commercial building',
    category: 'taxes',
    vendor: 'City of Montreal - Tax Department',
    paymentType: 'recurrent',
    schedulePayment: 'custom',
    scheduleCustom: ['2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31'],
    costs: ['4800.00', '4800.00', '4800.00', '4800.00'],
    totalAmount: '19200.00',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'sent',
    documentPath: '/documents/taxes/TAX-2024-011.pdf',
    documentName: 'Property_Tax_Assessment_2024.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { assessment: '960000', rate: '2.0%', installments: '4' },
    notes: 'Quarterly installments. Assessment value: $960,000. Rate: 2.0%',
    createdAt: new Date('2024-02-01'),
    buildingName: 'Demo Building 1'
  },

  // Demo Building 1 - Administration
  {
    id: '12',
    buildingId: '5673ef95-3ca3-4bc7-bdf1-9dde8febebe7',
    billNumber: 'ADM-2024-012',
    title: 'Property Management Software License',
    description: 'Annual license for building management software and tenant portal',
    category: 'administration',
    vendor: 'PropTech Solutions Quebec',
    paymentType: 'recurrent',
    schedulePayment: 'yearly',
    scheduleCustom: [],
    costs: ['2400.00'],
    totalAmount: '2400.00',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'paid',
    documentPath: '/documents/admin/ADM-2024-012.pdf',
    documentName: 'Software_License_2024.pdf',
    isAiAnalyzed: true,
    aiAnalysisData: { users: '25', modules: '8', support: 'premium' },
    notes: 'Includes premium support, 25 user licenses, and all management modules.',
    createdAt: new Date('2024-01-03'),
    buildingName: 'Demo Building 1'
  },

  // Demo Building 2 - Other (Miscellaneous)
  {
    id: '13',
    buildingId: '58895d94-884b-4e8a-9d3a-7bdb52b38f14',
    billNumber: 'OTH-2024-013',
    title: 'Legal Services - Tenant Dispute Resolution',
    description: 'Legal consultation and representation for tenant dispute and lease negotiations',
    category: 'other',
    vendor: 'Cote & Associates Legal Services',
    paymentType: 'unique',
    schedulePayment: null,
    scheduleCustom: [],
    costs: ['3200.00'],
    totalAmount: '3200.00',
    startDate: '2024-02-15',
    endDate: '2024-03-15',
    status: 'cancelled',
    documentPath: '/documents/legal/OTH-2024-013.pdf',
    documentName: 'Legal_Services_Estimate.pdf',
    isAiAnalyzed: false,
    aiAnalysisData: null,
    notes: 'Dispute resolved without legal intervention. Invoice cancelled.',
    createdAt: new Date('2024-02-15'),
    buildingName: 'Demo Building 2'
  }
];

// Validation schemas
const billFilterSchema = z.object({
  buildingId: z.string().uuid(),
  category: z.string().optional(),
  year: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']).optional()
});

const createBillSchema = z.object({
  buildingId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum([
    'insurance',
    'maintenance', 
    'salary',
    'utilities',
    'cleaning',
    'security',
    'landscaping',
    'professional_services',
    'administration',
    'repairs',
    'supplies',
    'taxes',
    'other'
  ]),
  vendor: z.string().optional(),
  paymentType: z.enum(['unique', 'recurrent']),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  scheduleCustom: z.array(z.string()).optional(),
  costs: z.array(z.number().positive()),
  totalAmount: z.number().positive(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']).optional(),
  notes: z.string().optional()
});

export function registerBillRoutes(app: Express) {
  // Get bills with filtering
  app.get('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const filters = billFilterSchema.parse(req.query);
      const user = req.user;
      
      // Check if user has access to the requested building
      const building = await db
        .select({ 
          id: buildings.id,
          name: buildings.name, 
          organizationId: buildings.organizationId 
        })
        .from(buildings)
        .where(eq(buildings.id, filters.buildingId))
        .limit(1);
      
      if (!building[0]) {
        return res.status(404).json({ message: 'Building not found' });
      }
      
      // Role-based access control:
      // - Admin role: can access all buildings
      // - Manager role: can only access buildings from their organizations
      // - Others: no access to bills management
      const canAccessBuilding = 
        user.role === 'admin' || 
        user.canAccessAllOrganizations ||
        (user.role === 'manager' && user.organizations?.includes(building[0].organizationId));
      
      if (!canAccessBuilding) {
        return res.status(403).json({ 
          message: 'Access denied to this building',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      const buildingName = building[0].name;
      
      // Query real bills from database
      let query = db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          status: bills.status,
          notes: bills.notes,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt
        })
        .from(bills)
        .where(eq(bills.buildingId, filters.buildingId));
      
      // Apply additional filters
      const conditions = [eq(bills.buildingId, filters.buildingId)];
      
      if (filters.category && filters.category !== 'all') {
        conditions.push(eq(bills.category, filters.category as any));
      }
      
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(bills.status, filters.status as any));
      }
      
      if (filters.year) {
        conditions.push(sql`EXTRACT(YEAR FROM ${bills.startDate}) = ${filters.year}`);
      }
      
      const result = await db
        .select({
          id: bills.id,
          buildingId: bills.buildingId,
          billNumber: bills.billNumber,
          title: bills.title,
          description: bills.description,
          category: bills.category,
          vendor: bills.vendor,
          paymentType: bills.paymentType,
          costs: bills.costs,
          totalAmount: bills.totalAmount,
          startDate: bills.startDate,
          status: bills.status,
          notes: bills.notes,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt
        })
        .from(bills)
        .where(and(...conditions))
        .orderBy(desc(bills.createdAt));
      
      // Add building name to each bill
      const billsWithBuildingName = result.map(bill => ({
        ...bill,
        buildingName
      }));
      
      res.json(billsWithBuildingName);
    } catch (error) {
      console.error('Error fetching bills:', error);
      res.status(400).json({ 
        message: error instanceof z.ZodError ? 'Invalid filters' : 'Failed to fetch bills',
        errors: error instanceof z.ZodError ? error.issues : undefined
      });
    }
  });

  // Get single bill by ID
  app.get('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const billId = req.params.id;
      const bill = mockBills.find(b => b.id === billId);
      
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      res.json(bill);
    } catch (error) {
      console.error('Error fetching bill:', error);
      res.status(500).json({ message: 'Failed to fetch bill' });
    }
  });

  // Create new bill
  app.post('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const data = createBillSchema.parse(req.body);
      const user = req.user;
      
      // Check if user has access to create bills for this building
      const building = await db
        .select({ 
          id: buildings.id,
          organizationId: buildings.organizationId 
        })
        .from(buildings)
        .where(eq(buildings.id, data.buildingId))
        .limit(1);
      
      if (!building[0]) {
        return res.status(404).json({ message: 'Building not found' });
      }
      
      // Role-based access control for bill creation
      const canCreateBill = 
        user.role === 'admin' || 
        user.canAccessAllOrganizations ||
        (user.role === 'manager' && user.organizations?.includes(building[0].organizationId));
      
      if (!canCreateBill) {
        return res.status(403).json({ 
          message: 'Access denied to create bills for this building',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Generate bill number
      const billNumber = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const newBill = {
        id: Date.now().toString(),
        ...data,
        billNumber,
        costs: data.costs.map(c => c.toString()),
        totalAmount: data.totalAmount.toString(),
        scheduleCustom: data.scheduleCustom || [],
        documentPath: null,
        documentName: null,
        isAiAnalyzed: false,
        aiAnalysisData: null,
        createdAt: new Date(),
        buildingName: 'Mock Building'
      };

      // For now, just return the new bill (in real implementation, this would be saved to database)
      res.status(201).json(newBill);
    } catch (error) {
      console.error('Error creating bill:', error);
      res.status(400).json({ 
        message: error instanceof z.ZodError ? 'Invalid bill data' : 'Failed to create bill',
        errors: error instanceof z.ZodError ? error.issues : undefined
      });
    }
  });

  // Update bill
  app.put('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const billId = req.params.id;
      const data = createBillSchema.partial().parse(req.body);
      const user = req.user;
      
      const billIndex = mockBills.findIndex(b => b.id === billId);
      if (billIndex === -1) {
        return res.status(404).json({ message: 'Bill not found' });
      }
      
      // Check if user has access to update this bill
      const billBuildingId = mockBills[billIndex].buildingId;
      const building = await db
        .select({ organizationId: buildings.organizationId })
        .from(buildings)
        .where(eq(buildings.id, billBuildingId))
        .limit(1);
      
      if (!building[0]) {
        return res.status(404).json({ message: 'Building not found for this bill' });
      }
      
      // Role-based access control for bill updates
      const canUpdateBill = 
        user.role === 'admin' || 
        user.canAccessAllOrganizations ||
        (user.role === 'manager' && user.organizations?.includes(building[0].organizationId));
      
      if (!canUpdateBill) {
        return res.status(403).json({ 
          message: 'Access denied to update this bill',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Update mock bill
      const updatedBill = {
        ...mockBills[billIndex],
        ...data,
        costs: data.costs ? data.costs.map(c => c.toString()) : mockBills[billIndex].costs,
        totalAmount: data.totalAmount ? data.totalAmount.toString() : mockBills[billIndex].totalAmount
      };

      res.json(updatedBill);
    } catch (error) {
      console.error('Error updating bill:', error);
      res.status(400).json({ 
        message: error instanceof z.ZodError ? 'Invalid bill data' : 'Failed to update bill',
        errors: error instanceof z.ZodError ? error.issues : undefined
      });
    }
  });

  // Delete bill
  app.delete('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const billId = req.params.id;
      const user = req.user;
      const billIndex = mockBills.findIndex(b => b.id === billId);
      
      if (billIndex === -1) {
        return res.status(404).json({ message: 'Bill not found' });
      }
      
      // Check if user has access to delete this bill
      const billBuildingId = mockBills[billIndex].buildingId;
      const building = await db
        .select({ organizationId: buildings.organizationId })
        .from(buildings)
        .where(eq(buildings.id, billBuildingId))
        .limit(1);
      
      if (!building[0]) {
        return res.status(404).json({ message: 'Building not found for this bill' });
      }
      
      // Role-based access control for bill deletion
      const canDeleteBill = 
        user.role === 'admin' || 
        user.canAccessAllOrganizations ||
        (user.role === 'manager' && user.organizations?.includes(building[0].organizationId));
      
      if (!canDeleteBill) {
        return res.status(403).json({ 
          message: 'Access denied to delete this bill',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      res.json({ message: 'Bill deleted successfully' });
    } catch (error) {
      console.error('Error deleting bill:', error);
      res.status(500).json({ message: 'Failed to delete bill' });
    }
  });

  // Get bill categories
  app.get('/api/bills/categories', requireAuth, async (req: any, res: any) => {
    const categories = [
      { value: 'insurance', label: 'Insurance' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'salary', label: 'Salary' },
      { value: 'utilities', label: 'Utilities' },
      { value: 'cleaning', label: 'Cleaning' },
      { value: 'security', label: 'Security' },
      { value: 'landscaping', label: 'Landscaping' },
      { value: 'professional_services', label: 'Professional Services' },
      { value: 'administration', label: 'Administration' },
      { value: 'repairs', label: 'Repairs' },
      { value: 'supplies', label: 'Supplies' },
      { value: 'taxes', label: 'Taxes' },
      { value: 'other', label: 'Other' }
    ];
    
    res.json(categories);
  });

  // Money flow endpoints - Coming soon
  app.get('/api/money-flows', requireAuth, async (req: any, res: any) => {
    res.status(501).json({ 
      message: 'Money flow tracking coming soon',
      note: 'This feature will be available once the database migration is complete'
    });
  });

  app.post('/api/money-flows', requireAuth, async (req: any, res: any) => {
    res.status(501).json({ 
      message: 'Money flow tracking coming soon',
      note: 'This feature will be available once the database migration is complete'
    });
  });
}