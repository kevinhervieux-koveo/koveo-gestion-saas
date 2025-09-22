import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../auth';
import { z } from 'zod';
import { eq, and, or, sql, desc, asc, ilike, inArray, isNull, count, sum } from 'drizzle-orm';
import { UNIFORMAT_CATALOG } from '@shared/data/uniformat-catalog';
import {
  uniformatCodes,
  vendors,
  buildingElements,
  elementHistory,
  evaluationSuggestions,
  maintenanceProjects,
  projectSteps,
  projectElements,
  elementDocuments,
  // Import the types
  type UniformatCode,
  type Vendor,
  type InsertVendor,
  type BuildingElement,
  type InsertBuildingElement,
  type ElementHistory,
  type InsertElementHistory,
  type EvaluationSuggestion,
  type InsertEvaluationSuggestion,
  type MaintenanceProject,
  type InsertMaintenanceProject,
  type ProjectStep,
  type InsertProjectStep,
  type ElementDocument,
  type InsertElementDocument,
} from '@shared/schemas/maintenance';
import { buildings, organizations, userOrganizations } from '@shared/schema';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { secureFileStorage } from '../services/secure-file-storage';
import { getUploadConfig, type UploadContext } from '@shared/config/upload-config';
import { maintenanceSuggestionService } from '../services/maintenanceSuggestionService';
import { maintenanceJobsScheduler } from '../jobs/maintenanceJobs';

// Security: Secure filename sanitization function
function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename provided');
  }
  
  // Remove path traversal sequences and dangerous characters
  let sanitized = filename.replace(/\.\.[\\\/]/g, ''); // Remove ../ and ..\
  sanitized = sanitized.replace(/[\\\/]/g, '_'); // Replace slashes with underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_'); // Only allow safe characters
  
  // Ensure reasonable length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext).substring(0, 200);
    sanitized = name + ext;
  }
  
  // Ensure it's not empty
  if (!sanitized || sanitized === '.' || sanitized === '_') {
    sanitized = 'file_' + crypto.randomUUID().substring(0, 8);
  }
  
  return sanitized;
}

// Security: Generate secure random filename
function generateSecureFilename(originalName: string): string {
  const sanitizedName = sanitizeFilename(originalName);
  const ext = path.extname(sanitizedName);
  const baseName = path.basename(sanitizedName, ext);
  const secureId = crypto.randomUUID();
  return `${baseName}_${secureId}${ext}`;
}

// Security: Magic number validation for file type verification
function validateFileByMagicNumbers(fileBuffer: Buffer, declaredMimeType: string): boolean {
  if (!fileBuffer || fileBuffer.length < 4) return false;
  
  const magicNumbers = fileBuffer.slice(0, 8);
  const validMagicNumbers = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'image/jpeg': [0xFF, 0xD8, 0xFF], // JPEG
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    'image/gif': [0x47, 0x49, 0x46], // GIF
  };
  
  const expectedMagic = validMagicNumbers[declaredMimeType as keyof typeof validMagicNumbers];
  if (!expectedMagic) return false;
  
  return expectedMagic.every((byte, index) => magicNumbers[index] === byte);
}

// Security: Configure multer for file uploads with enhanced security
const upload = multer({
  dest: '/tmp/uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Security: Rate limiting for file upload endpoint
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each user to 20 uploads per windowMs
  message: {
    error: 'Too many upload requests',
    message: 'Please wait before uploading more files',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Rate limit per authenticated user ID (preferred) or use IP as fallback with IPv6 support
    return req.user?.id || ipKeyGenerator(req);
  },
  skip: (req: any) => {
    return !req.user?.id;
  }
});

// Security: Rate limiting for suggestion generation endpoint
const suggestionGenerationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 generation requests per hour
  message: {
    error: 'Too many generation requests',
    message: 'Please wait before generating more suggestions',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.id || ipKeyGenerator(req);
  },
  skip: (req: any) => {
    return !req.user?.id;
  }
});

// Security: UUID validation helper
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Validation schemas
const uniformatSearchSchema = z.object({
  query: z.string().min(1).max(100),
  level: z.number().min(1).max(4).optional(),
  category: z.string().optional(),
});

const vendorCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

const vendorUpdateSchema = vendorCreateSchema.partial();

const buildingElementCreateSchema = z.object({
  uniformatCode: z.string().min(1).max(10),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  originalConstructionDate: z.coerce.date().optional(),
  originalLifespan: z.number().positive().optional(),
  currentLifespan: z.number().positive().optional(),
  currentCondition: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']),
  lastInspectionDate: z.coerce.date().optional(),
  nextEvaluationDate: z.coerce.date().optional(),
  unit: z.string().max(20).optional(),
  unitValue: z.number().positive().optional(),
  notes: z.string().optional(),
});

const buildingElementUpdateSchema = buildingElementCreateSchema.partial();

