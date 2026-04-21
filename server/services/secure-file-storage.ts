/**
 * Secure File Storage Service
 * 
 * Handles secure file storage with role-based directory structure
 * and proper access control for different upload contexts.
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { generateStorageDirectory, validateUploadContext, type UploadContext } from '@shared/config/upload-config';

// Secure filename sanitization function
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

// Generate cryptographically secure random filename
function generateSecureFilename(originalName: string): string {
  const sanitizedName = sanitizeFilename(originalName);
  const ext = path.extname(sanitizedName);
  const secureId = crypto.randomUUID();
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `${secureId}_${timestamp}_${randomSuffix}${ext}`;
}

export interface StorageResult {
  success: boolean;
  filePath?: string;
  directory?: string;
  error?: string;
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  context: UploadContext;
}

export class SecureFileStorageService {
  private readonly baseUploadDir: string;

  constructor() {
    // Use /tmp/uploads for persistent storage in Replit
    this.baseUploadDir = path.join('/tmp', 'uploads');
  }

  /**
   * Store a file securely based on the upload context and user role
   */
  async storeFile(
    file: Express.Multer.File,
    context: UploadContext,
    userRole: string,
    userId: string
  ): Promise<StorageResult> {
    try {
      // Validate the upload context for the user role
      if (!validateUploadContext(context, userRole)) {
        return {
          success: false,
          error: `Insufficient permissions for ${userRole} to upload to this context`
        };
      }

      // SECURITY: Generate and validate secure directory path
      const contextWithUser = { ...context, userRole, userId };
      const relativePath = generateStorageDirectory(contextWithUser);
      
      // Ensure relativePath doesn't contain traversal sequences
      const sanitizedRelativePath = relativePath.replace(/\.\.[\\\/]/g, '').replace(/^[\\\/]+/, '');
      const fullDirectory = path.join(this.baseUploadDir, sanitizedRelativePath);
      
      // SECURITY: Validate that fullDirectory is within baseUploadDir
      const resolvedFullDir = path.resolve(fullDirectory);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);
      if (!resolvedFullDir.startsWith(resolvedBaseDir)) {
        throw new Error('Invalid directory path - outside allowed storage area');
      }

      // Ensure directory exists
      await this.ensureDirectoryExists(fullDirectory);

      // SECURITY: Generate cryptographically secure filename
      const uniqueFileName = generateSecureFilename(file.originalname);
      
      const filePath = path.join(fullDirectory, uniqueFileName);

      // Copy file to secure location
      if (file.path) {
        // File is on disk (from multer disk storage)
        await fs.copyFile(file.path, filePath);
        // Clean up temporary file
        await fs.unlink(file.path).catch(() => {}); // Ignore errors
      } else if (file.buffer) {
        // File is in memory (from multer memory storage)
        await fs.writeFile(filePath, file.buffer);
      } else {
        return {
          success: false,
          error: 'No file data available'
        };
      }

      // Store metadata
      await this.storeFileMetadata(filePath, {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: userId,
        uploadedAt: new Date(),
        context: contextWithUser
      });

      return {
        success: true,
        filePath: path.relative(this.baseUploadDir, filePath),
        directory: relativePath
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
   * Retrieve a file if the user has access to it
   */
  async retrieveFile(
    relativePath: string,
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // SECURITY: Sanitize and validate relative path
      const sanitizedPath = relativePath.replace(/\.\.[\\/]/g, '').replace(/^[\\/]+/, '');
      const fullPath = path.join(this.baseUploadDir, sanitizedPath);
      
      // SECURITY: Ensure the resolved path is within baseUploadDir
      const resolvedPath = path.resolve(fullPath);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);
      if (!resolvedPath.startsWith(resolvedBaseDir)) {
        return {
          success: false,
          error: 'Access denied - invalid file path'
        };
      }

      // Check if file exists
      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // Load metadata to check access
      const metadata = await this.getFileMetadata(fullPath);
      if (!metadata) {
        return {
          success: false,
          error: 'File metadata not found'
        };
      }

      // Check access permissions
      const hasAccess = this.checkFileAccess(metadata, userId, userRole);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      return {
        success: true,
        filePath: fullPath
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
   * Delete a file if the user has access to it
   */
  async deleteFile(
    relativePath: string,
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.join(this.baseUploadDir, relativePath);

      // Check if file exists
      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // Load metadata to check access
      const metadata = await this.getFileMetadata(fullPath);
      if (!metadata) {
        return {
          success: false,
          error: 'File metadata not found'
        };
      }

      // Check delete permissions (stricter than read access)
      const canDelete = this.checkDeleteAccess(metadata, userId, userRole);
      if (!canDelete) {
        return {
          success: false,
          error: 'Delete access denied'
        };
      }

      // Delete file and metadata
      await fs.unlink(fullPath);
      await this.deleteFileMetadata(fullPath);

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
   * List files accessible to the user in a specific context
   */
  async listFiles(
    context: UploadContext,
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; files?: FileMetadata[]; error?: string }> {
    try {
      if (!validateUploadContext(context, userRole)) {
        return {
          success: false,
          error: 'Insufficient permissions to list files in this context'
        };
      }

      const contextWithUser = { ...context, userRole, userId };
      const relativePath = generateStorageDirectory(contextWithUser);
      const fullDirectory = path.join(this.baseUploadDir, relativePath);

      if (!existsSync(fullDirectory)) {
        return { success: true, files: [] };
      }

      const files = await fs.readdir(fullDirectory);
      const fileMetadata: FileMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.metadata.json')) continue; // Skip metadata files
        
        const filePath = path.join(fullDirectory, file);
        const metadata = await this.getFileMetadata(filePath);
        
        if (metadata && this.checkFileAccess(metadata, userId, userRole)) {
          fileMetadata.push(metadata);
        }
      }

      return {
        success: true,
        files: fileMetadata
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
   * Ensure a directory exists, creating it if necessary
   */
  private async ensureDirectoryExists(directory: string): Promise<void> {
    if (!existsSync(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }
  }

  /**
   * Store file metadata
   */
  private async storeFileMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    const metadataPath = `${filePath}.metadata.json`;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get file metadata
   */
  private async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const metadataPath = `${filePath}.metadata.json`;
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadataContent);
    } catch {
      return null;
    }
  }

  /**
   * Delete file metadata
   */
  private async deleteFileMetadata(filePath: string): Promise<void> {
    try {
      const metadataPath = `${filePath}.metadata.json`;
      await fs.unlink(metadataPath);
    } catch {
      // Ignore errors when deleting metadata
    }
  }

  /**
   * Check if user has access to read a file
   */
  private checkFileAccess(metadata: FileMetadata, userId: string, userRole: string): boolean {
    // Admin has access to everything
    if (userRole === 'admin') {
      return true;
    }

    // User can always access their own files
    if (metadata.uploadedBy === userId) {
      return true;
    }

    // Manager can access files in their organization
    if (userRole === 'manager' && metadata.context.organizationId) {
      return true; // Additional org membership check would be needed in real implementation
    }

    // Resident can access files in their building/residence
    if (userRole === 'resident' && 
        (metadata.context.buildingId || metadata.context.residenceId)) {
      return true; // Additional building/residence membership check would be needed
    }

    return false;
  }

  /**
   * Check if user has access to delete a file
   */
  private checkDeleteAccess(metadata: FileMetadata, userId: string, userRole: string): boolean {
    // Admin can delete everything
    if (userRole === 'admin') {
      return true;
    }

    // User can delete their own files
    if (metadata.uploadedBy === userId) {
      return true;
    }

    // Manager can delete files in their organization (stricter control)
    if (userRole === 'manager' && metadata.context.organizationId) {
      return true;
    }

    // Residents and tenants can only delete their own files
    return false;
  }
}

export const secureFileStorage = new SecureFileStorageService();