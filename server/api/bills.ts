import type { Express } from 'express';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { requireAuth } from '../auth';
import { z } from 'zod';
import { moneyFlowJob } from '../jobs/money_flow_job';
import { billGenerationService } from '../services/bill-generation-service';

const { buildings, bills } = schema;

// Database-driven bills - no more mock data

// Validation schemas
const billFilterSchema = z.object({
  buildingId: z.string().uuid(),
  category: z.string().optional(),
  year: z.string().optional(),
  status: z.enum(['all', 'draft', 'sent', 'overdue', 'paid', 'cancelled']).optional(),
  months: z.string().optional() // Comma-separated month numbers (e.g., "1,3,6,12")
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
    'technology',
    'reserves',
    'other'
  ]),
  vendor: z.string().optional(),
  paymentType: z.enum(['unique', 'recurrent']),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  scheduleCustom: z.array(z.string()).optional(),
  costs: z.array(z.string()),
  totalAmount: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().optional()
});

const updateBillSchema = createBillSchema.partial();

export function registerBillRoutes(app: Express) {
  /**
   * Get all bills with optional filtering
   * GET /api/bills?buildingId=uuid&category=insurance&year=2024&status=draft&months=1,3,6
   */
  app.get('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const { buildingId, category, year, status = 'all', months } = req.query;

      // Build the WHERE conditions
      const conditions = [];
      
      if (buildingId && buildingId !== 'all') {
        conditions.push(eq(bills.buildingId, buildingId));
      }
      
      if (category && category !== 'all') {
        conditions.push(eq(bills.category, category));
      }
      
      if (year) {
        conditions.push(sql`EXTRACT(YEAR FROM ${bills.startDate}) = ${year}`);
      }
      
      if (status && status !== 'all') {
        conditions.push(eq(bills.status, status));
      }
      
      if (months) {
        const monthNumbers = months.split(',').map((m: string) => parseInt(m.trim()));
        const monthConditions = monthNumbers.map((month: number) => 
          sql`EXTRACT(MONTH FROM ${bills.startDate}) = ${month}`
        );
        conditions.push(sql`(${sql.join(monthConditions, sql` OR `)})`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const billsList = await db
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
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt
        })
        .from(bills)
        .where(whereClause)
        .orderBy(desc(bills.startDate));

      res.json(billsList);
    } catch (error) {
      console.error('Error fetching bills:', error);
      res.status(500).json({ 
        message: 'Failed to fetch bills',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get a specific bill by ID
   * GET /api/bills/:id
   */
  app.get('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const bill = await db
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
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt
        })
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (bill.length === 0) {
        return res.status(404).json({ 
          message: 'Bill not found' 
        });
      }

      res.json(bill[0]);
    } catch (error) {
      console.error('Error fetching bill:', error);
      res.status(500).json({ 
        message: 'Failed to fetch bill',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Create a new bill
   * POST /api/bills
   */
  app.post('/api/bills', requireAuth, async (req: any, res: any) => {
    try {
      const validation = createBillSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid bill data',
          errors: validation.error.issues
        });
      }

      const billData = validation.data;
      
      const newBill = await db
        .insert(bills)
        .values({
          buildingId: billData.buildingId,
          billNumber: billData.billNumber || `BILL-${Date.now()}`,
          title: billData.title,
          description: billData.description,
          category: billData.category,
          vendor: billData.vendor,
          paymentType: billData.paymentType,
          costs: billData.costs.map(cost => parseFloat(cost)),
          totalAmount: parseFloat(billData.totalAmount),
          startDate: billData.startDate,
          status: billData.status,
          notes: billData.notes,
          createdBy: req.user.id
        })
        .returning();

      // In the future when bills are actually saved to database, trigger money flow generation:
      // try {
      //     await moneyFlowJob.generateForBill(newBill.id);
      // } catch (error) {
      //     console.error('Failed to generate money flow for new bill:', error);
      // }

      res.status(201).json(newBill[0]);
    } catch (error) {
      console.error('Error creating bill:', error);
      res.status(500).json({ 
        message: 'Failed to create bill',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Update a bill
   * PUT /api/bills/:id
   */
  app.put('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const validation = updateBillSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid bill data',
          errors: validation.error.issues
        });
      }

      const billData = validation.data;
      
      const updateData: any = {};
      if (billData.title) updateData.title = billData.title;
      if (billData.description) updateData.description = billData.description;
      if (billData.category) updateData.category = billData.category;
      if (billData.vendor) updateData.vendor = billData.vendor;
      if (billData.paymentType) updateData.paymentType = billData.paymentType;
      if (billData.costs) updateData.costs = billData.costs.map((cost: string) => parseFloat(cost));
      if (billData.totalAmount) updateData.totalAmount = parseFloat(billData.totalAmount);
      if (billData.startDate) updateData.startDate = billData.startDate;
      if (billData.status) updateData.status = billData.status;
      if (billData.notes) updateData.notes = billData.notes;
      updateData.updatedAt = new Date();

      const updatedBill = await db
        .update(bills)
        .set(updateData)
        .where(eq(bills.id, id))
        .returning();

      if (updatedBill.length === 0) {
        return res.status(404).json({ 
          message: 'Bill not found' 
        });
      }

      // In the future when bills are actually updated in database, trigger money flow regeneration:
      // try {
      //     await moneyFlowJob.generateForBill(billId);
      // } catch (error) {
      //     console.error('Failed to regenerate money flow for updated bill:', error);
      // }

      res.json(updatedBill[0]);
    } catch (error) {
      console.error('Error updating bill:', error);
      res.status(500).json({ 
        message: 'Failed to update bill',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Delete a bill
   * DELETE /api/bills/:id
   */
  app.delete('/api/bills/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const deletedBill = await db
        .delete(bills)
        .where(eq(bills.id, id))
        .returning();

      if (deletedBill.length === 0) {
        return res.status(404).json({ 
          message: 'Bill not found' 
        });
      }

      res.json({ 
        message: 'Bill deleted successfully',
        bill: deletedBill[0]
      });
    } catch (error) {
      console.error('Error deleting bill:', error);
      res.status(500).json({ 
        message: 'Failed to delete bill',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate future bill instances for a recurrent bill
   * POST /api/bills/:id/generate-future
   */
  app.post('/api/bills/:id/generate-future', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const bill = await db
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
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt
        })
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (bill.length === 0) {
        return res.status(404).json({ 
          message: 'Bill not found' 
        });
      }

      // Check if user has access to this bill's building
      const building = await db
        .select({
          id: buildings.id,
          name: buildings.name,
          organizationId: buildings.organizationId
        })
        .from(buildings)
        .where(eq(buildings.id, bill[0].buildingId))
        .limit(1);

      if (building.length === 0) {
        return res.status(403).json({
          message: 'Access denied to generate future bills',
          code: 'ACCESS_DENIED'
        });
      }

      if (bill[0].paymentType !== 'recurrent') {
        return res.status(400).json({
          message: 'Only recurrent bills can generate future instances' 
        });
      }

      // Generate future bills
      const result = await billGenerationService.generateFutureBillInstances(bill[0] as any);

      res.json({
        message: 'Future bills generated successfully',
        billsCreated: result.billsCreated,
        generatedUntil: result.generatedUntil,
      });
    } catch (error) {
      console.error('Error generating future bills:', error);
      res.status(500).json({ 
        message: 'Failed to generate future bills',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get bill categories for filter dropdown
   * GET /api/bills/categories
   */
  app.get('/api/bills/categories', requireAuth, async (req: any, res: any) => {
    try {
      const categories = [
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
        'technology',
        'reserves',
        'other'
      ];

      res.json(categories);
    } catch (error) {
      console.error('Error fetching bill categories:', error);
      res.status(500).json({ 
        message: 'Failed to fetch bill categories',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get statistics for auto-generated bills from a parent bill
   * GET /api/bills/:id/generated-stats
   */
  app.get('/api/bills/:id/generated-stats', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const bill = await db
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
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt
        })
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

      if (bill.length === 0) {
        return res.status(404).json({ 
          message: 'Bill not found' 
        });
      }

      // Find all bills generated from this parent bill (look for auto-generated bills)
      const generatedBills = await db
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
          createdBy: bills.createdBy,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt
        })
        .from(bills)
        .where(sql`bills.notes LIKE '%Auto-generated from:%'`)
        .orderBy(bills.startDate);

      const stats = generatedBills.map(genBill => ({
        id: genBill.id,
        title: genBill.title,
        amount: genBill.totalAmount,
        startDate: genBill.startDate,
        status: genBill.status,
        billNumber: genBill.billNumber
      }));

      res.json({
        parentBill: bill[0],
        generatedBills: stats
      });
    } catch (error) {
      console.error('Error getting generated bills stats:', error);
      res.status(500).json({ 
        message: 'Failed to get generated bills statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}