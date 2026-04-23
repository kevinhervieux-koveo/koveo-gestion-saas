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
import { normalizeFilename } from '../utils/filenameNormalization';
import { documentService, type DocumentType } from '../services/document-service';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';

import { asyncHandler } from '../utils/async-handler';
import { sendDbWriteError } from '../utils/rest-db-error';
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

// Folder mapping for different document types
// This allows easy extension for future document types
const DOCUMENT_FOLDER_MAPPING: Record<string, string> = {
  'inventory_item': 'inventory',
  'maintenance_project': 'projects',
  'submission_vendor': 'projects',
  'demand': 'demands',
  'bill': 'documents', // Bills stay in general documents folder
  // Add more mappings as needed
};

/**
 * Manager-only flag is privileged: only admins/managers may set it on a
 * create or upload request. Residents/tenants who pass `isManagerOnly=true`
 * (whether by mistake, through a tampered form, or via a direct API call)
 * have the flag silently coerced to `false` so they cannot hide their own
 * uploads from other co-owners. The PUT update path enforces the same rule
 * around line 2686.
 */
function resolveManagerOnlyFlag(rawValue: unknown, userRole?: string): boolean {
  const requested = rawValue === 'true' || rawValue === true;
  if (!requested) return false;
  return (
    userRole === 'admin' ||
    userRole === 'manager' ||
    userRole === 'demo_manager'
  );
}

/**
 * Maps attachedToType string to DocumentType for use with documentService
 * @param attachedToType - The attached entity type (e.g., 'inventory_item', 'maintenance_project')
 * @returns The corresponding DocumentType for documentService
 */
function mapAttachedToTypeToDocumentType(attachedToType?: string): DocumentType {
  if (!attachedToType) return 'documents';
  
  const typeMapping: Record<string, DocumentType> = {
    'inventory_item': 'inventory',
    'maintenance_project': 'projects',
    'submission_vendor': 'projects',
    'demand': 'demands',
    'bill': 'bills',
    'maintenance': 'maintenance',
  };
  
  return typeMapping[attachedToType] || 'documents';
}

/**
 * @deprecated Use documentService.buildHierarchicalPath() instead.
 * This function is kept for backward compatibility but will be removed in a future version.
 * 
 * Example migration:
 * ```typescript
 * // Old way (deprecated):
 * const path = await buildHierarchicalPath({
 *   organizationId, buildingId, residenceId, originalFilename, attachedToType
 * });
 * 
 * // New way (recommended):
 * const path = documentService.buildHierarchicalPath({
 *   type: mapAttachedToTypeToDocumentType(attachedToType),
 *   buildingId,
 *   residenceId,
 * }, originalFilename);
 * ```
 */
async function buildHierarchicalPath(params: {
  organizationId: string;
  buildingId: string;
  residenceId?: string;
  originalFilename: string;
  attachedToType?: string;
}): Promise<string> {
  const { organizationId, buildingId, residenceId, originalFilename, attachedToType } = params;
  
  const uuid = uuidv4();
  const normalizedName = normalizeFilename(originalFilename);
  const filename = `${uuid}_${normalizedName}`;
  
  // For residence-specific documents, always use residences/{residenceId}/documents/
  if (residenceId) {
    return `buildings/${buildingId}/residences/${residenceId}/documents/${filename}`;
  }
  
  // For building-level documents, route based on attachedToType
  if (attachedToType && DOCUMENT_FOLDER_MAPPING[attachedToType]) {
    const folder = DOCUMENT_FOLDER_MAPPING[attachedToType];
    return `buildings/${buildingId}/${folder}/${filename}`;
  }
  
  // Default fallback for unrecognized types
  return `buildings/${buildingId}/documents/${filename}`;
}

