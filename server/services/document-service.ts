/**
 * Unified Document Service
 * 
 * This service provides a DRY (Don't Repeat Yourself) approach to document management.
 * All document upload, view, download, and delete operations should use this service
 * to ensure consistent path structure, access control, and error handling.
 * 
 * Path Hierarchy Standard:
 * - Building documents: /objects/buildings/{buildingId}/documents/{uuid}_{filename}
 * - Bill documents: /objects/buildings/{buildingId}/bills/{uuid}_{filename}
 * - Inventory documents: /objects/buildings/{buildingId}/inventory/{uuid}_{filename}
 * - Project documents: /objects/buildings/{buildingId}/projects/{uuid}_{filename}
 * - Demand documents: /objects/buildings/{buildingId}/demands/{uuid}_{filename}
 * - Residence documents: /objects/buildings/{buildingId}/residences/{residenceId}/documents/{uuid}_{filename}
 * - Bug attachments: /objects/bugs/{bugId}/{uuid}_{filename}
 * - Feature attachments: /objects/features/{featureId}/{uuid}_{filename}
 */

import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { db } from '../db';
import { documents, bills, buildings, residences } from '../../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { ObjectStorageService, ObjectNotFoundError } from '../objectStorage';
import {
  ObjectAclPolicy,
  ObjectAccessGroupType,
  ObjectPermission,
  canAccessObject,
  setObjectAclPolicy,
} from '../objectAcl';

const OBJECTS_PREFIX = '/objects/';

export type DocumentType = 
  | 'documents' 
  | 'bills' 
  | 'inventory' 
  | 'projects' 
  | 'demands'
  | 'bugs'
  | 'features'
  | 'maintenance';

export interface DocumentContext {
  type: DocumentType;
  buildingId?: string;
  residenceId?: string;
  entityId?: string; // For bugs, features, bills, etc.
  organizationId?: string;
}

export interface UploadResult {
  success: boolean;
  filePath?: string;
  uploadUrl?: string;
  error?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface DocumentInfo {
  id: string;
  filePath: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  buildingId?: string;
  residenceId?: string;
}

export interface AclEvaluator {
  canAccessObject: typeof canAccessObject;
}

export interface DocumentServiceDependencies {
  objectStorage?: ObjectStorageService;
  aclEvaluator?: AclEvaluator;
}

class DocumentService {
  private objectStorage: ObjectStorageService;
  private aclEvaluator: AclEvaluator;

  constructor(deps?: DocumentServiceDependencies) {
    this.objectStorage = deps?.objectStorage ?? new ObjectStorageService();
    this.aclEvaluator = deps?.aclEvaluator ?? { canAccessObject };
  }

  /**
   * Normalize a filename to be URL-safe
   */
  normalizeFilename(filename: string): string {
    if (!filename) return `file_${uuidv4().substring(0, 8)}`;

    let normalized = filename
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (normalized.length > 200) {
      const ext = normalized.includes('.') ? normalized.substring(normalized.lastIndexOf('.')) : '';
      normalized = normalized.substring(0, 200 - ext.length) + ext;
    }

    if (!normalized || normalized === '.' || normalized === '_') {
      normalized = `file_${uuidv4().substring(0, 8)}`;
    }

    return normalized;
  }