const elementHistoryCreateSchema = z.object({
  eventType: z.enum(['construction', 'repair', 'minor_rehab', 'major_rehab', 'replacement']),
  eventDate: z.coerce.date(),
  description: z.string().min(1),
  cost: z.number().positive().optional(),
  vendorId: z.string().uuid().optional(),
  warrantyEndDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const evaluationSuggestionCreateSchema = z.object({
  buildingId: z.string().uuid(),
  elementId: z.string().uuid().optional(),
  uniformatCode: z.string().max(10).optional(),
  suggestionType: z.enum(['inspection', 'minor_rehab', 'major_rehab', 'replacement']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  estimatedCost: z.number().positive().optional(),
  suggestedDate: z.coerce.date(),
  reasoning: z.string().optional(),
});

const evaluationSuggestionUpdateSchema = z.object({
  status: z.enum(['pending', 'scheduled', 'postponed', 'completed', 'dismissed']).optional(),
  postponedUntil: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const maintenanceProjectCreateSchema = z.object({
  buildingId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  projectType: z.enum(['evaluation', 'repair', 'minor_rehab', 'major_rehab', 'replacement']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedCost: z.number().positive().optional(),
  actualCost: z.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  assignedVendorId: z.string().uuid().optional(),
  evaluationSuggestionId: z.string().uuid().optional(),
});

const maintenanceProjectUpdateSchema = maintenanceProjectCreateSchema.partial().extend({
  status: z.enum(['planned', 'evaluation', 'submission', 'pre_work', 'work', 'post_work', 'completed']).optional(),
});

const projectStepUpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
  completedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

// Security: Pagination validation schema
const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50), // Security: Hard limit of 100 items per page
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Helper function to check user access to building
async function checkBuildingAccess(userId: string, userRole: string, buildingId: string): Promise<boolean> {
  if (userRole === 'admin') {
    return true;
  }
  
  if (userRole === 'manager') {
    // Check if user has access to the building's organization
    const result = await db
      .select({ organizationId: buildings.organizationId })
      .from(buildings)
      .innerJoin(userOrganizations, eq(userOrganizations.organizationId, buildings.organizationId))
      .where(and(
        eq(buildings.id, buildingId),
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.isActive, true)
      ))
      .limit(1);
    
    return result.length > 0;
  }
  
  return false;
}

// Helper function to get user organizations
async function getUserOrganizations(userId: string): Promise<string[]> {
  const result = await db
    .select({ organizationId: userOrganizations.organizationId })
    .from(userOrganizations)
    .where(and(
      eq(userOrganizations.userId, userId),
      eq(userOrganizations.isActive, true)
    ));
  
  return result.map(r => r.organizationId);
}

/**
 * Register maintenance API routes
 */
export function registerMaintenanceRoutes(app: Express): void {
  
  // ===========================================
  // UNIFORMAT CATALOG MANAGEMENT
  // ===========================================
  
  /**
   * GET /api/maintenance/uniformat - Get UNIFORMAT catalog with hierarchy
   */
  app.get('/api/maintenance/uniformat', requireAuth, async (req: any, res) => {
    try {
      const { level, category, parentCode } = req.query;
      
      let filteredCatalog = UNIFORMAT_CATALOG;
      
      // Apply filters
      if (level) {
        const levelNum = parseInt(level as string);
        filteredCatalog = filteredCatalog.filter(item => item.level === levelNum);
      }
      
      if (category) {
        filteredCatalog = filteredCatalog.filter(item => 
          item.category.toLowerCase().includes((category as string).toLowerCase())
        );
      }
      
      if (parentCode) {
        filteredCatalog = filteredCatalog.filter(item => item.parentCode === parentCode);
      }
      
      res.json({
        success: true,
        data: filteredCatalog
      });
    } catch (error: any) {
      console.error('Error fetching UNIFORMAT catalog:', error);
      res.status(500).json({
        error: 'Failed to fetch UNIFORMAT catalog',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/uniformat/:code - Get specific UNIFORMAT element
   */
  app.get('/api/maintenance/uniformat/:code', requireAuth, async (req: any, res) => {
    try {
      const { code } = req.params;
      
      const element = UNIFORMAT_CATALOG.find(item => item.code === code);
      
      if (!element) {
        return res.status(404).json({
          error: 'UNIFORMAT element not found',
          code
        });
      }
      
      // Get children elements
      const children = UNIFORMAT_CATALOG.filter(item => item.parentCode === code);
      
      res.json({
        success: true,
        data: {
          ...element,
          children
        }
      });
    } catch (error: any) {
      console.error('Error fetching UNIFORMAT element:', error);
      res.status(500).json({
        error: 'Failed to fetch UNIFORMAT element',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/uniformat/search - Search UNIFORMAT catalog
   */
  app.get('/api/maintenance/uniformat/search', requireAuth, async (req: any, res) => {
    try {
      const validation = uniformatSearchSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid search parameters',
          details: validation.error.errors
        });
      }
      
      const { query, level, category } = validation.data;
      const searchLower = query.toLowerCase();
      
      let results = UNIFORMAT_CATALOG.filter(item => 
        item.code.toLowerCase().includes(searchLower) ||
        item.nameFr.toLowerCase().includes(searchLower) ||
        item.nameEn.toLowerCase().includes(searchLower) ||
        (item.descriptionFr && item.descriptionFr.toLowerCase().includes(searchLower)) ||
        (item.descriptionEn && item.descriptionEn.toLowerCase().includes(searchLower))
      );
      
      // Apply additional filters
      if (level) {
        results = results.filter(item => item.level === level);
      }
      
      if (category) {
        results = results.filter(item => 
          item.category.toLowerCase().includes(category.toLowerCase())
        );
      }
      
      // Limit results
      results = results.slice(0, 50);
      
      res.json({
        success: true,
        data: results,
        total: results.length
      });
    } catch (error: any) {
      console.error('Error searching UNIFORMAT catalog:', error);
      res.status(500).json({
        error: 'Failed to search UNIFORMAT catalog',
        details: error.message
      });
    }
  });
  
  // ===========================================
  // VENDORS MANAGEMENT
  // ===========================================
  
  /**
   * GET /api/maintenance/vendors - List vendors for organization
   */
  app.get('/api/maintenance/vendors', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get user organizations
      const userOrgs = await getUserOrganizations(user.id);
      
      if (user.role === 'admin') {
        // Admin can see all vendors
        const allVendors = await db
          .select()
          .from(vendors)
          .where(eq(vendors.isActive, true))
          .orderBy(asc(vendors.name));
        
        return res.json({
          success: true,
          data: allVendors
        });
      } else if (user.role === 'manager' && userOrgs.length > 0) {
        // Manager can see vendors in their organizations
        const organizationVendors = await db
          .select()
          .from(vendors)
          .where(and(
            eq(vendors.isActive, true),
            inArray(vendors.organizationId, userOrgs)
          ))
          .orderBy(asc(vendors.name));
        
        return res.json({
          success: true,
          data: organizationVendors
        });
      } else {
        return res.status(403).json({
          error: 'Insufficient permissions to view vendors'
        });
      }
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      res.status(500).json({
        error: 'Failed to fetch vendors',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/maintenance/vendors - Create vendor
   */
  app.post('/api/maintenance/vendors', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to create vendors'
        });
      }
      
      const validation = vendorCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid vendor data',
          details: validation.error.errors
        });
      }
      
      const { organizationId } = req.body;
      
      // Get user organizations for organization scoping
      let userOrgs: string[] = [];
      if (user.role === 'manager') {
        userOrgs = await getUserOrganizations(user.id);
      }
      
      // Verify organization access and derive organizationId
      let finalOrganizationId = organizationId;
      
      if (user.role === 'manager') {
        if (organizationId && !userOrgs.includes(organizationId)) {
          return res.status(403).json({
            error: 'No access to specified organization'
          });
        }
        // Use provided organizationId or default to first user organization
        finalOrganizationId = organizationId || userOrgs[0];
        
        if (!finalOrganizationId) {
          return res.status(400).json({
            error: 'No organization available for vendor creation'
          });
        }
      } else if (user.role === 'admin') {
        // Admin users must specify an organizationId
        if (!organizationId) {
          return res.status(400).json({
            error: 'organizationId is required for admin users'
          });
        }
        finalOrganizationId = organizationId;
      }
      
      const vendorData: InsertVendor = {
        ...validation.data,
        organizationId: finalOrganizationId,
      };
      
      const [vendor] = await db
        .insert(vendors)
        .values(vendorData)
        .returning();
      
      res.status(201).json({
        success: true,
        data: vendor
      });
    } catch (error: any) {
      console.error('Error creating vendor:', error);
      res.status(500).json({
        error: 'Failed to create vendor',
        details: error.message
      });
    }
  });
  
  /**
   * PUT /api/maintenance/vendors/:id - Update vendor
   */
  app.put('/api/maintenance/vendors/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to update vendors'
        });
      }
      
      const { id } = req.params;
      const validation = vendorUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid vendor data',
          details: validation.error.errors
        });
      }
      
      // Check vendor exists and user has access
      const existingVendor = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, id))
        .limit(1);
      
      if (existingVendor.length === 0) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      
      if (user.role === 'manager') {
        const userOrgs = await getUserOrganizations(user.id);
        if (!userOrgs.includes(existingVendor[0].organizationId)) {
          return res.status(403).json({
            error: 'No access to this vendor'
          });
        }
      }
      
      const [updatedVendor] = await db
        .update(vendors)
        .set({
          ...validation.data,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, id))
        .returning();
      
      res.json({
        success: true,
        data: updatedVendor
      });
    } catch (error: any) {
      console.error('Error updating vendor:', error);
      res.status(500).json({
        error: 'Failed to update vendor',
        details: error.message
      });
    }
  });
  
  /**
   * DELETE /api/maintenance/vendors/:id - Delete vendor (soft delete)
   */
  app.delete('/api/maintenance/vendors/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to delete vendors'
        });
      }
      
      const { id } = req.params;
      
      // Security: Validate UUID format
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid vendor ID format' });
      }
      
      // Check vendor exists and user has access
      const existingVendor = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, id))
        .limit(1);
      
      if (existingVendor.length === 0) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      
      if (user.role === 'manager') {
        const userOrgs = await getUserOrganizations(user.id);
        if (!userOrgs.includes(existingVendor[0].organizationId)) {
          return res.status(403).json({
            error: 'No access to this vendor'
          });
        }
      }
      
      // Soft delete - mark as inactive
      await db
        .update(vendors)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, id));
      
      res.json({
        success: true,
        message: 'Vendor deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      res.status(500).json({
        error: 'Failed to delete vendor',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/vendors/:id/projects - Get vendor project history
   */
  app.get('/api/maintenance/vendors/:id/projects', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { id: vendorId } = req.params;
      
      // Check vendor exists and user has access
      const existingVendor = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);
      
      if (existingVendor.length === 0) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      
      if (user.role === 'manager') {
        const userOrgs = await getUserOrganizations(user.id);
        if (!userOrgs.includes(existingVendor[0].organizationId)) {
          return res.status(403).json({
            error: 'No access to this vendor'
          });
        }
      }
      
      // Get projects assigned to this vendor
      const projects = await db
        .select({
          id: maintenanceProjects.id,
          title: maintenanceProjects.title,
          projectType: maintenanceProjects.projectType,
          status: maintenanceProjects.status,
          priority: maintenanceProjects.priority,
          estimatedCost: maintenanceProjects.estimatedCost,
          actualCost: maintenanceProjects.actualCost,
          startDate: maintenanceProjects.startDate,
          endDate: maintenanceProjects.endDate,
          createdAt: maintenanceProjects.createdAt,
          buildingName: buildings.name,
        })
        .from(maintenanceProjects)
        .innerJoin(buildings, eq(maintenanceProjects.buildingId, buildings.id))
        .where(eq(maintenanceProjects.assignedVendorId, vendorId))
        .orderBy(desc(maintenanceProjects.createdAt));
      
      res.json({
        success: true,
        data: projects
      });
    } catch (error: any) {
      console.error('Error fetching vendor projects:', error);
      res.status(500).json({
        error: 'Failed to fetch vendor projects',
        details: error.message
      });
    }
  });

  // ===========================================
  // BUILDING ELEMENTS MANAGEMENT
  // ===========================================
  
  /**
   * GET /api/maintenance/buildings/:buildingId/elements - List elements for building with pagination
   */
  app.get('/api/maintenance/buildings/:buildingId/elements', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { buildingId } = req.params;
      
      // Security: Validate UUID format
      if (!isValidUUID(buildingId)) {
        return res.status(400).json({ error: 'Invalid building ID format' });
      }
      
      // Security: Validate pagination parameters
      const paginationValidation = paginationSchema.safeParse(req.query);
      if (!paginationValidation.success) {
        return res.status(400).json({
          error: 'Invalid pagination parameters',
          details: paginationValidation.error.errors
        });
      }
      
      const { page, limit, order } = paginationValidation.data;
      const offset = (page - 1) * limit;
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      // Security: Get elements with pagination and count
      const [elements, totalCount] = await Promise.all([
        db
          .select({
            id: buildingElements.id,
            uniformatCode: buildingElements.uniformatCode,
            name: buildingElements.name,
            description: buildingElements.description,
            originalConstructionDate: buildingElements.originalConstructionDate,
            originalLifespan: buildingElements.originalLifespan,
            currentLifespan: buildingElements.currentLifespan,
            currentCondition: buildingElements.currentCondition,
            lastInspectionDate: buildingElements.lastInspectionDate,
            nextEvaluationDate: buildingElements.nextEvaluationDate,
            unit: buildingElements.unit,
            unitValue: buildingElements.unitValue,
            notes: buildingElements.notes,
            isActive: buildingElements.isActive,
            createdAt: buildingElements.createdAt,
            updatedAt: buildingElements.updatedAt,
          })
          .from(buildingElements)
          .where(and(
            eq(buildingElements.buildingId, buildingId),
            eq(buildingElements.isActive, true)
          ))
          .limit(limit)
          .offset(offset)
          .orderBy(
            order === 'asc' 
              ? [asc(buildingElements.uniformatCode), asc(buildingElements.name)]
              : [desc(buildingElements.uniformatCode), desc(buildingElements.name)]
          ),
        db
          .select({ count: count() })
          .from(buildingElements)
          .where(and(
            eq(buildingElements.buildingId, buildingId),
            eq(buildingElements.isActive, true)
          ))
      ]);
      
      const total = totalCount[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);
      
      res.json({
        success: true,
        data: elements,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error: any) {
      console.error('Error fetching building elements:', error);
      res.status(500).json({
        error: 'Failed to fetch building elements',
        details: error.message
      });
    }
  });

  
  /**
   * POST /api/maintenance/buildings/:buildingId/elements - Create element
   */
  app.post('/api/maintenance/buildings/:buildingId/elements', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to create building elements'
        });
      }
      
      const { buildingId } = req.params;
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const validation = buildingElementCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid element data',
          details: validation.error.errors
        });
      }
      
      // Verify UNIFORMAT code exists
      const uniformatElement = UNIFORMAT_CATALOG.find(item => item.code === validation.data.uniformatCode);
      if (!uniformatElement) {
        return res.status(400).json({
          error: 'Invalid UNIFORMAT code'
        });
      }
      
      const elementData: InsertBuildingElement = {
        ...validation.data,
        buildingId,
        originalConstructionDate: validation.data.originalConstructionDate || null,
        lastInspectionDate: validation.data.lastInspectionDate || null,
        nextEvaluationDate: validation.data.nextEvaluationDate || null,
      };
      
      // Security: Use transaction for atomic operation
      const [element] = await db.transaction(async (tx) => {
        return await tx
          .insert(buildingElements)
          .values(elementData)
          .returning();
      });
      
      res.status(201).json({
        success: true,
        data: element
      });
    } catch (error: any) {
      console.error('Error creating building element:', error);
      res.status(500).json({
        error: 'Failed to create building element',
        details: error.message
      });
    }
  });
  
  /**
   * PUT /api/maintenance/elements/:id - Update element
   */
  app.put('/api/maintenance/elements/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to update building elements'
        });
      }
      
      const { id } = req.params;
      const validation = buildingElementUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid element data',
          details: validation.error.errors
        });
      }
      
      // Check element exists and user has access
      const existingElement = await db
        .select({ buildingId: buildingElements.buildingId })
        .from(buildingElements)
        .where(eq(buildingElements.id, id))
        .limit(1);
      
      if (existingElement.length === 0) {
        return res.status(404).json({ error: 'Element not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, existingElement[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this element'
        });
      }
      
      // Verify UNIFORMAT code if provided
      if (validation.data.uniformatCode) {
        const uniformatElement = UNIFORMAT_CATALOG.find(item => item.code === validation.data.uniformatCode);
        if (!uniformatElement) {
          return res.status(400).json({
            error: 'Invalid UNIFORMAT code'
          });
        }
      }
      
      const updateData = {
        ...validation.data,
        originalConstructionDate: validation.data.originalConstructionDate ? new Date(validation.data.originalConstructionDate) : undefined,
        lastInspectionDate: validation.data.lastInspectionDate ? new Date(validation.data.lastInspectionDate) : undefined,
        nextEvaluationDate: validation.data.nextEvaluationDate ? new Date(validation.data.nextEvaluationDate) : undefined,
        updatedAt: new Date(),
      };
      
      const [updatedElement] = await db
        .update(buildingElements)
        .set(updateData)
        .where(eq(buildingElements.id, id))
        .returning();
      
      res.json({
        success: true,
        data: updatedElement
      });
    } catch (error: any) {
      console.error('Error updating building element:', error);
      res.status(500).json({
        error: 'Failed to update building element',
        details: error.message
      });
    }
  });
  
  /**
   * DELETE /api/maintenance/elements/:id - Delete element (soft delete)
   */
  app.delete('/api/maintenance/elements/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to delete building elements'
        });
      }
      
      const { id } = req.params;
      
      // Check element exists and user has access
      const existingElement = await db
        .select({ buildingId: buildingElements.buildingId })
        .from(buildingElements)
        .where(eq(buildingElements.id, id))
        .limit(1);
      
      if (existingElement.length === 0) {
        return res.status(404).json({ error: 'Element not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, existingElement[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this element'
        });
      }
      
      // Soft delete - mark as inactive
      await db
        .update(buildingElements)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(buildingElements.id, id));
      
      res.json({
        success: true,
        message: 'Element deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting building element:', error);
      res.status(500).json({
        error: 'Failed to delete building element',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/elements/:id - Get element details with history
   */
  app.get('/api/maintenance/elements/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { id } = req.params;
      
      // Get element details
      const elementResult = await db
        .select()
        .from(buildingElements)
        .where(eq(buildingElements.id, id))
        .limit(1);
      
      if (elementResult.length === 0) {
        return res.status(404).json({ error: 'Element not found' });
      }
      
      const element = elementResult[0];
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, element.buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this element'
        });
      }
      
      // Get element history
      const history = await db
        .select()
        .from(elementHistory)
        .where(eq(elementHistory.elementId, id))
        .orderBy(desc(elementHistory.eventDate));
      
      // Get UNIFORMAT info
      const uniformatInfo = UNIFORMAT_CATALOG.find(item => item.code === element.uniformatCode);
      
      res.json({
        success: true,
        data: {
          ...element,
          uniformatInfo,
          history
        }
      });
    } catch (error: any) {
      console.error('Error fetching element details:', error);
      res.status(500).json({
        error: 'Failed to fetch element details',
        details: error.message
      });
    }
  });
  
  // ===========================================
  // ELEMENT HISTORY TRACKING
  // ===========================================
  
  /**
   * GET /api/maintenance/elements/:elementId/history - Get element history
   */
  app.get('/api/maintenance/elements/:elementId/history', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { elementId } = req.params;
      
      // Check element exists and user has access
      const elementResult = await db
        .select({ buildingId: buildingElements.buildingId })
        .from(buildingElements)
        .where(eq(buildingElements.id, elementId))
        .limit(1);
      
      if (elementResult.length === 0) {
        return res.status(404).json({ error: 'Element not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, elementResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this element'
        });
      }
      
      const history = await db
        .select({
          id: elementHistory.id,
          eventType: elementHistory.eventType,
          eventDate: elementHistory.eventDate,
          description: elementHistory.description,
          cost: elementHistory.cost,
          vendorId: elementHistory.vendorId,
          warrantyEndDate: elementHistory.warrantyEndDate,
          notes: elementHistory.notes,
          createdAt: elementHistory.createdAt,
          vendorName: vendors.name,
        })
        .from(elementHistory)
        .leftJoin(vendors, eq(elementHistory.vendorId, vendors.id))
        .where(eq(elementHistory.elementId, elementId))
        .orderBy(desc(elementHistory.eventDate));
      
      res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      console.error('Error fetching element history:', error);
      res.status(500).json({
        error: 'Failed to fetch element history',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/maintenance/elements/:elementId/history - Add history entry
   */
  app.post('/api/maintenance/elements/:elementId/history', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to add element history'
        });
      }
      
      const { elementId } = req.params;
      const validation = elementHistoryCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid history data',
          details: validation.error.errors
        });
      }
      
      // Check element exists and user has access
      const elementResult = await db
        .select({ buildingId: buildingElements.buildingId })
        .from(buildingElements)
        .where(eq(buildingElements.id, elementId))
        .limit(1);
      
      if (elementResult.length === 0) {
        return res.status(404).json({ error: 'Element not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, elementResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this element'
        });
      }
      
      const historyData: InsertElementHistory = {
        ...validation.data,
        elementId,
        eventDate: validation.data.eventDate,
        warrantyEndDate: validation.data.warrantyEndDate || null,
      };
      
      // Security: Use transaction for atomic multi-entity operation
      const [history] = await db.transaction(async (tx) => {
        const [newHistory] = await tx
          .insert(elementHistory)
          .values(historyData)
          .returning();
        
        // Update element's last inspection date if this is an inspection
        if (validation.data.eventType === 'inspection') {
          await tx
            .update(buildingElements)
            .set({
              lastInspectionDate: validation.data.eventDate,
              updatedAt: new Date(),
            })
            .where(eq(buildingElements.id, elementId));
        }
        
        return [newHistory];
      });
      
      res.status(201).json({
        success: true,
        data: history
      });
    } catch (error: any) {
      console.error('Error adding element history:', error);
      res.status(500).json({
        error: 'Failed to add element history',
        details: error.message
      });
    }
  });
  
  /**
   * PUT /api/maintenance/history/:id - Update history entry
   */
  app.put('/api/maintenance/history/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to update element history'
        });
      }
      
      const { id } = req.params;
      const validation = elementHistoryCreateSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid history data',
          details: validation.error.errors
        });
      }
      
      // Check history exists and user has access
      const historyResult = await db
        .select({ 
          elementId: elementHistory.elementId,
          buildingId: buildingElements.buildingId 
        })
        .from(elementHistory)
        .innerJoin(buildingElements, eq(elementHistory.elementId, buildingElements.id))
        .where(eq(elementHistory.id, id))
        .limit(1);
      
      if (historyResult.length === 0) {
        return res.status(404).json({ error: 'History entry not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, historyResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this history entry'
        });
      }
      
      const updateData = {
        ...validation.data,
        eventDate: validation.data.eventDate ? new Date(validation.data.eventDate) : undefined,
        warrantyEndDate: validation.data.warrantyEndDate ? new Date(validation.data.warrantyEndDate) : undefined,
        updatedAt: new Date(),
      };
      
      const [updatedHistory] = await db
        .update(elementHistory)
        .set(updateData)
        .where(eq(elementHistory.id, id))
        .returning();
      
      res.json({
        success: true,
        data: updatedHistory
      });
    } catch (error: any) {
      console.error('Error updating element history:', error);
      res.status(500).json({
        error: 'Failed to update element history',
        details: error.message
      });
    }
  });
  
  /**
   * DELETE /api/maintenance/history/:id - Delete history entry
   */
  app.delete('/api/maintenance/history/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to delete element history'
        });
      }
      
      const { id } = req.params;
      
      // Check history exists and user has access
      const historyResult = await db
        .select({ 
          elementId: elementHistory.elementId,
          buildingId: buildingElements.buildingId 
        })
        .from(elementHistory)
        .innerJoin(buildingElements, eq(elementHistory.elementId, buildingElements.id))
        .where(eq(elementHistory.id, id))
        .limit(1);
      
      if (historyResult.length === 0) {
        return res.status(404).json({ error: 'History entry not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, historyResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this history entry'
        });
      }
      
      await db
        .delete(elementHistory)
        .where(eq(elementHistory.id, id));

  // ===========================================
  // SECURE FILE UPLOAD FOR MAINTENANCE DOCUMENTS
  // ===========================================
  
  /**
   * POST /api/maintenance/elements/:elementId/documents - Upload element document
   */
  app.post('/api/maintenance/elements/:elementId/documents', requireAuth, uploadRateLimit, upload.single('file'), async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to upload documents'
        });
      }
      
      const { elementId } = req.params;
      const file = req.file;
      
      // Security: Validate UUID format
      if (!isValidUUID(elementId)) {
        return res.status(400).json({ error: 'Invalid element ID format' });
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Check element exists and user has access
      const elementResult = await db
        .select({ buildingId: buildingElements.buildingId, organizationId: buildings.organizationId })
        .from(buildingElements)
        .innerJoin(buildings, eq(buildingElements.buildingId, buildings.id))
        .where(eq(buildingElements.id, elementId))
        .limit(1);
      
      if (elementResult.length === 0) {
        return res.status(404).json({ error: 'Element not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, elementResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this element'
        });
      }
      
      // Security: Magic number validation
      const fileBuffer = fs.readFileSync(file.path);
      if (!validateFileByMagicNumbers(fileBuffer, file.mimetype)) {
        // Clean up temp file
        fs.unlinkSync(file.path);
        return res.status(400).json({
          error: 'File type mismatch - file content does not match declared type'
        });
      }
      
      // Security: Use secure file storage
      const uploadContext: UploadContext = {
        type: 'maintenance',
        organizationId: elementResult[0].organizationId,
        buildingId: elementResult[0].buildingId,
        elementId: elementId,
      };
      
      const storageResult = await secureFileStorage.storeFile(
        file,
        uploadContext,
        user.role,
        user.id
      );
      
      if (!storageResult.success) {
        return res.status(500).json({
          error: 'Failed to store file securely',
          details: storageResult.error
        });
      }
      
      // Determine document type based on MIME type and user input
      let documentType: 'image' | 'pdf' | 'specification' | 'warranty' | 'report' = 'report'; // default
      
      // Check if user provided a specific document type
      const userDocumentType = req.body.documentType;
      const validDocumentTypes = ['image', 'pdf', 'specification', 'warranty', 'report'];
      
      if (userDocumentType && validDocumentTypes.includes(userDocumentType)) {
        documentType = userDocumentType;
      } else {
        // Auto-categorize based on MIME type
        if (file.mimetype.startsWith('image/')) {
          documentType = 'image';
        } else if (file.mimetype === 'application/pdf') {
          documentType = 'pdf';
        } else {
          // Default to 'report' for other document types
          documentType = 'report';
        }
      }
      
      // Security: Store document metadata in transaction
      const [document] = await db.transaction(async (tx) => {
        return await tx
          .insert(elementDocuments)
          .values({
            elementId,
            documentType,
            title: req.body.title || file.originalname,
            description: req.body.description || null,
            filePath: storageResult.filePath!,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedBy: user.id,
          })
          .returning();
      });
      
      res.status(201).json({
        success: true,
        data: document
      });
    } catch (error: any) {
      console.error('Error uploading document:', error);
      // Clean up temp file on error
      if (req.file?.path) {
        fs.unlinkSync(req.file.path).catch(() => {});
      }
      res.status(500).json({
        error: 'Failed to upload document',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/elements/:elementId/documents - List element documents
   */
  app.get('/api/maintenance/elements/:elementId/documents', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { elementId } = req.params;
      
      // Security: Validate UUID format
      if (!isValidUUID(elementId)) {
        return res.status(400).json({ error: 'Invalid element ID format' });
      }
      
      // Check element exists and user has access
      const elementResult = await db
        .select({ buildingId: buildingElements.buildingId })
        .from(buildingElements)
        .where(eq(buildingElements.id, elementId))
        .limit(1);
      
      if (elementResult.length === 0) {
        return res.status(404).json({ error: 'Element not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, elementResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this element'
        });
      }
      
      // Security: Validate pagination
      const paginationValidation = paginationSchema.safeParse(req.query);
      if (!paginationValidation.success) {
        return res.status(400).json({
          error: 'Invalid pagination parameters',
          details: paginationValidation.error.errors
        });
      }
      
      const { page, limit, order } = paginationValidation.data;
      const offset = (page - 1) * limit;
      
      const [documents, totalCount] = await Promise.all([
        db
          .select({
            id: elementDocuments.id,
            documentType: elementDocuments.documentType,
            title: elementDocuments.title,
            description: elementDocuments.description,
            fileName: elementDocuments.fileName,
            fileSize: elementDocuments.fileSize,
            mimeType: elementDocuments.mimeType,
            uploadedBy: elementDocuments.uploadedBy,
            createdAt: elementDocuments.createdAt,
          })
          .from(elementDocuments)
          .where(eq(elementDocuments.elementId, elementId))
          .limit(limit)
          .offset(offset)
          .orderBy(order === 'asc' ? asc(elementDocuments.createdAt) : desc(elementDocuments.createdAt)),
        db
          .select({ count: count() })
          .from(elementDocuments)
          .where(eq(elementDocuments.elementId, elementId))
      ]);
      
      const total = totalCount[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);
      
      res.json({
        success: true,
        data: documents,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      res.status(500).json({
        error: 'Failed to fetch documents',
        details: error.message
      });
    }
  });
  
  /**
   * DELETE /api/maintenance/documents/:id - Delete document
   */
  app.delete('/api/maintenance/documents/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to delete documents'
        });
      }
      
      const { id } = req.params;
      
      // Security: Validate UUID format
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid document ID format' });
      }
      
      // Check document exists and user has access
      const documentResult = await db
        .select({ 
          filePath: elementDocuments.filePath,
          buildingId: buildingElements.buildingId 
        })
        .from(elementDocuments)
        .innerJoin(buildingElements, eq(elementDocuments.elementId, buildingElements.id))
        .where(eq(elementDocuments.id, id))
        .limit(1);
      
      if (documentResult.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, documentResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this document'
        });
      }
      
      // Security: Delete file and metadata in transaction
      await db.transaction(async (tx) => {
        // Delete from database first
        await tx
          .delete(elementDocuments)
          .where(eq(elementDocuments.id, id));
        
        // Then delete file from storage
        try {
          await secureFileStorage.deleteFile(documentResult[0].filePath, user.id, user.role);
        } catch (fileError) {
          console.warn('Failed to delete file from storage:', fileError);
          // Don't fail the transaction for file deletion errors
        }
      });
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting document:', error);
      res.status(500).json({
        error: 'Failed to delete document',
        details: error.message
      });
    }
  });
      
      res.json({
        success: true,
        message: 'History entry deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting element history:', error);
      res.status(500).json({
        error: 'Failed to delete element history',
        details: error.message
      });
    }
  });
  
  // ===========================================
  // EVALUATION SUGGESTIONS
  // ===========================================
  
  /**
   * GET /api/maintenance/buildings/:buildingId/suggestions - Get suggestions for building
   */
  app.get('/api/maintenance/buildings/:buildingId/suggestions', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { buildingId } = req.params;
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const suggestions = await db
        .select({
          id: evaluationSuggestions.id,
          elementId: evaluationSuggestions.elementId,
          uniformatCode: evaluationSuggestions.uniformatCode,
          suggestionType: evaluationSuggestions.suggestionType,
          priority: evaluationSuggestions.priority,
          title: evaluationSuggestions.title,
          description: evaluationSuggestions.description,
          estimatedCost: evaluationSuggestions.estimatedCost,
          suggestedDate: evaluationSuggestions.suggestedDate,
          status: evaluationSuggestions.status,
          postponedUntil: evaluationSuggestions.postponedUntil,
          reasoning: evaluationSuggestions.reasoning,
          notes: evaluationSuggestions.notes,
          createdAt: evaluationSuggestions.createdAt,
          elementName: buildingElements.name,
        })
        .from(evaluationSuggestions)
        .leftJoin(buildingElements, eq(evaluationSuggestions.elementId, buildingElements.id))
        .where(eq(evaluationSuggestions.buildingId, buildingId))
        .orderBy(
          sql`
            CASE ${evaluationSuggestions.priority}
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2  
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END
          `,
          asc(evaluationSuggestions.suggestedDate)
        );
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error: any) {
      console.error('Error fetching evaluation suggestions:', error);
      res.status(500).json({
        error: 'Failed to fetch evaluation suggestions',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/maintenance/suggestions - Create manual suggestion
   */
  app.post('/api/maintenance/suggestions', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to create suggestions'
        });
      }
      
      const validation = evaluationSuggestionCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid suggestion data',
          details: validation.error.errors
        });
      }
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, validation.data.buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const suggestionData: InsertEvaluationSuggestion = {
        ...validation.data,
        suggestedDate: validation.data.suggestedDate,
        isSystemGenerated: false,
      };
      
      // Security: Use transaction for atomic operation
      const [suggestion] = await db.transaction(async (tx) => {
        return await tx
          .insert(evaluationSuggestions)
          .values(suggestionData)
          .returning();
      });
      
      res.status(201).json({
        success: true,
        data: suggestion
      });
    } catch (error: any) {
      console.error('Error creating evaluation suggestion:', error);
      res.status(500).json({
        error: 'Failed to create evaluation suggestion',
        details: error.message
      });
    }
  });
  
  /**
   * PUT /api/maintenance/suggestions/:id - Update suggestion (postpone, dismiss, etc.)
   */
  app.put('/api/maintenance/suggestions/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to update suggestions'
        });
      }
      
      const { id } = req.params;
      const validation = evaluationSuggestionUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid suggestion data',
          details: validation.error.errors
        });
      }
      
      // Check suggestion exists and user has access
      const suggestionResult = await db
        .select({ buildingId: evaluationSuggestions.buildingId })
        .from(evaluationSuggestions)
        .where(eq(evaluationSuggestions.id, id))
        .limit(1);
      
      if (suggestionResult.length === 0) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, suggestionResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this suggestion'
        });
      }
      
      const updateData = {
        ...validation.data,
        postponedUntil: validation.data.postponedUntil ? new Date(validation.data.postponedUntil) : undefined,
        updatedAt: new Date(),
      };
      
      const [updatedSuggestion] = await db
        .update(evaluationSuggestions)
        .set(updateData)
        .where(eq(evaluationSuggestions.id, id))
        .returning();
      
      res.json({
        success: true,
        data: updatedSuggestion
      });
    } catch (error: any) {
      console.error('Error updating evaluation suggestion:', error);
      res.status(500).json({
        error: 'Failed to update evaluation suggestion',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/maintenance/suggestions/:id/convert-to-project - Convert suggestion to project
   */
  app.post('/api/maintenance/suggestions/:id/convert-to-project', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to convert suggestions to projects'
        });
      }
      
      const { id } = req.params;
      
      // Get suggestion details
      const suggestionResult = await db
        .select()
        .from(evaluationSuggestions)
        .where(eq(evaluationSuggestions.id, id))
        .limit(1);
      
      if (suggestionResult.length === 0) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }
      
      const suggestion = suggestionResult[0];
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, suggestion.buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this suggestion'
        });
      }
      
      // Create maintenance project from suggestion
      const projectData: InsertMaintenanceProject = {
        buildingId: suggestion.buildingId,
        title: suggestion.title,
        description: suggestion.description,
        projectType: suggestion.suggestionType as any, // Type assertion needed
        priority: suggestion.priority,
        estimatedCost: suggestion.estimatedCost,
        evaluationSuggestionId: suggestion.id,
      };
      
      const [project] = await db
        .insert(maintenanceProjects)
        .values(projectData)
        .returning();
      
      // Update suggestion status
      await db
        .update(evaluationSuggestions)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(evaluationSuggestions.id, id));
      
      res.status(201).json({
        success: true,
        data: project
      });
    } catch (error: any) {
      console.error('Error converting suggestion to project:', error);
      res.status(500).json({
        error: 'Failed to convert suggestion to project',
        details: error.message
      });
    }
  });
  
  // ===========================================
  // MAINTENANCE PROJECTS
  // ===========================================
  
  /**
   * GET /api/maintenance/buildings/:buildingId/projects - List projects for building
   */
  app.get('/api/maintenance/buildings/:buildingId/projects', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { buildingId } = req.params;
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const projects = await db
        .select({
          id: maintenanceProjects.id,
          title: maintenanceProjects.title,
          description: maintenanceProjects.description,
          projectType: maintenanceProjects.projectType,
          status: maintenanceProjects.status,
          priority: maintenanceProjects.priority,
          estimatedCost: maintenanceProjects.estimatedCost,
          actualCost: maintenanceProjects.actualCost,
          startDate: maintenanceProjects.startDate,
          endDate: maintenanceProjects.endDate,
          assignedVendorId: maintenanceProjects.assignedVendorId,
          evaluationSuggestionId: maintenanceProjects.evaluationSuggestionId,
          createdAt: maintenanceProjects.createdAt,
          updatedAt: maintenanceProjects.updatedAt,
          vendorName: vendors.name,
        })
        .from(maintenanceProjects)
        .leftJoin(vendors, eq(maintenanceProjects.assignedVendorId, vendors.id))
        .where(eq(maintenanceProjects.buildingId, buildingId))
        .orderBy(
          sql`
            CASE ${maintenanceProjects.priority}
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END
          `,
          desc(maintenanceProjects.createdAt)
        );
      
      res.json({
        success: true,
        data: projects
      });
    } catch (error: any) {
      console.error('Error fetching maintenance projects:', error);
      res.status(500).json({
        error: 'Failed to fetch maintenance projects',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/maintenance/projects - Create project
   */
  app.post('/api/maintenance/projects', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to create projects'
        });
      }
      
      const validation = maintenanceProjectCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid project data',
          details: validation.error.errors
        });
      }
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, validation.data.buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const projectData: InsertMaintenanceProject = {
        ...validation.data,
        startDate: validation.data.startDate ? new Date(validation.data.startDate) : null,
        endDate: validation.data.endDate ? new Date(validation.data.endDate) : null,
      };
      
      const [project] = await db
        .insert(maintenanceProjects)
        .values(projectData)
        .returning();
      
      res.status(201).json({
        success: true,
        data: project
      });
    } catch (error: any) {
      console.error('Error creating maintenance project:', error);
      res.status(500).json({
        error: 'Failed to create maintenance project',
        details: error.message
      });
    }
  });
  
  /**
   * PUT /api/maintenance/projects/:id - Update project
   */
  app.put('/api/maintenance/projects/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to update projects'
        });
      }
      
      const { id } = req.params;
      const validation = maintenanceProjectUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid project data',
          details: validation.error.errors
        });
      }
      
      // Check project exists and user has access
      const projectResult = await db
        .select({ buildingId: maintenanceProjects.buildingId })
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.id, id))
        .limit(1);
      
      if (projectResult.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, projectResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this project'
        });
      }
      
      const updateData = {
        ...validation.data,
        startDate: validation.data.startDate ? new Date(validation.data.startDate) : undefined,
        endDate: validation.data.endDate ? new Date(validation.data.endDate) : undefined,
        updatedAt: new Date(),
      };
      
      const [updatedProject] = await db
        .update(maintenanceProjects)
        .set(updateData)
        .where(eq(maintenanceProjects.id, id))
        .returning();
      
      res.json({
        success: true,
        data: updatedProject
      });
    } catch (error: any) {
      console.error('Error updating maintenance project:', error);
      res.status(500).json({
        error: 'Failed to update maintenance project',
        details: error.message
      });
    }
  });
  
  /**
   * DELETE /api/maintenance/projects/:id - Delete project
   */
  app.delete('/api/maintenance/projects/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to delete projects'
        });
      }
      
      const { id } = req.params;
      
      // Check project exists and user has access
      const projectResult = await db
        .select({ buildingId: maintenanceProjects.buildingId })
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.id, id))
        .limit(1);
      
      if (projectResult.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, projectResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this project'
        });
      }
      
      await db
        .delete(maintenanceProjects)
        .where(eq(maintenanceProjects.id, id));
      
      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting maintenance project:', error);
      res.status(500).json({
        error: 'Failed to delete maintenance project',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/projects/:id - Get project details
   */
  app.get('/api/maintenance/projects/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { id } = req.params;
      
      // Get project details
      const projectResult = await db
        .select({
          id: maintenanceProjects.id,
          buildingId: maintenanceProjects.buildingId,
          title: maintenanceProjects.title,
          description: maintenanceProjects.description,
          projectType: maintenanceProjects.projectType,
          status: maintenanceProjects.status,
          priority: maintenanceProjects.priority,
          estimatedCost: maintenanceProjects.estimatedCost,
          actualCost: maintenanceProjects.actualCost,
          startDate: maintenanceProjects.startDate,
          endDate: maintenanceProjects.endDate,
          assignedVendorId: maintenanceProjects.assignedVendorId,
          evaluationSuggestionId: maintenanceProjects.evaluationSuggestionId,
          createdAt: maintenanceProjects.createdAt,
          updatedAt: maintenanceProjects.updatedAt,
          vendorName: vendors.name,
          buildingName: buildings.name,
        })
        .from(maintenanceProjects)
        .leftJoin(vendors, eq(maintenanceProjects.assignedVendorId, vendors.id))
        .leftJoin(buildings, eq(maintenanceProjects.buildingId, buildings.id))
        .where(eq(maintenanceProjects.id, id))
        .limit(1);
      
      if (projectResult.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const project = projectResult[0];
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, project.buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this project'
        });
      }
      
      // Get project steps
      const steps = await db
        .select()
        .from(projectSteps)
        .where(eq(projectSteps.projectId, id))
        .orderBy(asc(projectSteps.stepOrder));
      
      // Get linked elements
      const linkedElements = await db
        .select({
          elementId: projectElements.elementId,
          elementName: buildingElements.name,
          uniformatCode: buildingElements.uniformatCode,
        })
        .from(projectElements)
        .innerJoin(buildingElements, eq(projectElements.elementId, buildingElements.id))
        .where(eq(projectElements.projectId, id));
      
      res.json({
        success: true,
        data: {
          ...project,
          steps,
          linkedElements
        }
      });
    } catch (error: any) {
      console.error('Error fetching project details:', error);
      res.status(500).json({
        error: 'Failed to fetch project details',
        details: error.message
      });
    }
  });
  
  // ===========================================
  // PROJECT WORKFLOW
  // ===========================================
  
  /**
   * GET /api/maintenance/projects/:id/steps - Get project steps
   */
  app.get('/api/maintenance/projects/:id/steps', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { id: projectId } = req.params;
      
      // Check project exists and user has access
      const projectResult = await db
        .select({ buildingId: maintenanceProjects.buildingId })
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.id, projectId))
        .limit(1);
      
      if (projectResult.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, projectResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this project'
        });
      }
      
      const steps = await db
        .select()
        .from(projectSteps)
        .where(eq(projectSteps.projectId, projectId))
        .orderBy(asc(projectSteps.stepOrder));
      
      res.json({
        success: true,
        data: steps
      });
    } catch (error: any) {
      console.error('Error fetching project steps:', error);
      res.status(500).json({
        error: 'Failed to fetch project steps',
        details: error.message
      });
    }
  });
  
  /**
   * PUT /api/maintenance/projects/:id/steps/:stepId - Update step status
   */
  app.put('/api/maintenance/projects/:id/steps/:stepId', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to update project steps'
        });
      }
      
      const { id: projectId, stepId } = req.params;
      const validation = projectStepUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid step data',
          details: validation.error.errors
        });
      }
      
      // Check project exists and user has access
      const projectResult = await db
        .select({ buildingId: maintenanceProjects.buildingId })
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.id, projectId))
        .limit(1);
      
      if (projectResult.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, projectResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this project'
        });
      }
      
      const updateData = {
        ...validation.data,
        completedDate: validation.data.completedDate ? new Date(validation.data.completedDate) : undefined,
        updatedAt: new Date(),
      };
      
      const [updatedStep] = await db
        .update(projectSteps)
        .set(updateData)
        .where(and(
          eq(projectSteps.projectId, projectId),
          eq(projectSteps.id, stepId)
        ))
        .returning();
      
      if (!updatedStep) {
        return res.status(404).json({ error: 'Step not found' });
      }
      
      res.json({
        success: true,
        data: updatedStep
      });
    } catch (error: any) {
      console.error('Error updating project step:', error);
      res.status(500).json({
        error: 'Failed to update project step',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/maintenance/projects/:id/elements - Link elements to project
   */
  app.post('/api/maintenance/projects/:id/elements', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to link elements to projects'
        });
      }
      
      const { id: projectId } = req.params;
      const { elementIds } = req.body;
      
      if (!Array.isArray(elementIds) || elementIds.length === 0) {
        return res.status(400).json({
          error: 'elementIds must be a non-empty array'
        });
      }
      
      // Check project exists and user has access
      const projectResult = await db
        .select({ buildingId: maintenanceProjects.buildingId })
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.id, projectId))
        .limit(1);
      
      if (projectResult.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const hasAccess = await checkBuildingAccess(user.id, user.role, projectResult[0].buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this project'
        });
      }
      
      // Verify all elements exist and belong to the same building
      const elements = await db
        .select({ id: buildingElements.id, buildingId: buildingElements.buildingId })
        .from(buildingElements)
        .where(inArray(buildingElements.id, elementIds));
      
      if (elements.length !== elementIds.length) {
        return res.status(400).json({
          error: 'Some elements were not found'
        });
      }
      
      // Check all elements belong to the same building as the project
      const invalidElements = elements.filter(el => el.buildingId !== projectResult[0].buildingId);
      if (invalidElements.length > 0) {
        return res.status(400).json({
          error: 'All elements must belong to the same building as the project'
        });
      }
      
      // Create project-element links
      const linkData = elementIds.map(elementId => ({
        projectId,
        elementId,
      }));
      
      const links = await db
        .insert(projectElements)
        .values(linkData)
        .onConflictDoNothing()
        .returning();
      
      res.status(201).json({
        success: true,
        data: links,
        message: `${links.length} elements linked to project`
      });
    } catch (error: any) {
      console.error('Error linking elements to project:', error);
      res.status(500).json({
        error: 'Failed to link elements to project',
        details: error.message
      });
    }
  });
  
  // ===========================================
  // SPECIAL FEATURES
  // ===========================================
  
  /**
   * GET /api/maintenance/buildings/:buildingId/smart-suggestions - Generate smart evaluation suggestions
   */
  app.get('/api/maintenance/buildings/:buildingId/smart-suggestions', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { buildingId } = req.params;
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      // Get building elements with their conditions and dates
      const elements = await db
        .select()
        .from(buildingElements)
        .where(and(
          eq(buildingElements.buildingId, buildingId),
          eq(buildingElements.isActive, true)
        ));
      
      const smartSuggestions = [];
      const currentDate = new Date();
      
      for (const element of elements) {
        const uniformatInfo = UNIFORMAT_CATALOG.find(item => item.code === element.uniformatCode);
        const typicalLifespan = uniformatInfo?.typicalLifespan || element.originalLifespan || 25;
        
        // Calculate age
        let age = 0;
        if (element.originalConstructionDate) {
          age = currentDate.getFullYear() - element.originalConstructionDate.getFullYear();
        }
        
        // Generate suggestions based on condition and age
        if (element.currentCondition === 'critical') {
          smartSuggestions.push({
            elementId: element.id,
            elementName: element.name,
            uniformatCode: element.uniformatCode,
            suggestionType: 'replacement',
            priority: 'critical',
            title: `Urgent replacement needed: ${element.name}`,
            description: `Element is in critical condition and requires immediate replacement.`,
            reasoning: `Current condition: ${element.currentCondition}`,
            estimatedCost: null,
            suggestedDate: new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
          });
        } else if (element.currentCondition === 'poor') {
          smartSuggestions.push({
            elementId: element.id,
            elementName: element.name,
            uniformatCode: element.uniformatCode,
            suggestionType: age > typicalLifespan * 0.8 ? 'major_rehab' : 'minor_rehab',
            priority: 'high',
            title: `Rehabilitation needed: ${element.name}`,
            description: `Element condition has deteriorated and requires rehabilitation.`,
            reasoning: `Current condition: ${element.currentCondition}, Age: ${age} years`,
            estimatedCost: null,
            suggestedDate: new Date(currentDate.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
          });
        } else if (age > typicalLifespan * 0.75) {
          smartSuggestions.push({
            elementId: element.id,
            elementName: element.name,
            uniformatCode: element.uniformatCode,
            suggestionType: 'inspection',
            priority: age > typicalLifespan ? 'high' : 'medium',
            title: `Detailed inspection recommended: ${element.name}`,
            description: `Element is approaching end of typical lifespan and should be inspected.`,
            reasoning: `Age: ${age} years, Typical lifespan: ${typicalLifespan} years`,
            estimatedCost: null,
            suggestedDate: new Date(currentDate.getTime() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
          });
        }
        
        // Check inspection schedules
        if (element.nextEvaluationDate && element.nextEvaluationDate <= currentDate) {
          smartSuggestions.push({
            elementId: element.id,
            elementName: element.name,
            uniformatCode: element.uniformatCode,
            suggestionType: 'inspection',
            priority: 'medium',
            title: `Scheduled inspection overdue: ${element.name}`,
            description: `The scheduled evaluation date has passed.`,
            reasoning: `Next evaluation was due: ${element.nextEvaluationDate.toISOString().split('T')[0]}`,
            estimatedCost: null,
            suggestedDate: new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
          });
        }
      }
      
      res.json({
        success: true,
        data: smartSuggestions,
        total: smartSuggestions.length
      });
    } catch (error: any) {
      console.error('Error generating smart suggestions:', error);
      res.status(500).json({
        error: 'Failed to generate smart suggestions',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/maintenance/buildings/:buildingId/bulk-import-elements - Bulk import elements from UNIFORMAT
   */
  app.post('/api/maintenance/buildings/:buildingId/bulk-import-elements', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to bulk import elements'
        });
      }
      
      const { buildingId } = req.params;
      const { uniformatCodes: importCodes, defaultCondition = 'good' } = req.body;
      
      if (!Array.isArray(importCodes) || importCodes.length === 0) {
        return res.status(400).json({
          error: 'uniformatCodes must be a non-empty array'
        });
      }
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const elementsToCreate = [];
      const errors = [];
      
      for (const code of importCodes) {
        const uniformatElement = UNIFORMAT_CATALOG.find(item => item.code === code);
        if (!uniformatElement) {
          errors.push(`Invalid UNIFORMAT code: ${code}`);
          continue;
        }
        
        // Check if element already exists
        const existing = await db
          .select({ id: buildingElements.id })
          .from(buildingElements)
          .where(and(
            eq(buildingElements.buildingId, buildingId),
            eq(buildingElements.uniformatCode, code),
            eq(buildingElements.isActive, true)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          errors.push(`Element already exists for UNIFORMAT code: ${code}`);
          continue;
        }
        
        elementsToCreate.push({
          buildingId,
          uniformatCode: code,
          name: uniformatElement.nameFr, // Use French name as default
          description: uniformatElement.descriptionFr,
          originalLifespan: uniformatElement.typicalLifespan,
          currentLifespan: uniformatElement.typicalLifespan,
          currentCondition: defaultCondition as any,
        });
      }
      
      if (elementsToCreate.length === 0) {
        return res.status(400).json({
          error: 'No valid elements to create',
          details: errors
        });
      }
      
      const createdElements = await db
        .insert(buildingElements)
        .values(elementsToCreate)
        .returning();
      
      res.status(201).json({
        success: true,
        data: createdElements,
        created: createdElements.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error('Error bulk importing elements:', error);
      res.status(500).json({
        error: 'Failed to bulk import elements',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/buildings/:buildingId/timeline - Get maintenance timeline for planning
   */
  app.get('/api/maintenance/buildings/:buildingId/timeline', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { buildingId } = req.params;
      const { startDate, endDate, limit = '100' } = req.query;
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const timelineEvents = [];
      
      // Get upcoming evaluation suggestions
      const suggestions = await db
        .select({
          id: evaluationSuggestions.id,
          title: evaluationSuggestions.title,
          suggestionType: evaluationSuggestions.suggestionType,
          priority: evaluationSuggestions.priority,
          suggestedDate: evaluationSuggestions.suggestedDate,
          status: evaluationSuggestions.status,
          elementName: buildingElements.name,
        })
        .from(evaluationSuggestions)
        .leftJoin(buildingElements, eq(evaluationSuggestions.elementId, buildingElements.id))
        .where(and(
          eq(evaluationSuggestions.buildingId, buildingId),
          eq(evaluationSuggestions.status, 'pending')
        ));
      
      suggestions.forEach(suggestion => {
        timelineEvents.push({
          id: suggestion.id,
          type: 'suggestion',
          title: suggestion.title,
          description: `${suggestion.suggestionType} suggestion for ${suggestion.elementName || 'building'}`,
          date: suggestion.suggestedDate,
          priority: suggestion.priority,
          status: suggestion.status,
        });
      });
      
      // Get active projects
      const projects = await db
        .select({
          id: maintenanceProjects.id,
          title: maintenanceProjects.title,
          projectType: maintenanceProjects.projectType,
          priority: maintenanceProjects.priority,
          status: maintenanceProjects.status,
          startDate: maintenanceProjects.startDate,
          endDate: maintenanceProjects.endDate,
        })
        .from(maintenanceProjects)
        .where(and(
          eq(maintenanceProjects.buildingId, buildingId),
          or(
            eq(maintenanceProjects.status, 'planned'),
            eq(maintenanceProjects.status, 'evaluation'),
            eq(maintenanceProjects.status, 'submission'),
            eq(maintenanceProjects.status, 'pre_work'),
            eq(maintenanceProjects.status, 'work'),
            eq(maintenanceProjects.status, 'post_work')
          )
        ));
      
      projects.forEach(project => {
        if (project.startDate) {
          timelineEvents.push({
            id: project.id,
            type: 'project_start',
            title: `Project Start: ${project.title}`,
            description: `${project.projectType} project begins`,
            date: project.startDate,
            priority: project.priority,
            status: project.status,
          });
        }
        
        if (project.endDate) {
          timelineEvents.push({
            id: project.id,
            type: 'project_end',
            title: `Project End: ${project.title}`,
            description: `${project.projectType} project completion`,
            date: project.endDate,
            priority: project.priority,
            status: project.status,
          });
        }
      });
      
      // Get upcoming evaluations
      const upcomingEvaluations = await db
        .select({
          id: buildingElements.id,
          name: buildingElements.name,
          nextEvaluationDate: buildingElements.nextEvaluationDate,
          currentCondition: buildingElements.currentCondition,
        })
        .from(buildingElements)
        .where(and(
          eq(buildingElements.buildingId, buildingId),
          eq(buildingElements.isActive, true),
          sql`${buildingElements.nextEvaluationDate} IS NOT NULL`
        ));
      
      upcomingEvaluations.forEach(element => {
        if (element.nextEvaluationDate) {
          timelineEvents.push({
            id: element.id,
            type: 'evaluation',
            title: `Evaluation Due: ${element.name}`,
            description: `Scheduled evaluation for element in ${element.currentCondition} condition`,
            date: element.nextEvaluationDate,
            priority: element.currentCondition === 'poor' || element.currentCondition === 'critical' ? 'high' : 'medium',
            status: 'pending',
          });
        }
      });
      
      // Sort timeline events by date
      timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Apply filters if provided
      let filteredEvents = timelineEvents;
      if (startDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.date) >= new Date(startDate as string));
      }
      if (endDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.date) <= new Date(endDate as string));
      }
      
      // Limit results
      const limitNum = parseInt(limit as string);
      if (limitNum > 0) {
        filteredEvents = filteredEvents.slice(0, limitNum);
      }
      
      res.json({
        success: true,
        data: filteredEvents,
        total: filteredEvents.length
      });
    } catch (error: any) {
      console.error('Error fetching maintenance timeline:', error);
      res.status(500).json({
        error: 'Failed to fetch maintenance timeline',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/buildings/:buildingId/cost-analysis - Cost analysis and aggregation
   */
  app.get('/api/maintenance/buildings/:buildingId/cost-analysis', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { buildingId } = req.params;
      const { period = 'year', category } = req.query;
      
      // Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'No access to this building'
        });
      }
      
      const analysis = {
        totalCosts: {
          historical: 0,
          projected: 0,
        },
        costsByCategory: {},
        costsByPeriod: {},
        costsByElement: {},
        costsByPriority: {},
      };
      
      // Get historical costs from element histories
      const historicalCosts = await db
        .select({
          cost: elementHistory.cost,
          eventDate: elementHistory.eventDate,
          eventType: elementHistory.eventType,
          uniformatCode: buildingElements.uniformatCode,
          elementName: buildingElements.name,
        })
        .from(elementHistory)
        .innerJoin(buildingElements, eq(elementHistory.elementId, buildingElements.id))
        .where(and(
          eq(buildingElements.buildingId, buildingId),
          sql`${elementHistory.cost} IS NOT NULL AND ${elementHistory.cost} > 0`
        ));
      
      // Calculate historical costs
      let totalHistorical = 0;
      const categoryCosts = {};
      const periodCosts = {};
      const elementCosts = {};
      
      historicalCosts.forEach(record => {
        const cost = record.cost || 0;
        totalHistorical += cost;
        
        // Group by UNIFORMAT category
        const uniformatInfo = UNIFORMAT_CATALOG.find(item => item.code === record.uniformatCode);
        const category = uniformatInfo?.category || 'Other';
        categoryCosts[category] = (categoryCosts[category] || 0) + cost;
        
        // Group by period
        const date = new Date(record.eventDate);
        const periodKey = period === 'month' 
          ? `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
          : date.getFullYear().toString();
        periodCosts[periodKey] = (periodCosts[periodKey] || 0) + cost;
        
        // Group by element
        elementCosts[record.elementName] = (elementCosts[record.elementName] || 0) + cost;
      });
      
      analysis.totalCosts.historical = totalHistorical;
      analysis.costsByCategory = categoryCosts;
      analysis.costsByPeriod = periodCosts;
      analysis.costsByElement = elementCosts;
      
      // Get projected costs from active projects and suggestions
      const projectedFromProjects = await db
        .select({
          estimatedCost: maintenanceProjects.estimatedCost,
          priority: maintenanceProjects.priority,
          projectType: maintenanceProjects.projectType,
        })
        .from(maintenanceProjects)
        .where(and(
          eq(maintenanceProjects.buildingId, buildingId),
          or(
            eq(maintenanceProjects.status, 'planned'),
            eq(maintenanceProjects.status, 'evaluation'),
            eq(maintenanceProjects.status, 'submission')
          ),
          sql`${maintenanceProjects.estimatedCost} IS NOT NULL AND ${maintenanceProjects.estimatedCost} > 0`
        ));
      
      const projectedFromSuggestions = await db
        .select({
          estimatedCost: evaluationSuggestions.estimatedCost,
          priority: evaluationSuggestions.priority,
          suggestionType: evaluationSuggestions.suggestionType,
        })
        .from(evaluationSuggestions)
        .where(and(
          eq(evaluationSuggestions.buildingId, buildingId),
          eq(evaluationSuggestions.status, 'pending'),
          sql`${evaluationSuggestions.estimatedCost} IS NOT NULL AND ${evaluationSuggestions.estimatedCost} > 0`
        ));
      
      let totalProjected = 0;
      const priorityCosts = {};
      
      [...projectedFromProjects, ...projectedFromSuggestions].forEach(record => {
        const cost = record.estimatedCost || 0;
        totalProjected += cost;
        priorityCosts[record.priority] = (priorityCosts[record.priority] || 0) + cost;
      });
      
      analysis.totalCosts.projected = totalProjected;
      analysis.costsByPriority = priorityCosts;
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error: any) {
      console.error('Error fetching cost analysis:', error);
      res.status(500).json({
        error: 'Failed to fetch cost analysis',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/maintenance/dashboard/:organizationId - Dashboard summary statistics
   */
  app.get('/api/maintenance/dashboard/:organizationId', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { organizationId } = req.params;
      
      // Check organization access
      if (user.role === 'manager') {
        const userOrgs = await getUserOrganizations(user.id);
        if (!userOrgs.includes(organizationId)) {
          return res.status(403).json({
            error: 'No access to this organization'
          });
        }
      }
      
      // Get organization buildings
      const organizationBuildings = await db
        .select({ id: buildings.id })
        .from(buildings)
        .where(and(
          eq(buildings.organizationId, organizationId),
          eq(buildings.isActive, true)
        ));
      
      const buildingIds = organizationBuildings.map(b => b.id);
      
      if (buildingIds.length === 0) {
        return res.json({
          success: true,
          data: {
            buildings: 0,
            elements: 0,
            activeSuggestions: 0,
            activeProjects: 0,
            criticalElements: 0,
            overdueSuggestions: 0,
            upcomingEvaluations: 0,
            monthlyStats: {},
          }
        });
      }
      
      // Parallel queries for dashboard data
      const [
        elementsCount,
        activeSuggestionsCount,
        activeProjectsCount,
        criticalElementsCount,
        overdueSuggestionsCount,
        upcomingEvaluationsCount,
      ] = await Promise.all([
        // Total elements
        db.select({ count: count() })
          .from(buildingElements)
          .where(and(
            inArray(buildingElements.buildingId, buildingIds),
            eq(buildingElements.isActive, true)
          )),
        
        // Active suggestions
        db.select({ count: count() })
          .from(evaluationSuggestions)
          .where(and(
            inArray(evaluationSuggestions.buildingId, buildingIds),
            eq(evaluationSuggestions.status, 'pending')
          )),
        
        // Active projects  
        db.select({ count: count() })
          .from(maintenanceProjects)
          .where(and(
            inArray(maintenanceProjects.buildingId, buildingIds),
            or(
              eq(maintenanceProjects.status, 'planned'),
              eq(maintenanceProjects.status, 'evaluation'),
              eq(maintenanceProjects.status, 'submission'),
              eq(maintenanceProjects.status, 'pre_work'),
              eq(maintenanceProjects.status, 'work'),
              eq(maintenanceProjects.status, 'post_work')
            )
          )),
        
        // Critical condition elements
        db.select({ count: count() })
          .from(buildingElements)
          .where(and(
            inArray(buildingElements.buildingId, buildingIds),
            eq(buildingElements.isActive, true),
            or(
              eq(buildingElements.currentCondition, 'critical'),
              eq(buildingElements.currentCondition, 'poor')
            )
          )),
        
        // Overdue suggestions (past suggested date)
        db.select({ count: count() })
          .from(evaluationSuggestions)
          .where(and(
            inArray(evaluationSuggestions.buildingId, buildingIds),
            eq(evaluationSuggestions.status, 'pending'),
            sql`${evaluationSuggestions.suggestedDate} < CURRENT_DATE`
          )),
        
        // Upcoming evaluations (next 90 days)
        db.select({ count: count() })
          .from(buildingElements)
          .where(and(
            inArray(buildingElements.buildingId, buildingIds),
            eq(buildingElements.isActive, true),
            sql`${buildingElements.nextEvaluationDate} BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'`
          )),
      ]);
      
      const dashboard = {
        buildings: buildingIds.length,
        elements: elementsCount[0]?.count || 0,
        activeSuggestions: activeSuggestionsCount[0]?.count || 0,
        activeProjects: activeProjectsCount[0]?.count || 0,
        criticalElements: criticalElementsCount[0]?.count || 0,
        overdueSuggestions: overdueSuggestionsCount[0]?.count || 0,
        upcomingEvaluations: upcomingEvaluationsCount[0]?.count || 0,
      };
      
      res.json({
        success: true,
        data: dashboard
      });
    } catch (error: any) {
      console.error('Error fetching maintenance dashboard:', error);
      res.status(500).json({
        error: 'Failed to fetch maintenance dashboard',
        details: error.message
      });
    }
  });

  // ===========================================
  // SMART EVALUATION SUGGESTIONS
  // ===========================================

  /**
   * POST /api/maintenance/buildings/:buildingId/suggestions/generate - Generate maintenance suggestions
   */
  app.post('/api/maintenance/buildings/:buildingId/suggestions/generate', 
    requireAuth, 
    suggestionGenerationRateLimit, 
    async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { buildingId } = req.params;
      
      // Security: Validate UUID format
      if (!isValidUUID(buildingId)) {
        return res.status(400).json({ 
          error: 'Invalid building ID format',
          code: 'INVALID_UUID'
        });
      }

      // RBAC: Check building access
      const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Insufficient permissions to generate suggestions for this building',
          code: 'ACCESS_DENIED'
        });
      }

      // Validate building exists and is active
      const building = await db
        .select({ 
          id: buildings.id, 
          name: buildings.name,
          isActive: buildings.isActive 
        })
        .from(buildings)
        .where(eq(buildings.id, buildingId))
        .limit(1);

      if (building.length === 0) {
        return res.status(404).json({
          error: 'Building not found',
          code: 'BUILDING_NOT_FOUND'
        });
      }

      if (!building[0].isActive) {
        return res.status(400).json({
          error: 'Cannot generate suggestions for inactive building',
          code: 'BUILDING_INACTIVE'
        });
      }

      // Parse query parameters
      const dryRun = req.query.dryRun === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const forceRegeneration = req.query.forceRegeneration === 'true';

      // Validate limit parameter
      if (limit && (isNaN(limit) || limit < 1 || limit > 1000)) {
        return res.status(400).json({
          error: 'Invalid limit parameter. Must be between 1 and 1000.',
          code: 'INVALID_LIMIT'
        });
      }

      console.log(`🔧 Starting suggestion generation for building ${buildingId} (${building[0].name})`);
      console.log(`📊 Options: dryRun=${dryRun}, limit=${limit}, forceRegeneration=${forceRegeneration}`);

      // Generate suggestions using the service
      const result = await maintenanceSuggestionService.generateForBuilding(buildingId, {
        dryRun,
        limit,
        forceRegeneration
      });

      // Log results for monitoring
      console.log(`✅ Suggestion generation completed for building ${buildingId}:`);
      console.log(`   Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}`);
      console.log(`   Errors: ${result.errors.length}`);

      // Response with comprehensive statistics
      const response = {
        success: true,
        buildingId,
        buildingName: building[0].name,
        dryRun,
        timestamp: new Date().toISOString(),
        results: {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          total: result.created + result.updated + result.skipped,
          errors: result.errors.length,
        },
        sampleSuggestions: result.sampleSuggestions.slice(0, 5), // Limit sample size
        ...(result.errors.length > 0 && { 
          errors: result.errors.slice(0, 10) // Limit error details
        })
      };

      // Return appropriate status code
      const statusCode = result.errors.length > 0 ? 207 : 200; // 207 Multi-Status if partial errors
      
      res.status(statusCode).json(response);

    } catch (error: any) {
      console.error('Error generating maintenance suggestions:', error);
      
      // Handle specific service errors
      if (error.message.includes('Database connection')) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          details: 'Database connection issue'
        });
      }

      if (error.message.includes('Rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          details: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to generate maintenance suggestions',
        code: 'GENERATION_ERROR',
        details: error.message
      });
    }
  });

  /**
   * GET /api/maintenance/jobs/suggestions/status - Get maintenance job status and health
   */
  app.get('/api/maintenance/jobs/suggestions/status', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only admin and manager roles can access job status
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to view job status',
          code: 'ACCESS_DENIED'
        });
      }

      // Get job status from the scheduler
      const status = await maintenanceJobsScheduler.getJobStatus();

      // Add system health information
      const systemInfo = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        timezone: 'America/Montreal'
      };

      res.json({
        success: true,
        data: {
          scheduler: {
            ...status,
            enabled: true,
            schedule: {
              daily: 'Every day at 02:15 AM (America/Montreal)',
              weekly: 'Saturdays at 03:00 AM (America/Montreal)'
            }
          },
          system: systemInfo
        }
      });

    } catch (error: any) {
      console.error('Error fetching maintenance job status:', error);
      res.status(500).json({
        error: 'Failed to fetch job status',
        details: error.message
      });
    }
  });

  /**
   * POST /api/maintenance/jobs/suggestions/trigger - Manual trigger for maintenance suggestions
   */
  app.post('/api/maintenance/jobs/suggestions/trigger', 
    requireAuth, 
    suggestionGenerationRateLimit, 
    async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only admin and manager roles can trigger jobs
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions to trigger maintenance jobs',
          code: 'ACCESS_DENIED'
        });
      }

      // Parse options from request body
      const { buildingIds, organizationId, dryRun, limit } = req.body;

      // Validate building access if specific buildings are provided
      if (buildingIds && Array.isArray(buildingIds)) {
        for (const buildingId of buildingIds) {
          if (!isValidUUID(buildingId)) {
            return res.status(400).json({
              error: 'Invalid building ID format',
              code: 'INVALID_UUID',
              buildingId
            });
          }

          const hasAccess = await checkBuildingAccess(user.id, user.role, buildingId);
          if (!hasAccess) {
            return res.status(403).json({
              error: 'Insufficient permissions for specified building',
              code: 'ACCESS_DENIED',
              buildingId
            });
          }
        }
      }

      console.log(`🔄 Manual trigger requested by user ${user.id} (${user.role})`);
      console.log(`📊 Options: buildingIds=${buildingIds?.length || 'all'}, dryRun=${dryRun}, limit=${limit}`);

      // Trigger the job
      const result = await maintenanceJobsScheduler.triggerManual({
        buildingIds,
        organizationId,
        dryRun,
        limit
      });

      res.json({
        success: true,
        trigger: {
          triggeredBy: user.id,
          triggerTime: new Date().toISOString(),
          options: {
            buildingIds: buildingIds || null,
            organizationId: organizationId || null,
            dryRun: dryRun || false,
            limit: limit || null
          }
        },
        result
      });

    } catch (error: any) {
      console.error('Error triggering maintenance job:', error);
      
      if (error.message.includes('already running')) {
        return res.status(409).json({
          error: 'Job is currently running',
          code: 'JOB_RUNNING',
          details: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to trigger maintenance job',
        code: 'TRIGGER_ERROR',
        details: error.message
      });
    }
  });
}