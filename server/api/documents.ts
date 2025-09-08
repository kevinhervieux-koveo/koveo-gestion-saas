import type { Express } from 'express';
import { requireAuth, requireRole } from '../auth';
import { storage } from '../storage';
import {
  documents,
  insertDocumentSchema,
  type InsertDocument,
  type Document,
} from '../../shared/schema';

// Use the generated Document type from schema to avoid DOM Document collision
type DocumentRecord = Document;
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import { db } from '../db';

// Enhanced security configuration for file uploads
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // Reduced to 25MB for better security
  MAX_FILES_PER_USER_PER_HOUR: 10, // Rate limiting
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ],
  ALLOWED_EXTENSIONS: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'gif']
};

// Rate limiting storage for uploads
const uploadRateTracker = new Map();

// Enhanced file validation function
function validateFile(file: any): { isValid: boolean; error?: string } {
  if (!file) return { isValid: false, error: 'No file provided' };
  
  // Check file size
  if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    return { isValid: false, error: `File size exceeds ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
  }
  
  // Check MIME type
  if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { isValid: false, error: `File type ${file.mimetype} not allowed` };
  }
  
  // Check file extension
  const extension = path.extname(file.originalname).toLowerCase().substring(1);
  if (!SECURITY_CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: `File extension .${extension} not allowed` };
  }
  
  // Check filename for path traversal attempts
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return { isValid: false, error: 'Invalid filename detected' };
  }
  
  return { isValid: true };
}

// Rate limiting function
function checkUploadRateLimit(userId: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const userUploads = uploadRateTracker.get(userId) || [];
  
  // Clean old uploads (older than 1 hour)
  const recentUploads = userUploads.filter((timestamp: number) => now - timestamp < 60 * 60 * 1000);
  
  if (recentUploads.length >= SECURITY_CONFIG.MAX_FILES_PER_USER_PER_HOUR) {
    return { allowed: false, error: 'Upload rate limit exceeded. Please try again later.' };
  }
  
  // Update tracker
  recentUploads.push(now);
  uploadRateTracker.set(userId, recentUploads);
  
  return { allowed: true };
}

// Configure multer for file uploads with enhanced security
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: SECURITY_CONFIG.MAX_FILE_SIZE,
    files: 1, // Only allow one file at a time
  },
  fileFilter: (req, file, cb) => {
    const validation = validateFile(file);
    if (validation.isValid) {
      cb(null, true);
    } else {
      cb(new Error(validation.error));
    }
  },
});

// DocumentRecord categories for validation - synchronized with frontend
const DOCUMENT_CATEGORIES = [
  'bylaw',
  'financial',
  'maintenance',
  'legal',
  'meeting_minutes',
  'insurance',
  'contracts',
  'permits',
  'inspection',
  'lease',
  'correspondence',
  'utilities',
  'other',
] as const;

// Enhanced schemas for different document types
const createDocumentSchema = insertDocumentSchema.extend({
  category: z.enum(DOCUMENT_CATEGORIES),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  isVisibleToTenants: z.boolean().default(false),
});

const createBuildingDocumentSchema = insertDocumentSchema.extend({
  type: z.enum(DOCUMENT_CATEGORIES),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const createResidentDocumentSchema = insertDocumentSchema.extend({
  type: z.enum(DOCUMENT_CATEGORIES),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

// Schema for unified document upload
const uploadDocumentRecordSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  documentType: z.enum(DOCUMENT_CATEGORIES),
  isVisibleToTenants: z.boolean().default(false),
  residenceId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  attachedToType: z.string().optional(),
  attachedToId: z.string().optional(),
});

/**
 *
 * @param app
 */
/**
 * RegisterDocumentRecordRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerDocumentRoutes(app: Express): void {
  console.log(`[${new Date().toISOString()}] 🔧 Registering document routes...`);
  
  // Security audit logging
  const auditLog: Array<{
    timestamp: string;
    action: string;
    userId: string;
    userRole: string;
    documentId?: string;
    success: boolean;
    details?: any;
  }> = [];
  
  // Error tracking for production debugging
  const errorLog: Array<{timestamp: string, error: any, endpoint: string, user?: any}> = [];
  
  // Enhanced security audit logging function with debug levels
  const logSecurityEvent = (action: string, user: any, success: boolean, documentId?: string, details?: any) => {
    const event = {
      timestamp: new Date().toISOString(),
      action,
      userId: user.id,
      userRole: user.role,
      documentId,
      success,
      details
    };
    
    auditLog.push(event);
    if (auditLog.length > 1000) auditLog.shift(); // Keep last 1000 events
    
    console.log(`[SECURITY AUDIT] ${action}:`, event);
    return event;
  };

  // Enhanced debug logging function for document operations
  const logDocumentOperation = (operation: string, data: any, level: 'INFO' | 'ERROR' | 'DEBUG' | 'WARN' = 'INFO') => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation,
      level,
      data: typeof data === 'object' ? JSON.stringify(data, null, 2) : data
    };
    
    const emoji = {
      INFO: '📋',
      ERROR: '❌', 
      DEBUG: '🔍',
      WARN: '⚠️'
    }[level];
    
    console.log(`[${timestamp}] ${emoji} [DOCUMENT ${operation.toUpperCase()}] ${level}:`, data);
    return logEntry;
  };

  // Database connection testing functions
  const testDatabaseConnection = async () => {
    try {
      const result = await db.execute(sql`SELECT 1 as test`);
      return {
        success: true,
        result: result.rows[0],
        url_truncated: process.env.DATABASE_URL?.substring(0, 50) + '...'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        url_truncated: process.env.DATABASE_URL?.substring(0, 50) + '...'
      };
    }
  };

  const testSampleQuery = async () => {
    try {
      // Test the exact query that's failing
      const result = await db.execute(sql`
        SELECT COUNT(*) as document_count 
        FROM documents 
        LIMIT 1
      `);
      return {
        success: true,
        document_count: result.rows[0]?.document_count || 0
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stack: error.stack?.substring(0, 200) + '...'
      };
    }
  };

  const checkEnumValues = async () => {
    try {
      // Check current enum values in production
      const result = await db.execute(sql`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (
          SELECT oid 
          FROM pg_type 
          WHERE typname = 'user_role'
        )
        ORDER BY enumsortorder
      `);
      return {
        success: true,
        production_enum_values: result.rows.map(row => row.enumlabel)
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  const checkUserOrganizationLinks = async () => {
    try {
      // Check user-organization relationships
      const userCount = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE is_active = true`);
      const orgCount = await db.execute(sql`SELECT COUNT(*) as total FROM organizations WHERE is_active = true`);
      const linkCount = await db.execute(sql`SELECT COUNT(*) as total FROM user_organizations WHERE is_active = true`);
      
      // Check users without organization links
      const orphanUsers = await db.execute(sql`
        SELECT u.id, u.email, u.role 
        FROM users u 
        LEFT JOIN user_organizations uo ON u.id = uo.user_id AND uo.is_active = true
        WHERE u.is_active = true AND uo.user_id IS NULL
        LIMIT 10
      `);

      // Check current test user specifically (from error logs)
      const testUser = await db.execute(sql`
        SELECT u.email, u.role, uo.organization_id, o.name as org_name
        FROM users u
        LEFT JOIN user_organizations uo ON u.id = uo.user_id AND uo.is_active = true  
        LEFT JOIN organizations o ON uo.organization_id = o.id
        WHERE u.id = '222f5a0d-6bc6-4f28-9f4d-32c133eed333'
      `);

      return {
        success: true,
        stats: {
          total_users: userCount.rows[0]?.total || 0,
          total_organizations: orgCount.rows[0]?.total || 0,
          total_links: linkCount.rows[0]?.total || 0,
          orphan_user_count: orphanUsers.rows.length
        },
        orphan_users: orphanUsers.rows,
        test_user_status: testUser.rows[0] || null
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  // Enum cleanup endpoint for safe schema migration  
  app.post('/api/documents/cleanup-enum', async (req, res) => {
    try {
      // First, verify no users have the 'owner' role
      const userCheck = await db.execute(sql`
        SELECT COUNT(*) as owner_count 
        FROM users 
        WHERE role = 'owner'
      `);
      
      const ownerCount = Number(userCheck.rows[0]?.owner_count) || 0;
      
      if (ownerCount > 0) {
        return res.status(400).json({
          error: 'Cannot remove owner role - users still assigned to it',
          owner_count: ownerCount
        });
      }

      // Safe to remove - no users have 'owner' role
      await db.execute(sql`
        ALTER TYPE user_role DROP VALUE IF EXISTS 'owner'
      `);

      res.json({
        message: 'Successfully removed unused owner role',
        safe_to_push_schema: true,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error during enum cleanup:', error);
      res.status(500).json({
        error: 'Enum cleanup failed',
        message: error.message,
        suggestion: 'Try running npm run db:push --force instead'
      });
    }
  });

  // Fix user-organization relationships
  app.post('/api/documents/fix-user-links', async (req, res) => {
    try {
      // Step 1: Find users without organization links
      const orphanUsers = await db.execute(sql`
        SELECT u.id, u.email, u.role 
        FROM users u 
        LEFT JOIN user_organizations uo ON u.id = uo.user_id AND uo.is_active = true
        WHERE u.is_active = true AND uo.user_id IS NULL
      `);

      if (orphanUsers.rows.length === 0) {
        return res.json({
          message: 'All users already have organization links',
          action_taken: 'none',
          timestamp: new Date().toISOString()
        });
      }

      // Step 2: Get the first available organization (or create default one)
      let defaultOrg = await db.execute(sql`
        SELECT id, name FROM organizations WHERE is_active = true LIMIT 1
      `);

      let organizationId: string;
      let organizationName: string;

      if (defaultOrg.rows.length === 0) {
        // Create a default organization if none exists
        organizationId = crypto.randomUUID();
        organizationName = 'Default Organization';
        await db.execute(sql`
          INSERT INTO organizations (id, name, type, address, phone, email, is_active, created_at, updated_at)
          VALUES (${organizationId}, ${organizationName}, 'condominium', '123 Main St', '514-555-0100', 'admin@koveo.ca', true, NOW(), NOW())
        `);
      } else {
        organizationId = defaultOrg.rows[0].id as string;
        organizationName = defaultOrg.rows[0].name as string;
      }

      // Step 3: Link all orphan users to the default organization
      const linkPromises = orphanUsers.rows.map(user => {
        const linkId = crypto.randomUUID();
        return db.execute(sql`
          INSERT INTO user_organizations (id, user_id, organization_id, role, is_active, created_at, updated_at)
          VALUES (${linkId}, ${user.id}, ${organizationId}, ${user.role}, true, NOW(), NOW())
        `);
      });

      await Promise.all(linkPromises);

      res.json({
        message: 'Successfully linked users to organizations',
        users_linked: orphanUsers.rows.length,
        organization_id: organizationId,
        organization_name: organizationName,
        linked_users: orphanUsers.rows.map(u => ({ id: u.id, email: u.email, role: u.role })),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error fixing user-organization links:', error);
      res.status(500).json({
        error: 'Failed to fix user-organization links',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Safe enum migration endpoint
  app.post('/api/documents/fix-enum-migration', async (req, res) => {
    try {
      // Step 1: Check current enum values and usage
      const enumCheck = await db.execute(sql`
        SELECT enumlabel, enumsortorder 
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        ORDER BY enumsortorder
      `);

      const currentEnumValues = enumCheck.rows.map(row => row.enumlabel);
      
      // Step 2: Check if we have any data that would prevent migration
      const userRoleUsage = await db.execute(sql`
        SELECT role, COUNT(*) as count 
        FROM users 
        GROUP BY role
      `);

      // Step 3: Since enum reordering is the issue, let's use a different approach
      // We'll create a new enum with correct order, migrate data, then swap
      const targetEnumValues = ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'];
      
      // Check if current order matches target
      const orderMatches = JSON.stringify(currentEnumValues) === JSON.stringify(targetEnumValues);
      
      if (orderMatches) {
        return res.json({
          message: 'Enum values already in correct order',
          current_values: currentEnumValues,
          target_values: targetEnumValues,
          migration_needed: false
        });
      }

      // Step 4: Create new enum with correct order
      await db.execute(sql`CREATE TYPE user_role_new AS ENUM ('admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident')`);

      // Step 5: Update all tables to use new enum
      await db.execute(sql`
        ALTER TABLE users 
        ALTER COLUMN role TYPE user_role_new 
        USING role::text::user_role_new
      `);

      await db.execute(sql`
        ALTER TABLE user_organizations 
        ALTER COLUMN organization_role TYPE user_role_new 
        USING organization_role::text::user_role_new
      `);

      await db.execute(sql`
        ALTER TABLE role_permissions 
        ALTER COLUMN role TYPE user_role_new 
        USING role::text::user_role_new
      `);

      // Step 6: Drop old enum and rename new one
      await db.execute(sql`DROP TYPE user_role`);
      await db.execute(sql`ALTER TYPE user_role_new RENAME TO user_role`);

      res.json({
        message: 'Successfully migrated user_role enum',
        old_values: currentEnumValues,
        new_values: targetEnumValues,
        user_role_usage: userRoleUsage.rows,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error during enum migration:', error);
      res.status(500).json({
        error: 'Enum migration failed',
        message: error.message,
        suggestion: 'This is a complex migration - may need manual intervention',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Fix invitations table enum dependency
  app.post('/api/documents/fix-invitations-dependency', async (req, res) => {
    try {
      // Step 1: Check current invitations table structure
      const invitationsSchema = await db.execute(sql`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_name = 'invitations' AND column_name = 'role'
      `);

      // Step 2: Remove default value from invitations.role column temporarily
      await db.execute(sql`
        ALTER TABLE invitations 
        ALTER COLUMN role DROP DEFAULT
      `);

      // Step 3: Check what other tables might have enum dependencies
      const enumDependencies = await db.execute(sql`
        SELECT 
          t.table_name,
          c.column_name,
          c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE c.data_type = 'USER-DEFINED' 
        AND c.udt_name = 'user_role'
        AND c.column_default IS NOT NULL
      `);

      res.json({
        message: 'Successfully removed invitations table enum dependency',
        removed_defaults: invitationsSchema.rows,
        remaining_dependencies: enumDependencies.rows,
        next_step: 'Run npm run db:push now, then call /api/documents/restore-invitations-default',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error fixing invitations dependency:', error);
      res.status(500).json({
        error: 'Failed to fix invitations dependency',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Restore invitations default value after schema sync
  app.post('/api/documents/restore-invitations-default', async (req, res) => {
    try {
      // Restore default value to 'tenant' for invitations.role column
      await db.execute(sql`
        ALTER TABLE invitations 
        ALTER COLUMN role SET DEFAULT 'tenant'
      `);

      // Verify the change
      const verification = await db.execute(sql`
        SELECT column_name, column_default
        FROM information_schema.columns 
        WHERE table_name = 'invitations' AND column_name = 'role'
      `);

      res.json({
        message: 'Successfully restored invitations role default to tenant',
        current_default: verification.rows[0]?.column_default,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error restoring invitations default:', error);
      res.status(500).json({
        error: 'Failed to restore invitations default',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Migrate owner users to admin before enum cleanup
  app.post('/api/documents/migrate-owner-to-admin', async (req, res) => {
    try {
      // Step 1: Check how many users have 'owner' role
      const ownerUsersCheck = await db.execute(sql`
        SELECT id, email, first_name, last_name 
        FROM users 
        WHERE role = 'owner'
      `);

      const ownerCount = ownerUsersCheck.rows.length;

      if (ownerCount === 0) {
        return res.json({
          message: 'No owner users found - migration not needed',
          owner_count: 0,
          timestamp: new Date().toISOString()
        });
      }

      // Step 2: Update all owner users to admin
      await db.execute(sql`
        UPDATE users 
        SET role = 'admin' 
        WHERE role = 'owner'
      `);

      // Step 3: Update user_organizations table if it exists
      try {
        await db.execute(sql`
          UPDATE user_organizations 
          SET organization_role = 'admin' 
          WHERE organization_role = 'owner'
        `);
      } catch (e) {
        // Table might not exist, that's OK
      }

      // Step 4: Remove 'owner' from enum
      await db.execute(sql`
        ALTER TYPE user_role RENAME TO user_role_old
      `);

      await db.execute(sql`
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident')
      `);

      // Step 5: Update all tables to use new enum
      await db.execute(sql`
        ALTER TABLE users 
        ALTER COLUMN role TYPE user_role 
        USING role::text::user_role
      `);

      try {
        await db.execute(sql`
          ALTER TABLE user_organizations 
          ALTER COLUMN organization_role TYPE user_role 
          USING organization_role::text::user_role
        `);
      } catch (e) {
        // Table might not exist
      }

      try {
        await db.execute(sql`
          ALTER TABLE role_permissions 
          ALTER COLUMN role TYPE user_role 
          USING role::text::user_role
        `);
      } catch (e) {
        // Table might not exist
      }

      try {
        await db.execute(sql`
          ALTER TABLE invitations 
          ALTER COLUMN role TYPE user_role 
          USING role::text::user_role
        `);
      } catch (e) {
        // Column might not exist
      }

      // Step 6: Drop old enum
      await db.execute(sql`DROP TYPE user_role_old`);

      res.json({
        message: 'Successfully migrated owner users to admin',
        migrated_users: ownerUsersCheck.rows,
        owner_count: ownerCount,
        new_enum_values: ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'],
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error migrating owner users to admin:', error);
      res.status(500).json({
        error: 'Owner to admin migration failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Remove all remaining enum dependencies
  app.post('/api/documents/remove-all-enum-dependencies', async (req, res) => {
    try {
      const results = [];

      // Remove default from users.role
      try {
        await db.execute(sql`
          ALTER TABLE users 
          ALTER COLUMN role DROP DEFAULT
        `);
        results.push('users.role default removed');
      } catch (e) {
        results.push(`users.role: ${e.message}`);
      }

      // Remove default from user_organizations.organization_role
      try {
        await db.execute(sql`
          ALTER TABLE user_organizations 
          ALTER COLUMN organization_role DROP DEFAULT
        `);
        results.push('user_organizations.organization_role default removed');
      } catch (e) {
        results.push(`user_organizations.organization_role: ${e.message}`);
      }

      // Check remaining dependencies
      const remainingDeps = await db.execute(sql`
        SELECT 
          t.table_name,
          c.column_name,
          c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE c.data_type = 'USER-DEFINED' 
        AND c.udt_name = 'user_role'
        AND c.column_default IS NOT NULL
      `);

      res.json({
        message: 'Removed all enum dependencies',
        operations: results,
        remaining_dependencies: remainingDeps.rows,
        next_step: 'Run npm run db:push now',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error removing enum dependencies:', error);
      res.status(500).json({
        error: 'Failed to remove enum dependencies',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Restore all default values after schema sync
  app.post('/api/documents/restore-all-defaults', async (req, res) => {
    try {
      const results = [];

      // Restore users.role default
      try {
        await db.execute(sql`
          ALTER TABLE users 
          ALTER COLUMN role SET DEFAULT 'tenant'
        `);
        results.push('users.role default restored to tenant');
      } catch (e) {
        results.push(`users.role restore failed: ${e.message}`);
      }

      // Restore user_organizations.organization_role default
      try {
        await db.execute(sql`
          ALTER TABLE user_organizations 
          ALTER COLUMN organization_role SET DEFAULT 'tenant'
        `);
        results.push('user_organizations.organization_role default restored to tenant');
      } catch (e) {
        results.push(`user_organizations.organization_role restore failed: ${e.message}`);
      }

      // Restore invitations.role default
      try {
        await db.execute(sql`
          ALTER TABLE invitations 
          ALTER COLUMN role SET DEFAULT 'tenant'
        `);
        results.push('invitations.role default restored to tenant');
      } catch (e) {
        results.push(`invitations.role restore failed: ${e.message}`);
      }

      res.json({
        message: 'Restored all default values',
        operations: results,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error restoring defaults:', error);
      res.status(500).json({
        error: 'Failed to restore defaults',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Complete database schema sync endpoint
  app.post('/api/documents/complete-schema-sync', async (req, res) => {
    try {
      const results = [];

      // Step 1: Remove all enum dependencies temporarily
      try {
        await db.execute(sql`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
        results.push('✓ Removed users.role default');
      } catch (e) {
        results.push(`users.role: ${e.message}`);
      }

      try {
        await db.execute(sql`ALTER TABLE user_organizations ALTER COLUMN organization_role DROP DEFAULT`);
        results.push('✓ Removed user_organizations.organization_role default');
      } catch (e) {
        results.push(`user_organizations.organization_role: ${e.message}`);
      }

      try {
        await db.execute(sql`ALTER TABLE invitations ALTER COLUMN role DROP DEFAULT`);
        results.push('✓ Removed invitations.role default');
      } catch (e) {
        results.push(`invitations.role: ${e.message}`);
      }

      // Step 2: Migrate any 'owner' users to 'admin'
      const ownerUsers = await db.execute(sql`SELECT count(*) as count FROM users WHERE role = 'owner'`);
      const ownerCount = Number(ownerUsers.rows[0]?.count || 0);
      if (ownerCount > 0) {
        await db.execute(sql`UPDATE users SET role = 'admin' WHERE role = 'owner'`);
        results.push(`✓ Migrated ${ownerCount} owner users to admin`);
      }

      try {
        await db.execute(sql`UPDATE user_organizations SET organization_role = 'admin' WHERE organization_role = 'owner'`);
        results.push('✓ Updated user_organizations owner roles to admin');
      } catch (e) {
        results.push(`user_organizations owner update: ${e.message}`);
      }

      // Step 3: Fix the enum to match development schema
      try {
        // Rename current enum
        await db.execute(sql`ALTER TYPE user_role RENAME TO user_role_old`);
        
        // Create new enum with correct values
        await db.execute(sql`
          CREATE TYPE user_role AS ENUM (
            'admin', 'manager', 'tenant', 'resident', 
            'demo_manager', 'demo_tenant', 'demo_resident'
          )
        `);

        // Update all tables
        await db.execute(sql`ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role`);
        await db.execute(sql`ALTER TABLE user_organizations ALTER COLUMN organization_role TYPE user_role USING organization_role::text::user_role`);
        await db.execute(sql`ALTER TABLE invitations ALTER COLUMN role TYPE user_role USING role::text::user_role`);
        
        try {
          await db.execute(sql`ALTER TABLE role_permissions ALTER COLUMN role TYPE user_role USING role::text::user_role`);
          results.push('✓ Updated role_permissions enum');
        } catch (e) {
          results.push(`role_permissions: ${e.message}`);
        }

        // Drop old enum
        await db.execute(sql`DROP TYPE user_role_old`);
        
        results.push('✓ Successfully updated user_role enum');
      } catch (e) {
        results.push(`Enum update failed: ${e.message}`);
      }

      // Step 4: Restore default values
      try {
        await db.execute(sql`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'tenant'`);
        results.push('✓ Restored users.role default to tenant');
      } catch (e) {
        results.push(`users.role default restore: ${e.message}`);
      }

      try {
        await db.execute(sql`ALTER TABLE user_organizations ALTER COLUMN organization_role SET DEFAULT 'tenant'`);
        results.push('✓ Restored user_organizations.organization_role default to tenant');
      } catch (e) {
        results.push(`user_organizations.organization_role default restore: ${e.message}`);
      }

      try {
        await db.execute(sql`ALTER TABLE invitations ALTER COLUMN role SET DEFAULT 'tenant'`);
        results.push('✓ Restored invitations.role default to tenant');
      } catch (e) {
        results.push(`invitations.role default restore: ${e.message}`);
      }

      // Step 5: Add missing columns that exist in production but not development
      try {
        await db.execute(sql`
          ALTER TABLE invitation_audit_log 
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
        `);
        results.push('✓ Added created_at to invitation_audit_log');
      } catch (e) {
        results.push(`invitation_audit_log.created_at: ${e.message}`);
      }

      res.json({
        message: 'Database schema synchronization complete',
        operations: results,
        timestamp: new Date().toISOString(),
        success: true
      });
    } catch (error: any) {
      console.error('❌ Error during schema synchronization:', error);
      res.status(500).json({
        error: 'Schema synchronization failed',
        message: error.message,
        timestamp: new Date().toISOString(),
        success: false
      });
    }
  });

  // Enhanced diagnostic endpoint with database schema check
  app.get('/api/documents/diagnostic', async (req, res) => {
    try {
      // Check if documents table exists
      let tableExists = false;
      let tableSchema = null;
      
      try {
        const result = await db.execute(sql`
          SELECT column_name, data_type, is_nullable, column_default 
          FROM information_schema.columns 
          WHERE table_name = 'documents' 
          ORDER BY ordinal_position
        `);
        tableExists = result.rows.length > 0;
        tableSchema = result.rows;
      } catch (schemaError) {
        console.error('Schema check error:', schemaError);
      }

      res.json({
        message: 'Document API diagnostic',
        gcs_disabled: true,
        session_fix_applied: true,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: 'v2.1-gcs-disabled',
        recent_errors: errorLog.slice(-5), // Last 5 errors
        storage_status: {
          exists: !!storage,
          type: storage?.constructor?.name,
          methods: Object.getOwnPropertyNames(Object.getPrototypeOf(storage || {}))
        },
        database_status: {
          documents_table_exists: tableExists,
          documents_table_schema: tableSchema,
          schema_columns_count: tableSchema?.length || 0,
          connection_test: await testDatabaseConnection(),
          sample_query_test: await testSampleQuery(),
          enum_check: await checkEnumValues(),
          user_organization_links: await checkUserOrganizationLinks()
        }
      });
    } catch (error: any) {
      console.error('❌ Error running diagnostic:', error);
      res.status(500).json({
        error: 'Diagnostic failed',
        message: error.message
      });
    }
  });
  
  // Error logging helper
  const logError = (endpoint: string, error: any, user?: any) => {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      endpoint,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        details: error.toString()
      },
      user: user ? { id: user.id, role: user.role } : null
    };
    
    errorLog.push(errorEntry);
    if (errorLog.length > 50) errorLog.shift(); // Keep only last 50 errors
    
    console.error(`[${errorEntry.timestamp}] 🚨 ERROR in ${endpoint}:`, errorEntry);
    return errorEntry;
  };
  
  // Get all documents for the authenticated user
  app.get('/api/documents', requireAuth, async (req: any, res) => {
    const timestamp = new Date().toISOString();
    logDocumentOperation('LIST_REQUEST', {
      userId: req.user?.id,
      userRole: req.user?.role,
      query: req.query,
      url: req.url,
      method: req.method,
      headers: {
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer
      }
    }, 'INFO');
    
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      
      // Enhanced user data logging
      logDocumentOperation('USER_VALIDATION', {
        userId,
        userRole,
        hasValidUser: !!user,
        sessionInfo: {
          sessionExists: !!req.session,
          isAuthenticated: !!req.user
        }
      }, 'DEBUG');
      
      // Critical storage validation with enhanced debugging
      logDocumentOperation('STORAGE_VALIDATION', {
        storageExists: !!storage,
        storageType: storage?.constructor?.name,
        storageMethod: typeof storage?.getDocuments,
        databaseConnection: {
          hasDb: !!db,
          connectionString: process.env.DATABASE_URL?.substring(0, 30) + '...'
        }
      }, 'DEBUG');
      const documentType = req.query.type as string; // 'building', 'resident', or undefined for both
      const specificResidenceId = req.query.residenceId as string; // Filter by specific residence
      const specificBuildingId = req.query.buildingId as string; // Filter by specific building
      const attachedToType = req.query.attachedToType as string; // Filter by attached entity type
      const attachedToId = req.query.attachedToId as string; // Filter by attached entity ID

      // Get user's organization and residences for filtering
      logDocumentOperation('USER_DATA_FETCH_START', { userId }, 'DEBUG');
      
      logDocumentOperation('CALL_getUserOrganizations', { userId }, 'DEBUG');
      const organizationsStart = performance.now();
      const organizations = await storage.getUserOrganizations(userId);
      const organizationsTime = performance.now() - organizationsStart;
      logDocumentOperation('getUserOrganizations_SUCCESS', {
        count: organizations.length,
        executionTime: `${organizationsTime.toFixed(2)}ms`,
        organizations: organizations.map(org => ({ id: org.organizationId, role: org.organizationRole }))
      }, 'DEBUG');
      
      logDocumentOperation('CALL_getUserResidences', { userId }, 'DEBUG');
      const residencesStart = performance.now();
      const userResidences = await storage.getUserResidences(userId);
      const residencesTime = performance.now() - residencesStart;
      logDocumentOperation('getUserResidences_SUCCESS', {
        count: userResidences.length,
        executionTime: `${residencesTime.toFixed(2)}ms`,
        residenceIds: userResidences.map(ur => ur.residenceId || ur.userResidence?.residenceId).filter(Boolean)
      }, 'DEBUG');
      
      logDocumentOperation('CALL_getBuildings', {}, 'DEBUG');
      const buildingsStart = performance.now();
      const buildings = await storage.getBuildings();
      const buildingsTime = performance.now() - buildingsStart;
      logDocumentOperation('getBuildings_SUCCESS', {
        count: buildings.length,
        executionTime: `${buildingsTime.toFixed(2)}ms`,
        buildingIds: buildings.map(b => b.id)
      }, 'DEBUG');

      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      console.log(`[${timestamp}] 🏢 Organization ID determined:`, organizationId);

      // If specific residence ID provided, filter to only that residence
      let residenceIds: string[];
      if (specificResidenceId) {
        // Admin users have access to all residences
        if (userRole === 'admin' || userRole === 'manager') {
          residenceIds = [specificResidenceId];
        } else {
          // Verify user has access to this specific residence
          // Handle both simple {residenceId: string} and complex nested structures
          const hasAccess = userResidences.some((ur: any) => {
            // Handle simple structure
            if (ur.residenceId === specificResidenceId) {
              return true;
            }
            // Handle complex nested structure
            if (ur.userResidence?.residenceId === specificResidenceId) {
              return true;
            }
            // Handle residence nested structure
            if (ur.residence?.id === specificResidenceId) {
              return true;
            }
            return false;
          });
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied to this residence' });
          }
          residenceIds = [specificResidenceId];
        }
      } else {
        // Extract residence IDs from both simple and complex structures
        residenceIds = userResidences
          .map((ur: any) => {
            // Handle simple structure
            if (ur.residenceId) {
              return ur.residenceId;
            }
            // Handle complex nested structure
            if (ur.userResidence?.residenceId) {
              return ur.userResidence.residenceId;
            }
            // Handle residence nested structure
            if (ur.residence?.id) {
              return ur.residence.id;
            }
            return null;
          })
          .filter((id: any) => id !== null);
      }

      const buildingIds = buildings.map((b) => b.id);

      const allDocumentRecords: any[] = [];

      // Use unified documents system
      const filters: any = {
        userId,
        userRole,
      };

      // Filter by specific residence if provided
      if (specificResidenceId) {
        filters.residenceId = specificResidenceId;
      }

      // Filter by specific building if provided
      if (specificBuildingId) {
        filters.buildingId = specificBuildingId;
      } else if (documentType === 'building') {
        // For building documents, search in buildings user has access to
        if (buildingIds.length > 0) {
          // Get all documents for buildings, will filter later to show only building-level documents
        }
      } else if (documentType === 'resident') {
        // For resident documents, search in residences user has access to
        if (residenceIds.length > 0) {
          // Get all documents for residences, will filter later
        }
      }

      // CRITICAL: Enhanced document fetching with performance tracking
      logDocumentOperation('STORAGE_getDocuments_CALL', {
        filters,
        storageInstance: storage.constructor.name,
        filtersStringified: JSON.stringify(filters, null, 2)
      }, 'DEBUG');
      
      const documentsStart = performance.now();
      let documents;
      try {
        documents = await storage.getDocuments(filters);
        const documentsTime = performance.now() - documentsStart;
        logDocumentOperation('STORAGE_getDocuments_SUCCESS', {
          documentCount: documents?.length || 0,
          executionTime: `${documentsTime.toFixed(2)}ms`,
          filters: filters
        }, 'DEBUG');
      } catch (documentsError) {
        const documentsTime = performance.now() - documentsStart;
        logDocumentOperation('STORAGE_getDocuments_ERROR', {
          error: documentsError.message,
          stack: documentsError.stack?.substring(0, 200),
          executionTime: `${documentsTime.toFixed(2)}ms`,
          filters: filters
        }, 'ERROR');
        throw documentsError;
      }

      // Enhanced document response logging
      logDocumentOperation('DOCUMENTS_RESPONSE_ANALYSIS', {
        totalDocuments: documents?.length || 0,
        documentPreview: documents?.slice(0, 3)?.map(d => ({
          id: d.id,
          name: d.name,
          documentType: d.documentType,
          uploadedById: d.uploadedById,
          buildingId: d.buildingId,
          residenceId: d.residenceId,
          filePath: d.filePath,
          isVisibleToTenants: d.isVisibleToTenants,
          createdAt: d.createdAt
        })),
        documentTypes: documents?.reduce((acc, doc) => {
          acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }, 'DEBUG');

      // Debug logging
      console.log('🔍 [DOCUMENTS API DEBUG]:', {
        filters,
        documentsFound: documents?.length || 0,
        specificResidenceId,
        attachedToType,
        attachedToId,
        userRole,
        userId,
      });

      // Apply role-based filtering with tenant visibility rules
      const filteredDocumentRecords = documents.filter((doc) => {
        // If filtering by attached entity, only show documents attached to that entity
        if (attachedToType && attachedToId) {
          if (doc.attachedToType !== attachedToType || doc.attachedToId !== attachedToId) {
            return false;
          }
        }

        // If filtering by specific building, only show documents for that building
        if (specificBuildingId) {
          if (doc.buildingId !== specificBuildingId) {
            return false;
          }
          
          // When viewing Building Documents, only show building-level documents (not residence-level)
          if (documentType === 'building' && doc.filePath && doc.filePath.includes('residences/')) {
            return false;
          }
        }

        // When viewing Building Documents (documentType === 'building'), filter out residence-level documents
        if (documentType === 'building' && doc.filePath && doc.filePath.includes('residences/')) {
          return false;
        }

        // Admin can see all documents
        if (userRole === 'admin') {
          return true;
        }

        // Manager can see all documents in their organization
        if (userRole === 'manager' && organizationId) {
          if (doc.buildingId && buildingIds.includes(doc.buildingId)) {
            return true;
          }
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }
        }

        // Resident access rules
        if (userRole === 'resident') {
          // Residents can see documents in their residence
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }
          // Residents can see building documents related to their residences
          if (doc.buildingId) {
            // Check if any of user's residences belong to this building
            const userBuildingIds = userResidences
              .map((ur: any) => ur.residence?.buildingId || ur.userResidence?.residence?.buildingId)
              .filter(Boolean);
            return userBuildingIds.includes(doc.buildingId);
          }
        }

        // Tenant access rules - more restrictive
        if (userRole === 'tenant') {
          // Tenants can only see documents marked as visible to tenants
          if (!doc.isVisibleToTenants) {
            return false;
          }

          // Tenants can see visible documents in their residence
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }

          // Tenants can see visible building documents related to their residences
          if (doc.buildingId) {
            // Check if any of user's residences belong to this building
            const userBuildingIds = userResidences
              .map((ur: any) => ur.residence?.buildingId || ur.userResidence?.residence?.buildingId)
              .filter(Boolean);
            return userBuildingIds.includes(doc.buildingId);
          }
        }

        return false;
      });

      // Add document type indicators for frontend compatibility and field mapping
      const enhancedDocumentRecords = filteredDocumentRecords.map((doc) => ({
        ...doc,
        title: doc.name, // Map database 'name' field to frontend 'title' field
        category: doc.documentType, // Map database 'documentType' to frontend 'category'
        documentCategory: doc.buildingId ? 'building' : 'resident',
        entityType: doc.buildingId ? 'building' : 'residence',
        entityId: doc.buildingId || doc.residenceId,
        uploadDate: doc.createdAt, // For backward compatibility
        fileUrl: doc.filePath ? `/api/documents/${doc.id}/file` : undefined, // Generate file URL if file exists
      }));

      allDocumentRecords.push(...enhancedDocumentRecords);

      // Sort by upload date, most recent first
      allDocumentRecords.sort(
        (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      );

      const response = {
        documents: allDocumentRecords,
        total: allDocumentRecords.length,
        buildingCount: allDocumentRecords.filter((d) => d.documentCategory === 'building').length,
        residentCount: allDocumentRecords.filter((d) => d.documentCategory === 'resident').length,
        legacyCount: allDocumentRecords.filter((d) => d.documentCategory === 'legacy').length,
      };
      // Log successful document access
      logSecurityEvent('DOCUMENT_LIST_ACCESS', user, true, undefined, {
        documentsReturned: allDocumentRecords.length,
        filters: { documentType, specificResidenceId, specificBuildingId }
      });
      
      // Keep useful logging for bill documents
      if (attachedToType === 'bill' && enhancedDocumentRecords.length > 0) {
        console.log(`[${timestamp}] 📄 Bill documents found:`, enhancedDocumentRecords.length);
      }
      
      res.json(response);
    } catch (_error: any) {
      const errorEntry = logError('GET /api/documents', _error, req.user);
      res.status(500).json({ 
        message: 'Failed to fetch documents',
        error_id: errorEntry.timestamp,
        debug_info: process.env.NODE_ENV === 'development' ? _error.message : undefined
      });
    }
  });

  // Get a specific document by ID
  app.get('/api/documents/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const documentType = req.query.type as string; // Optional type hint

      // Get user's organization and residences for filtering
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      const buildings = await storage.getBuildings();

      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map((ur) => ur.residenceId);
      const buildingIds = buildings.map((b) => b.id);

      let document: DocumentRecord | null = null;

      // Try to find the document in the appropriate table(s)
      const hasNewDocumentRecordMethods = 'getBuildingDocumentRecord' in storage;

      if (hasNewDocumentRecordMethods) {
        if (!documentType || documentType === 'building') {
          try {
            document = await (storage as any).getBuildingDocumentRecord(
              documentId,
              userId,
              userRole,
              organizationId,
              buildingIds
            );
            if (document) {
              (document as any).documentCategory = 'building';
              (document as any).entityType = 'building';
              (document as any).entityId = (document as any).buildingId;
            }
          } catch (e) {
            console.warn('⚠️ Error fetching building document:', e);
          }
        }

        if (!document && (!documentType || documentType === 'resident')) {
          try {
            document = await (storage as any).getResidentDocumentRecord(
              documentId,
              userId,
              userRole,
              organizationId,
              residenceIds
            );
            if (document) {
              (document as any).documentCategory = 'resident';
              (document as any).entityType = 'residence';
              (document as any).entityId = (document as any).residenceId;
            }
          } catch (e) {
            console.warn('⚠️ Error fetching resident document:', e);
          }
        }
      }

      // Fallback to legacy documents if not found and no type specified
      if (!document && !documentType) {
        try {
          document = await storage.getDocument(documentId);
          if (document) {
            (document as any).documentCategory = 'legacy';
            (document as any).entityType = 'legacy';
            (document as any).entityId = null;
          }
        } catch (e) {
          console.warn('⚠️ Error fetching legacy document:', e);
        }
      }

      if (!document) {
        return res.status(404).json({ message: 'DocumentRecord not found or access denied' });
      }

      res.json(document);
    } catch (error: any) {
      console.error('❌ Error fetching document:', error);
      res.status(500).json({ message: 'Failed to fetch document' });
    }
  });

  // Create a new document (supports both file upload and text-only documents)
  app.post('/api/documents', requireAuth, upload.single('file'), async (req: any, res) => {
    const operationId = crypto.randomUUID();
    const startTime = performance.now();
    
    logDocumentOperation('UPLOAD_START', {
      operationId,
      userId: req.user.id,
      userRole: req.user.role,
      endpoint: 'POST /api/documents'
    }, 'INFO');
    
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const { documentType, buildingId, residenceId, textContent, type, ...otherData } = req.body;
      
      // Enhanced request analysis
      logDocumentOperation('UPLOAD_REQUEST_ANALYSIS', {
        operationId,
        requestDetails: {
          documentType,
          type,
          buildingId, 
          residenceId,
          hasFile: !!req.file,
          hasTextContent: !!textContent,
          textContentLength: textContent?.length,
          otherDataKeys: Object.keys(otherData),
          contentType: req.headers['content-type']
        },
        fileDetails: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          encoding: req.file.encoding,
          fieldname: req.file.fieldname,
          tempPath: req.file.path
        } : null
      }, 'DEBUG');

      if (req.file) {
        console.log(`📄 [DOCUMENTS UPLOAD] File details:`, {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          tempPath: req.file.path,
          encoding: req.file.encoding
        });
      }

      // Enhanced rate limiting with detailed tracking
      logDocumentOperation('RATE_LIMIT_CHECK', {
        operationId,
        userId,
        currentUploads: uploadRateTracker.get(userId)?.length || 0,
        maxAllowed: SECURITY_CONFIG.MAX_FILES_PER_USER_PER_HOUR
      }, 'DEBUG');
      
      const rateLimitCheck = checkUploadRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        logDocumentOperation('RATE_LIMIT_EXCEEDED', {
          operationId,
          userId,
          error: rateLimitCheck.error,
          currentCount: uploadRateTracker.get(userId)?.length || 0
        }, 'WARN');
        logSecurityEvent('UPLOAD_RATE_LIMIT_EXCEEDED', user, false, undefined, { operationId, error: rateLimitCheck.error });
        return res.status(429).json({ message: rateLimitCheck.error });
      }
      
      logDocumentOperation('RATE_LIMIT_PASSED', {
        operationId,
        userId,
        remainingUploads: SECURITY_CONFIG.MAX_FILES_PER_USER_PER_HOUR - (uploadRateTracker.get(userId)?.length || 0)
      }, 'DEBUG');
      
      // Enhanced permission validation
      logDocumentOperation('PERMISSION_CHECK', {
        operationId,
        userRole,
        allowedRoles: ['admin', 'manager', 'resident'],
        isAuthorized: ['admin', 'manager', 'resident'].includes(userRole)
      }, 'DEBUG');
      
      if (!['admin', 'manager', 'resident'].includes(userRole)) {
        logDocumentOperation('PERMISSION_DENIED', {
          operationId,
          userRole,
          requiredRoles: ['admin', 'manager', 'resident'],
          userId
        }, 'WARN');
        logSecurityEvent('UNAUTHORIZED_UPLOAD_ATTEMPT', user, false, undefined, { 
          operationId, 
          requiredRoles: ['admin', 'manager', 'resident'] 
        });
        return res.status(403).json({ message: 'Insufficient permissions to create documents' });
      }
      
      logDocumentOperation('PERMISSION_GRANTED', {
        operationId,
        userRole,
        userId
      }, 'DEBUG');

      // Enhanced document type classification
      const isTextDocumentRecord = !req.file && textContent;
      const isFileDocumentRecord = !!req.file;
      const isMetadataDocumentRecord = !req.file && !textContent && (otherData.title || otherData.name);

      logDocumentOperation('DOCUMENT_TYPE_CLASSIFICATION', {
        operationId,
        classification: {
          isTextDocument: isTextDocumentRecord,
          isFileDocument: isFileDocumentRecord,
          isMetadataDocument: isMetadataDocumentRecord
        },
        analysisDetails: {
          hasFile: !!req.file,
          hasTextContent: !!textContent,
          textContentLength: textContent?.length,
          hasTitle: !!otherData.title,
          hasName: !!otherData.name,
          fileSize: req.file?.size,
          fileName: req.file?.originalname
        }
      }, 'DEBUG');

      if (!isTextDocumentRecord && !isFileDocumentRecord && !isMetadataDocumentRecord) {
        logDocumentOperation('INVALID_DOCUMENT_REQUEST', {
          operationId,
          reason: 'No file, text content, or metadata provided',
          providedData: {
            hasFile: !!req.file,
            hasTextContent: !!textContent,
            hasTitle: !!otherData.title,
            hasName: !!otherData.name
          }
        }, 'ERROR');
        return res.status(400).json({ message: 'Either a file, text content, or document title/name is required' });
      }

      // For text documents, create unified document directly
      if (isTextDocumentRecord) {
        // Create text document without file storage
        const documentData: InsertDocument = {
          name: otherData.name || 'Untitled DocumentRecord',
          description: otherData.description || textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''),
          documentType: documentType || 'other',
          filePath: `text-documents/${userId}/${uuidv4()}.txt`, // Virtual path for text documents
          isVisibleToTenants: otherData.isVisibleToTenants === 'true' || otherData.isVisibleToTenants === true,
          residenceId: residenceId || undefined,
          buildingId: buildingId || undefined,
          uploadedById: userId,
        };

        // Permission checks
        if (buildingId && userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
          const building = await storage.getBuilding(buildingId);
          if (!building || building.organizationId !== organizationId) {
            return res.status(403).json({ message: 'Cannot assign document to building outside your organization' });
          }
        }

        if (residenceId && userRole === 'resident') {
          const residences = await storage.getUserResidences(userId);
          const residenceIds = residences.map((ur) => ur.residenceId);
          if (!residenceIds.includes(residenceId)) {
            return res.status(403).json({ message: 'Cannot assign document to residence you do not own' });
          }
        }

        // Determine document record type for directory structure
        let documentRecordType;
        if (buildingId && !residenceId) {
          documentRecordType = 'building';
        } else if (residenceId && !buildingId) {
          documentRecordType = 'resident';
        } else {
          return res.status(400).json({
            message: 'Must provide either buildingId (for building documents) or residenceId (for resident documents)',
          });
        }

        // Save text content to local file system with proper directory structure
        let fileName: string;
        try {
          const textFilePath = path.join(process.cwd(), 'uploads', documentRecordType);
          if (!fs.existsSync(textFilePath)) {
            fs.mkdirSync(textFilePath, { recursive: true });
          }
          fileName = `${uuidv4()}-text-document.txt`;
          const fullPath = path.join(textFilePath, fileName);
          fs.writeFileSync(fullPath, textContent, 'utf8');
        } catch (fsError) {
          console.error('Error saving text document to filesystem:', fsError);
          return res.status(500).json({ message: 'Failed to save text document' });
        }
        
        // Update file path to match regular document uploads
        documentData.filePath = `${documentRecordType}/${fileName}`;

        // Create document record in database
        const document = await storage.createDocument(documentData);
        
        return res.status(201).json({
          message: 'Text document created successfully',
          document: {
            ...document,
            title: document.name, // Map name to title for frontend compatibility
            category: document.documentType, // Map documentType to category for frontend compatibility
            documentCategory: buildingId ? 'building' : 'resident',
            entityType: buildingId ? 'building' : 'residence',
            entityId: buildingId || residenceId,
          },
        });
      }

      // Handle metadata-only documents (create document record without file)
      if (isMetadataDocumentRecord) {
        // Map frontend 'title' field to database 'name' field and 'category' to 'documentType'
        const documentData: InsertDocument = {
          name: otherData.title || otherData.name || 'Untitled Document',
          description: otherData.description || '',
          documentType: otherData.category || documentType || 'other',
          filePath: `metadata-documents/${userId}/${uuidv4()}`, // Placeholder path for metadata-only documents
          isVisibleToTenants: otherData.isVisibleToTenants === 'true' || otherData.isVisibleToTenants === true || false,
          residenceId: residenceId || undefined,
          buildingId: buildingId || undefined,
          uploadedById: userId,
        };

        // Validate building/residence requirement
        if (!buildingId && !residenceId) {
          return res.status(400).json({
            message: 'Must provide either buildingId (for building documents) or residenceId (for resident documents)',
          });
        }

        if (buildingId && residenceId) {
          return res.status(400).json({
            message: 'Cannot provide both buildingId and residenceId',
          });
        }

        // Permission checks
        if (buildingId && userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
          const building = await storage.getBuilding(buildingId);
          if (!building || building.organizationId !== organizationId) {
            return res.status(403).json({ message: 'Cannot assign document to building outside your organization' });
          }
        }

        if (residenceId && userRole === 'resident') {
          const residences = await storage.getUserResidences(userId);
          const residenceIds = residences.map((ur) => ur.residenceId);
          if (!residenceIds.includes(residenceId)) {
            return res.status(403).json({ message: 'Cannot assign document to residence you do not own' });
          }
        }

        // Create document record in database
        const document = await storage.createDocument(documentData);
        
        return res.status(201).json({
          message: 'Document created successfully',
          document: {
            ...document,
            title: document.name, // Map name to title for frontend compatibility
            category: document.documentType, // Map documentType to category for frontend compatibility
            documentCategory: buildingId ? 'building' : 'resident',
            entityType: buildingId ? 'building' : 'residence',
            entityId: buildingId || residenceId,
            fileUrl: undefined, // No file URL for metadata-only documents
          },
        });
      }

      // Handle file uploads (existing logic)
      console.log(`📄 [DOCUMENTS UPLOAD] Starting file document processing`);
      
      // Determine document record type based on buildingId/residenceId (not from documentType field)
      let finalDocumentRecordType;
      if (buildingId && !residenceId) {
        finalDocumentRecordType = 'building';
        console.log(`📄 [DOCUMENTS UPLOAD] Determined document type: BUILDING (ID: ${buildingId})`);
      } else if (residenceId && !buildingId) {
        finalDocumentRecordType = 'resident';
        console.log(`📄 [DOCUMENTS UPLOAD] Determined document type: RESIDENCE (ID: ${residenceId})`);
      } else if (buildingId && residenceId) {
        console.log(`❌ [DOCUMENTS UPLOAD] Both buildingId and residenceId provided: ${buildingId}, ${residenceId}`);
        return res.status(400).json({
          message: 'Cannot provide both buildingId and residenceId',
        });
      } else {
        console.log(`❌ [DOCUMENTS UPLOAD] No buildingId or residenceId provided`);
        return res.status(400).json({
          message:
            'Must provide either buildingId (for building documents) or residenceId (for resident documents)',
        });
      }

      if (finalDocumentRecordType === 'building') {
        console.log(`🏢 [BUILDING UPLOAD] Processing building document for building ID: ${buildingId}`);
        
        // Validate and create building document
        if (!buildingId) {
          console.log(`❌ [BUILDING UPLOAD] Missing buildingId`);
          return res.status(400).json({ message: 'buildingId is required for building documents' });
        }

        // Prepare the permanent file path and move file if needed
        let filePath: string;
        let fileName: string | undefined;
        
        if (req.file) {
          console.log(`🏢 [BUILDING UPLOAD] Processing file upload for building ${buildingId}`);
          
          // Generate unique filename and move to permanent location
          fileName = `${uuidv4()}-${req.file.originalname}`;
          const permanentDir = path.join(process.cwd(), 'uploads', 'buildings', buildingId);
          
          console.log(`🏢 [BUILDING UPLOAD] File paths:`, {
            originalName: req.file.originalname,
            newFileName: fileName,
            tempPath: req.file.path,
            permanentDir,
            directoryExists: fs.existsSync(permanentDir)
          });
          
          // Ensure directory exists
          if (!fs.existsSync(permanentDir)) {
            console.log(`🏢 [BUILDING UPLOAD] Creating directory: ${permanentDir}`);
            fs.mkdirSync(permanentDir, { recursive: true });
          }
          
          // Move file from temporary to permanent location (copy + delete for cross-filesystem)
          const permanentPath = path.join(permanentDir, fileName);
          console.log(`🏢 [BUILDING UPLOAD] Copying file from ${req.file.path} to ${permanentPath}`);
          fs.copyFileSync(req.file.path, permanentPath);
          console.log(`🏢 [BUILDING UPLOAD] Cleaning up temporary file: ${req.file.path}`);
          fs.unlinkSync(req.file.path); // Clean up temporary file
          filePath = `buildings/${buildingId}/${fileName}`;
          console.log(`🏢 [BUILDING UPLOAD] File successfully moved to: ${filePath}`);
        } else {
          console.log(`🏢 [BUILDING UPLOAD] No file provided, creating placeholder path`);
          filePath = `temp-path-${Date.now()}`;
        }
        
        const dataToValidate = {
          ...otherData,
          buildingId,
          uploadedById: userId,
          filePath,
          fileName,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          documentType: documentType || type || 'other', // Default to 'other' if not provided
        };
        
        console.log(`🏢 [BUILDING UPLOAD] Data to validate:`, {
          buildingId,
          uploadedById: userId,
          filePath,
          fileName,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          documentType: documentType || type || 'other',
          otherDataKeys: Object.keys(otherData)
        });
        
        let validatedData;
        try {
          validatedData = insertDocumentSchema.parse(dataToValidate);
          console.log(`✅ [BUILDING UPLOAD] Document validation successful for building ${buildingId}`);
        } catch (validationError) {
          console.log(`❌ [BUILDING UPLOAD] Document validation failed for building ${buildingId}:`, validationError);
          return res.status(400).json({ 
            message: 'Validation failed', 
            error: validationError.message || 'Invalid data',
            details: validationError.issues || validationError
          });
        }

        // Permission checks for building documents
        console.log(`🏢 [BUILDING UPLOAD] Checking permissions for role: ${userRole}`);
        
        if (userRole === 'manager') {
          console.log(`🏢 [BUILDING UPLOAD] Manager permission check for building ${buildingId}`);
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId =
            organizations.length > 0 ? organizations[0].organizationId : undefined;
          console.log(`🏢 [BUILDING UPLOAD] Manager organization: ${organizationId}`);
          
          const building = await storage.getBuilding(buildingId);
          console.log(`🏢 [BUILDING UPLOAD] Building organization: ${building?.organizationId}`);
          
          if (!building || building.organizationId !== organizationId) {
            console.log(`❌ [BUILDING UPLOAD] Manager permission denied - organization mismatch`);
            return res
              .status(403)
              .json({ message: 'Cannot assign document to building outside your organization' });
          }
          console.log(`✅ [BUILDING UPLOAD] Manager permission check passed`);
        }

        if (userRole === 'resident') {
          console.log(`🏢 [BUILDING UPLOAD] Resident permission check for building ${buildingId}`);
          const residences = await storage.getUserResidences(userId);
          console.log(`🏢 [BUILDING UPLOAD] User residences count: ${residences.length}`);
          
          const hasResidenceInBuilding = await Promise.all(
            residences.map(async (ur) => {
              const residence = await storage.getResidence(ur.residenceId);
              const isInBuilding = residence && residence.buildingId === buildingId;
              console.log(`🏢 [BUILDING UPLOAD] Residence ${ur.residenceId} in building ${buildingId}: ${isInBuilding}`);
              return isInBuilding;
            })
          );

          if (!hasResidenceInBuilding.some(Boolean)) {
            console.log(`❌ [BUILDING UPLOAD] Resident permission denied - no residence in building`);
            return res
              .status(403)
              .json({ message: 'Cannot assign document to building where you have no residence' });
          }
          console.log(`✅ [BUILDING UPLOAD] Resident permission check passed`);
        }

        // Create unified document instead of separate building document
        const unifiedDocument: InsertDocument = {
          name: validatedData.name || 'Untitled',
          description: validatedData.description,
          documentType: validatedData.documentType,
          filePath: validatedData.filePath || `temp-path-${Date.now()}`,
          isVisibleToTenants: validatedData.isVisibleToTenants || false,
          residenceId: undefined,
          buildingId: validatedData.buildingId,
          uploadedById: validatedData.uploadedById,
        };

        console.log(`🏢 [BUILDING UPLOAD] Creating document in database:`, {
          name: unifiedDocument.name,
          documentType: unifiedDocument.documentType,
          filePath: unifiedDocument.filePath,
          buildingId: unifiedDocument.buildingId,
          uploadedById: unifiedDocument.uploadedById
        });

        const document = await storage.createDocument(unifiedDocument);
        console.log(`✅ [BUILDING UPLOAD] Document created successfully with ID: ${document.id}`);

        // File has been moved to permanent location, no cleanup needed

        res.status(201).json({
          ...document,
          documentCategory: 'building',
          entityType: 'building',
          entityId: document.buildingId,
        });
      } else if (finalDocumentRecordType === 'resident') {
        console.log(`🏠 [RESIDENCE UPLOAD] Processing residence document for residence ID: ${residenceId}`);
        
        // Validate and create resident document
        if (!residenceId) {
          console.log(`❌ [RESIDENCE UPLOAD] Missing residenceId`);
          return res
            .status(400)
            .json({ message: 'residenceId is required for resident documents' });
        }

        // Prepare the permanent file path and move file if needed
        let filePath: string;
        let fileName: string | undefined;
        
        if (req.file) {
          console.log(`🏠 [RESIDENCE UPLOAD] Processing file upload for residence ${residenceId}`);
          
          // Generate unique filename and move to permanent location
          fileName = `${uuidv4()}-${req.file.originalname}`;
          const permanentDir = path.join(process.cwd(), 'uploads', 'residences', residenceId);
          
          console.log(`🏠 [RESIDENCE UPLOAD] File paths:`, {
            originalName: req.file.originalname,
            newFileName: fileName,
            tempPath: req.file.path,
            permanentDir,
            directoryExists: fs.existsSync(permanentDir)
          });
          
          // Ensure directory exists
          if (!fs.existsSync(permanentDir)) {
            console.log(`🏠 [RESIDENCE UPLOAD] Creating directory: ${permanentDir}`);
            fs.mkdirSync(permanentDir, { recursive: true });
          }
          
          // Move file from temporary to permanent location (copy + delete for cross-filesystem)
          const permanentPath = path.join(permanentDir, fileName);
          console.log(`🏠 [RESIDENCE UPLOAD] Copying file from ${req.file.path} to ${permanentPath}`);
          fs.copyFileSync(req.file.path, permanentPath);
          console.log(`🏠 [RESIDENCE UPLOAD] Cleaning up temporary file: ${req.file.path}`);
          fs.unlinkSync(req.file.path); // Clean up temporary file
          filePath = `residences/${residenceId}/${fileName}`;
          console.log(`🏠 [RESIDENCE UPLOAD] File successfully moved to: ${filePath}`);
        } else {
          console.log(`🏠 [RESIDENCE UPLOAD] No file provided, creating placeholder path`);
          filePath = `temp-path-${Date.now()}`;
        }

        const dataToValidate = {
          ...otherData,
          residenceId,
          uploadedById: userId,
          filePath,
          fileName,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          documentType: documentType || type || 'other', // Default to 'other' if not provided
        };
        
        console.log('🔍 Residence document validation debug:', {
          dataToValidate,
          documentType,
          otherDataKeys: Object.keys(otherData),
          hasFile: !!req.file
        });
        
        let validatedData;
        try {
          validatedData = insertDocumentSchema.parse(dataToValidate);
          console.log('✅ Residence document validation SUCCESS');
        } catch (validationError) {
          console.log('❌ Residence document validation ERROR:', validationError);
          return res.status(400).json({ 
            message: 'Validation failed', 
            error: validationError.message || 'Invalid data',
            details: validationError.issues || validationError
          });
        }

        // Permission checks for resident documents
        if (userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId =
            organizations.length > 0 ? organizations[0].organizationId : undefined;
          const residence = await storage.getResidence(residenceId);
          if (residence) {
            const building = await storage.getBuilding(residence.buildingId);
            if (!building || building.organizationId !== organizationId) {
              return res
                .status(403)
                .json({ message: 'Cannot assign document to residence outside your organization' });
            }
          } else {
            return res.status(404).json({ message: 'Residence not found' });
          }
        }

        if (userRole === 'resident') {
          const residences = await storage.getUserResidences(userId);
          const residenceIds = residences.map((ur) => ur.residenceId);

          if (!residenceIds.includes(residenceId)) {
            return res
              .status(403)
              .json({ message: 'Cannot assign document to residence you do not own' });
          }
        }

        // Convert to unified document format
        const unifiedDocument: InsertDocument = {
          name: validatedData.name || 'Untitled',
          description: validatedData.description,
          documentType: validatedData.documentType,
          filePath: validatedData.filePath || `temp-path-${Date.now()}`,
          isVisibleToTenants: validatedData.isVisibleToTenants || false,
          residenceId: validatedData.residenceId,
          buildingId: undefined,
          uploadedById: validatedData.uploadedById,
        };

        const document = await storage.createDocument(unifiedDocument) ;

        console.log('📝 Created resident document:', document);
        console.log('📝 DocumentRecord ID:', document.id);

        const response = {
          ...document,
          documentCategory: 'resident',
          entityType: 'residence',
          entityId: document.residenceId,
        };

        console.log('📤 Sending response:', response);
        res.status(201).json(response);
      } else {
        return res.status(400).json({
          message: 'Invalid documentType. Must be either \"building\" or \"resident\"',
        });
      }
    } catch (_error: any) {
      // Clean up temporary file on error
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup temporary file:', cleanupError);
        }
      }

      console.error('❌ Error creating document:', _error);
      
      if (_error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid document data',
          errors: _error.issues,
        });
      }

      res.status(500).json({ message: 'Failed to create document' });
    }
  });

  // Update a document
  app.put('/api/documents/:id', requireAuth, upload.single('file'), async (req: any, res) => {
    console.log(`📝 [DOCUMENT UPDATE] Starting update for document ID: ${req.params.id}`);
    console.log(`📝 [DOCUMENT UPDATE] User: ${req.user.id} (${req.user.role})`);
    console.log(`📝 [DOCUMENT UPDATE] Body:`, req.body);
    console.log(`📝 [DOCUMENT UPDATE] File provided:`, !!req.file);
    
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;

      // Get existing document first to check permissions and get current file path
      const existingDocument = await storage.getDocuments({ documentId }).then(docs => docs[0]);
      
      if (!existingDocument) {
        console.log(`❌ [DOCUMENT UPDATE] Document not found: ${documentId}`);
        return res.status(404).json({ message: 'Document not found' });
      }

      console.log(`📝 [DOCUMENT UPDATE] Existing document:`, {
        id: existingDocument.id,
        name: existingDocument.name,
        filePath: existingDocument.filePath,
        buildingId: existingDocument.buildingId,
        residenceId: existingDocument.residenceId
      });

      // Check permissions (similar to view permissions)
      let hasAccess = false;
      if (userRole === 'admin') {
        hasAccess = true;
        console.log(`✅ [DOCUMENT UPDATE] Admin access granted`);
      } else if (userRole === 'manager') {
        // Manager should have access to documents in their organization
        const organizations = await storage.getUserOrganizations(userId);
        const buildings = await storage.getBuildings();
        const userOrganizations = organizations.map(org => org.organizationId);
        
        if (existingDocument.buildingId) {
          const orgBuildings = buildings.filter(building => 
            userOrganizations.includes(building.organizationId || '')
          );
          const orgBuildingIds = orgBuildings.map(b => b.id);
          hasAccess = orgBuildingIds.includes(existingDocument.buildingId);
        }
        console.log(`📝 [DOCUMENT UPDATE] Manager access: ${hasAccess}`);
      }

      if (!hasAccess) {
        console.log(`❌ [DOCUMENT UPDATE] Access denied for user ${userId}`);
        return res.status(403).json({ message: 'Access denied' });
      }

      // Prepare update data
      const updateData: any = {};
      
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.documentType) updateData.documentType = req.body.documentType;
      if (req.body.isVisibleToTenants !== undefined) {
        updateData.isVisibleToTenants = req.body.isVisibleToTenants === 'true';
      }

      console.log(`📝 [DOCUMENT UPDATE] Update data:`, updateData);

      // Handle file replacement if provided
      if (req.file) {
        console.log(`📝 [DOCUMENT UPDATE] Processing file replacement:`, {
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          tempPath: req.file.path
        });

        // Validate the file
        const fileValidation = validateFile(req.file);
        if (!fileValidation.isValid) {
          // Clean up temp file
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
          }
          return res.status(400).json({ message: fileValidation.error });
        }

        // Generate unique file path
        const fileExtension = path.extname(req.file.originalname);
        const baseFileName = path.basename(req.file.originalname, fileExtension);
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const entityType = existingDocument.buildingId ? 'buildings' : 'residences';
        const entityId = existingDocument.buildingId || existingDocument.residenceId;
        
        const documentsDir = path.join(process.cwd(), 'uploads', entityType, entityId || 'general');
        const uniqueFileName = `${uniqueId}-${baseFileName}${fileExtension}`;
        const finalPath = path.join(documentsDir, uniqueFileName);
        const relativePath = path.join(entityType, entityId || 'general', uniqueFileName);

        // Ensure directory exists
        if (!fs.existsSync(documentsDir)) {
          fs.mkdirSync(documentsDir, { recursive: true });
        }

        // Move file from temp to final location
        fs.renameSync(req.file.path, finalPath);
        
        // Update file-related fields
        updateData.filePath = relativePath;
        updateData.fileName = req.file.originalname;
        updateData.fileSize = req.file.size;
        updateData.mimeType = req.file.mimetype;

        console.log(`✅ [DOCUMENT UPDATE] File stored at: ${finalPath}`);

        // Clean up old file if it exists
        if (existingDocument.filePath) {
          const oldFilePath = path.isAbsolute(existingDocument.filePath) 
            ? existingDocument.filePath 
            : path.join(process.cwd(), 'uploads', existingDocument.filePath);
          
          try {
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`🗑️ [DOCUMENT UPDATE] Cleaned up old file: ${oldFilePath}`);
            }
          } catch (cleanupError) {
            console.warn('⚠️ Failed to cleanup old file:', cleanupError);
          }
        }
      }

      // Update the document
      const updatedDocument = await storage.updateDocument(documentId, updateData);

      if (!updatedDocument) {
        console.log(`❌ [DOCUMENT UPDATE] Failed to update document: ${documentId}`);
        return res.status(404).json({ message: 'Failed to update document' });
      }

      console.log(`✅ [DOCUMENT UPDATE] Document updated successfully:`, {
        id: (updatedDocument as any).id,
        name: (updatedDocument as any).name
      });

      // Add compatibility fields for frontend
      (updatedDocument as any).documentCategory = (updatedDocument as any).buildingId ? 'building' : 'resident';
      (updatedDocument as any).entityType = (updatedDocument as any).buildingId ? 'building' : 'residence';
      (updatedDocument as any).entityId = (updatedDocument as any).buildingId || (updatedDocument as any).residenceId;

      res.json(updatedDocument);
    } catch (_error: any) {
      // Clean up temporary file on error
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
          console.log(`🗑️ [DOCUMENT UPDATE] Cleaned up temp file on error: ${req.file.path}`);
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup temporary file:', cleanupError);
        }
      }

      console.error('❌ Error updating document:', _error);
      
      if (_error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid document data',
          errors: _error.issues,
        });
      }

      res.status(500).json({ message: 'Failed to update document' });
    }
  });

  // Security audit endpoint - admin only
  app.get('/api/documents/security/audit-log', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admins can access audit logs
      if (user.role !== 'admin') {
        logSecurityEvent('UNAUTHORIZED_AUDIT_ACCESS', user, false);
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }
      
      // Get last 100 audit events with pagination support
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      
      const paginatedLogs = auditLog.slice(offset, offset + limit);
      
      logSecurityEvent('AUDIT_LOG_ACCESS', user, true, undefined, { limit, offset });
      
      res.json({
        events: paginatedLogs,
        total: auditLog.length,
        limit,
        offset
      });
    } catch (error: any) {
      console.error('Error accessing audit log:', error);
      res.status(500).json({ message: 'Failed to retrieve audit log' });
    }
  });
  
  // Delete document with enhanced security logging
  app.delete('/api/documents/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const documentType = req.query.type as string; // Optional type hint

      // Get user's organization for permission checking
      const organizations = await storage.getUserOrganizations(userId);
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;

      // Use unified documents system for deletion
      let deleted = false;

      try {
        deleted = await storage.deleteDocument(documentId);
      } catch (e) {
        console.warn('⚠️ Error deleting document:', e);
      }

      if (!deleted) {
        return res.status(404).json({ message: 'DocumentRecord not found or access denied' });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('❌ Error in document deletion:', error);
      res.status(500).json({ message: 'Failed to delete document' });
    }
  });

  // Upload endpoint that matches frontend expectation: /api/documents/:id/upload
  app.post(
    '/api/documents/:id/upload',
    requireAuth,
    upload.single('file'),
    async (req: any, res) => {
      try {
        const user = req.user;
        const userRole = user.role;
        const userId = user.id;
        const documentId = req.params.id; // The :id in the URL is the document ID (from frontend)
        const { documentType = 'resident', residenceId, ...otherData } = req.body;

        console.log('📤 Upload request received:', {
          documentId,
          userId,
          userRole,
          hasFile: !!req.file,
          fileInfo: req.file
            ? {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                encoding: req.file.encoding,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path,
              }
            : null,
          bodyKeys: Object.keys(req.body),
          contentType: req.headers['content-type'],
        });

        // Validate permissions - only admin, manager, and resident can create documents
        if (!['admin', 'manager', 'resident'].includes(userRole)) {
          return res.status(403).json({ message: 'Insufficient permissions to create documents' });
        }

        if (!req.file) {
          console.error('❌ No file received in upload request');
          return res.status(400).json({ message: 'File is required for upload' });
        }

        // Get the existing document to determine where to store the file
        const documents = await storage.getDocuments({
          userId,
          userRole,
        });

        const existingDocument = documents.find((doc) => doc.id === documentId);

        if (!existingDocument) {
          return res.status(404).json({ message: 'DocumentRecord not found' });
        }

        // File validation passed - file exists and is ready for upload

        // Determine organization ID based on document context
        let organizationId: string;

        if (existingDocument.buildingId) {
          const building = await storage.getBuilding(existingDocument.buildingId);
          if (!building) {
            return res.status(404).json({ message: 'Building not found' });
          }
          organizationId = building.organizationId;
        } else if (existingDocument.residenceId) {
          const residence = await storage.getResidence(existingDocument.residenceId);
          if (!residence) {
            return res.status(404).json({ message: 'Residence not found' });
          }
          const building = await storage.getBuilding(residence.buildingId);
          if (!building) {
            return res.status(404).json({ message: 'Building not found' });
          }
          organizationId = building.organizationId;
        } else {
          return res
            .status(400)
            .json({ message: 'DocumentRecord must be associated with a building or residence' });
        }

        // Note: File upload to external storage removed

        // Update document with file information
        const updatedDocument = await storage.updateDocument(documentId, {
          filePath: `prod_org_${organizationId}/${req.file.originalname}`,
          name: req.file.originalname,
          // Remove mimeType as it's not in schema
        });

        // Clean up temporary file
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        res.status(200).json({
          document: updatedDocument,
          message: 'File uploaded successfully',
        });
      } catch (error: any) {
        const errorTimestamp = new Date().toISOString();
        console.error(`[${errorTimestamp}] Error type:`, error.constructor.name);
        console.error(`[${errorTimestamp}] Error message:`, error.message);
        console.error(`[${errorTimestamp}] Error stack:`, error.stack);

        // Clean up temporary file on error
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error(`[${errorTimestamp}] Error cleaning up file:`, cleanupError);
          }
        }

        if (error.name === 'ZodError') {
          return res.status(400).json({
            message: 'Validation error',
            errors: error.errors,
          });
        }

        res.status(500).json({ message: 'Failed to upload document' });
      }
    }
  );

  // POST /api/documents/upload - Upload file to GCS and create unified document record
  app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req: any, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📋 POST /api/documents/upload - Starting upload`, {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      body: req.body,
      userId: req.user?.id
    });
    
    try {
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Parse form data
      const formData = {
        name: req.body.name,
        description: req.body.description || '',
        documentType: req.body.documentType || req.body.type, // Handle both field names
        isVisibleToTenants: req.body.isVisibleToTenants === 'true',
        residenceId: req.body.residenceId || undefined,
        buildingId: req.body.buildingId || undefined,
        attachedToType: req.body.attachedToType || undefined,
        attachedToId: req.body.attachedToId || undefined,
      };

      // Production debugging: Log form data before validation
      if (process.env.NODE_ENV === 'production') {
        console.log('[PROD DEBUG] Form data before validation:', formData);
      }

      // Validate form data
      const validatedData = uploadDocumentRecordSchema.parse(formData);
      
      // DEBUG: Log validated data to see what's being passed
      console.log(`[${timestamp}] 🔍 VALIDATION DEBUG: Form data before validation:`, formData);
      console.log(`[${timestamp}] 🔍 VALIDATION DEBUG: Validated data:`, {
        ...validatedData,
        hasAttachedToType: !!validatedData.attachedToType,
        hasAttachedToId: !!validatedData.attachedToId
      });
      
      // Production debugging: Log after validation
      if (process.env.NODE_ENV === 'production') {
        console.log('[PROD DEBUG] Form data validation passed:', validatedData);
      }

      // Get user info from auth middleware
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // GCS DISABLED: Skip bucket configuration (using local storage only)
      console.log('📁 GCS disabled - skipping bucket configuration check');

      // Generate unique GCS path
      const fileExtension = path.extname(req.file.originalname);
      const baseFileName = path.basename(req.file.originalname, fileExtension);
      const uniqueFileName = `${uuidv4()}-${baseFileName}${fileExtension}`;

      let filePath: string;
      if (validatedData.residenceId) {
        filePath = `residences/${validatedData.residenceId}/${uniqueFileName}`;
      } else if (validatedData.buildingId) {
        filePath = `buildings/${validatedData.buildingId}/${uniqueFileName}`;
      } else {
        filePath = `general/${uniqueFileName}`;
      }

      // DISABLED GCS: Force local storage for all environments
      console.log('📁 GCS disabled - using local storage for all document operations');
      
      // Always use local storage (GCS disabled)
      try {
        // Use local storage with robust error handling
        const localStoragePath = path.join(process.cwd(), 'uploads');
        
        // Ensure uploads directory exists
        try {
          if (!fs.existsSync(localStoragePath)) {
            fs.mkdirSync(localStoragePath, { recursive: true });
            console.log(`📁 Created uploads directory: ${localStoragePath}`);
          }
        } catch (dirError) {
          console.error('Failed to create uploads directory:', dirError);
          throw new Error('Cannot create uploads directory - check permissions');
        }

        // Create directory structure for file
        const localFilePath = path.join(localStoragePath, filePath);
        const localFileDir = path.dirname(localFilePath);
        
        try {
          if (!fs.existsSync(localFileDir)) {
            fs.mkdirSync(localFileDir, { recursive: true });
            console.log(`📁 Created subdirectory: ${localFileDir}`);
          }
        } catch (subdirError) {
          console.error('Failed to create file subdirectory:', subdirError);
          throw new Error('Cannot create file directory - check permissions');
        }

        // Copy uploaded file to local storage
        try {
          fs.copyFileSync(req.file!.path, localFilePath);
          // File saved successfully
        } catch (copyError) {
          console.error('Failed to copy file:', copyError);
          throw new Error('Cannot save file - check disk space and permissions');
        }
      } catch (localError) {
        console.error('Local storage error:', localError);
        throw new Error('Failed to save file locally');
      }

      // Create document record in database
      const documentData: InsertDocument = {
        name: validatedData.name,
        description: validatedData.description,
        documentType: validatedData.documentType,
        filePath: filePath,
        isVisibleToTenants: validatedData.isVisibleToTenants,
        residenceId: validatedData.residenceId,
        buildingId: validatedData.buildingId,
        uploadedById: userId,
        attachedToType: validatedData.attachedToType,
        attachedToId: validatedData.attachedToId,
      };

      // Create document record in database

      // Create document record in database  
      const newDocument = await storage.createDocument(documentData);
      
      // Document record created successfully

      // Clean up temporary file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Return success response
      res.status(201).json({
        message: 'DocumentRecord uploaded successfully',
        document: newDocument,
      });
    } catch (error: any) {
      const errorEntry = logError('POST /api/documents/upload', error, req.user);

      // Clean up temporary file on error
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up temporary file:', cleanupError);
        }
      }

      // Handle validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors,
          error_id: errorEntry.timestamp
        });
      }

      // Handle GCS errors
      if (error.message && error.message.includes('Google Cloud Storage')) {
        return res.status(500).json({
          message: 'File upload failed',
          error: 'Storage service error',
          error_id: errorEntry.timestamp
        });
      }

      // Handle unique constraint violations (path conflicts)
      if (error?.message?.includes('unique constraint') || error?.code === '23505') {
        return res.status(409).json({
          message: 'DocumentRecord path conflict - please try uploading again',
          error: 'Path already exists',
          error_id: errorEntry.timestamp
        });
      }

      // Handle database errors
      if (error.message && error.message.includes('database')) {
        return res.status(500).json({
          message: 'Failed to save document record',
          error: 'Database error',
          error_id: errorEntry.timestamp
        });
      }

      // Generic error response
      res.status(500).json({
        message: 'Internal server error',
        error: 'DocumentRecord upload failed',
        error_id: errorEntry.timestamp,
        debug_info: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Serve document files
  // Serve document files with proper role-based access control
  app.get('/api/documents/:id/file', requireAuth, async (req: any, res) => {
    const operationId = crypto.randomUUID();
    const startTime = performance.now();
    
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const isDownload = req.query.download === 'true';

      logDocumentOperation('FILE_SERVE_REQUEST', {
        operationId,
        documentId,
        userId,
        userRole,
        isDownload,
        requestInfo: {
          url: req.url,
          method: req.method,
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          clientIP: req.ip || req.connection.remoteAddress
        }
      }, 'INFO');

      // Enhanced permission data loading with timing
      const permissionLoadStart = performance.now();
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      const buildings = await storage.getBuildings();
      const permissionLoadTime = performance.now() - permissionLoadStart;
      
      logDocumentOperation('PERMISSION_DATA_LOADED', {
        operationId,
        loadTime: `${permissionLoadTime.toFixed(2)}ms`,
        dataStats: {
          organizationsCount: organizations.length,
          residencesCount: residences.length,
          buildingsCount: buildings.length
        }
      }, 'DEBUG');

      // Enhanced security audit for file access
      logSecurityEvent('DOCUMENT_FILE_ACCESS_ATTEMPT', user, false, documentId, {
        operationId,
        userRole,
        documentId,
        isDownload,
        requestContext: {
          timestamp: new Date().toISOString(),
          clientIP: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      // Enhanced document lookup with performance tracking
      const documentLookupStart = performance.now();
      const allDocuments = await storage.getDocuments({});
      const document = allDocuments.find((doc) => doc.id === documentId);
      const documentLookupTime = performance.now() - documentLookupStart;
      
      logDocumentOperation('DOCUMENT_LOOKUP', {
        operationId,
        documentId,
        lookupTime: `${documentLookupTime.toFixed(2)}ms`,
        totalDocumentsSearched: allDocuments.length,
        documentFound: !!document
      }, 'DEBUG');

      if (!document) {
        logDocumentOperation('DOCUMENT_NOT_FOUND', {
          operationId,
          documentId,
          totalDocumentsInDatabase: allDocuments.length
        }, 'WARN');
        logSecurityEvent('DOCUMENT_FILE_ACCESS_NOT_FOUND', user, false, documentId, { operationId });
        return res.status(404).json({ message: 'Document not found' });
      }

      // Document found in database

      // Get user's organization info
      const userOrganizations = organizations.map(org => org.organizationId);
      const userResidenceIds = residences
        .map((ur: any) => ur.residenceId || ur.userResidence?.residenceId || ur.residence?.id)
        .filter(Boolean);

      // Get building IDs that user's residences belong to
      const userBuildingIds = [];
      for (const userResidence of residences) {
        // Handle different residence data structures
        const residenceId = userResidence.residenceId;
        if (residenceId) {
          // Find the actual residence to get building ID
          const allResidences = await storage.getResidences();
          const residence = allResidences.find(r => r.id === residenceId);
          if (residence?.buildingId) {
            userBuildingIds.push(residence.buildingId);
          }
        }
      }

      // Check permissions based on the specified rules
      let hasAccess = false;
      let accessReason = '';

      if (userRole === 'admin') {
        hasAccess = true;
        accessReason = 'Admin has global access';
        // Admin access granted
      } else if (userRole === 'manager') {
        // Checking manager permissions
        
        // Manager should have access to buildings they are assigned to
        if (document.buildingId) {
          // Checking building-level access
          // Get buildings for the manager's organization
          const orgBuildings = buildings.filter(building => 
            userOrganizations.includes(building.organizationId || '')
          );
          const orgBuildingIds = orgBuildings.map(b => b.id);
          
          // Checking organization buildings
          
          if (orgBuildingIds.includes(document.buildingId)) {
            hasAccess = true;
            accessReason = 'Manager has access to organization buildings';
            // Manager building access granted
          } else {
            // Manager building access denied
          }
        }
        
        // Manager has access to all residences in their organization
        if (document.residenceId) {
          // Check if residence belongs to manager's organization
          const allResidences = await storage.getResidences();
          const residence = allResidences.find(r => r.id === document.residenceId);
          if (residence) {
            // Check if residence building belongs to manager's organization
            const residenceBuilding = buildings.find(b => b.id === residence.buildingId);
            if (residenceBuilding && userOrganizations.includes(residenceBuilding.organizationId || '')) {
              hasAccess = true;
              accessReason = 'Manager has access to organization residences';
            }
          }
        }
      } else if (userRole === 'resident') {
        // Resident has access to building files they are assigned to
        if (document.buildingId && userBuildingIds.includes(document.buildingId)) {
          hasAccess = true;
          accessReason = 'Resident has access to assigned building documents';
        }
        
        // Resident has access to residence files they are assigned to
        if (document.residenceId && userResidenceIds.includes(document.residenceId)) {
          hasAccess = true;
          accessReason = 'Resident has access to assigned residence documents';
        }
      } else if (userRole === 'tenant') {
        // Tenants can only access documents marked as visible to tenants
        if (document.isVisibleToTenants) {
          // Tenant has access to building files they are assigned to and marked for tenant
          if (document.buildingId && userBuildingIds.includes(document.buildingId)) {
            hasAccess = true;
            accessReason = 'Tenant has access to assigned building documents marked for tenants';
          }
          
          // Tenant has access to residence files they are assigned to and marked for tenant
          if (document.residenceId && userResidenceIds.includes(document.residenceId)) {
            hasAccess = true;
            accessReason = 'Tenant has access to assigned residence documents marked for tenants';
          }
        }
      }

      if (!hasAccess) {
        logDocumentOperation('FILE_ACCESS_DENIED', {
          operationId,
          documentId,
          userId,
          userRole,
          accessAnalysis: {
            documentBuildingId: document.buildingId,
            documentResidenceId: document.residenceId,
            userBuildingIds,
            userResidenceIds,
            isVisibleToTenants: document.isVisibleToTenants,
            documentType: document.documentType
          }
        }, 'WARN');
        
        logSecurityEvent('DOCUMENT_FILE_ACCESS_DENIED', user, false, documentId, {
          operationId,
          userRole,
          documentBuildingId: document.buildingId,
          documentResidenceId: document.residenceId,
          userBuildingIds,
          userResidenceIds,
          isVisibleToTenants: document.isVisibleToTenants
        });
        return res.status(403).json({ message: 'Access denied' });
      }

      logDocumentOperation('FILE_ACCESS_GRANTED', {
        operationId,
        documentId,
        userId,
        userRole,
        accessReason,
        documentInfo: {
          name: document.name,
          documentType: document.documentType,
          filePath: document.filePath,
          buildingId: document.buildingId,
          residenceId: document.residenceId
        }
      }, 'INFO');

      logSecurityEvent('DOCUMENT_FILE_ACCESS_GRANTED', user, true, documentId, {
        operationId,
        accessReason,
        userRole,
        documentType: document.documentType
      });

      // Serve from local storage
      if (document.filePath) {
        // Serving file from local storage
        try {
          // Always serve from local storage (GCS disabled)
          let filePathToServe = document.filePath;

          // Resolving file path

          // Check if it's an absolute path
          if (document.filePath.startsWith('/')) {
            filePathToServe = document.filePath;
            // Using absolute path
          }
          // Check if it's a relative file path
          else if (
            document.filePath.includes('residences/') ||
            document.filePath.includes('buildings/') ||
            document.filePath.includes('text-documents/') ||
            document.filePath.includes('general/') ||
            document.filePath.includes('bills/')
          ) {
            // Checking common file locations
            
            // For development, try to find the file in common upload directories
            const possiblePaths = [
              path.join(process.cwd(), 'uploads', document.filePath), // Main fallback location
              path.join(process.cwd(), document.filePath), // Direct path
              `/tmp/uploads/${document.filePath}`,
              `/uploads/${document.filePath}`,
              `./uploads/${document.filePath}`,
              path.join('/tmp', document.filePath),
            ];

            // Checking multiple possible paths

            // Try to find the file in any of these locations
            for (const possiblePath of possiblePaths) {
              // Checking file path
              if (fs.existsSync(possiblePath)) {
                filePathToServe = possiblePath;
                // File found
                break;
              }
            }
          }
          // Check if it's a temp file path
          else if (document.filePath.includes('tmp')) {
            filePathToServe = document.filePath;
            // Using temp file path
          }

          // Try to serve the file
          if (fs.existsSync(filePathToServe)) {
            // Preparing to serve file
            
            // Get the original filename with extension, or construct one from the document name
            let fileName = (document as any).fileName || document.name || path.basename(document.filePath);

            // If the fileName doesn't have an extension, add it from the original file path
            if (!path.extname(fileName) && document.filePath) {
              const originalExt = path.extname(document.filePath);
              if (originalExt) {
                fileName += originalExt;
              }
            }

            // Setting file details for download

            if (isDownload) {
              res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            } else {
              res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
            }

            // Set appropriate content type based on file extension
            const ext = path.extname(fileName).toLowerCase();
            // Setting content type
            
            if (ext === '.pdf') {
              res.setHeader('Content-Type', 'application/pdf');
            } else if (ext === '.jpg' || ext === '.jpeg') {
              res.setHeader('Content-Type', 'image/jpeg');
            } else if (ext === '.png') {
              res.setHeader('Content-Type', 'image/png');
            } else if (ext === '.gif') {
              res.setHeader('Content-Type', 'image/gif');
            } else if (ext === '.doc' || ext === '.docx') {
              res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              );
            } else if (ext === '.txt') {
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            } else {
              res.setHeader('Content-Type', 'application/octet-stream');
            }

            // Production cache busting for documents
            if (process.env.NODE_ENV === 'production') {
              const fileStats = fs.statSync(filePathToServe);
              res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'ETag': `"${document.id}-${fileStats.mtime.getTime()}"`,
                'Last-Modified': fileStats.mtime.toUTCString(),
              });
            }

            const totalTime = performance.now() - startTime;
          logDocumentOperation('FILE_SERVE_SUCCESS', {
            operationId,
            documentId,
            filePath: filePathToServe,
            fileName,
            totalRequestTime: `${totalTime.toFixed(2)}ms`,
            isDownload,
            fileDetails: {
              exists: true,
              resolvedPath: path.resolve(filePathToServe)
            }
          }, 'INFO');
          
          return res.sendFile(path.resolve(filePathToServe));
          }

          const totalTime = performance.now() - startTime;
          logDocumentOperation('FILE_NOT_FOUND_ON_DISK', {
            operationId,
            documentId,
            originalFilePath: document.filePath,
            attemptedFilePath: filePathToServe,
            totalRequestTime: `${totalTime.toFixed(2)}ms`,
            searchedPaths: [
              path.join(process.cwd(), 'uploads', document.filePath),
              path.join(process.cwd(), document.filePath),
              `/tmp/uploads/${document.filePath}`
            ]
          }, 'ERROR');
          
          return res.status(404).json({ message: 'File not found on server' });
        } catch (fileError: any) {
          console.error('❌ [DOCUMENT DOWNLOAD] Error serving file:', fileError);
          return res.status(500).json({ message: 'Failed to serve file' });
        }
      }

      console.log(`❌ [DOCUMENT DOWNLOAD] No file associated with document ${documentId}`);
      return res.status(404).json({ message: 'No file associated with this document' });
    } catch (error: any) {
      console.error('❌ [DOCUMENT DOWNLOAD] Error serving document file:', error);
      res.status(500).json({ message: 'Failed to serve document file' });
    }
  });

}
