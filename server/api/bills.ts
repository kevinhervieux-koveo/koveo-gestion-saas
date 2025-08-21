import type { Express } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { requireAuth } from '../auth';
import { z } from 'zod';

const { buildings } = schema;

// Mock data for now - will be replaced with real database when tables are created
const mockBills = [
  {
    id: '1',
    buildingId: '',
    billNumber: 'INS-2024-001',
    title: 'Building Insurance Premium',
    description: 'Annual building insurance coverage',
    category: 'insurance',
    vendor: 'SecureGuard Insurance',
    paymentType: 'recurrent',
    schedulePayment: 'yearly',
    scheduleCustom: [],
    costs: ['12000.00'],
    totalAmount: '12000.00',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'sent',
    documentPath: null,
    documentName: null,
    isAiAnalyzed: false,
    aiAnalysisData: null,
    notes: 'Annual insurance payment',
    createdAt: new Date(),
    buildingName: ''
  },
  {
    id: '2',
    buildingId: '',
    billNumber: 'MAINT-2024-002',
    title: 'Elevator Maintenance',
    description: 'Monthly elevator inspection and maintenance',
    category: 'maintenance',
    vendor: 'ElevatorTech Services',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    scheduleCustom: [],
    costs: ['450.00'],
    totalAmount: '450.00',
    startDate: '2024-01-01',
    endDate: null,
    status: 'paid',
    documentPath: null,
    documentName: null,
    isAiAnalyzed: false,
    aiAnalysisData: null,
    notes: 'Monthly maintenance contract',
    createdAt: new Date(),
    buildingName: ''
  },
  {
    id: '3',
    buildingId: '',
    billNumber: 'UTIL-2024-003',
    title: 'Common Area Electricity',
    description: 'Monthly electricity for common areas',
    category: 'utilities',
    vendor: 'Hydro-Quebec',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    scheduleCustom: [],
    costs: ['280.00'],
    totalAmount: '280.00',
    startDate: '2024-01-01',
    endDate: null,
    status: 'overdue',
    documentPath: null,
    documentName: null,
    isAiAnalyzed: false,
    aiAnalysisData: null,
    notes: 'Monthly utility bill',
    createdAt: new Date(),
    buildingName: ''
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
      
      // Get building name for mock data
      const building = await db
        .select({ name: buildings.name })
        .from(buildings)
        .where(eq(buildings.id, filters.buildingId))
        .limit(1);
      
      const buildingName = building[0]?.name || 'Unknown Building';
      
      // Filter mock bills
      let filteredBills = mockBills.map(bill => ({
        ...bill,
        buildingId: filters.buildingId,
        buildingName
      }));
      
      if (filters.category) {
        filteredBills = filteredBills.filter(bill => bill.category === filters.category);
      }
      
      if (filters.status) {
        filteredBills = filteredBills.filter(bill => bill.status === filters.status);
      }
      
      if (filters.year) {
        filteredBills = filteredBills.filter(bill => 
          bill.startDate.startsWith(filters.year!)
        );
      }
      
      res.json(filteredBills);
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
      
      const billIndex = mockBills.findIndex(b => b.id === billId);
      if (billIndex === -1) {
        return res.status(404).json({ message: 'Bill not found' });
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
      const billIndex = mockBills.findIndex(b => b.id === billId);
      
      if (billIndex === -1) {
        return res.status(404).json({ message: 'Bill not found' });
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