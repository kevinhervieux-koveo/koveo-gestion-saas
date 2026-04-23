/**
 * Optimized File Storage Service
 * 
 * Streamlined file storage architecture with reduced directory depth,
 * intelligent caching, and improved performance while maintaining security.
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { LRUCache as LRU } from 'lru-cache';
import type { UploadContext } from '@shared/config/upload-config';

// Performance-optimized caching with invalidation support
const filePathCache = new LRU<string, string>({ max: 1000, ttl: 1000 * 60 * 15 }); // 15 min cache
const metadataCache = new LRU<string, FileMetadata>({ max: 500, ttl: 1000 * 60 * 10 }); // 10 min cache
const accessPermissionCache = new LRU<string, boolean>({ max: 1000, ttl: 1000 * 60 * 2 }); // Reduced to 2 min for security

// Legacy path mapping for backward compatibility
const legacyPathLookup = new LRU<string, string>({ max: 5000, ttl: 1000 * 60 * 60 }); // 1 hour cache for legacy paths

// Performance metrics
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  filesystemOperations: 0,
  avgResponseTime: 0,
  totalRequests: 0
};

export interface OptimizedStorageResult {
  success: boolean;
  filePath?: string;
  directory?: string;
  error?: string;
  fromCache?: boolean;
  performanceMetrics?: {
    responseTime: number;
    cacheHit: boolean;
    filesystemOps: number;
  };
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  context: UploadContext;
  accessFrequency?: number;
  lastAccessed?: Date;
  // Legacy path tracking for backward compatibility
  legacyPath?: string;
  migrationVersion?: string;
}

export class OptimizedFileStorageService {
  private readonly baseUploadDir: string;
  private readonly maxDirectoryDepth = 4; // Secure role-based structure
  private readonly migrationVersion = 'v2.0.0';
  
  constructor() {
    this.baseUploadDir = path.join(process.cwd(), 'uploads');
  }

  /**
   * FIXED: Secure role-based directory structure that preserves access patterns
   * New structure: {type}/org_{orgId}/building_{buildingId}/role_{role}/{filename}
   * This maintains clear access boundaries while optimizing performance
   */
  private generateSecureRoleBasedPath(context: UploadContext, filename?: string): string {
    const { type, organizationId, buildingId, residenceId, userRole, userId } = context;
    
    // Build secure directory structure that preserves role-based access
    const parts: string[] = [type];
    
    // Always include organization for isolation
    parts.push(`org_${organizationId || 'default'}`);
    
    // Include building for building-scoped files
    if (buildingId) {
      parts.push(`building_${buildingId}`);
    }
    
    // Include residence for residence-scoped files
    if (residenceId && buildingId) {
      parts.push(`residence_${residenceId}`);
    }
    
    // Always include role for access control
    parts.push(`role_${userRole || 'user'}`);
    
    if (filename) {
      parts.push(filename);
    }
    
    return parts.join('/');
  }

  /**
   * Legacy hash-based path generator for backward compatibility
   * This is used to lookup existing files that were created with the old system
   */
  private generateLegacyHashPath(context: UploadContext, filename?: string): string {
    const { type, organizationId, buildingId, residenceId, userRole } = context;
    
    const contextData = {
      org: organizationId || 'default',
      building: buildingId || null,
      residence: residenceId || null,
      role: userRole || 'user'
    };
    
    const contextString = JSON.stringify(contextData);
    const contextHash = crypto.createHash('sha256').update(contextString).digest('hex').substring(0, 8);
    
    const parts = [type, contextHash];
    
    if (filename) {
      parts.push(filename);
    }
    
    return parts.join('/');
  }

  /**
   * Store file with optimized directory structure and caching
   */
  async storeFile(
    file: Express.Multer.File,
    context: UploadContext,
    userRole: string,
    userId: string
  ): Promise<OptimizedStorageResult> {
    const startTime = performance.now();
    let filesystemOps = 0;
    
    try {
      // Validate context (from original service)
      if (!this.validateUploadContext(context, userRole)) {
        return {
          success: false,
          error: `Insufficient permissions for ${userRole} to upload to this context`
        };
      }

      // Generate secure filename
      const uniqueFileName = this.generateSecureFilename(file.originalname);
      const securePath = this.generateSecureRoleBasedPath({ ...context, userRole, userId }, uniqueFileName);
      const fullDirectory = path.dirname(path.join(this.baseUploadDir, securePath));
      const filePath = path.join(this.baseUploadDir, securePath);

      // Ensure directory exists (single operation instead of multiple levels)
      await this.ensureDirectoryExists(fullDirectory);
      filesystemOps++;

      // Store file
      if (file.path) {
        await fs.copyFile(file.path, filePath);
        await fs.unlink(file.path).catch(() => {});
      } else if (file.buffer) {
        await fs.writeFile(filePath, file.buffer);
      } else {
        return { success: false, error: 'No file data available' };
      }
      filesystemOps++;

      // Store metadata with caching and migration tracking
      const metadata: FileMetadata = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: userId,
        uploadedAt: new Date(),
        context: { ...context, userRole, userId },
        accessFrequency: 0,
        lastAccessed: new Date(),
        migrationVersion: this.migrationVersion
      };
      
      await this.storeFileMetadata(filePath, metadata);
      filesystemOps++;
      
      // Cache the metadata and path
      const cacheKey = this.generateCacheKey(context, userId, userRole);
      metadataCache.set(filePath, metadata);
      filePathCache.set(cacheKey, securePath);

      const responseTime = performance.now() - startTime;
      this.updatePerformanceMetrics(responseTime, false, filesystemOps);

      return {
        success: true,
        filePath: securePath,
        directory: path.dirname(securePath),
        performanceMetrics: {
          responseTime,
          cacheHit: false,
          filesystemOps
        }
      };

    } catch (error) {
      console.error('Error storing file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * FIXED: Secure file retrieval with backward compatibility and proper caching
   */
  async retrieveFile(
    relativePath: string,
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; filePath?: string; error?: string; fromCache?: boolean; performanceMetrics?: any }> {
    const startTime = performance.now();
    let filesystemOps = 0;
    let fromCache = false;
    
    try {
      // Check cache first (with shorter TTL for security)
      const cacheKey = `${relativePath}:${userId}:${userRole}`;
      const cachedAccess = accessPermissionCache.get(cacheKey);
      
      if (cachedAccess !== undefined) {
        fromCache = true;
        performanceMetrics.cacheHits++;
        
        if (!cachedAccess) {
          return {
            success: false,
            error: 'Access denied (cached)',
            fromCache: true
          };
        }
      } else {
        performanceMetrics.cacheMisses++;
      }

      // Sanitize and validate path
      const sanitizedPath = this.sanitizePath(relativePath);
      let fullPath = path.join(this.baseUploadDir, sanitizedPath);
      
      // Security validation
      if (!this.isPathSecure(fullPath)) {
        return {
          success: false,
          error: 'Access denied - invalid file path'
        };
      }

      // Check if file exists at current path
      if (!existsSync(fullPath)) {
        filesystemOps++;
        
        // Try legacy path lookup for backward compatibility
        const legacyPath = legacyPathLookup.get(relativePath);
        if (legacyPath) {
          const legacyFullPath = path.join(this.baseUploadDir, legacyPath);
          if (this.isPathSecure(legacyFullPath) && existsSync(legacyFullPath)) {
            fullPath = legacyFullPath;
            filesystemOps++;
          } else {
            return {
              success: false,
              error: 'File not found (legacy path also invalid)'
            };
          }
        } else {
          return {
            success: false,
            error: 'File not found'
          };
        }
      }

      // Load metadata with caching
      let metadata = metadataCache.get(fullPath);
      if (!metadata) {
        metadata = await this.getFileMetadata(fullPath);
        filesystemOps++;
        if (metadata) {
          metadataCache.set(fullPath, metadata);
        }
      } else {
        fromCache = true;
      }

      if (!metadata) {
        return {
          success: false,
          error: 'File metadata not found'
        };
      }

      // Check access permissions (cached if possible)
      if (!fromCache) {
        const hasAccess = this.checkFileAccess(metadata, userId, userRole);
        accessPermissionCache.set(cacheKey, hasAccess);
        
        if (!hasAccess) {
          return {
            success: false,
            error: 'Access denied'
          };
        }
      }

      // Update access tracking
      if (metadata) {
        metadata.accessFrequency = (metadata.accessFrequency || 0) + 1;
        metadata.lastAccessed = new Date();
        metadataCache.set(fullPath, metadata);
      }

      const responseTime = performance.now() - startTime;
      this.updatePerformanceMetrics(responseTime, fromCache, filesystemOps);

      return {
        success: true,
        filePath: fullPath,
        fromCache,
        performanceMetrics: {
          responseTime,
          cacheHit: fromCache,
          filesystemOps
        }
      };

    } catch (error) {
      console.error('Error retrieving file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Optimized file listing with batch operations
   */
  async listFiles(
    context: UploadContext,
    userId: string,
    userRole: string,
    limit = 50,
    offset = 0
  ): Promise<{ success: boolean; files?: FileMetadata[]; total?: number; error?: string; fromCache?: boolean }> {
    try {
      if (!this.validateUploadContext(context, userRole)) {
        return {
          success: false,
          error: 'Insufficient permissions to list files in this context'
        };
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(context, userId, userRole, `list:${limit}:${offset}`);
      const cached = filePathCache.get(cacheKey);
      
      if (cached) {
        return {
          success: true,
          files: JSON.parse(cached),
          fromCache: true
        };
      }

      const contextPath = this.generateOptimizedPath(context);
      const fullDirectory = path.join(this.baseUploadDir, contextPath);

      if (!existsSync(fullDirectory)) {
        return { success: true, files: [], total: 0 };
      }

      // Batch read directory contents
      const files = await fs.readdir(fullDirectory);
      const fileMetadata: FileMetadata[] = [];

      // Process files in batches for better performance
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchPromises = batch
          .filter(file => !file.endsWith('.metadata.json'))
          .map(async (file) => {
            const filePath = path.join(fullDirectory, file);
            let metadata = metadataCache.get(filePath);
            
            if (!metadata) {
              metadata = await this.getFileMetadata(filePath);
              if (metadata) {
                metadataCache.set(filePath, metadata);
              }
            }
            
            if (metadata && this.checkFileAccess(metadata, userId, userRole)) {
              return metadata;
            }
            return null;
          });

        const batchResults = await Promise.all(batchPromises);
        fileMetadata.push(...batchResults.filter(Boolean) as FileMetadata[]);
      }

      // Apply pagination
      const total = fileMetadata.length;
      const paginatedFiles = fileMetadata
        .slice(offset, offset + limit)
        .sort((a, b) => (b.lastAccessed?.getTime() || 0) - (a.lastAccessed?.getTime() || 0)); // Sort by recent access

      // Cache results
      filePathCache.set(cacheKey, JSON.stringify(paginatedFiles));

      return {
        success: true,
        files: paginatedFiles,
        total,
        fromCache: false
      };

    } catch (error) {
      console.error('Error listing files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics() {
    return {
      ...performanceMetrics,
      cacheHitRatio: performanceMetrics.totalRequests > 0 
        ? (performanceMetrics.cacheHits / performanceMetrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      cacheSize: {
        filePathCache: filePathCache.size,
        metadataCache: metadataCache.size,
        accessPermissionCache: accessPermissionCache.size
      }
    };
  }

  /**
   * FIXED: Cache invalidation methods for security and data integrity
   */
  invalidateFileCache(filePath: string): void {
    // Remove from metadata cache
    metadataCache.delete(filePath);
    
    // Remove from legacy path lookup
    legacyPathLookup.forEach((value, key) => {
      if (value === filePath) {
        legacyPathLookup.delete(key);
      }
    });
    
    // Clear related permission cache entries
    const relatedKeys: string[] = [];
    accessPermissionCache.forEach((value, key) => {
      if (key.includes(filePath)) {
        relatedKeys.push(key);
      }
    });
    relatedKeys.forEach(key => accessPermissionCache.delete(key));
  }

  /**
   * Invalidate cache entries for a specific user/role/context
   */
  invalidateUserCache(userId: string, userRole?: string, context?: UploadContext): void {
    const keysToDelete: string[] = [];
    
    accessPermissionCache.forEach((value, key) => {
      const keyParts = key.split(':');
      if (keyParts.includes(userId) || (userRole && keyParts.includes(userRole))) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => accessPermissionCache.delete(key));
    
    if (context) {
      const contextCacheKey = this.generateCacheKey(context, userId, userRole || 'user');
      filePathCache.delete(contextCacheKey);
    }
  }

  /**
   * Invalidate all permission caches (for critical security updates)
   */
  invalidateAllPermissionCache(): void {
    accessPermissionCache.clear();
    console.log('[SECURITY] All permission caches invalidated');
  }

  /**
   * Clear caches (for testing or maintenance)
   */
  clearCaches() {
    filePathCache.clear();
    metadataCache.clear();
    accessPermissionCache.clear();
    legacyPathLookup.clear();
    performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      filesystemOperations: 0,
      avgResponseTime: 0,
      totalRequests: 0
    };
  }

  /**
   * FIXED: Delete file with proper cache invalidation
   */
  async deleteFile(
    relativePath: string,
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const sanitizedPath = this.sanitizePath(relativePath);
      const fullPath = path.join(this.baseUploadDir, sanitizedPath);
      
      if (!this.isPathSecure(fullPath)) {
        return { success: false, error: 'Access denied - invalid file path' };
      }

      // Check permissions before deletion
      const metadata = await this.getFileMetadata(fullPath);
      if (!metadata || !this.checkFileAccess(metadata, userId, userRole)) {
        return { success: false, error: 'Access denied or file not found' };
      }

      // Delete file and metadata
      if (existsSync(fullPath)) {
        await fs.unlink(fullPath);
      }
      
      const metadataPath = `${fullPath}.metadata.json`;
      if (existsSync(metadataPath)) {
        await fs.unlink(metadataPath);
      }

      // CRITICAL: Invalidate all related caches
      this.invalidateFileCache(relativePath);
      this.invalidateUserCache(userId, userRole, metadata.context);

      return { success: true };

    } catch (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * FIXED: Move file with proper cache invalidation and database update support
   */
  async moveFile(
    oldPath: string,
    newContext: UploadContext,
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      const sanitizedOldPath = this.sanitizePath(oldPath);
      const fullOldPath = path.join(this.baseUploadDir, sanitizedOldPath);
      
      if (!this.isPathSecure(fullOldPath) || !existsSync(fullOldPath)) {
        return { success: false, error: 'Source file not found or access denied' };
      }

      // Check permissions
      const metadata = await this.getFileMetadata(fullOldPath);
      if (!metadata || !this.checkFileAccess(metadata, userId, userRole)) {
        return { success: false, error: 'Access denied' };
      }

      // Generate new secure path
      const fileName = path.basename(fullOldPath);
      const newSecurePath = this.generateSecureRoleBasedPath(
        { ...newContext, userRole, userId }, 
        fileName
      );
      const fullNewPath = path.join(this.baseUploadDir, newSecurePath);
      const newDirectory = path.dirname(fullNewPath);

      // Ensure new directory exists
      await this.ensureDirectoryExists(newDirectory);

      // Move file and metadata
      await fs.rename(fullOldPath, fullNewPath);
      
      const oldMetadataPath = `${fullOldPath}.metadata.json`;
      const newMetadataPath = `${fullNewPath}.metadata.json`;
      if (existsSync(oldMetadataPath)) {
        // Update metadata with new context and legacy path tracking
        const updatedMetadata: FileMetadata = {
          ...metadata,
          context: { ...newContext, userRole, userId },
          legacyPath: oldPath,
          lastAccessed: new Date()
        };
        
        await fs.writeFile(newMetadataPath, JSON.stringify(updatedMetadata, null, 2));
        await fs.unlink(oldMetadataPath);
        
        // Add to legacy lookup for backward compatibility
        legacyPathLookup.set(oldPath, newSecurePath);
      }

      // CRITICAL: Invalidate all related caches
      this.invalidateFileCache(oldPath);
      this.invalidateFileCache(newSecurePath);
      this.invalidateUserCache(userId, userRole);

      return { 
        success: true, 
        newPath: newSecurePath 
      };

    } catch (error) {
      console.error('Error moving file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods
  private generateCacheKey(context: UploadContext, userId: string, userRole: string, suffix = ''): string {
    return `${context.type}:${context.organizationId}:${context.buildingId}:${context.residenceId}:${userRole}:${userId}${suffix ? ':' + suffix : ''}`;
  }

  private generateSecureFilename(originalName: string): string {
    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext).substring(0, 50);
    const secureId = crypto.randomUUID().substring(0, 8);
    const timestamp = Date.now();
    return `${name}_${secureId}_${timestamp}${ext}`;
  }

  private sanitizePath(filePath: string): string {
    return filePath.replace(/\.\.[\\\/]/g, '').replace(/^[\\\/]+/, '').replace(/[\\\/]+$/, '');
  }

  private isPathSecure(fullPath: string): boolean {
    const resolvedPath = path.resolve(fullPath);
    const resolvedBaseDir = path.resolve(this.baseUploadDir);
    return resolvedPath.startsWith(resolvedBaseDir);
  }

  private validateUploadContext(context: UploadContext, userRole: string): boolean {
    if (userRole === 'admin') return true;
    if (userRole === 'manager') return !!context.organizationId;
    if (userRole === 'resident') return !!(context.organizationId && (context.buildingId || context.residenceId));
    if (userRole === 'tenant') return !!(context.organizationId && context.buildingId && context.residenceId);
    return false;
  }

  private checkFileAccess(metadata: FileMetadata, userId: string, userRole: string): boolean {
    if (userRole === 'admin') return true;
    if (metadata.uploadedBy === userId) return true;
    if (userRole === 'manager' && metadata.context.organizationId) return true;
    if (userRole === 'resident' && (metadata.context.buildingId || metadata.context.residenceId)) return true;
    return false;
  }

  private async ensureDirectoryExists(directory: string): Promise<void> {
    if (!existsSync(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }
  }

  private async storeFileMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    const metadataPath = `${filePath}.metadata.json`;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const metadataPath = `${filePath}.metadata.json`;
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadataContent);
    } catch {
      return null;
    }
  }

  private updatePerformanceMetrics(responseTime: number, fromCache: boolean, filesystemOps: number): void {
    performanceMetrics.totalRequests++;
    performanceMetrics.filesystemOperations += filesystemOps;
    
    // Update average response time
    const totalTime = performanceMetrics.avgResponseTime * (performanceMetrics.totalRequests - 1) + responseTime;
    performanceMetrics.avgResponseTime = totalTime / performanceMetrics.totalRequests;

    if (fromCache) {
      performanceMetrics.cacheHits++;
    } else {
      performanceMetrics.cacheMisses++;
    }
  }
}

export const optimizedFileStorage = new OptimizedFileStorageService();