  /**
   * Build a standardized hierarchical path for a document
   * This is the SINGLE source of truth for document paths
   */
  buildHierarchicalPath(context: DocumentContext, originalFilename: string): string {
    const uuid = uuidv4();
    const normalizedName = this.normalizeFilename(originalFilename);
    const filename = `${uuid}_${normalizedName}`;

    const { type, buildingId, residenceId, entityId } = context;

    // Handle non-building document types
    if (type === 'bugs' && entityId) {
      return `bugs/${entityId}/${filename}`;
    }

    if (type === 'features' && entityId) {
      return `features/${entityId}/${filename}`;
    }

    // Building-level documents require a buildingId
    if (!buildingId) {
      throw new Error(`buildingId is required for document type: ${type}`);
    }

    // Residence-specific documents
    if (residenceId) {
      return `buildings/${buildingId}/residences/${residenceId}/documents/${filename}`;
    }

    // Bill documents attached to a specific bill
    if (type === 'bills' && entityId) {
      return `buildings/${buildingId}/bills/${filename}`;
    }

    // Map type to folder name
    const folderMap: Record<DocumentType, string> = {
      documents: 'documents',
      bills: 'bills',
      inventory: 'inventory',
      projects: 'projects',
      demands: 'demands',
      bugs: 'bugs',
      features: 'features',
      maintenance: 'documents',
    };

    const folder = folderMap[type] || 'documents';
    return `buildings/${buildingId}/${folder}/${filename}`;
  }

  /**
   * Normalize a path to include the /objects/ prefix
   * This ensures consistent path format across all operations
   */
  normalizePath(path: string): string {
    if (!path) return path;
    
    // Already has the prefix
    if (path.startsWith(OBJECTS_PREFIX)) {
      return path;
    }
    
    // Remove any leading slashes before adding prefix
    const cleanPath = path.replace(/^\/+/, '');
    return `${OBJECTS_PREFIX}${cleanPath}`;
  }

  /**
   * Get the storage path (without /objects/ prefix) for physical file operations
   */
  getStoragePath(logicalPath: string): string {
    if (logicalPath.startsWith(OBJECTS_PREFIX)) {
      return logicalPath.substring(OBJECTS_PREFIX.length);
    }
    return logicalPath;
  }

  /**
   * Get a presigned upload URL for a document
   */
  async getUploadUrl(context: DocumentContext, originalFilename: string): Promise<UploadResult> {
    try {
      const hierarchicalPath = this.buildHierarchicalPath(context, originalFilename);
      const uploadUrl = await this.objectStorage.getCustomPathUploadURL(hierarchicalPath);
      const normalizedPath = this.normalizePath(hierarchicalPath);

      return {
        success: true,
        filePath: normalizedPath,
        uploadUrl,
      };
    } catch (error: any) {
      console.error('[DocumentService] Error getting upload URL:', error);
      return {
        success: false,
        error: error.message || 'Failed to get upload URL',
      };
    }
  }

  /**
   * Set ACL policy for a document
   */
  async setDocumentAcl(
    filePath: string,
    ownerId: string,
    context: DocumentContext,
    visibility: 'public' | 'private' = 'private'
  ): Promise<boolean> {
    try {
      const normalizedPath = this.normalizePath(filePath);
      
      const aclPolicy: ObjectAclPolicy = {
        owner: ownerId,
        visibility,
        aclRules: [],
      };

      // Add organization-level access if available
      if (context.organizationId) {
        aclPolicy.aclRules!.push({
          group: {
            type: ObjectAccessGroupType.ORGANIZATION,
            id: context.organizationId,
          },
          permission: ObjectPermission.READ,
        });
      }

      // Add building-level access if available
      if (context.buildingId) {
        aclPolicy.aclRules!.push({
          group: {
            type: ObjectAccessGroupType.BUILDING,
            id: context.buildingId,
          },
          permission: ObjectPermission.READ,
        });
      }

      // Add residence-level access if available
      if (context.residenceId) {
        aclPolicy.aclRules!.push({
          group: {
            type: ObjectAccessGroupType.RESIDENCE,
            id: context.residenceId,
          },
          permission: ObjectPermission.READ,
        });
      }

      await this.objectStorage.trySetObjectEntityAclPolicy(normalizedPath, aclPolicy);
      return true;
    } catch (error: any) {
      console.error('[DocumentService] Error setting ACL:', error);
      return false;
    }
  }