async function resolveDocumentContext(params: {
  user: any;
  buildingId?: string;
  residenceId?: string;
  attachedToType?: string;
  attachedToId?: string;
}): Promise<{ buildingId: string; organizationId: string; residenceId?: string }> {
  const { user, buildingId, residenceId, attachedToType, attachedToId } = params;
  
  if (buildingId) {
    const building = await storage.getBuilding(buildingId);
    if (!building) {
      throw new Error('Building not found');
    }
    
    return {
      buildingId,
      organizationId: building.organizationId,
      residenceId
    };
  }
  
  if (residenceId) {
    const residence = await storage.getResidence(residenceId);
    if (!residence) {
      throw new Error('Residence not found');
    }
    const building = await storage.getBuilding(residence.buildingId);
    if (!building) {
      throw new Error('Building not found');
    }
    
    return {
      buildingId: residence.buildingId,
      organizationId: building.organizationId,
      residenceId
    };
  }
  
  if (attachedToType === 'demand' && attachedToId) {
    const { demands } = await import('../../shared/schemas/operations');
    const { eq } = await import('drizzle-orm');
    const [demand] = await db.select().from(demands)
      .where(eq(demands.id, attachedToId))
      .limit(1);
    
    if (!demand) {
      throw new Error('Demand not found');
    }
    
    if (!demand.buildingId) {
      throw new Error('Demand does not have an associated building');
    }
    
    const building = await storage.getBuilding(demand.buildingId);
    if (!building) {
      throw new Error('Building not found');
    }
    
    return {
      buildingId: demand.buildingId,
      organizationId: building.organizationId,
      residenceId: demand.residenceId || undefined
    };
  }
  
  throw new Error('Unable to resolve document context: buildingId, residenceId, or valid demand attachment required');
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
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use /tmp/uploads for persistent storage in Replit
    const uploadDir = path.join('/tmp', 'uploads', 'documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = normalizeFilename(file.originalname);
    cb(null, `document-${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({
  storage: documentStorage,
  // Multer 2.x defaults to latin1 for multipart parameters, which mangles
  // French/diacritic filenames coming from real browsers (e.g. "Procès-verbal
  // été 2024.pdf"). Force utf8 so `file.originalname` matches what the user
  // actually uploaded — the canonical normalizer relies on this.
  defParamCharset: 'utf8',
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
  isManagerOnly: z.boolean().default(false),
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
  isManagerOnly: z.boolean().default(false),
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
  logInfo('[DOCUMENT ROUTES] Registering document routes');
  
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
  app.post('/api/documents/cleanup-enum', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/fix-user-links', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/fix-enum-migration', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/fix-invitations-dependency', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/restore-invitations-default', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/migrate-owner-to-admin', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/remove-all-enum-dependencies', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/restore-all-defaults', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.post('/api/documents/complete-schema-sync', requireAuth, requireRole(['admin']), async (req, res) => {
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
  app.get('/api/documents/diagnostic', requireAuth, requireRole(['admin']), async (req, res) => {
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
      const specificDocumentType = req.query.documentType as string; // Filter by document type (legal, maintenance, etc.)
      const specificResidenceId = req.query.residenceId as string; // Filter by specific residence
      const specificBuildingId = req.query.buildingId as string; // Filter by specific building
      const attachedToType = req.query.attachedToType as string; // Filter by attached entity type
      const attachedToId = req.query.attachedToId as string; // Filter by attached entity ID
      const managerOnlyFilter = req.query.isManagerOnly === 'true'; // Filter to only manager-only documents
      
      // Infer view type from which ID parameter is provided:
      // - If buildingId is provided (and no residenceId), it's a building documents view
      // - If residenceId is provided, it's a residence documents view

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
        // All users (including admins and managers) must have explicit access via user_residences table
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

      if (specificBuildingId && !specificResidenceId) {
        // For building documents view, search in buildings user has access to
        if (buildingIds.length > 0) {
          // Get all documents for buildings, will filter later to show only building-level documents
        }
      } else if (specificResidenceId) {
        // For residence documents view, search in residences user has access to
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
        // Note: documentType query param ('building' or 'resident') is NOT a document category filter
        // Document categories (legal, maintenance, etc.) are passed via specificDocumentType
        if (specificDocumentType) {
          additionalFilters.specificDocumentType = specificDocumentType;
        }
        // Pass attachedToType and attachedToId to optimize the query
        if (attachedToType) {
          additionalFilters.attachedToType = attachedToType;
        }
        if (attachedToId) {
          additionalFilters.attachedToId = attachedToId;
        }
        if (managerOnlyFilter) {
          additionalFilters.isManagerOnly = true;
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
          
          // When viewing Building Documents, only show building-level documents (exclude residence documents)
          // A building-level document has buildingId but no residenceId
          if (specificBuildingId && !specificResidenceId && doc.residenceId) {
            return false;
          }
        }

        // When viewing Building Documents (buildingId provided without residenceId), filter out residence-level documents
        // Only show documents that belong to the building but not to a specific residence
        if (specificBuildingId && !specificResidenceId && doc.residenceId) {
          return false;
        }

        // Manager-only documents are restricted to admins and managers, even
        // when residents/tenants would otherwise have residence/building access.
        if (doc.isManagerOnly) {
          if (
            userRole !== 'admin' &&
            userRole !== 'manager' &&
            userRole !== 'demo_manager'
          ) {
            return false;
          }
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

      // Attach tags inline for every document
      try {
        const { getTagsForDocuments } = await import('./document-tags');
        const ids = allDocumentRecords.map((d: any) => d.id).filter(Boolean);
        const tagsByDoc = await getTagsForDocuments(ids);
        for (const d of allDocumentRecords as any[]) {
          d.tags = tagsByDoc.get(d.id) || [];
        }
      } catch (e) {
        // Non-fatal: don't block listing if tag table is missing
      }

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
        filters: { specificDocumentType, specificResidenceId, specificBuildingId, attachedToType, attachedToId }
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

      // Get user's organizations for permission checking - check ALL organizations (not just the first)
      const organizations = await storage.getUserOrganizations(userId);
      const organizationIds = organizations.map((org) => org.organizationId);

      // Use the new permission-aware method with all organization IDs
      const document = await storage.getDocumentWithScope(
        documentId,
        userId,
        userRole,
        organizationIds
      );

      if (!document) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }

      // Add entity metadata for frontend compatibility
      if (document.buildingId) {
        (document as any).entityType = 'building';
        (document as any).entityId = document.buildingId;
      } else if (document.residenceId) {
        (document as any).entityType = 'residence';
        (document as any).entityId = document.residenceId;
      }

      try {
        const { getTagsForDocuments } = await import('./document-tags');
        const tagsByDoc = await getTagsForDocuments([document.id]);
        (document as any).tags = tagsByDoc.get(document.id) || [];
      } catch (e) {
        (document as any).tags = [];
      }

      res.json(document);
    } catch (error: any) {
      logError('Error fetching document', error);
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

      let resolvedBuildingId = buildingId;
      let resolvedResidenceId = residenceId;
      let resolvedOrganizationId: string | undefined;

      if (otherData.attachedToType === 'demand' && otherData.attachedToId && !buildingId && !residenceId) {
        try {
          logDocumentOperation('RESOLVING_DEMAND_CONTEXT', {
            operationId,
            attachedToId: otherData.attachedToId,
            userId
          }, 'DEBUG');

          const context = await resolveDocumentContext({
            user,
            buildingId,
            residenceId,
            attachedToType: otherData.attachedToType,
            attachedToId: otherData.attachedToId
          });

          resolvedBuildingId = context.buildingId;
          resolvedResidenceId = context.residenceId;
          resolvedOrganizationId = context.organizationId;

          logDocumentOperation('DEMAND_CONTEXT_RESOLVED', {
            operationId,
            resolvedBuildingId,
            resolvedResidenceId,
            resolvedOrganizationId,
            demandId: otherData.attachedToId
          }, 'DEBUG');
        } catch (error: any) {
          logDocumentOperation('DEMAND_CONTEXT_RESOLUTION_FAILED', {
            operationId,
            error: error.message,
            attachedToId: otherData.attachedToId
          }, 'ERROR');

          if (error.message === 'Demand not found') {
            return res.status(404).json({ message: 'Demand not found' });
          }
          if (error.message === 'Building not found') {
            return res.status(404).json({ message: 'Associated building not found' });
          }
          if (error.message === 'Demand does not have an associated building') {
            return res.status(400).json({ message: 'Demand does not have an associated building' });
          }
          return res.status(400).json({ message: error.message || 'Failed to resolve demand context' });
        }
      }

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
          isManagerOnly: resolveManagerOnlyFlag(otherData.isManagerOnly, userRole),
          isQuarantined: false, // Text documents are safe by default
          residenceId: residenceId || undefined,
          buildingId: buildingId || undefined,
          uploadedById: userId,
        };

        // Permission checks - validate against ALL user organizations (not just the first)
        if (buildingId && userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const userOrgIds = organizations.map((org) => org.organizationId);
          const building = await storage.getBuilding(buildingId);
          if (!building || !userOrgIds.includes(building.organizationId)) {
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
          isManagerOnly: resolveManagerOnlyFlag(otherData.isManagerOnly, userRole),
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

        // Permission checks - validate against ALL user organizations (not just the first)
        if (buildingId && userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const userOrgIds = organizations.map((org) => org.organizationId);
          const building = await storage.getBuilding(buildingId);
          if (!building || !userOrgIds.includes(building.organizationId)) {
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
      
      // Determine document record type based on resolvedBuildingId/resolvedResidenceId (not from documentType field)
      let finalDocumentRecordType;
      if (resolvedBuildingId && !resolvedResidenceId) {
        finalDocumentRecordType = 'building';
        // console.log(`📄 [DOCUMENTS UPLOAD] Determined document type: BUILDING (ID: ${resolvedBuildingId})`);
      } else if (resolvedResidenceId && !resolvedBuildingId) {
        finalDocumentRecordType = 'resident';
        // console.log(`📄 [DOCUMENTS UPLOAD] Determined document type: RESIDENCE (ID: ${resolvedResidenceId})`);
      } else if (resolvedBuildingId && resolvedResidenceId) {
        // console.log(`❌ [DOCUMENTS UPLOAD] Both buildingId and residenceId provided: ${resolvedBuildingId}, ${resolvedResidenceId}`);
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
        // console.log(`🏢 [BUILDING UPLOAD] Processing building document for building ID: ${resolvedBuildingId}`);
        
        // Validate and create building document
        if (!resolvedBuildingId) {
          // console.log(`❌ [BUILDING UPLOAD] Missing buildingId`);
          return res.status(400).json({ message: 'buildingId is required for building documents' });
        }

        // Prepare the permanent file path and move file if needed
        let filePath: string;
        let fileName: string | undefined;
        
        if (req.file) {
          logDebug('[BUILDING UPLOAD] Starting object storage upload process for building', { metadata: { buildingId: resolvedBuildingId } });
          
          // Attempt object storage upload FIRST
          try {
            const { ObjectStorageService } = await import('../objectStorage');
            const { ObjectAccessGroupType, ObjectPermission } = await import('../objectAcl');
            const objectStorageService = new ObjectStorageService();

            // Fetch building to get organization ID (use cached if available from context resolver)
            let organizationId = resolvedOrganizationId;
            if (!organizationId) {
              const building = await storage.getBuilding(resolvedBuildingId);
              if (!building) {
                throw new Error('Building not found');
              }
              organizationId = building.organizationId;
            }

            // Build hierarchical path with normalized filename using DocumentService
            const hierarchicalPath = documentService.buildHierarchicalPath({
              type: mapAttachedToTypeToDocumentType(otherData.attachedToType),
              buildingId: resolvedBuildingId,
              organizationId,
            }, req.file.originalname);
            logDebug('[BUILDING UPLOAD] Generated hierarchical path', { metadata: { path: hierarchicalPath } });

            // Get presigned URL for custom hierarchical path
            const uploadURL = await objectStorageService.getCustomPathUploadURL(hierarchicalPath);
            logDebug('[BUILDING UPLOAD] Got presigned upload URL for hierarchical path');

            // Upload file to object storage using presigned URL
            const fileBuffer = fs.readFileSync(req.file.path);
            const uploadResponse = await fetch(uploadURL, {
              method: 'PUT',
              body: fileBuffer,
              headers: {
                'Content-Type': req.file.mimetype,
              },
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload to object storage: ${uploadResponse.status}`);
            }
            logDebug('[BUILDING UPLOAD] File uploaded to object storage');

            // Build ACL policy based on building
            const aclPolicy = {
              owner: userId,
              visibility: 'private' as const,
              aclRules: [{
                group: {
                  type: ObjectAccessGroupType.BUILDING,
                  id: resolvedBuildingId
                },
                permission: ObjectPermission.READ
              }]
            };

            // Set ACL policy on the hierarchical path
            const objectStoragePath = await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, aclPolicy);
            logDebug('[BUILDING UPLOAD] ACL policy set', { metadata: { normalizedPath: objectStoragePath } });

            // Update filePath to use hierarchical path with normalized /objects/ prefix
            filePath = documentService.normalizePath(hierarchicalPath);
            fileName = normalizeFilename(req.file.originalname);
            
            // Clean up temporary file after successful upload
            if (fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
          } catch (objectStorageError: any) {
            logError('[BUILDING UPLOAD] Object storage error', objectStorageError);
            logWarn('[BUILDING UPLOAD] Falling back to local filesystem storage');
            
            // Fallback to local filesystem. Use the shared canonical
            // normalizer so the on-disk filename matches what we would have
            // written to Object Storage / what we save in `fileName`.
            fileName = `${uuidv4()}_${normalizeFilename(req.file.originalname)}`;
            const permanentDir = path.join(process.cwd(), 'uploads', 'buildings', resolvedBuildingId);
            
            // Ensure directory exists
            if (!fs.existsSync(permanentDir)) {
              logDebug('[BUILDING UPLOAD] Creating directory', { metadata: { dir: permanentDir } });
              fs.mkdirSync(permanentDir, { recursive: true });
            }
            
            // Move file from temporary to permanent location
            const permanentPath = path.join(permanentDir, fileName);
            fs.copyFileSync(req.file.path, permanentPath);
            fs.unlinkSync(req.file.path); // Clean up temporary file
            filePath = `buildings/${resolvedBuildingId}/${fileName}`;
            logDebug('[BUILDING UPLOAD] File saved to local storage (fallback)', { metadata: { filePath } });
          }
        } else {
          // console.log(`🏢 [BUILDING UPLOAD] No file provided, creating placeholder path`);
          filePath = `temp-path-${Date.now()}`;
        }
        
        // Convert string boolean fields to actual booleans for validation
        const isVisibleToTenants = otherData.isVisibleToTenants === 'true' || otherData.isVisibleToTenants === true;
        const isManagerOnly = resolveManagerOnlyFlag(otherData.isManagerOnly, userRole);
        
        const dataToValidate = {
          ...otherData,
          buildingId: resolvedBuildingId,
          uploadedById: userId,
          filePath,
          fileName,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          documentType: documentType || type || 'other', // Default to 'other' if not provided
          isVisibleToTenants, // Use converted boolean value
          isManagerOnly, // Use converted boolean value
        };
        
        // console.log(`🏢 [BUILDING UPLOAD] Data to validate:`, {
        //   buildingId: resolvedBuildingId,
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
          // console.log(`✅ [BUILDING UPLOAD] Document validation successful for building ${resolvedBuildingId}`);
        } catch (validationError) {
          // console.log(`❌ [BUILDING UPLOAD] Document validation failed for building ${resolvedBuildingId}:`, validationError);
          return res.status(400).json({ 
            message: 'Validation failed', 
            error: validationError.message || 'Invalid data',
            details: validationError.issues || validationError
          });
        }

        // Permission checks for building documents - validate against ALL user organizations (not just the first)
        // console.log(`🏢 [BUILDING UPLOAD] Checking permissions for role: ${userRole}`);
        
        if (userRole === 'manager') {
          // console.log(`🏢 [BUILDING UPLOAD] Manager permission check for building ${resolvedBuildingId}`);
          const organizations = await storage.getUserOrganizations(userId);
          const userOrgIds = organizations.map((org) => org.organizationId);
          // console.log(`🏢 [BUILDING UPLOAD] Manager organizations: ${userOrgIds.join(', ')}`);
          
          const building = await storage.getBuilding(resolvedBuildingId);
          // console.log(`🏢 [BUILDING UPLOAD] Building organization: ${building?.organizationId}`);
          
          if (!building || !userOrgIds.includes(building.organizationId)) {
            // console.log(`❌ [BUILDING UPLOAD] Manager permission denied - organization mismatch`);
            return res
              .status(403)
              .json({ message: 'Cannot assign document to building outside your organization' });
          }
          // console.log(`✅ [BUILDING UPLOAD] Manager permission check passed`);
        }

        if (userRole === 'resident') {
          // console.log(`🏢 [BUILDING UPLOAD] Resident permission check for building ${resolvedBuildingId}`);
          const residences = await storage.getUserResidences(userId);
          // console.log(`🏢 [BUILDING UPLOAD] User residences count: ${residences.length}`);
          
          const hasResidenceInBuilding = await Promise.all(
            residences.map(async (ur) => {
              const residence = await storage.getResidence(ur.residenceId);
              const isInBuilding = residence && residence.buildingId === resolvedBuildingId;
              // console.log(`🏢 [BUILDING UPLOAD] Residence ${ur.residenceId} in building ${resolvedBuildingId}: ${isInBuilding}`);
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
          isManagerOnly: validatedData.isManagerOnly || false,
          isQuarantined: false, // Building documents are validated and safe
          residenceId: undefined,
          buildingId: validatedData.buildingId,
          uploadedById: validatedData.uploadedById,
          effectiveDate: validatedData.effectiveDate ? new Date(validatedData.effectiveDate) as any : undefined,
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
        // console.log(`🏠 [RESIDENCE UPLOAD] Processing residence document for residence ID: ${resolvedResidenceId}`);
        
        // Validate and create resident document
        if (!resolvedResidenceId) {
          // console.log(`❌ [RESIDENCE UPLOAD] Missing residenceId`);
          return res
            .status(400)
            .json({ message: 'residenceId is required for resident documents' });
        }

        // Prepare the permanent file path and move file if needed
        let filePath: string;
        let fileName: string | undefined;
        
        if (req.file) {
          logDebug('[RESIDENCE UPLOAD] Starting object storage upload process for residence', { metadata: { residenceId: resolvedResidenceId } });
          
          // Attempt object storage upload FIRST
          try {
            const { ObjectStorageService } = await import('../objectStorage');
            const { ObjectAccessGroupType, ObjectPermission } = await import('../objectAcl');
            const objectStorageService = new ObjectStorageService();

            // Fetch residence and building to get organization ID (use cached if available from context resolver)
            let organizationId = resolvedOrganizationId;
            let buildingIdForPath = resolvedBuildingId;
            
            if (!organizationId || !buildingIdForPath) {
              const residence = await storage.getResidence(resolvedResidenceId);
              if (!residence) {
                throw new Error('Residence not found');
              }
              buildingIdForPath = residence.buildingId;
              
              const building = await storage.getBuilding(residence.buildingId);
              if (!building) {
                throw new Error('Building not found');
              }
              organizationId = building.organizationId;
            }

            // Build hierarchical path with normalized filename using DocumentService
            const hierarchicalPath = documentService.buildHierarchicalPath({
              type: mapAttachedToTypeToDocumentType(otherData.attachedToType),
              buildingId: buildingIdForPath,
              residenceId: resolvedResidenceId,
              organizationId,
            }, req.file.originalname);
            logDebug('[RESIDENCE UPLOAD] Generated hierarchical path', { metadata: { path: hierarchicalPath } });

            // Get presigned URL for custom hierarchical path
            const uploadURL = await objectStorageService.getCustomPathUploadURL(hierarchicalPath);
            logDebug('[RESIDENCE UPLOAD] Got presigned upload URL for hierarchical path');

            // Upload file to object storage using presigned URL
            const fileBuffer = fs.readFileSync(req.file.path);
            const uploadResponse = await fetch(uploadURL, {
              method: 'PUT',
              body: fileBuffer,
              headers: {
                'Content-Type': req.file.mimetype,
              },
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload to object storage: ${uploadResponse.status}`);
            }
            logDebug('[RESIDENCE UPLOAD] File uploaded to object storage');

            // Build ACL policy based on residence
            const aclPolicy = {
              owner: userId,
              visibility: 'private' as const,
              aclRules: [{
                group: {
                  type: ObjectAccessGroupType.RESIDENCE,
                  id: resolvedResidenceId
                },
                permission: ObjectPermission.READ
              }]
            };

            // Set ACL policy on the hierarchical path
            const objectStoragePath = await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, aclPolicy);
            logDebug('[RESIDENCE UPLOAD] ACL policy set', { metadata: { normalizedPath: objectStoragePath } });

            // Update filePath to use hierarchical path with normalized /objects/ prefix
            filePath = documentService.normalizePath(hierarchicalPath);
            fileName = normalizeFilename(req.file.originalname);
            
            // Clean up temporary file after successful upload
            if (fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
          } catch (objectStorageError: any) {
            logError('[RESIDENCE UPLOAD] Object storage error', objectStorageError);
            logWarn('[RESIDENCE UPLOAD] Falling back to local filesystem storage');
            
            // Fallback to local filesystem. Use the shared canonical
            // normalizer so the on-disk filename matches what we would have
            // written to Object Storage / what we save in `fileName`.
            fileName = `${uuidv4()}_${normalizeFilename(req.file.originalname)}`;
            const permanentDir = path.join(process.cwd(), 'uploads', 'residences', resolvedResidenceId);
            
            // Ensure directory exists
            if (!fs.existsSync(permanentDir)) {
              logDebug('[RESIDENCE UPLOAD] Creating directory', { metadata: { dir: permanentDir } });
              fs.mkdirSync(permanentDir, { recursive: true });
            }
            
            // Move file from temporary to permanent location
            const permanentPath = path.join(permanentDir, fileName);
            fs.copyFileSync(req.file.path, permanentPath);
            fs.unlinkSync(req.file.path); // Clean up temporary file
            filePath = `residences/${resolvedResidenceId}/${fileName}`;
            logDebug('[RESIDENCE UPLOAD] File saved to local storage (fallback)', { metadata: { filePath } });
          }
        } else {
          // console.log(`🏠 [RESIDENCE UPLOAD] No file provided, creating placeholder path`);
          filePath = `temp-path-${Date.now()}`;
        }

        // Convert string boolean fields to actual booleans for validation
        const isVisibleToTenants = otherData.isVisibleToTenants === 'true' || otherData.isVisibleToTenants === true;
        const isManagerOnly = resolveManagerOnlyFlag(otherData.isManagerOnly, userRole);
        
        const dataToValidate = {
          ...otherData,
          residenceId: resolvedResidenceId,
          uploadedById: userId,
          filePath,
          fileName,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          documentType: documentType || type || 'other', // Default to 'other' if not provided
          isVisibleToTenants, // Use converted boolean value
          isManagerOnly, // Use converted boolean value
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
        const residence = await storage.getResidence(resolvedResidenceId);
        if (!residence) {
          return res.status(404).json({ message: 'Residence not found' });
        }

        // Permission checks for resident documents - validate against ALL user organizations (not just the first)
        if (userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const userOrgIds = organizations.map((org) => org.organizationId);
          const building = await storage.getBuilding(residence.buildingId);
          if (!building || !userOrgIds.includes(building.organizationId)) {
            return res
              .status(403)
              .json({ message: 'Cannot assign document to residence outside your organization' });
          }
        }

        if (userRole === 'resident') {
          const residences = await storage.getUserResidences(userId);
          const residenceIds = residences.map((ur) => ur.residenceId);

          if (!residenceIds.includes(resolvedResidenceId)) {
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
          isManagerOnly: validatedData.isManagerOnly || false,
          isQuarantined: false, // Resident documents are validated and safe
          residenceId: validatedData.residenceId,
          buildingId: residence.buildingId,
          uploadedById: validatedData.uploadedById,
          effectiveDate: validatedData.effectiveDate ? new Date(validatedData.effectiveDate) as any : undefined,
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

      // Get existing document first to check permissions and get current file path.
      // Use getDocumentWithScope so the manager-only visibility filter is applied
      // consistently with the read endpoints (Task #345): residents/tenants must
      // get a 404 on manager-only documents, not be allowed to edit them.
      const organizations = await storage.getUserOrganizations(userId);
      const organizationIds = organizations.map((org) => org.organizationId);
      const existingDocument = await storage.getDocumentWithScope(
        documentId,
        userId,
        userRole,
        organizationIds
      );

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
      } else if (userRole === 'manager' || userRole === 'demo_manager') {
        // Manager should have access to documents in their organization. Reuse
        // the organizations already fetched above for the scope query.
        const buildings = await storage.getBuildings();
        const userOrganizations = organizationIds;
        
        if (existingDocument.buildingId) {
          const orgBuildings = buildings.filter(building => 
            userOrganizations.includes(building.organizationId || '')
          );
          const orgBuildingIds = orgBuildings.map(b => b.id);
          hasAccess = orgBuildingIds.includes(existingDocument.buildingId);
        }
        
        if (existingDocument.residenceId && !hasAccess) {
          const residences = await storage.getResidences();
          const orgResidences = residences.filter(residence => {
            const building = buildings.find(b => b.id === residence.buildingId);
            return building && userOrganizations.includes(building.organizationId || '');
          });
          const orgResidenceIds = orgResidences.map(r => r.id);
          hasAccess = orgResidenceIds.includes(existingDocument.residenceId);
        }
        // console.log(`📝 [DOCUMENT UPDATE] Manager access: ${hasAccess}`);
      } else if (userRole === 'resident' || userRole === 'demo_resident') {
        // Residents can only edit documents in their residences (not building documents)
        if (existingDocument.residenceId) {
          const userResidences = await storage.getUserResidences(userId);
          const userResidenceIds = userResidences.map(r => r.residenceId);
          hasAccess = userResidenceIds.includes(existingDocument.residenceId);
        }
        // Residents cannot edit building-level documents (view-only access)
        if (existingDocument.buildingId && !existingDocument.residenceId) {
          hasAccess = false;
        }
        // console.log(`📝 [DOCUMENT UPDATE] Resident access: ${hasAccess}`);
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
        updateData.isVisibleToTenants = req.body.isVisibleToTenants === 'true' || req.body.isVisibleToTenants === true;
      }
      if (req.body.isManagerOnly !== undefined) {
        // Only admins/managers may toggle the manager-only visibility flag.
        if (
          userRole === 'admin' ||
          userRole === 'manager' ||
          userRole === 'demo_manager'
        ) {
          updateData.isManagerOnly = req.body.isManagerOnly === 'true' || req.body.isManagerOnly === true;
        }
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

        // Generate unique file path. Route through the shared canonical
        // normalizer so the on-disk name and the persisted `fileName` field
        // follow the same rules as the rest of the upload pipeline.
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const uniqueFileName = `${uniqueId}_${normalizeFilename(req.file.originalname)}`;
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

  // Set file path after object storage upload
  app.put('/api/documents/:id/file-path', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userId = user.id;
      const documentId = req.params.id;
      const { filePath } = req.body;

      if (!filePath) {
        return res.status(400).json({ message: 'File path is required' });
      }

      // Get existing document to check permissions
      const existingDocument = await storage.getDocuments({ userId, userRole: user.role }).then(docs => docs.find(doc => doc.id === documentId));
      
      if (!existingDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check permissions (admin, manager, and resident can update)
      let hasAccess = false;
      if (user.role === 'admin') {
        hasAccess = true;
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
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
        
        if (existingDocument.residenceId && !hasAccess) {
          const residences = await storage.getResidences();
          const orgResidences = residences.filter(residence => {
            const building = buildings.find(b => b.id === residence.buildingId);
            return building && userOrganizations.includes(building.organizationId || '');
          });
          const orgResidenceIds = orgResidences.map(r => r.id);
          hasAccess = orgResidenceIds.includes(existingDocument.residenceId);
        }
      } else if (user.role === 'resident' || user.role === 'demo_resident') {
        // Residents can only update documents in their residences (not building documents)
        if (existingDocument.residenceId) {
          const userResidences = await storage.getUserResidences(userId);
          const userResidenceIds = userResidences.map(r => r.residenceId);
          hasAccess = userResidenceIds.includes(existingDocument.residenceId);
        }
        // Residents cannot update building-level documents (view-only access)
        if (existingDocument.buildingId && !existingDocument.residenceId) {
          hasAccess = false;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Validate that the provided path is an /objects/ path (must be from our
      // own storage, not an arbitrary URL or local path)
      const { ObjectStorageService } = await import('../objectStorage');
      const { ObjectAccessGroupType, ObjectPermission } = await import('../objectAcl');
      const objectStorageService = new ObjectStorageService();

      const normalizedForCheck = objectStorageService.normalizeObjectEntityPath(filePath);
      if (!normalizedForCheck.startsWith('/objects/')) {
        return res.status(400).json({ message: 'Invalid file path: must reference an object storage path' });
      }

      // Prevent path-rebinding: reject if the object already has an ACL set
      // by a different user. A freshly uploaded object will have no ACL yet.
      const existingAcl = await objectStorageService.getExistingObjectAcl(filePath);
      if (existingAcl && existingAcl.owner && existingAcl.owner !== userId) {
        return res.status(403).json({ message: 'Access denied: object belongs to another user' });
      }

      // Validate the uploaded object's MIME type against the allowlist.
      // Fail-closed: reject when no content-type is stamped on the object
      // (an object without recognized metadata cannot be trusted as a
      // legitimate user upload) OR when the type is not in the allowlist.
      // This blocks HTML/JS attachments and any path that wasn't produced
      // by a server-validated upload pipeline.
      const objectContentType = await objectStorageService.getObjectContentType(filePath);
      if (!objectContentType || !SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(objectContentType)) {
        return res.status(400).json({
          message: objectContentType
            ? `File type not allowed: ${objectContentType}`
            : 'File type could not be verified',
        });
      }

      // Build ACL policy based on document properties
      const aclPolicy = {
        owner: userId,
        visibility: existingDocument.isVisibleToTenants ? 'public' as const : 'private' as const,
        aclRules: []
      };

      // Add access rules based on building/residence
      if (existingDocument.buildingId) {
        aclPolicy.aclRules!.push({
          group: {
            type: ObjectAccessGroupType.BUILDING,
            id: existingDocument.buildingId
          },
          permission: ObjectPermission.READ
        });
      }

      if (existingDocument.residenceId) {
        aclPolicy.aclRules!.push({
          group: {
            type: ObjectAccessGroupType.RESIDENCE,
            id: existingDocument.residenceId
          },
          permission: ObjectPermission.READ
        });
      }

      // Set ACL policy and get normalized path
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(filePath, aclPolicy);

      // Update document with normalized file path
      const updatedDocument = await storage.updateDocument(documentId, {
        filePath: normalizedPath
      });

      if (!updatedDocument) {
        return res.status(500).json({ message: 'Failed to update document' });
      }

      res.json(updatedDocument);
    } catch (error: any) {
      logError('Error setting file path', error);
      res.status(500).json({ 
        message: 'Failed to set file path',
        error: error.message 
      });
    }
  });

  // Security audit endpoint - admin only
  app.get('/api/documents/security/audit-log', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to retrieve audit log' }));
  
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

      // Get user's organizations for permission checking - check ALL organizations (not just the first)
      const organizations = await storage.getUserOrganizations(userId);
      const userOrganizationIds = organizations.map((org) => org.organizationId);

      // SECURITY CHECK 2: Document existence and permission verification using new scope-based method
      let document;
      try {
        document = await storage.getDocumentWithScope(
          documentId,
          userId,
          userRole,
          userOrganizationIds
        );
      } catch (error: any) {
        logSecurityEvent('DELETE_ERROR_DOCUMENT_LOOKUP', user, false, documentId, { 
          operationId,
          error: error.message 
        });
        logError('Error looking up document for deletion', error);
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

      if (!userOrganizationIds.length) {
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
      // Check if the document's organization is in the user's list of organizations
      if (userRole !== 'admin' && documentOrganizationId && !userOrganizationIds.includes(documentOrganizationId)) {
        logSecurityEvent('DELETE_DENIED_ORGANIZATION_MISMATCH', user, false, documentId, { 
          operationId,
          userOrganizationIds,
          documentOrganizationId 
        });
        logDocumentOperation('DELETE_DENIED_CROSS_ORGANIZATION_ACCESS', {
          operationId,
          documentId,
          userId,
          userRole,
          userOrganizationIds,
          documentOrganizationId
        }, 'WARN');
        return res.status(403).json({ 
          message: 'Cannot delete document outside your organization' 
        });
      }

      // Log admin cross-organization access for audit purposes
      if (userRole === 'admin' && documentOrganizationId && !userOrganizationIds.includes(documentOrganizationId)) {
        logSecurityEvent('ADMIN_CROSS_ORGANIZATION_DELETE', user, true, documentId, { 
          operationId,
          userOrganizationIds,
          documentOrganizationId,
          justification: 'Admin privilege bypass'
        });
        logDocumentOperation('ADMIN_BYPASS_ORGANIZATION_CHECK', {
          operationId,
          documentId,
          userId,
          userRole,
          userOrganizationIds,
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
            organizationIds: userOrganizationIds
          }, 'DEBUG');
        } else if (document.residenceId) {
          // Manager can delete residence documents if the residence building is in their organization
          logDocumentOperation('DELETE_AUTHORIZED_MANAGER_RESIDENCE', {
            operationId,
            documentId,
            residenceId: document.residenceId,
            userId,
            organizationIds: userOrganizationIds
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
        organizationIds: userOrganizationIds
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
        organizationIds: userOrganizationIds,
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

        // Upload to Object Storage for persistent file storage
        logDebug('[DOCUMENT UPLOAD] Starting object storage upload process for existing document');
        
        const sanitizedName = normalizeFilename(req.file.originalname);
        let filePath: string;
        let uploadedToObjectStorage = false;

        try {
          const { ObjectStorageService } = await import('../objectStorage');
          const { ObjectAccessGroupType, ObjectPermission } = await import('../objectAcl');
          const objectStorageService = new ObjectStorageService();

          // Get presigned URL for upload
          const uploadURL = await objectStorageService.getObjectEntityUploadURL();
          logDebug('[DOCUMENT UPLOAD] Got presigned upload URL');

          // Upload file to object storage using presigned URL
          const fileBuffer = fs.readFileSync(req.file.path);
          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: fileBuffer,
            headers: {
              'Content-Type': req.file.mimetype,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload to object storage: ${uploadResponse.status}`);
          }
          logDebug('[DOCUMENT UPLOAD] File uploaded to object storage');

          // Build ACL policy based on document properties
          const aclPolicy = {
            owner: userId,
            visibility: existingDocument.isVisibleToTenants ? 'public' as const : 'private' as const,
            aclRules: []
          };

          // Determine ACL type based on building vs residence
          if (existingDocument.residenceId) {
            // Residence-level document
            aclPolicy.aclRules.push({
              group: {
                type: ObjectAccessGroupType.RESIDENCE,
                id: existingDocument.residenceId
              },
              permission: ObjectPermission.READ
            });
            logDebug('[DOCUMENT UPLOAD] Added residence-level ACL rule');
          } else if (existingDocument.buildingId) {
            // Building-level document
            aclPolicy.aclRules.push({
              group: {
                type: ObjectAccessGroupType.BUILDING,
                id: existingDocument.buildingId
              },
              permission: ObjectPermission.READ
            });
            logDebug('[DOCUMENT UPLOAD] Added building-level ACL rule');
          }

          // Set ACL policy and get normalized path
          filePath = await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, aclPolicy);
          uploadedToObjectStorage = true;
          logDebug('[DOCUMENT UPLOAD] ACL policy set', { metadata: { normalizedPath: filePath } });

        } catch (objectStorageError: any) {
          // Fall back to local filesystem path on object storage failure
          logWarn('[DOCUMENT UPLOAD] Object storage upload failed, falling back to local path', { metadata: { error: objectStorageError.message } });
          
          // Determine fallback path based on building vs residence
          if (existingDocument.residenceId) {
            filePath = `uploads/documents/org_${organizationId}/residence_${existingDocument.residenceId}/${sanitizedName}`;
          } else if (existingDocument.buildingId) {
            filePath = `uploads/documents/org_${organizationId}/building_${existingDocument.buildingId}/${sanitizedName}`;
          } else {
            filePath = `prod_org_${organizationId}/${sanitizedName}`;
          }
          
          logDebug('[DOCUMENT UPLOAD] Using fallback local path', { metadata: { filePath } });
        }

        // Update document with file information
        const updatedDocument = await storage.updateDocument(documentId, {
          filePath,
          name: sanitizedName,
          // Remove mimeType as it's not in schema
        });

        logInfo('[DOCUMENT UPLOAD] Document updated successfully', {
          documentId,
          filePath,
          uploadedToObjectStorage
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
      
      const { textContent, name, description, documentType, attachedToType, attachedToId, buildingId, residenceId, isVisibleToTenants, isManagerOnly, effectiveDate } = req.body;
      const userRoleForFlag = req.user?.role;
      
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
        isManagerOnly: resolveManagerOnlyFlag(isManagerOnly, userRoleForFlag),
        isQuarantined: false, // Text documents are safe by default
        residenceId: residenceId || undefined,
        buildingId: buildingId || undefined,
        attachedToType: attachedToType || undefined,
        attachedToId: attachedToId || undefined,
        uploadedById: userId,
        effectiveDate: effectiveDate ? new Date(effectiveDate) as any : undefined,
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
    logDebug('[UPLOAD HANDLER] Document upload endpoint hit', { metadata: { hasFile: !!req.file, fileName: req.file?.originalname } });
    
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
        isManagerOnly: resolveManagerOnlyFlag(req.body.isManagerOnly, req.user?.role),
        residenceId: req.body.residenceId || undefined,
        buildingId: req.body.buildingId || undefined,
        attachedToType: req.body.attachedToType || undefined,
        attachedToId: req.body.attachedToId || undefined,
        effectiveDate: req.body.effectiveDate && req.body.effectiveDate.trim() !== '' ? req.body.effectiveDate : undefined,
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

      // Upload to Object Storage for persistent file storage
      logDebug('[DOCUMENT UPLOAD] Starting object storage upload process');
      
      let filePath: string;
      try {
        const { ObjectStorageService } = await import('../objectStorage');
        const { ObjectAccessGroupType, ObjectPermission } = await import('../objectAcl');
        const objectStorageService = new ObjectStorageService();

        // Determine organization ID based on building
        if (!actualBuildingId) {
          throw new Error('Building ID is required for hierarchical storage');
        }
        
        const building = await storage.getBuilding(actualBuildingId);
        if (!building) {
          throw new Error('Building not found');
        }
        const organizationId = building.organizationId;

        // Build hierarchical path with normalized filename using DocumentService
        const hierarchicalPath = documentService.buildHierarchicalPath({
          type: mapAttachedToTypeToDocumentType(validatedData.attachedToType),
          buildingId: actualBuildingId,
          residenceId: validatedData.residenceId,
          organizationId,
        }, req.file!.originalname);
        logDebug('[DOCUMENT UPLOAD] Generated hierarchical path', { metadata: { path: hierarchicalPath } });

        // Get presigned URL for custom hierarchical path
        const uploadURL = await objectStorageService.getCustomPathUploadURL(hierarchicalPath);
        logDebug('[DOCUMENT UPLOAD] Got presigned upload URL for hierarchical path');

        // Upload file to object storage using presigned URL
        const fileBuffer = fs.readFileSync(req.file!.path);
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: fileBuffer,
          headers: {
            'Content-Type': req.file!.mimetype,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload to object storage: ${uploadResponse.status}`);
        }
        logDebug('[DOCUMENT UPLOAD] File uploaded to object storage');

        // Build ACL policy based on document properties
        const aclPolicy = {
          owner: userId,
          visibility: validatedData.isVisibleToTenants ? 'public' as const : 'private' as const,
          aclRules: []
        };

        // Add access rules based on building/residence
        if (actualBuildingId) {
          aclPolicy.aclRules!.push({
            group: {
              type: ObjectAccessGroupType.BUILDING,
              id: actualBuildingId
            },
            permission: ObjectPermission.READ
          });
        }

        if (validatedData.residenceId) {
          aclPolicy.aclRules!.push({
            group: {
              type: ObjectAccessGroupType.RESIDENCE,
              id: validatedData.residenceId
            },
            permission: ObjectPermission.READ
          });
        }

        // Set ACL policy on the hierarchical path
        const objectStoragePath = await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, aclPolicy);
        logDebug('[DOCUMENT UPLOAD] ACL policy set', { metadata: { normalizedPath: objectStoragePath } });

        // Update filePath to use hierarchical path with normalized /objects/ prefix
        filePath = documentService.normalizePath(hierarchicalPath);
      } catch (objectStorageError: any) {
        logError('[DOCUMENT UPLOAD] Object storage error', objectStorageError);
        logWarn('[DOCUMENT UPLOAD] Falling back to local storage');
        
        // Generate unique file path with sanitized filename for fallback.
        // Use the shared canonical normalizer so the on-disk fallback name
        // and the persisted `fileName` field always agree.
        const sanitizedFileName = `${uuidv4()}_${normalizeFilename(req.file!.originalname)}`;

        // Create fallback local path
        if (validatedData.residenceId) {
          filePath = `residences/${validatedData.residenceId}/${sanitizedFileName}`;
        } else if (actualBuildingId) {
          filePath = `buildings/${actualBuildingId}/${sanitizedFileName}`;
        } else {
          filePath = `general/${sanitizedFileName}`;
        }
        
        // Fallback to local storage if object storage fails
        const localStoragePath = path.join(process.cwd(), 'uploads');
        
        // Ensure uploads directory exists
        if (!fs.existsSync(localStoragePath)) {
          fs.mkdirSync(localStoragePath, { recursive: true });
        }

        // Create directory structure for file
        const localFilePath = path.join(localStoragePath, filePath);
        const localFileDir = path.dirname(localFilePath);
        
        if (!fs.existsSync(localFileDir)) {
          fs.mkdirSync(localFileDir, { recursive: true });
        }

        // Copy uploaded file to local storage
        fs.copyFileSync(req.file!.path, localFilePath);
        logDebug('[DOCUMENT UPLOAD] File saved to local storage (fallback)');
      }

      // Create document record in database with buildingId from residence if applicable
      const documentData: InsertDocument = {
        name: validatedData.name,
        description: validatedData.description,
        documentType: validatedData.documentType,
        filePath: filePath,
        fileName: normalizeFilename(req.file!.originalname),
        fileSize: req.file!.size,
        mimeType: req.file!.mimetype,
        isVisibleToTenants: validatedData.isVisibleToTenants,
        isManagerOnly: validatedData.isManagerOnly,
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

      // Task #257 — surface friendlier database error messages via the
      // shared MCP classifier so the unique-violation (23505) "path
      // conflict" branch and the generic 500 fallback both flow through
      // a single consistent envelope (with Retry-After on transient
      // failures). The `error_id` is preserved so operators can still
      // correlate with the audit log.
      if (typeof (error as { code?: unknown })?.code === 'string') {
        return sendDbWriteError(res, error, 'document', 'create', {
          logPrefix: '[DOCUMENT UPLOAD] db error',
          extraFields: { error_id: errorEntry.timestamp },
        });
      }

      // Generic error response (non-DB failure path)
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

      // Manager-only documents are restricted to admins/managers regardless of
      // building/residence assignment. Residents and tenants are denied even
      // for documents in their own residence/building.
      const isManagerOnlyDocument = !!document.isManagerOnly;
      const userIsManagerOrAdmin =
        userRole === 'admin' ||
        userRole === 'manager' ||
        userRole === 'demo_manager';

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
      
      // Enforce manager-only flag: revoke any access we might have granted to
      // residents/tenants based on their residence/building assignment.
      if (isManagerOnlyDocument && !userIsManagerOrAdmin) {
        hasAccess = false;
        accessReason = 'Document is restricted to managers only';
      }

      // Special handling for documents attached to demands
      if (!hasAccess && document.attachedToType === 'demand' && document.attachedToId) {
        const { demands } = await import('../../shared/schemas/operations');
        const [demand] = await db.select().from(demands).where(eq(demands.id, document.attachedToId)).limit(1);
        
        if (demand) {
          // User can access if they created the demand, or if they're admin/manager
          if (demand.submitterId === userId || userRole === 'admin' || userRole === 'manager' || userRole === 'demo_manager') {
            hasAccess = true;
            accessReason = demand.submitterId === userId 
              ? 'User created the demand this document is attached to'
              : 'Manager/admin has access to all demands';
          }
        }
      }

      // Final manager-only enforcement (covers any access granted by demand path).
      if (isManagerOnlyDocument && !userIsManagerOrAdmin) {
        hasAccess = false;
        accessReason = 'Document is restricted to managers only';
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

      // Object-level ACL check: verify the requesting user has access to the
      // underlying storage object, not only to the document record. This
      // prevents the path-rebinding attack where a user points their own
      // document at another user's file and reads it through this endpoint.
      if (document.filePath && document.filePath.startsWith('/objects/')) {
        const aclAccess = await documentService.canUserAccessDocument(userId, userRole, document.filePath);
        if (!aclAccess.allowed) {
          logDocumentOperation('OBJECT_ACL_DENIED', {
            operationId,
            documentId,
            userId,
            filePath: document.filePath,
            reason: aclAccess.reason,
          }, 'WARN');
          return res.status(403).json({ message: 'Access denied to file' });
        }
      }

      // Download document using Object Storage via documentService (unified approach)
      // This is the ONLY download method - no local filesystem fallbacks for Autoscale compatibility
      if (!document.filePath) {
        logDocumentOperation('NO_FILE_PATH', {
          operationId,
          documentId
        }, 'WARN');
        return res.status(404).json({ 
          message: 'No file associated with this document',
          hint: 'This document record exists but has no file attached'
        });
      }

      try {
        const normalizedPath = documentService.normalizePath(document.filePath);
        
        logDocumentOperation('ATTEMPTING_OBJECT_STORAGE_DOWNLOAD', {
          operationId,
          documentId,
          originalPath: document.filePath,
          normalizedPath
        }, 'DEBUG');
        
        // Get filename for Content-Disposition header
        const fileName = (document as any).fileName || document.name || path.basename(document.filePath);
        // Always serve as attachment (never inline) to prevent active content
        // (HTML/JS) from executing in the browser's same-origin context even if
        // a malicious file were somehow stored.
        const downloadOptions = {
          cacheTtlSec: 3600,
          filename: fileName,
          inline: false,
          mimeType: (document as any).mimeType ?? undefined,
        };
        
        const success = await documentService.downloadDocument(
          document.filePath, 
          res, 
          downloadOptions
        );
        
        if (success) {
          const totalTime = performance.now() - startTime;
          logDocumentOperation('DOCUMENT_DOWNLOAD_SUCCESS', {
            operationId,
            documentId,
            filePath: document.filePath,
            totalRequestTime: `${totalTime.toFixed(2)}ms`
          }, 'INFO');
          return; // Response already sent by documentService
        }
        
        // If documentService returns false without sending a response, return 404
        if (!res.headersSent) {
          const totalTime = performance.now() - startTime;
          logDocumentOperation('FILE_NOT_FOUND_IN_OBJECT_STORAGE', {
            operationId,
            documentId,
            filePath: document.filePath,
            normalizedPath,
            totalRequestTime: `${totalTime.toFixed(2)}ms`
          }, 'WARN');
          
          return res.status(404).json({ 
            message: 'File not found',
            hint: 'The document record exists but the file could not be found in storage. It may have been deleted or not yet uploaded.'
          });
        }
      } catch (downloadError: any) {
        const totalTime = performance.now() - startTime;
        logDocumentOperation('DOCUMENT_DOWNLOAD_ERROR', {
          operationId,
          documentId,
          error: downloadError.message,
          filePath: document.filePath,
          totalRequestTime: `${totalTime.toFixed(2)}ms`
        }, 'ERROR');
        
        // Only send error response if headers haven't been sent
        if (!res.headersSent) {
          // Check for specific error types
          if (downloadError?.name === 'ObjectNotFoundError' || downloadError?.message?.includes('not found')) {
            return res.status(404).json({ 
              message: 'File not found',
              hint: 'The document record exists but the file could not be found in storage.'
            });
          }
          
          return res.status(500).json({ 
            message: 'Failed to download file',
            error: 'An error occurred while retrieving the file from storage'
          });
        }
      }
    } catch (error: any) {
      // console.error('❌ [DOCUMENT DOWNLOAD] Error serving document file:', error);
      res.status(500).json({ message: 'Failed to serve document file' });
    }
  });

  // ===========================================================================
  // Document linking (date-based sequence with explicit overrides)
  // ===========================================================================
  const checkDocumentAccess = async (documentId: string, user: any) => {
    const orgs = await storage.getUserOrganizations(user.id);
    const orgIds = orgs.map((o: any) => o.organizationId);
    return storage.getDocumentWithScope(documentId, user.id, user.role, orgIds);
  };

  app.get('/api/documents/:id/neighbors', requireAuth, asyncHandler(async (req: any, res) => {
    const accessible = await checkDocumentAccess(req.params.id, req.user);
    if (!accessible) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    const { resolveDocumentNeighbors } = await import('../services/document-link-service');
    const result = await resolveDocumentNeighbors(req.params.id, { role: req.user.role });
    if (!result) return res.status(404).json({ message: 'Document not found' });
    res.json({
      currentId: result.current.id,
      previous: result.previous.document
        ? {
            id: result.previous.document.id,
            name: result.previous.document.name,
            effectiveDate: result.previous.document.effectiveDate,
            createdAt: result.previous.document.createdAt,
            documentType: result.previous.document.documentType,
            source: result.previous.source,
          }
        : null,
      next: result.next.document
        ? {
            id: result.next.document.id,
            name: result.next.document.name,
            effectiveDate: result.next.document.effectiveDate,
            createdAt: result.next.document.createdAt,
            documentType: result.next.document.documentType,
            source: result.next.source,
          }
        : null,
    });
  }));

  app.get('/api/documents/:id/links', requireAuth, asyncHandler(async (req: any, res) => {
    const accessible = await checkDocumentAccess(req.params.id, req.user);
    if (!accessible) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    const { listLinksForDocument } = await import('../services/document-link-service');
    const links = await listLinksForDocument(req.params.id);
    res.json({ links });
  }));

  const linkBodySchema = z.object({
    targetDocumentId: z.string().min(1),
    position: z.enum(['before', 'after']),
    ordinal: z.number().int().optional(),
  });

  app.post('/api/documents/:id/links', requireAuth, requireRole(['admin', 'manager', 'demo_manager']), asyncHandler(async (req: any, res) => {
    const accessible = await checkDocumentAccess(req.params.id, req.user);
    if (!accessible) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    const parsed = linkBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
    }
    const targetAccessible = await checkDocumentAccess(parsed.data.targetDocumentId, req.user);
    if (!targetAccessible) {
      return res.status(404).json({ message: 'Target document not found or access denied' });
    }
    const { upsertDocumentLink, DocumentLinkValidationError } = await import('../services/document-link-service');
    try {
      const link = await upsertDocumentLink({
        fromDocumentId: req.params.id,
        toDocumentId: parsed.data.targetDocumentId,
        position: parsed.data.position,
        ordinal: parsed.data.ordinal ?? null,
      });
      res.status(201).json(link);
    } catch (e: any) {
      if (e instanceof DocumentLinkValidationError) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      logError('Error creating document link', e);
      res.status(500).json({ message: 'Failed to create document link' });
    }
  }));

  app.delete('/api/documents/:id/links/:position', requireAuth, requireRole(['admin', 'manager', 'demo_manager']), asyncHandler(async (req: any, res) => {
    const accessible = await checkDocumentAccess(req.params.id, req.user);
    if (!accessible) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    const position = req.params.position;
    if (position !== 'before' && position !== 'after') {
      return res.status(400).json({ message: 'Position must be "before" or "after"' });
    }
    const { deleteDocumentLink } = await import('../services/document-link-service');
    const removed = await deleteDocumentLink({ fromDocumentId: req.params.id, position });
    if (!removed) return res.status(404).json({ message: 'Link not found' });
    res.json({ status: 'ok' });
  }));

  app.get('/api/documents/:id/link-suggestions', requireAuth, asyncHandler(async (req: any, res) => {
    const accessible = await checkDocumentAccess(req.params.id, req.user);
    if (!accessible) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    const { suggestLinkTargets } = await import('../services/document-link-service');
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10) || 10, 50) : 10;
    const result = await suggestLinkTargets({ documentId: req.params.id, query, limit, viewer: { role: req.user.role } });
    if (!result) return res.status(404).json({ message: 'Document not found' });
    res.json({
      suggestions: result.suggestions.map((s) => ({
        document: {
          id: s.document.id,
          name: s.document.name,
          documentType: s.document.documentType,
          effectiveDate: s.document.effectiveDate,
          createdAt: s.document.createdAt,
          buildingId: s.document.buildingId,
          residenceId: s.document.residenceId,
        },
        score: Math.round(s.score * 100) / 100,
        explain: s.explain,
      })),
    });
  }));

}
