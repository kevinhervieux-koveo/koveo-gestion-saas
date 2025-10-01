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
import { sql, eq } from 'drizzle-orm';
import { db } from '../db';

// Enhanced security configuration for file uploads
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // Reduced to 10MB for better security
  MAX_FILES_PER_USER_PER_HOUR: 5, // More restrictive rate limiting
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png'
  ],
  ALLOWED_EXTENSIONS: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'],
  // File content validation patterns to block potentially malicious files
  BLOCKED_PATTERNS: [
    /<%[\s\S]*%>/g,  // ASP/JSP tags
    /<\?php[\s\S]*\?>/g,  // PHP tags
    /<script[\s\S]*<\/script>/gi,  // Script tags
    /javascript:/gi,  // JavaScript protocol
    /vbscript:/gi,   // VBScript protocol
    /data:.*base64/gi, // Base64 data URLs
    /eval\s*\(/gi,   // eval() calls
    /exec\s*\(/gi,   // exec() calls
    /system\s*\(/gi, // system() calls
  ]
};

// Rate limiting storage for uploads
const uploadRateTracker = new Map();

// Secure path sanitization to prevent directory traversal attacks
function sanitizeFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided');
  }
  
  // Remove any null bytes (common in path traversal attacks)
  let sanitized = filePath.replace(/\0/g, '');
  
  // Remove any path traversal sequences
  sanitized = sanitized.replace(/\.\.[\\\/]/g, ''); // Remove ../ and ..\
  sanitized = sanitized.replace(/^[\\\/]+/, ''); // Remove leading slashes
  sanitized = sanitized.replace(/[\\\/]+$/, ''); // Remove trailing slashes
  
  // Normalize path separators to forward slashes
  sanitized = sanitized.replace(/\\/g, '/');
  
  // Remove any remaining dangerous sequences
  sanitized = sanitized.replace(/\.\.+/g, '.'); // Convert multiple dots to single dot
  sanitized = sanitized.replace(/\/+/g, '/'); // Convert multiple slashes to single slash
  
  // Only allow alphanumeric chars, dots, hyphens, underscores, and forward slashes
  sanitized = sanitized.replace(/[^a-zA-Z0-9._\/-]/g, '_');
  
  // Ensure the path doesn't start with dangerous sequences after sanitization
  if (sanitized.startsWith('./') || sanitized.startsWith('../') || sanitized.startsWith('/')) {
    sanitized = sanitized.substring(sanitized.search(/[^.\/]/) || 1);
  }
  
  // Final validation - path must not be empty and must be reasonable length
  if (!sanitized || sanitized.length > 500) {
    throw new Error('Invalid file path after sanitization');
  }
  
  return sanitized;
}