  /**
   * Check if a user can access a document
   */
  async canUserAccessDocument(
    userId: string,
    userRole: string,
    filePath: string,
    permission: ObjectPermission = ObjectPermission.READ
  ): Promise<AccessCheckResult> {
    try {
      // Admins have full access
      if (userRole === 'admin' || userRole === 'demo_admin') {
        return { allowed: true };
      }

      const normalizedPath = this.normalizePath(filePath);
      
      // Try to get the file and check ACL
      try {
        const objectFile = await this.objectStorage.getObjectEntityFile(normalizedPath);
        const hasAccess = await this.aclEvaluator.canAccessObject({
          userId,
          objectFile,
          requestedPermission: permission,
        });

        return {
          allowed: hasAccess,
          reason: hasAccess ? undefined : 'Access denied by ACL policy',
        };
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          // File doesn't exist in storage - try fallback path
          const storagePath = this.getStoragePath(normalizedPath);
          try {
            const fallbackPath = this.normalizePath(storagePath);
            const objectFile = await this.objectStorage.getObjectEntityFile(fallbackPath);
            const hasAccess = await this.aclEvaluator.canAccessObject({
              userId,
              objectFile,
              requestedPermission: permission,
            });
            return { allowed: hasAccess };
          } catch {
            // Allow access for missing files - let download handler return 404
            return { allowed: true, reason: 'File not found - allowing access check to pass' };
          }
        }
        throw error;
      }
    } catch (error: any) {
      console.error('[DocumentService] Error checking access:', error);
      return { allowed: false, reason: error.message };
    }
  }

