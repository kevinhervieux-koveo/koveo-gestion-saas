import type { Express } from 'express';
import { requireAuth } from '../auth';
import { storage } from '../storage';
import { insertDocumentSchema, type Document } from '../../shared/schemas/documents';
import { z } from 'zod';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getStorageClient } from '../lib/gcs';

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow most common document and image types
    const allowedTypes = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|gif|bmp|tiff)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents and images are allowed.'));
    }
  },
});

// Request validation schema
const uploadRequestSchema = z.object({
  residenceId: z.string().optional(),
  buildingId: z.string().optional(),
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  documentType: z.string().min(1, 'Document type is required'),
  isVisibleToTenants: z.string().transform(val => val === 'true').optional().default(false),
}).refine(data => data.residenceId || data.buildingId, {
  message: "Either residenceId or buildingId must be provided"
});

type UploadRequest = z.infer<typeof uploadRequestSchema>;

/**
 * Determines the appropriate GCS bucket based on environment
 */
function getGcsBucket(): string {
  const isDev = process.env.NODE_ENV === 'development';
  const bucketName = isDev 
    ? process.env.GCS_DEV_BUCKET_NAME 
    : process.env.GCS_PROD_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error(`GCS bucket name not configured for ${isDev ? 'development' : 'production'} environment`);
  }
  
  return bucketName;
}

/**
 * Generates a unique GCS path for the uploaded file
 */
function generateGcsPath(targetId: string, originalFilename: string, isResidence: boolean): string {
  const fileExtension = path.extname(originalFilename);
  const baseFilename = path.basename(originalFilename, fileExtension);
  const uniqueId = uuidv4();
  const sanitizedFilename = `${baseFilename}-${uniqueId}${fileExtension}`;
  
  const prefix = isResidence ? 'residences' : 'buildings';
  return `${prefix}/${targetId}/${sanitizedFilename}`;
}

/**
 * Uploads file to Google Cloud Storage
 */
async function uploadToGcs(filePath: string, gcsPath: string, originalFilename: string): Promise<string> {
  try {
    const storageClient = await getStorageClient();
    const bucketName = getGcsBucket();
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(gcsPath);

    // Create upload stream
    const stream = file.createWriteStream({
      metadata: {
        contentType: getMimeType(originalFilename),
        metadata: {
          originalName: originalFilename,
        },
      },
    });

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.pipe(stream)
        .on('error', (error) => {
          console.error('GCS upload error:', error);
          reject(new Error(`Failed to upload file to GCS: ${error.message}`));
        })
        .on('finish', () => {
          console.log(`File uploaded to GCS: ${gcsPath}`);
          resolve(gcsPath);
        });
    });
  } catch (error) {
    console.error('GCS client error:', error);
    throw new Error(`GCS client configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Clean up temporary file
 */
function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Failed to cleanup temp file:', filePath, error);
  }
}

/**
 * Register document upload routes
 */
export function registerDocumentUploadRoutes(app: Express): void {
  /**
   * POST /api/documents/upload
   * Upload a document file with metadata
   */
  app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req, res) => {
    let tempFilePath: string | undefined;
    
    try {
      // Validate uploaded file
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded',
          details: 'A file is required for document upload'
        });
      }

      tempFilePath = req.file.path;

      // Validate request body
      const validationResult = uploadRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const uploadData = validationResult.data;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required',
          details: 'User ID not found in session'
        });
      }

      // Determine target ID and type
      const targetId = uploadData.residenceId || uploadData.buildingId!;
      const isResidence = Boolean(uploadData.residenceId);

      // Generate unique GCS path
      const gcsPath = generateGcsPath(targetId, req.file.originalname, isResidence);

      // Upload file to GCS
      console.log(`Uploading file ${req.file.originalname} to GCS path: ${gcsPath}`);
      await uploadToGcs(tempFilePath, gcsPath, req.file.originalname);

      // Prepare document data for database
      const documentData = {
        name: uploadData.name,
        description: uploadData.description,
        documentType: uploadData.documentType,
        gcsPath: gcsPath,
        isVisibleToTenants: uploadData.isVisibleToTenants,
        residenceId: uploadData.residenceId || null,
        buildingId: uploadData.buildingId || null,
        uploadedById: userId,
      };

      // Validate document data against schema
      const documentValidation = insertDocumentSchema.safeParse(documentData);
      if (!documentValidation.success) {
        return res.status(400).json({
          error: 'Invalid document data',
          details: documentValidation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      // Create document record in database
      console.log('Creating document record in database');
      const newDocument = await storage.createDocument(documentValidation.data);

      // Return success response
      res.status(201).json({
        message: 'Document uploaded successfully',
        document: newDocument
      });

    } catch (error) {
      console.error('Document upload error:', error);
      
      // Clean up temp file on error
      if (tempFilePath) {
        cleanupTempFile(tempFilePath);
      }

      if (error instanceof Error) {
        if (error.message.includes('GCS')) {
          return res.status(500).json({
            error: 'File upload failed',
            details: 'Failed to upload file to cloud storage'
          });
        }
        
        if (error.message.includes('database') || error.message.includes('storage')) {
          return res.status(500).json({
            error: 'Database error',
            details: 'Failed to save document metadata'
          });
        }
      }

      return res.status(500).json({
        error: 'Internal server error',
        details: 'An unexpected error occurred during file upload'
      });
    } finally {
      // Always clean up temp file
      if (tempFilePath) {
        cleanupTempFile(tempFilePath);
      }
    }
  });
}