// Enhanced file validation function with content scanning and magic number validation
function validateFile(file: any, fileContent?: Buffer): { isValid: boolean; error?: string } {
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
  
  // Check filename for path traversal and malicious patterns
  const filename = file.originalname;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || 
      filename.includes('<') || filename.includes('>') || filename.includes('"') ||
      filename.includes('|') || filename.includes('*') || filename.includes('?')) {
    return { isValid: false, error: 'Invalid filename detected - contains prohibited characters' };
  }
  
  // Validate filename length
  if (filename.length > 255 || filename.length < 1) {
    return { isValid: false, error: 'Filename length invalid' };
  }
  
  // Check for executable file extensions (double extension attack)
  const doubleExtensionPattern = /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|dll|sys|bin)\.[\w]+$/i;
  if (doubleExtensionPattern.test(filename)) {
    return { isValid: false, error: 'Potentially malicious filename detected' };
  }
  
  // Magic number validation for file type verification
  if (fileContent && fileContent.length > 4) {
    const magicNumbers = fileContent.slice(0, 8);
    const validMagicNumbers = {
      'pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
      'jpg': [0xFF, 0xD8, 0xFF], // JPEG
      'png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
      'gif': [0x47, 0x49, 0x46], // GIF
      'docx': [0x50, 0x4B], // ZIP-based format (DOCX)
      'txt': null // Text files don't have consistent magic numbers
    };
    
    // Verify file content matches declared MIME type
    const extension = path.extname(file.originalname).toLowerCase().substring(1);
    const expectedMagic = validMagicNumbers[extension as keyof typeof validMagicNumbers];
    
    if (expectedMagic) {
      const matches = expectedMagic.every((byte, index) => magicNumbers[index] === byte);
      if (!matches && extension !== 'txt') {
        return { isValid: false, error: `File content does not match declared type: ${extension}` };
      }
    }
  }
  
  // Content validation if available
  if (fileContent) {
    const contentString = fileContent.toString('utf8', 0, Math.min(fileContent.length, 8192)); // Check first 8KB
    
    // Check for malicious patterns in file content
    for (const pattern of SECURITY_CONFIG.BLOCKED_PATTERNS) {
      if (pattern.test(contentString)) {
        return { isValid: false, error: 'File content contains potentially malicious code' };
      }
    }
    
    // Check for null bytes (possible binary exploitation)
    if (contentString.includes('\0')) {
      return { isValid: false, error: 'File contains null bytes - potentially malicious' };
    }
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
  effectiveDate: z.string().optional(),
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
  // console.log(`[${new Date().toISOString()}] 🔧 Registering document routes...`);
  
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
    
    // console.log(`[SECURITY AUDIT] ${action}:`, event);
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
    
    // console.log(`[${timestamp}] ${emoji} [DOCUMENT ${operation.toUpperCase()}] ${level}:`, data);
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
      // console.error('❌ Error during enum cleanup:', error);
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
      // console.error('❌ Error fixing user-organization links:', error);
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
      // console.error('❌ Error during enum migration:', error);
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
      // console.error('❌ Error fixing invitations dependency:', error);
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
      // console.error('❌ Error restoring invitations default:', error);
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
      // console.error('❌ Error migrating owner users to admin:', error);
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
      // console.error('❌ Error removing enum dependencies:', error);
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
      // console.error('❌ Error restoring defaults:', error);
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
      // console.error('❌ Error during schema synchronization:', error);
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
        // console.error('Schema check error:', schemaError);
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
      // console.error('❌ Error running diagnostic:', error);
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
    
    // console.error(`[${errorEntry.timestamp}] 🚨 ERROR in ${endpoint}:`, errorEntry);
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
          dbConfigured: !!process.env.DATABASE_URL
        }
      }, 'DEBUG');
      const documentType = req.query.type as string; // 'building', 'resident', or undefined for both
      const specificDocumentType = req.query.documentType as string; // Filter by document type (legal, maintenance, etc.)
      const specificResidenceId = req.query.residenceId as string; // Filter by specific residence
      const specificBuildingId = req.query.buildingId as string; // Filter by specific building
      const attachedToType = req.query.attachedToType as string; // Filter by attached entity type
      const attachedToId = req.query.attachedToId as string; // Filter by attached entity ID

      // OPTIMIZED: Use single query to get user access scope instead of 3 separate queries
      logDocumentOperation('USER_ACCESS_SCOPE_FETCH_START', { userId, userRole }, 'DEBUG');
      
      const scopeStart = performance.now();
      const { getUserAccessScope } = await import('../db/queries/optimized-document-queries');
      const scope = await getUserAccessScope(userId, userRole);
      const scopeTime = performance.now() - scopeStart;
      
      logDocumentOperation('USER_ACCESS_SCOPE_SUCCESS', {
        executionTime: `${scopeTime.toFixed(2)}ms`,
        organizationCount: scope.organizationIds.length,
        buildingCount: scope.buildingIds.length,
        residenceCount: scope.residenceIds.length,
        optimization: 'Single CTE query replaced 3 separate queries'
      }, 'DEBUG');
      
      // Use scope data directly - no need for compatibility objects
      const organizationIds = scope.organizationIds;
      const scopeBuildingIds = scope.buildingIds;
      const scopeResidenceIds = scope.residenceIds;
      
      // For backward compatibility where needed
      const organizations = scope.organizationIds.map(id => ({ organizationId: id }));
      const userResidences = scope.residenceIds.map(id => ({ residenceId: id }));

      const organizationId = organizationIds.length > 0 ? organizationIds[0] : undefined;
      // console.log(`[${timestamp}] 🏢 Organization ID determined:`, organizationId);

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

      const buildingIds = scopeBuildingIds; // Use optimized scope building IDs

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
      }

      // Filter by attached entity (e.g., bill attachments)
      if (attachedToType) {
        filters.attachedToType = attachedToType;
      }
      if (attachedToId) {
        filters.attachedToId = attachedToId;
      }

      if (documentType === 'building') {
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

      // OPTIMIZED: Use optimized query that loads documents with all related data in single query
      logDocumentOperation('OPTIMIZED_DOCUMENTS_FETCH_START', {
        userRole,
        userId,
        filters,
        optimization: 'Using getDocumentsForUser with JOINs'
      }, 'DEBUG');
      
      const documentsStart = performance.now();
      let documents;
      try {
        const { getDocumentsForUser } = await import('../db/queries/optimized-document-queries');
        const additionalFilters: any = {};
        
        if (specificBuildingId) {
          additionalFilters.buildingId = specificBuildingId;
        }
        if (specificResidenceId) {
          additionalFilters.residenceId = specificResidenceId;
        }
        if (documentType) {
          additionalFilters.documentType = documentType;
        }
        if (specificDocumentType) {
          additionalFilters.specificDocumentType = specificDocumentType;
        }
        
        documents = await getDocumentsForUser(userId, userRole, additionalFilters);
        const documentsTime = performance.now() - documentsStart;
        logDocumentOperation('OPTIMIZED_DOCUMENTS_SUCCESS', {
          documentCount: documents?.length || 0,
          executionTime: `${documentsTime.toFixed(2)}ms`,
          optimization: 'Single query with JOINs for documents + related entities',
          performanceGain: 'Eliminated N+1 queries for buildings/residences/users'
        }, 'DEBUG');
      } catch (documentsError) {
        const documentsTime = performance.now() - documentsStart;
        logDocumentOperation('OPTIMIZED_DOCUMENTS_ERROR', {
          error: documentsError.message,
          stack: documentsError.stack?.substring(0, 200),
          executionTime: `${documentsTime.toFixed(2)}ms`
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
      // console.log('🔍 [DOCUMENTS API DEBUG]:', {
      //   filters,
      //   documentsFound: documents?.length || 0,
      //   specificResidenceId,
      //   attachedToType,
      //   attachedToId,
      //   userRole,
      //   userId,
      // });

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

        // Manager (including demo_manager) can see all documents in their organization
        if ((userRole === 'manager' || userRole === 'demo_manager') && organizationId) {
          if (doc.buildingId && buildingIds.includes(doc.buildingId)) {
            return true;
          }
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }
        }

        // Resident (including demo_resident) access rules
        if (userRole === 'resident' || userRole === 'demo_resident') {
          // Residents can see documents in their residence
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }
          // Residents can see building documents related to their residences
          // FIXED: Use scopeBuildingIds from optimized query instead of trying to extract from non-existent nested objects
          if (doc.buildingId && scopeBuildingIds.includes(doc.buildingId)) {
            return true;
          }
        }

        // Tenant (including demo_tenant) access rules - more restrictive
        if (userRole === 'tenant' || userRole === 'demo_tenant') {
          // Tenants can only see documents marked as visible to tenants
          if (!doc.isVisibleToTenants) {
            return false;
          }

          // Tenants can see visible documents in their residence
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }

          // Tenants can see visible building documents related to their residences
          // FIXED: Use scopeBuildingIds from optimized query instead of trying to extract from non-existent nested objects
          if (doc.buildingId && scopeBuildingIds.includes(doc.buildingId)) {
            return true;
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
        // console.log(`[${timestamp}] 📄 Bill documents found:`, enhancedDocumentRecords.length);
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
            // console.warn('⚠️ Error fetching building document:', e);
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
            // console.warn('⚠️ Error fetching resident document:', e);
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
          // console.warn('⚠️ Error fetching legacy document:', e);
        }
      }

      if (!document) {
        return res.status(404).json({ message: 'DocumentRecord not found or access denied' });
      }

      res.json(document);
    } catch (error: any) {
      // console.error('❌ Error fetching document:', error);
      res.status(500).json({ message: 'Failed to fetch document' });
    }
  });

  // Multer error handling middleware
  const handleMulterError = (err: any, req: any, res: any, next: any) => {
    if (err) {
      // Handle multer-specific errors
      if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `File size exceeds ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB limit` });
        }
        return res.status(400).json({ error: err.message });
      }
      // Handle custom validation errors from fileFilter
      if (err.message) {
        return res.status(400).json({ error: err.message });
      }
      // Generic error
      return res.status(400).json({ error: 'File upload failed' });
    }
    next();
  };

  // Create a new document (supports both file upload and text-only documents)
  app.post('/api/documents', requireAuth, (req: any, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  }, async (req: any, res) => {
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
        // console.log(`📄 [DOCUMENTS UPLOAD] File details:`, {
        //   originalName: req.file.originalname,
        //   mimeType: req.file.mimetype,
        //   size: req.file.size,
        //   tempPath: req.file.path,
        //   encoding: req.file.encoding
        // });
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
          isQuarantined: false, // Text documents are safe by default
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
          // console.error('Error saving text document to filesystem:', fsError);
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
          isQuarantined: false, // Metadata documents are safe by default
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
      // console.log(`📄 [DOCUMENTS UPLOAD] Starting file document processing`);
      
      // Determine document record type based on buildingId/residenceId (not from documentType field)
      let finalDocumentRecordType;
      if (buildingId && !residenceId) {
        finalDocumentRecordType = 'building';
        // console.log(`📄 [DOCUMENTS UPLOAD] Determined document type: BUILDING (ID: ${buildingId})`);
      } else if (residenceId && !buildingId) {
        finalDocumentRecordType = 'resident';
        // console.log(`📄 [DOCUMENTS UPLOAD] Determined document type: RESIDENCE (ID: ${residenceId})`);
      } else if (buildingId && residenceId) {
        // console.log(`❌ [DOCUMENTS UPLOAD] Both buildingId and residenceId provided: ${buildingId}, ${residenceId}`);
        return res.status(400).json({
          message: 'Cannot provide both buildingId and residenceId',
        });
      } else {
        // console.log(`❌ [DOCUMENTS UPLOAD] No buildingId or residenceId provided`);
        return res.status(400).json({
          message:
            'Must provide either buildingId (for building documents) or residenceId (for resident documents)',
        });
      }

      if (finalDocumentRecordType === 'building') {
        // console.log(`🏢 [BUILDING UPLOAD] Processing building document for building ID: ${buildingId}`);
        
        // Validate and create building document
        if (!buildingId) {
          // console.log(`❌ [BUILDING UPLOAD] Missing buildingId`);
          return res.status(400).json({ message: 'buildingId is required for building documents' });
        }

        // Prepare the permanent file path and move file if needed
        let filePath: string;
        let fileName: string | undefined;
        
        if (req.file) {
          // console.log(`🏢 [BUILDING UPLOAD] Processing file upload for building ${buildingId}`);
          
          // Generate unique filename with sanitization and move to permanent location
          const unsanitizedFileName = `${uuidv4()}-${req.file.originalname}`;
          fileName = sanitizeFilePath(unsanitizedFileName);
          const permanentDir = path.join(process.cwd(), 'uploads', 'buildings', buildingId);
          
          // console.log(`🏢 [BUILDING UPLOAD] File paths:`, {
          //   originalName: req.file.originalname,
          //   newFileName: fileName,
          //   tempPath: req.file.path,
          //   permanentDir,
          //   directoryExists: fs.existsSync(permanentDir)
          // });
          
          // Ensure directory exists
          if (!fs.existsSync(permanentDir)) {
            // console.log(`🏢 [BUILDING UPLOAD] Creating directory: ${permanentDir}`);
            fs.mkdirSync(permanentDir, { recursive: true });
          }
          
          // Move file from temporary to permanent location (copy + delete for cross-filesystem)
          const permanentPath = path.join(permanentDir, fileName);
          // console.log(`🏢 [BUILDING UPLOAD] Copying file from ${req.file.path} to ${permanentPath}`);
          fs.copyFileSync(req.file.path, permanentPath);
          // console.log(`🏢 [BUILDING UPLOAD] Cleaning up temporary file: ${req.file.path}`);
          fs.unlinkSync(req.file.path); // Clean up temporary file
          filePath = `buildings/${buildingId}/${fileName}`;
          // console.log(`🏢 [BUILDING UPLOAD] File successfully moved to: ${filePath}`);
        } else {
          // console.log(`🏢 [BUILDING UPLOAD] No file provided, creating placeholder path`);
          filePath = `temp-path-${Date.now()}`;
        }
        
        // Convert string boolean fields to actual booleans for validation
        const isVisibleToTenants = otherData.isVisibleToTenants === 'true' || otherData.isVisibleToTenants === true;
        
        const dataToValidate = {
          ...otherData,
          buildingId,
          uploadedById: userId,
          filePath,
          fileName,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          documentType: documentType || type || 'other', // Default to 'other' if not provided
          isVisibleToTenants, // Use converted boolean value
        };
        
        // console.log(`🏢 [BUILDING UPLOAD] Data to validate:`, {
        //   buildingId,
        //   uploadedById: userId,
        //   filePath,
        //   fileName,
        //   fileSize: req.file?.size,
        //   mimeType: req.file?.mimetype,
        //   documentType: documentType || type || 'other',
        //   otherDataKeys: Object.keys(otherData)
        // });
        
        let validatedData;
        try {
          validatedData = insertDocumentSchema.parse(dataToValidate);
          // console.log(`✅ [BUILDING UPLOAD] Document validation successful for building ${buildingId}`);
        } catch (validationError) {
          // console.log(`❌ [BUILDING UPLOAD] Document validation failed for building ${buildingId}:`, validationError);
          return res.status(400).json({ 
            message: 'Validation failed', 
            error: validationError.message || 'Invalid data',
            details: validationError.issues || validationError
          });
        }

        // Permission checks for building documents
        // console.log(`🏢 [BUILDING UPLOAD] Checking permissions for role: ${userRole}`);
        
        if (userRole === 'manager') {
          // console.log(`🏢 [BUILDING UPLOAD] Manager permission check for building ${buildingId}`);
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId =
            organizations.length > 0 ? organizations[0].organizationId : undefined;
          // console.log(`🏢 [BUILDING UPLOAD] Manager organization: ${organizationId}`);
          
          const building = await storage.getBuilding(buildingId);
          // console.log(`🏢 [BUILDING UPLOAD] Building organization: ${building?.organizationId}`);
          
          if (!building || building.organizationId !== organizationId) {
            // console.log(`❌ [BUILDING UPLOAD] Manager permission denied - organization mismatch`);
            return res
              .status(403)
              .json({ message: 'Cannot assign document to building outside your organization' });
          }
          // console.log(`✅ [BUILDING UPLOAD] Manager permission check passed`);
        }

        if (userRole === 'resident') {
          // console.log(`🏢 [BUILDING UPLOAD] Resident permission check for building ${buildingId}`);
          const residences = await storage.getUserResidences(userId);
          // console.log(`🏢 [BUILDING UPLOAD] User residences count: ${residences.length}`);
          
          const hasResidenceInBuilding = await Promise.all(
            residences.map(async (ur) => {
              const residence = await storage.getResidence(ur.residenceId);
              const isInBuilding = residence && residence.buildingId === buildingId;
              // console.log(`🏢 [BUILDING UPLOAD] Residence ${ur.residenceId} in building ${buildingId}: ${isInBuilding}`);
              return isInBuilding;
            })
          );

          if (!hasResidenceInBuilding.some(Boolean)) {
            // console.log(`❌ [BUILDING UPLOAD] Resident permission denied - no residence in building`);
            return res
              .status(403)
              .json({ message: 'Cannot assign document to building where you have no residence' });
          }
          // console.log(`✅ [BUILDING UPLOAD] Resident permission check passed`);
        }

        // Create unified document instead of separate building document
        const unifiedDocument: InsertDocument = {
          name: validatedData.name || 'Untitled',
          description: validatedData.description,
          documentType: validatedData.documentType,
          filePath: validatedData.filePath || `temp-path-${Date.now()}`,
          fileName: validatedData.fileName,
          fileSize: validatedData.fileSize,
          mimeType: validatedData.mimeType,
          isVisibleToTenants: validatedData.isVisibleToTenants || false,
          isQuarantined: false, // Building documents are validated and safe
          residenceId: undefined,
          buildingId: validatedData.buildingId,
          uploadedById: validatedData.uploadedById,
        };

        // console.log(`🏢 [BUILDING UPLOAD] Creating document in database:`, {
        //   name: unifiedDocument.name,
        //   documentType: unifiedDocument.documentType,
        //   filePath: unifiedDocument.filePath,
        //   buildingId: unifiedDocument.buildingId,
        //   uploadedById: unifiedDocument.uploadedById
        // });

        const document = await storage.createDocument(unifiedDocument);
        // console.log(`✅ [BUILDING UPLOAD] Document created successfully with ID: ${document.id}`);

        // File has been moved to permanent location, no cleanup needed

        res.status(201).json({
          ...document,
          documentCategory: 'building',
          entityType: 'building',
          entityId: document.buildingId,
        });
      } else if (finalDocumentRecordType === 'resident') {
        // console.log(`🏠 [RESIDENCE UPLOAD] Processing residence document for residence ID: ${residenceId}`);
        
        // Validate and create resident document
        if (!residenceId) {
          // console.log(`❌ [RESIDENCE UPLOAD] Missing residenceId`);
          return res
            .status(400)
            .json({ message: 'residenceId is required for resident documents' });
        }

        // Prepare the permanent file path and move file if needed
        let filePath: string;
        let fileName: string | undefined;
        
        if (req.file) {
          // console.log(`🏠 [RESIDENCE UPLOAD] Processing file upload for residence ${residenceId}`);
          
          // Generate unique filename with sanitization and move to permanent location
          const unsanitizedFileName = `${uuidv4()}-${req.file.originalname}`;
          fileName = sanitizeFilePath(unsanitizedFileName);
          const permanentDir = path.join(process.cwd(), 'uploads', 'residences', residenceId);
          
          // console.log(`🏠 [RESIDENCE UPLOAD] File paths:`, {
          //   originalName: req.file.originalname,
          //   newFileName: fileName,
          //   tempPath: req.file.path,
          //   permanentDir,
          //   directoryExists: fs.existsSync(permanentDir)
          // });
          
          // Ensure directory exists
          if (!fs.existsSync(permanentDir)) {
            // console.log(`🏠 [RESIDENCE UPLOAD] Creating directory: ${permanentDir}`);
            fs.mkdirSync(permanentDir, { recursive: true });
          }
          
          // Move file from temporary to permanent location (copy + delete for cross-filesystem)
          const permanentPath = path.join(permanentDir, fileName);
          // console.log(`🏠 [RESIDENCE UPLOAD] Copying file from ${req.file.path} to ${permanentPath}`);
          fs.copyFileSync(req.file.path, permanentPath);
          // console.log(`🏠 [RESIDENCE UPLOAD] Cleaning up temporary file: ${req.file.path}`);
          fs.unlinkSync(req.file.path); // Clean up temporary file
          filePath = `residences/${residenceId}/${fileName}`;
          // console.log(`🏠 [RESIDENCE UPLOAD] File successfully moved to: ${filePath}`);
        } else {
          // console.log(`🏠 [RESIDENCE UPLOAD] No file provided, creating placeholder path`);
          filePath = `temp-path-${Date.now()}`;
        }

        // Convert string boolean fields to actual booleans for validation
        const isVisibleToTenants = otherData.isVisibleToTenants === 'true' || otherData.isVisibleToTenants === true;
        
        const dataToValidate = {
          ...otherData,
          residenceId,
          uploadedById: userId,
          filePath,
          fileName,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          documentType: documentType || type || 'other', // Default to 'other' if not provided
          isVisibleToTenants, // Use converted boolean value
        };
        
        // console.log('🔍 Residence document validation debug:', {
        //   dataToValidate,
        //   documentType,
        //   otherDataKeys: Object.keys(otherData),
        //   hasFile: !!req.file
        // });
        
        let validatedData;
        try {
          validatedData = insertDocumentSchema.parse(dataToValidate);
          // console.log('✅ Residence document validation SUCCESS');
        } catch (validationError) {
          // console.log('❌ Residence document validation ERROR:', validationError);
          return res.status(400).json({ 
            message: 'Validation failed', 
            error: validationError.message || 'Invalid data',
            details: validationError.issues || validationError
          });
        }

        // Fetch residence to get buildingId for access control
        const residence = await storage.getResidence(residenceId);
        if (!residence) {
          return res.status(404).json({ message: 'Residence not found' });
        }

        // Permission checks for resident documents
        if (userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId =
            organizations.length > 0 ? organizations[0].organizationId : undefined;
          const building = await storage.getBuilding(residence.buildingId);
          if (!building || building.organizationId !== organizationId) {
            return res
              .status(403)
              .json({ message: 'Cannot assign document to residence outside your organization' });
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

        // Convert to unified document format with buildingId from residence
        const unifiedDocument: InsertDocument = {
          name: validatedData.name || 'Untitled',
          description: validatedData.description,
          documentType: validatedData.documentType,
          filePath: validatedData.filePath || `temp-path-${Date.now()}`,
          fileName: validatedData.fileName,
          fileSize: validatedData.fileSize,
          mimeType: validatedData.mimeType,
          isVisibleToTenants: validatedData.isVisibleToTenants || false,
          isQuarantined: false, // Resident documents are validated and safe
          residenceId: validatedData.residenceId,
          buildingId: residence.buildingId,
          uploadedById: validatedData.uploadedById,
        };

        const document = await storage.createDocument(unifiedDocument) ;

        // console.log('📝 Created resident document:', document);
        // console.log('📝 DocumentRecord ID:', document.id);

        const response = {
          ...document,
          documentCategory: 'resident',
          entityType: 'residence',
          entityId: document.residenceId,
        };

        // console.log('📤 Sending response:', response);
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
          // console.warn('⚠️ Failed to cleanup temporary file:', cleanupError);
        }
      }

      // console.error('❌ Error creating document:', _error);
      
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
    // console.log(`📝 [DOCUMENT UPDATE] Starting update for document ID: ${req.params.id}`);
    // console.log(`📝 [DOCUMENT UPDATE] User: ${req.user.id} (${req.user.role})`);
    // console.log(`📝 [DOCUMENT UPDATE] Body:`, req.body);
    // console.log(`📝 [DOCUMENT UPDATE] File provided:`, !!req.file);
    
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;

      // Get existing document first to check permissions and get current file path
      // FIXED: Pass userId and userRole to enable optimized query path
      const existingDocument = await storage.getDocuments({ userId, userRole }).then(docs => docs.find(doc => doc.id === documentId));
      
      if (!existingDocument) {
        // console.log(`❌ [DOCUMENT UPDATE] Document not found: ${documentId}`);
        return res.status(404).json({ message: 'Document not found' });
      }

      // console.log(`📝 [DOCUMENT UPDATE] Existing document:`, {
      //   id: existingDocument.id,
      //   name: existingDocument.name,
      //   filePath: existingDocument.filePath,
      //   buildingId: existingDocument.buildingId,
      //   residenceId: existingDocument.residenceId
      // });

      // Check permissions (similar to view permissions)
      let hasAccess = false;
      if (userRole === 'admin') {
        hasAccess = true;
        // console.log(`✅ [DOCUMENT UPDATE] Admin access granted`);
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
        // console.log(`📝 [DOCUMENT UPDATE] Manager access: ${hasAccess}`);
      }

      if (!hasAccess) {
        // console.log(`❌ [DOCUMENT UPDATE] Access denied for user ${userId}`);
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

      // console.log(`📝 [DOCUMENT UPDATE] Update data:`, updateData);

      // Handle file replacement if provided
      if (req.file) {
        // console.log(`📝 [DOCUMENT UPDATE] Processing file replacement:`, {
        //   originalname: req.file.originalname,
        //   size: req.file.size,
        //   mimetype: req.file.mimetype,
        //   tempPath: req.file.path
        // });

        // Validate the file
        const fileValidation = validateFile(req.file);
        if (!fileValidation.isValid) {
          // Clean up temp file
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            // console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
          }
          return res.status(400).json({ message: fileValidation.error });
        }

        // Generate unique file path with sanitization
        const fileExtension = path.extname(req.file.originalname);
        const baseFileName = path.basename(req.file.originalname, fileExtension);
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const unsanitizedFileName = `${uniqueId}-${baseFileName}${fileExtension}`;
        const uniqueFileName = sanitizeFilePath(unsanitizedFileName);
        const entityType = existingDocument.buildingId ? 'buildings' : 'residences';
        const entityId = existingDocument.buildingId || existingDocument.residenceId;
        
        const documentsDir = path.join(process.cwd(), 'uploads', entityType, entityId || 'general');
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
        updateData.fileName = uniqueFileName;
        updateData.fileSize = req.file.size;
        updateData.mimeType = req.file.mimetype;

        // console.log(`✅ [DOCUMENT UPDATE] File stored at: ${finalPath}`);

        // Clean up old file if it exists
        if (existingDocument.filePath) {
          const oldFilePath = path.isAbsolute(existingDocument.filePath) 
            ? existingDocument.filePath 
            : path.join(process.cwd(), 'uploads', existingDocument.filePath);
          
          try {
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              // console.log(`🗑️ [DOCUMENT UPDATE] Cleaned up old file: ${oldFilePath}`);
            }
          } catch (cleanupError) {
            // console.warn('⚠️ Failed to cleanup old file:', cleanupError);
          }
        }
      }

      // Update the document
      const updatedDocument = await storage.updateDocument(documentId, updateData);

      if (!updatedDocument) {
        // console.log(`❌ [DOCUMENT UPDATE] Failed to update document: ${documentId}`);
        return res.status(404).json({ message: 'Failed to update document' });
      }

      // console.log(`✅ [DOCUMENT UPDATE] Document updated successfully:`, {
      //   id: (updatedDocument as any).id,
      //   name: (updatedDocument as any).name
      // });

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
          // console.log(`🗑️ [DOCUMENT UPDATE] Cleaned up temp file on error: ${req.file.path}`);
        } catch (cleanupError) {
          // console.warn('⚠️ Failed to cleanup temporary file:', cleanupError);
        }
      }

      // console.error('❌ Error updating document:', _error);
      
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
      // console.error('Error accessing audit log:', error);
      res.status(500).json({ message: 'Failed to retrieve audit log' });
    }
  });
  
  // Delete document with comprehensive security checks and audit logging
  app.delete('/api/documents/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const operationId = `delete-${documentId}-${Date.now()}`;

      logDocumentOperation('DELETE_ATTEMPT', {
        operationId,
        documentId,
        userId,
        userRole,
        timestamp: new Date().toISOString()
      }, 'INFO');

      // SECURITY CHECK 1: Role-based access control - admin, manager, and resident can delete documents
      if (!['admin', 'manager', 'resident'].includes(userRole)) {
        logSecurityEvent('UNAUTHORIZED_DELETE_ATTEMPT', user, false, documentId, { 
          operationId,
          requiredRoles: ['admin', 'manager', 'resident'],
          attemptedRole: userRole
        });
        logDocumentOperation('DELETE_DENIED_INSUFFICIENT_ROLE', {
          operationId,
          documentId,
          userRole,
          requiredRoles: ['admin', 'manager', 'resident']
        }, 'WARN');
        return res.status(403).json({ 
          message: 'Insufficient permissions. Only administrators, managers, and residents can delete documents.' 
        });
      }

      // SECURITY CHECK 2: Document existence and ownership verification
      let document;
      try {
        // Get all documents the user has access to and find the specific one
        const documents = await storage.getDocuments({
          userId,
          userRole,
        });
        document = documents.find((doc) => doc.id === documentId);
      } catch (error: any) {
        logSecurityEvent('DELETE_ERROR_DOCUMENT_LOOKUP', user, false, documentId, { 
          operationId,
          error: error.message 
        });
        // console.error('❌ Error looking up document for deletion:', error);
        return res.status(500).json({ message: 'Error verifying document access' });
      }

      if (!document) {
        logSecurityEvent('DELETE_ATTEMPT_NONEXISTENT_DOCUMENT', user, false, documentId, { 
          operationId 
        });
        logDocumentOperation('DELETE_DENIED_DOCUMENT_NOT_FOUND', {
          operationId,
          documentId,
          userId,
          userRole
        }, 'WARN');
        return res.status(404).json({ message: 'Document not found or access denied' });
      }

      // SECURITY CHECK 3: Organization membership verification
      const organizations = await storage.getUserOrganizations(userId);
      const userOrganizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;

      if (!userOrganizationId) {
        logSecurityEvent('DELETE_DENIED_NO_ORGANIZATION', user, false, documentId, { 
          operationId 
        });
        return res.status(403).json({ message: 'User must belong to an organization to delete documents' });
      }

      // SECURITY CHECK 4: Building/Residence access verification
      let documentOrganizationId: string | undefined;

      if (document.buildingId) {
        try {
          const building = await storage.getBuilding(document.buildingId);
          if (!building) {
            logSecurityEvent('DELETE_DENIED_BUILDING_NOT_FOUND', user, false, documentId, { 
              operationId,
              buildingId: document.buildingId 
            });
            return res.status(404).json({ message: 'Associated building not found' });
          }
          documentOrganizationId = building.organizationId;
        } catch (error: any) {
          logSecurityEvent('DELETE_ERROR_BUILDING_LOOKUP', user, false, documentId, { 
            operationId,
            buildingId: document.buildingId,
            error: error.message 
          });
          return res.status(500).json({ message: 'Error verifying building access' });
        }
      } else if (document.residenceId) {
        try {
          const residence = await storage.getResidence(document.residenceId);
          if (!residence) {
            logSecurityEvent('DELETE_DENIED_RESIDENCE_NOT_FOUND', user, false, documentId, { 
              operationId,
              residenceId: document.residenceId 
            });
            return res.status(404).json({ message: 'Associated residence not found' });
          }
          const building = await storage.getBuilding(residence.buildingId);
          if (!building) {
            logSecurityEvent('DELETE_DENIED_RESIDENCE_BUILDING_NOT_FOUND', user, false, documentId, { 
              operationId,
              residenceId: document.residenceId,
              buildingId: residence.buildingId 
            });
            return res.status(404).json({ message: 'Associated building for residence not found' });
          }
          documentOrganizationId = building.organizationId;
        } catch (error: any) {
          logSecurityEvent('DELETE_ERROR_RESIDENCE_LOOKUP', user, false, documentId, { 
            operationId,
            residenceId: document.residenceId,
            error: error.message 
          });
          return res.status(500).json({ message: 'Error verifying residence access' });
        }
      } else {
        logSecurityEvent('DELETE_DENIED_NO_BUILDING_OR_RESIDENCE', user, false, documentId, { 
          operationId 
        });
        return res.status(400).json({ message: 'Document must be associated with a building or residence' });
      }

      // SECURITY CHECK 5: Organization access verification (admin bypass allowed)
      if (userRole !== 'admin' && documentOrganizationId !== userOrganizationId) {
        logSecurityEvent('DELETE_DENIED_ORGANIZATION_MISMATCH', user, false, documentId, { 
          operationId,
          userOrganizationId,
          documentOrganizationId 
        });
        logDocumentOperation('DELETE_DENIED_CROSS_ORGANIZATION_ACCESS', {
          operationId,
          documentId,
          userId,
          userRole,
          userOrganizationId,
          documentOrganizationId
        }, 'WARN');
        return res.status(403).json({ 
          message: 'Cannot delete document outside your organization' 
        });
      }

      // Log admin cross-organization access for audit purposes
      if (userRole === 'admin' && documentOrganizationId !== userOrganizationId) {
        logSecurityEvent('ADMIN_CROSS_ORGANIZATION_DELETE', user, true, documentId, { 
          operationId,
          userOrganizationId,
          documentOrganizationId,
          justification: 'Admin privilege bypass'
        });
        logDocumentOperation('ADMIN_BYPASS_ORGANIZATION_CHECK', {
          operationId,
          documentId,
          userId,
          userRole,
          userOrganizationId,
          documentOrganizationId,
          action: 'Cross-organization delete authorized via admin privilege'
        }, 'INFO');
      }

      // SECURITY CHECK 6: Manager-specific building access verification
      if (userRole === 'manager') {
        if (document.buildingId) {
          // Manager can only delete documents for buildings in their organization (already verified above)
          logDocumentOperation('DELETE_AUTHORIZED_MANAGER_BUILDING', {
            operationId,
            documentId,
            buildingId: document.buildingId,
            userId,
            organizationId: userOrganizationId
          }, 'DEBUG');
        } else if (document.residenceId) {
          // Manager can delete residence documents if the residence building is in their organization
          logDocumentOperation('DELETE_AUTHORIZED_MANAGER_RESIDENCE', {
            operationId,
            documentId,
            residenceId: document.residenceId,
            userId,
            organizationId: userOrganizationId
          }, 'DEBUG');
        }
      }

      // SECURITY CHECK 7: Resident-specific residence access verification
      if (userRole === 'resident') {
        if (document.residenceId) {
          // Resident can only delete documents from residences they have access to
          const userResidences = await storage.getUserResidences(userId);
          const userResidenceIds = userResidences.map(ur => ur.residenceId);
          
          if (!userResidenceIds.includes(document.residenceId)) {
            logSecurityEvent('DELETE_DENIED_RESIDENCE_ACCESS', user, false, documentId, { 
              operationId,
              residenceId: document.residenceId,
              userResidenceIds
            });
            logDocumentOperation('DELETE_DENIED_RESIDENT_RESIDENCE_ACCESS', {
              operationId,
              documentId,
              residenceId: document.residenceId,
              userId,
              userResidenceIds
            }, 'WARN');
            return res.status(403).json({ 
              message: 'Cannot delete documents from residences you do not have access to' 
            });
          }
          
          logDocumentOperation('DELETE_AUTHORIZED_RESIDENT_RESIDENCE', {
            operationId,
            documentId,
            residenceId: document.residenceId,
            userId
          }, 'DEBUG');
        } else if (document.buildingId) {
          // Residents cannot delete building-level documents
          logSecurityEvent('DELETE_DENIED_RESIDENT_BUILDING_DOCUMENT', user, false, documentId, { 
            operationId,
            buildingId: document.buildingId
          });
          logDocumentOperation('DELETE_DENIED_RESIDENT_CANNOT_DELETE_BUILDING_DOCS', {
            operationId,
            documentId,
            buildingId: document.buildingId,
            userId
          }, 'WARN');
          return res.status(403).json({ 
            message: 'Residents can only delete documents from their own residences, not building-level documents' 
          });
        }
      }

      // All security checks passed - proceed with deletion
      logSecurityEvent('DELETE_AUTHORIZED', user, true, documentId, { 
        operationId,
        documentType: document.documentType,
        buildingId: document.buildingId,
        residenceId: document.residenceId,
        organizationId: userOrganizationId
      });

      // Attempt to delete the document
      let deleted = false;
      try {
        deleted = await storage.deleteDocument(documentId);
      } catch (deleteError: any) {
        logSecurityEvent('DELETE_ERROR_STORAGE_FAILURE', user, false, documentId, { 
          operationId,
          error: deleteError.message 
        });
        // console.error('❌ Error deleting document from storage:', deleteError);
        return res.status(500).json({ message: 'Failed to delete document from storage' });
      }

      if (!deleted) {
        logSecurityEvent('DELETE_FAILED_NOT_FOUND_IN_STORAGE', user, false, documentId, { 
          operationId 
        });
        return res.status(404).json({ message: 'Document not found in storage' });
      }

      // Successful deletion
      logSecurityEvent('DELETE_SUCCESS', user, true, documentId, { 
        operationId,
        documentName: document.name,
        documentType: document.documentType,
        buildingId: document.buildingId,
        residenceId: document.residenceId
      });
      
      logDocumentOperation('DELETE_COMPLETED', {
        operationId,
        documentId,
        documentName: document.name,
        userId,
        userRole,
        organizationId: userOrganizationId,
        timestamp: new Date().toISOString()
      }, 'INFO');

      res.status(204).send();
    } catch (error: any) {
      logSecurityEvent('DELETE_ERROR_UNEXPECTED', req.user, false, req.params.id, { 
        error: error.message,
        stack: error.stack 
      });
      // console.error('❌ Unexpected error in document deletion:', error);
      res.status(500).json({ message: 'Failed to delete document due to unexpected error' });
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

        // console.log('📤 Upload request received:', {
        //   documentId,
        //   userId,
        //   userRole,
        //   hasFile: !!req.file,
        //   fileInfo: req.file
        //     ? {
        //         fieldname: req.file.fieldname,
        //         originalname: req.file.originalname,
        //         encoding: req.file.encoding,
        //         mimetype: req.file.mimetype,
        //         size: req.file.size,
        //         path: req.file.path,
        //       }
        //     : null,
        //   bodyKeys: Object.keys(req.body),
        //   contentType: req.headers['content-type'],
        // });

        // Validate permissions - only admin, manager, and resident can create documents
        if (!['admin', 'manager', 'resident'].includes(userRole)) {
          return res.status(403).json({ message: 'Insufficient permissions to create documents' });
        }

        if (!req.file) {
          // console.error('❌ No file received in upload request');
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

        // Update document with file information (with sanitized filename)
        const sanitizedName = sanitizeFilePath(req.file.originalname);
        const updatedDocument = await storage.updateDocument(documentId, {
          filePath: `prod_org_${organizationId}/${sanitizedName}`,
          name: sanitizedName,
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
        // console.error(`[${errorTimestamp}] Error type:`, error.constructor.name);
        // console.error(`[${errorTimestamp}] Error message:`, error.message);
        // console.error(`[${errorTimestamp}] Error stack:`, error.stack);

        // Clean up temporary file on error
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            // console.error(`[${errorTimestamp}] Error cleaning up file:`, cleanupError);
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

  // Helper function to handle text document creation
  async function handleTextDocumentCreation(req: any, res: any, timestamp: string) {
    try {
      // console.log(`[${timestamp}] 📝 Starting text document creation process`);
      
      const userId = req.user?.id;
      if (!userId) {
        // console.log(`[${timestamp}] ❌ User not authenticated`);
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const { textContent, name, description, documentType, attachedToType, attachedToId, buildingId, residenceId, isVisibleToTenants, effectiveDate } = req.body;
      
      // console.log(`[${timestamp}] 🔍 Text document data:`, {
      //   textContentLength: textContent?.length,
      //   name,
      //   description,
      //   documentType,
      //   attachedToType,
      //   attachedToId,
      //   buildingId,
      //   residenceId,
      //   isVisibleToTenants,
      //   userId
      // });
      
      // Validate required fields
      if (!textContent || !name) {
        // console.log(`[${timestamp}] ❌ Missing required fields: textContent=${!!textContent}, name=${!!name}`);
        return res.status(400).json({ message: 'Text content and name are required for text documents' });
      }
      
      // Create unique filename and path for text document
      const fileName = `${uuidv4()}-text-document.txt`;
      
      // Determine storage path
      let storagePath: string;
      if (attachedToType && attachedToId) {
        storagePath = `text-documents/${attachedToType}/${attachedToId}`;
      } else if (buildingId) {
        storagePath = `text-documents/buildings/${buildingId}`;
      } else if (residenceId) {
        storagePath = `text-documents/residences/${residenceId}`;
      } else {
        storagePath = `text-documents/general`;
      }
      
      // Create directory structure
      const fullStoragePath = path.join(process.cwd(), 'uploads', storagePath);
      // console.log(`[${timestamp}] 📁 Creating storage directory: ${fullStoragePath}`);
      
      try {
        if (!fs.existsSync(fullStoragePath)) {
          fs.mkdirSync(fullStoragePath, { recursive: true });
          // console.log(`[${timestamp}] ✅ Created storage directory successfully`);
        }
      } catch (dirError) {
        // console.error(`[${timestamp}] ❌ Error creating storage directory:`, dirError);
        return res.status(500).json({ message: 'Failed to create storage directory' });
      }
      
      // Write text content to file
      const fullFilePath = path.join(fullStoragePath, fileName);
      try {
        fs.writeFileSync(fullFilePath, textContent, 'utf8');
        // console.log(`[${timestamp}] ✅ Text file written successfully: ${fullFilePath}`);
      } catch (fileError) {
        // console.error(`[${timestamp}] ❌ Error writing text file:`, fileError);
        return res.status(500).json({ message: 'Failed to save text document to filesystem' });
      }
      
      // Prepare document data for database
      const documentData: InsertDocument = {
        name,
        description: description || textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''),
        documentType: documentType || 'other',
        filePath: `${storagePath}/${fileName}`,
        isVisibleToTenants: isVisibleToTenants === 'true' || isVisibleToTenants === true,
        isQuarantined: false, // Text documents are safe by default
        residenceId: residenceId || undefined,
        buildingId: buildingId || undefined,
        attachedToType: attachedToType || undefined,
        attachedToId: attachedToId || undefined,
        uploadedById: userId,
        effectiveDate: effectiveDate,
      };
      
      // console.log(`[${timestamp}] 💾 Creating document record in database:`, {
      //   ...documentData,
      //   textContentLength: textContent.length
      // });
      
      // Create document record in database
      const document = await storage.createDocument(documentData);
      
      // console.log(`[${timestamp}] ✅ Text document created successfully:`, {
      //   documentId: document.id,
      //   name: document.name,
      //   filePath: document.filePath,
      //   attachedToType: document.attachedToType,
      //   attachedToId: document.attachedToId
      // });
      
      return res.status(201).json({
        message: 'Text document created successfully',
        document: {
          ...document,
          title: document.name,
          category: document.documentType,
        },
      });
      
    } catch (error: any) {
      // console.error(`[${timestamp}] ❌ Error in handleTextDocumentCreation:`, error);
      
      // Log detailed error information
      const errorEntry = {
        timestamp,
        error: error.message,
        stack: error.stack,
        type: error.constructor.name,
        userId: req.user?.id,
        requestBody: req.body
      };
      
      // console.error(`[${timestamp}] 💥 Detailed error info:`, errorEntry);
      
      return res.status(500).json({ 
        message: 'Failed to create text document',
        error: error.message,
        timestamp 
      });
    }
  }

  // POST /api/documents/upload - Upload file to GCS and create unified document record
  app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req: any, res) => {
    const timestamp = new Date().toISOString();
    // console.log(`[${timestamp}] 📋 POST /api/documents/upload - Starting upload`, {
    //   hasFile: !!req.file,
    //   fileName: req.file?.originalname,
    //   fileSize: req.file?.size,
    //   body: req.body,
    //   userId: req.user?.id
    // });
    
    try {
      // Check if we have either a file or text content
      const hasFile = !!req.file;
      const hasTextContent = !!req.body.textContent;
      
      if (!hasFile && !hasTextContent) {
        // console.log(`[${timestamp}] ❌ No file or text content provided`);
        return res.status(400).json({ message: 'Either a file or text content is required' });
      }
      
      // Handle text document creation
      if (!hasFile && hasTextContent) {
        // console.log(`[${timestamp}] 📝 Processing text document creation`);
        return await handleTextDocumentCreation(req, res, timestamp);
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
        effectiveDate: req.body.effectiveDate || undefined,
      };

      // Production debugging: Log form data before validation
      if (process.env.NODE_ENV === 'production') {
        // console.log('[PROD DEBUG] Form data before validation:', formData);
      }

      // Validate form data
      const validatedData = uploadDocumentRecordSchema.parse(formData);
      
      // DEBUG: Log validated data to see what's being passed
      // console.log(`[${timestamp}] 🔍 VALIDATION DEBUG: Form data before validation:`, formData);
      // console.log(`[${timestamp}] 🔍 VALIDATION DEBUG: Validated data:`, {
      //   ...validatedData,
      //   hasAttachedToType: !!validatedData.attachedToType,
      //   hasAttachedToId: !!validatedData.attachedToId
      // });
      
      // Production debugging: Log after validation
      if (process.env.NODE_ENV === 'production') {
        // console.log('[PROD DEBUG] Form data validation passed:', validatedData);
      }

      // Get user info from auth middleware
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Fetch buildingId from residence if residenceId is provided
      let actualBuildingId = validatedData.buildingId;
      if (validatedData.residenceId && !actualBuildingId) {
        const residence = await storage.getResidence(validatedData.residenceId);
        if (!residence) {
          return res.status(404).json({ message: 'Residence not found' });
        }
        actualBuildingId = residence.buildingId;
      }

      // GCS DISABLED: Skip bucket configuration (using local storage only)
      // console.log('📁 GCS disabled - skipping bucket configuration check');

      // Generate unique file path with sanitized filename
      const fileExtension = path.extname(req.file.originalname);
      const baseFileName = path.basename(req.file.originalname, fileExtension);
      const unsanitizedName = `${uuidv4()}-${baseFileName}${fileExtension}`;
      
      // Sanitize filename to prevent path traversal and ensure consistent naming
      const sanitizedFileName = sanitizeFilePath(unsanitizedName);

      let filePath: string;
      if (validatedData.residenceId) {
        filePath = `residences/${validatedData.residenceId}/${sanitizedFileName}`;
      } else if (actualBuildingId) {
        filePath = `buildings/${actualBuildingId}/${sanitizedFileName}`;
      } else {
        filePath = `general/${sanitizedFileName}`;
      }

      // DISABLED GCS: Force local storage for all environments
      // console.log('📁 GCS disabled - using local storage for all document operations');
      
      // Always use local storage (GCS disabled)
      try {
        // Use local storage with robust error handling
        const localStoragePath = path.join(process.cwd(), 'uploads');
        
        // Ensure uploads directory exists
        try {
          if (!fs.existsSync(localStoragePath)) {
            fs.mkdirSync(localStoragePath, { recursive: true });
            // console.log(`📁 Created uploads directory: ${localStoragePath}`);
          }
        } catch (dirError) {
          // console.error('Failed to create uploads directory:', dirError);
          throw new Error('Cannot create uploads directory - check permissions');
        }

        // Create directory structure for file
        const localFilePath = path.join(localStoragePath, filePath);
        const localFileDir = path.dirname(localFilePath);
        
        try {
          if (!fs.existsSync(localFileDir)) {
            fs.mkdirSync(localFileDir, { recursive: true });
            // console.log(`📁 Created subdirectory: ${localFileDir}`);
          }
        } catch (subdirError) {
          // console.error('Failed to create file subdirectory:', subdirError);
          throw new Error('Cannot create file directory - check permissions');
        }

        // Copy uploaded file to local storage
        try {
          fs.copyFileSync(req.file!.path, localFilePath);
          // File saved successfully
        } catch (copyError) {
          // console.error('Failed to copy file:', copyError);
          throw new Error('Cannot save file - check disk space and permissions');
        }
      } catch (localError) {
        // console.error('Local storage error:', localError);
        throw new Error('Failed to save file locally');
      }

      // Create document record in database with buildingId from residence if applicable
      const documentData: InsertDocument = {
        name: validatedData.name,
        description: validatedData.description,
        documentType: validatedData.documentType,
        filePath: filePath,
        isVisibleToTenants: validatedData.isVisibleToTenants,
        isQuarantined: false, // File uploads are validated and safe
        residenceId: validatedData.residenceId,
        buildingId: actualBuildingId,
        uploadedById: userId,
        attachedToType: validatedData.attachedToType,
        attachedToId: validatedData.attachedToId,
        effectiveDate: validatedData.effectiveDate,
      };

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
          // console.error('Error cleaning up temporary file:', cleanupError);
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

      // OPTIMIZED: Use single query to get user access scope instead of 3 separate queries
      const permissionLoadStart = performance.now();
      const { getUserAccessScope } = await import('../db/queries/optimized-document-queries');
      const scope = await getUserAccessScope(userId, userRole);
      const permissionLoadTime = performance.now() - permissionLoadStart;
      
      logDocumentOperation('PERMISSION_DATA_LOADED_OPTIMIZED', {
        operationId,
        loadTime: `${permissionLoadTime.toFixed(2)}ms`,
        dataStats: {
          organizationsCount: scope.organizationIds.length,
          buildingsCount: scope.buildingIds.length,
          residencesCount: scope.residenceIds.length
        },
        optimization: 'Single CTE query replaced 3 separate queries'
      }, 'DEBUG');
      
      // For backward compatibility
      const organizations = scope.organizationIds.map(id => ({ organizationId: id }));
      const residences = scope.residenceIds.map(id => ({ residenceId: id }));
      const buildings = scope.buildingIds.map(id => ({ id }));

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

      // Enhanced document lookup with performance tracking - FIXED to use Drizzle for proper camelCase mapping
      const documentLookupStart = performance.now();
      let document;
      try {
        document = await db.query.documents.findFirst({ 
          where: eq(documents.id, documentId) 
        });
      } catch (dbError: any) {
        const totalTime = performance.now() - startTime;
        logDocumentOperation('DATABASE_CONNECTION_ERROR', {
          operationId,
          documentId,
          error: dbError.message,
          errorCode: dbError.code,
          totalRequestTime: `${totalTime.toFixed(2)}ms`,
          errorDetails: {
            name: dbError.name,
            severity: dbError.severity
          }
        }, 'ERROR');
        // console.error('❌ [DOCUMENT DATABASE] Database connection error:', dbError);
        return res.status(503).json({ 
          message: 'Database temporarily unavailable. Please try again in a moment.',
          error: 'DB_CONNECTION_FAILED'
        });
      }
      const documentLookupTime = performance.now() - documentLookupStart;
      
      logDocumentOperation('DOCUMENT_LOOKUP', {
        operationId,
        documentId,
        lookupTime: `${documentLookupTime.toFixed(2)}ms`,
        documentFound: !!document,
        documentInfo: document ? {
          id: document.id,
          name: document.name,
          filePath: document.filePath,
          buildingId: document.buildingId
        } : null
      }, 'DEBUG');

      if (!document) {
        logDocumentOperation('DOCUMENT_NOT_FOUND', {
          operationId,
          documentId
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

      // OPTIMIZED: Building IDs already loaded from scope query, no need for additional queries
      const userBuildingIds = scope.buildingIds;

      // Check permissions based on the specified rules
      let hasAccess = false;
      let accessReason = '';

      if (userRole === 'admin') {
        hasAccess = true;
        accessReason = 'Admin has global access';
      } else if (userRole === 'manager' || userRole === 'demo_manager') {
        // Manager should have access to buildings they are assigned to
        if (document.buildingId) {
          if (userBuildingIds.includes(document.buildingId)) {
            hasAccess = true;
            accessReason = 'Manager has access to organization buildings';
          }
        }
        
        // Manager has access to all residences in their organization
        if (document.residenceId) {
          if (scope.residenceIds.includes(document.residenceId)) {
            hasAccess = true;
            accessReason = 'Manager has access to organization residences';
          }
        }
      } else if (userRole === 'resident' || userRole === 'demo_resident') {
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
      } else if (userRole === 'tenant' || userRole === 'demo_tenant') {
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

      // Check if document is quarantined
      if (document.isQuarantined) {
        logDocumentOperation('DOCUMENT_QUARANTINED', {
          operationId,
          documentId,
          documentName: document.name
        }, 'WARN');
        
        return res.status(410).json({ 
          message: 'Document quarantined or unavailable',
          reason: 'This document has been quarantined and is not accessible'
        });
      }

      // Serve from local storage
      if (document.filePath) {
        try {
          // SECURITY: Properly sanitize file path to prevent directory traversal
          let cleanFilePath: string;
          try {
            cleanFilePath = sanitizeFilePath(document.filePath);
            
            logSecurityEvent('FILE_PATH_SANITIZED', user, true, documentId, {
              originalPath: document.filePath,
              sanitizedPath: cleanFilePath
            });
          } catch (sanitizationError: any) {
            logSecurityEvent('FILE_PATH_SANITIZATION_FAILED', user, false, documentId, {
              originalPath: document.filePath,
              error: sanitizationError.message
            });
            return res.status(400).json({ 
              message: 'Invalid file path',
              error: 'File path contains invalid characters'
            });
          }
          
          // Remove leading 'uploads/' if it exists to prevent double-prefix
          if (cleanFilePath.startsWith('uploads/')) {
            cleanFilePath = cleanFilePath.substring('uploads/'.length);
          }
          
          // Handle quarantine paths
          if (cleanFilePath.includes('_quarantine_')) {
            const quarantinePaths = [
              path.join(process.cwd(), 'uploads', cleanFilePath),
              path.join(process.cwd(), cleanFilePath),
            ];
            
            for (const quarantinePath of quarantinePaths) {
              if (fs.existsSync(quarantinePath)) {
                return res.status(410).json({ 
                  message: 'Document quarantined or unavailable',
                  reason: 'This document has been moved to quarantine'
                });
              }
            }
          }

          let filePathToServe = null;

          // SECURITY: Only try safe path combinations - no direct filesystem access
          const baseUploadDir = path.resolve(process.cwd(), 'uploads');
          const tmpUploadDir = '/tmp/uploads';
          
          // Build comprehensive list of possible file locations
          const possiblePaths = [
            // Check /tmp/uploads first (where multer saves files)
            path.join(tmpUploadDir, cleanFilePath),
            // Standard uploads directory
            path.join(baseUploadDir, cleanFilePath),
            // Demo data paths
            path.join(baseUploadDir, 'demo', cleanFilePath),
            path.join(baseUploadDir, 'demo', 'residences', cleanFilePath),
            path.join(baseUploadDir, 'demo', 'buildings', cleanFilePath),
          ];

          // Add quarantine directory paths (legacy files that were quarantined)
          let quarantineDirs: string[] = [];
          try {
            if (fs.existsSync(baseUploadDir)) {
              quarantineDirs = fs.readdirSync(baseUploadDir)
                .filter(dir => dir.startsWith('_quarantine_'))
                .map(dir => path.join(baseUploadDir, dir));
            }
          } catch (e) {
            // If directory doesn't exist or can't be read, continue without quarantine paths
            logDocumentOperation('QUARANTINE_DIR_READ_ERROR', { error: e.message }, 'DEBUG');
          }
          
          for (const quarantineDir of quarantineDirs) {
            // Files in quarantine are in 'directories' subdirectory with original structure
            possiblePaths.push(path.join(quarantineDir, 'directories', cleanFilePath));
          }

          // Add hierarchical organization paths for modern file structure
          // Pattern: {type}/org_{orgId}/building_{buildingId}/residence_{residenceId}/role_{role}/
          if (document.buildingId) {
            const docType = cleanFilePath.split('/')[0]; // e.g., 'bills', 'documents', etc.
            const filename = path.basename(cleanFilePath);
            
            // Search in organization-based hierarchical paths
            let orgDirs: string[] = [];
            try {
              if (fs.existsSync(baseUploadDir)) {
                const allDirs = fs.readdirSync(baseUploadDir);
                orgDirs = allDirs.filter(dir => {
                  // Safely check if directory matches or exists, wrapped in try/catch
                  try {
                    if (dir === docType) return true;
                    const fullPath = path.join(baseUploadDir, dir);
                    return fs.existsSync(fullPath);
                  } catch (e) {
                    // If any error occurs during check, skip this directory
                    return false;
                  }
                });
              }
            } catch (e) {
              // If directory doesn't exist or can't be read, continue without hierarchical paths
              logDocumentOperation('HIERARCHICAL_DIR_READ_ERROR', { error: e.message }, 'DEBUG');
            }
            
            for (const dir of orgDirs) {
              const dirPath = path.join(baseUploadDir, dir);
              
              // Safely check if path is a directory using existsSync + lstatSync with try/catch
              let isDirectory = false;
              try {
                if (fs.existsSync(dirPath)) {
                  const stats = fs.lstatSync(dirPath);
                  isDirectory = stats.isDirectory();
                }
              } catch (e) {
                // If lstatSync fails (ENOENT, ENOTDIR, permission errors), skip this directory
                logDocumentOperation('DIRECTORY_STAT_ERROR', { dirPath, error: e.message }, 'DEBUG');
                continue;
              }
              
              if (isDirectory) {
                // Check for org_* subdirectories
                try {
                  const subDirs = fs.readdirSync(dirPath).filter(d => d.startsWith('org_') || d.startsWith('building_'));
                  for (const subDir of subDirs) {
                    possiblePaths.push(path.join(dirPath, subDir, filename));
                    possiblePaths.push(path.join(dirPath, subDir, `building_${document.buildingId}`, filename));
                    if (document.residenceId) {
                      possiblePaths.push(path.join(dirPath, subDir, `building_${document.buildingId}`, `residence_${document.residenceId}`, filename));
                    }
                  }
                } catch (e) {
                  // Skip if directory read fails
                  logDocumentOperation('SUBDIR_READ_ERROR', { dirPath, error: e.message }, 'DEBUG');
                }
              }
            }
          }

          // Add legacy path patterns for backward compatibility
          const pathVariants = [
            // Legacy uploads/uploads structure
            path.join(baseUploadDir, 'uploads', cleanFilePath),
            path.join(baseUploadDir, 'uploads', 'demo', cleanFilePath),
          ];
          
          possiblePaths.push(...pathVariants);

          logDocumentOperation('PATH_RESOLUTION_START', {
            operationId,
            originalPath: document.filePath,
            cleanedPath: cleanFilePath,
            searchPaths: possiblePaths.length,
            includesQuarantine: quarantineDirs.length > 0
          }, 'DEBUG');

          // Try to find the file in any of these locations
          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              // SECURITY: Strict path validation - only allow files within uploads directory
              const resolvedPath = path.resolve(possiblePath);
              const allowedBaseDirs = [
                path.resolve(process.cwd(), 'uploads'),
                path.resolve(tmpUploadDir)
              ];
              
              // Use path.relative to ensure the file is within one of the allowed directories
              let isPathSafe = false;
              for (const allowedBaseDir of allowedBaseDirs) {
                const relativePath = path.relative(allowedBaseDir, resolvedPath);
                if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
                  isPathSafe = true;
                  break;
                }
              }
              
              if (isPathSafe) {
                filePathToServe = resolvedPath;
                logDocumentOperation('FILE_FOUND', {
                  operationId,
                  resolvedPath: filePathToServe,
                  searchAttempts: possiblePaths.indexOf(possiblePath) + 1
                }, 'DEBUG');
                break;
              } else {
                logDocumentOperation('UNSAFE_PATH_REJECTED', {
                  operationId,
                  rejectedPath: resolvedPath,
                  allowedBaseDirs
                }, 'WARN');
              }
            }
          }

          // Try to serve the file if we found one
          if (filePathToServe && fs.existsSync(filePathToServe)) {
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
          // console.error('❌ [DOCUMENT DOWNLOAD] Error serving file:', fileError);
          return res.status(500).json({ message: 'Failed to serve file' });
        }
      }

      // console.log(`❌ [DOCUMENT DOWNLOAD] No file associated with document ${documentId}`);
      return res.status(404).json({ message: 'No file associated with this document' });
    } catch (error: any) {
      // console.error('❌ [DOCUMENT DOWNLOAD] Error serving document file:', error);
      res.status(500).json({ message: 'Failed to serve document file' });
    }
  });

}