  /**
   * Download a document to the response stream
   */
  async downloadDocument(
    filePath: string,
    res: Response,
    options?: { cacheTtlSec?: number; filename?: string; inline?: boolean; mimeType?: string }
  ): Promise<boolean> {
    try {
      // Build a deduplicated list of path variations to try. Different
      // documents have been stored over time with slightly different
      // conventions (with/without the /objects/ prefix, with/without a
      // leading slash, with/without a buildings/ prefix). Try them all
      // and log which ones we tried so future failures are debuggable.
      const candidates: string[] = [];
      const push = (p: string | undefined | null) => {
        if (!p) return;
        if (!candidates.includes(p)) candidates.push(p);
      };

      const raw = filePath;
      const noLeadingSlash = filePath.replace(/^\/+/, '');
      const stripped = this.getStoragePath(filePath);

      push(this.normalizePath(filePath));
      push(this.normalizePath(stripped));
      push(raw);
      push(`/${noLeadingSlash}`);
      push(noLeadingSlash);
      push(stripped);
      // Try with and without buildings/ prefix
      if (noLeadingSlash.startsWith('buildings/')) {
        const withoutBuildings = noLeadingSlash.replace(/^buildings\//, '');
        push(this.normalizePath(withoutBuildings));
        push(withoutBuildings);
      } else {
        push(this.normalizePath(`buildings/${noLeadingSlash}`));
        push(`buildings/${noLeadingSlash}`);
      }

      let objectFile;
      const triedPaths: string[] = [];
      let lastNonNotFoundError: unknown = null;
      for (const candidate of candidates) {
        triedPaths.push(candidate);
        try {
          objectFile = await this.objectStorage.getObjectEntityFile(candidate);
          break;
        } catch (error) {
          if (error instanceof ObjectNotFoundError) continue;
          lastNonNotFoundError = error;
          break;
        }
      }

      if (!objectFile) {
        if (lastNonNotFoundError) throw lastNonNotFoundError;
        console.error(
          '[DocumentService] File not found at any path. Original:',
          filePath,
          'Tried:',
          triedPaths
        );
        if (!res.headersSent) {
          res.status(404).json({
            error: 'File not found',
            originalPath: filePath,
            triedPaths,
          });
        }
        return false;
      }

      // Set content-disposition header if filename provided
      if (options?.filename) {
        const disposition = options?.inline ? 'inline' : 'attachment';
        res.setHeader('Content-Disposition', `${disposition}; filename="${options.filename}"`);
      }

      // Forward the DB-recorded MIME type so the response carries the correct
      // Content-Type regardless of what (if anything) was stamped on the GCS
      // object metadata at upload time. Without this, files uploaded as
      // application/octet-stream would still be downloaded by the browser
      // even when Content-Disposition is set to inline.
      if (options?.mimeType) {
        res.setHeader('Content-Type', options.mimeType);
      }

      await this.objectStorage.downloadObject(objectFile, res, options?.cacheTtlSec || 3600);
      return true;
    } catch (error: any) {
      console.error('[DocumentService] Error downloading document:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
      return false;
    }
  }

  /**
   * Delete a document from storage
   */
  async deleteDocument(filePath: string): Promise<boolean> {
    try {
      const normalizedPath = this.normalizePath(filePath);
      return await this.objectStorage.deleteObject(normalizedPath);
    } catch (error: any) {
      console.error('[DocumentService] Error deleting document:', error);
      return false;
    }
  }

  /**
   * Get building context for document operations
   */
  async getBuildingContext(buildingId: string): Promise<{ buildingId: string; organizationId: string } | null> {
    try {
      const [building] = await db.select({
        id: buildings.id,
        organizationId: buildings.organizationId,
      }).from(buildings).where(eq(buildings.id, buildingId)).limit(1);

      if (!building) return null;

      return {
        buildingId: building.id,
        organizationId: building.organizationId,
      };
    } catch (error) {
      console.error('[DocumentService] Error getting building context:', error);
      return null;
    }
  }

  /**
   * Get residence context including building info
   */
  async getResidenceContext(residenceId: string): Promise<{ buildingId: string; residenceId: string; organizationId: string } | null> {
    try {
      const [residence] = await db.select({
        id: residences.id,
        buildingId: residences.buildingId,
      }).from(residences).where(eq(residences.id, residenceId)).limit(1);

      if (!residence) return null;

      const buildingContext = await this.getBuildingContext(residence.buildingId);
      if (!buildingContext) return null;

      return {
        buildingId: buildingContext.buildingId,
        residenceId: residence.id,
        organizationId: buildingContext.organizationId,
      };
    } catch (error) {
      console.error('[DocumentService] Error getting residence context:', error);
      return null;
    }
  }

  /**
   * Normalize all paths in the database to use /objects/ prefix
   * This is a migration helper
   */
  async normalizeAllPaths(dryRun: boolean = true): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    // Get all documents without /objects/ prefix
    const docsToUpdate = await db.select({
      id: documents.id,
      filePath: documents.filePath,
    }).from(documents).where(isNotNull(documents.filePath));

    for (const doc of docsToUpdate) {
      if (doc.filePath && !doc.filePath.startsWith(OBJECTS_PREFIX)) {
        const normalizedPath = this.normalizePath(doc.filePath);
        if (!dryRun) {
          try {
            await db.update(documents)
              .set({ filePath: normalizedPath })
              .where(eq(documents.id, doc.id));
            updated++;
          } catch (error) {
            console.error(`Error updating document ${doc.id}:`, error);
            errors++;
          }
        } else {
          updated++;
        }
      }
    }

    // Get all bills without /objects/ prefix
    const billsToUpdate = await db.select({
      id: bills.id,
      filePath: bills.filePath,
    }).from(bills).where(isNotNull(bills.filePath));

    for (const bill of billsToUpdate) {
      if (bill.filePath && !bill.filePath.startsWith(OBJECTS_PREFIX)) {
        const normalizedPath = this.normalizePath(bill.filePath);
        if (!dryRun) {
          try {
            await db.update(bills)
              .set({ filePath: normalizedPath })
              .where(eq(bills.id, bill.id));
            updated++;
          } catch (error) {
            console.error(`Error updating bill ${bill.id}:`, error);
            errors++;
          }
        } else {
          updated++;
        }
      }
    }

    return { updated, errors };
  }
}

// Export singleton instance
export const documentService = new DocumentService();

// Export class for testing
export { DocumentService };

// Factory function for creating document service with custom dependencies (for testing)
export function createDocumentService(deps?: DocumentServiceDependencies): DocumentService {
  return new DocumentService(deps);
}
