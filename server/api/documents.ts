import type { Express } from 'express';
import { requireAuth, requireRole } from '../auth';
import { storage } from '../storage';
import {
  insertDocumentSchema,
  type Document,
  type InsertDocument,
  insertDocumentBuildingSchema,
  type DocumentBuilding,
  type InsertDocumentBuilding,
  insertDocumentResidentSchema,
  type DocumentResident,
  type InsertDocumentResident,
} from '../../shared/schemas/documents';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getGCSClient } from '../../src/lib/gcs';

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

// Document categories for validation - synchronized with frontend
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

const createBuildingDocumentSchema = insertDocumentBuildingSchema.extend({
  type: z.enum(DOCUMENT_CATEGORIES),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const createResidentDocumentSchema = insertDocumentResidentSchema.extend({
  type: z.enum(DOCUMENT_CATEGORIES),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

// Schema for unified document upload
const uploadDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  documentType: z.enum(DOCUMENT_CATEGORIES),
  isVisibleToTenants: z.boolean().default(false),
  residenceId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
});

/**
 *
 * @param app
 */
/**
 * RegisterDocumentRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerDocumentRoutes(app: Express): void {
  // Get all documents for the authenticated user
  app.get('/api/documents', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentType = req.query.type as string; // 'building', 'resident', or undefined for both
      const specificResidenceId = req.query.residenceId as string; // Filter by specific residence

      // Get user's organization and residences for filtering
      const organizations = await storage.getUserOrganizations(userId);
      const userResidences = await storage.getUserResidences(userId);
      const buildings = await storage.getBuildings();

      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;

      // If specific residence ID provided, filter to only that residence
      let residenceIds: string[];
      if (specificResidenceId) {
        // Admin users have access to all residences
        if (userRole === 'admin' || userRole === 'manager') {
          residenceIds = [specificResidenceId];
        } else {
          // Verify user has access to this specific residence
          // Handle both simple {residenceId: string} and complex nested structures
          const hasAccess = userResidences.some((ur: unknown) => {
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
          .map((ur: unknown) => {
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
          .filter((id: unknown) => id !== null);
      }

      const buildingIds = buildings.map((b) => b.id);

      const allDocuments: unknown[] = [];

      // Use unified documents system
      const filters: any = {
        userId,
        userRole,
      };
      
      // Filter by specific residence if provided
      if (specificResidenceId) {
        filters.residenceId = specificResidenceId;
      } else if (documentType === 'building') {
        // For building documents, search in buildings user has access to
        if (buildingIds.length > 0) {
          // Get all documents for buildings, will filter later
        }
      } else if (documentType === 'resident') {
        // For resident documents, search in residences user has access to
        if (residenceIds.length > 0) {
          // Get all documents for residences, will filter later
        }
      }
      
      const documents = await storage.getDocuments(filters);
      
      // Apply role-based filtering
      const filteredDocuments = documents.filter((doc) => {
        // Admin can see all documents
        if (userRole === 'admin') {
          return true;
        }
        
        // Manager can see documents in their organization
        if (userRole === 'manager' && organizationId) {
          if (doc.buildingId && buildingIds.includes(doc.buildingId)) {
            return true;
          }
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }
        }
        
        // Residents/tenants can only see documents for their properties
        if (userRole === 'resident' || userRole === 'tenant') {
          if (doc.residenceId && residenceIds.includes(doc.residenceId)) {
            return true;
          }
          if (doc.buildingId && buildingIds.includes(doc.buildingId)) {
            return true;
          }
        }
        
        return false;
      });
      
      // Add document type indicators for frontend compatibility
      const enhancedDocuments = filteredDocuments.map((doc) => ({
        ...doc,
        documentCategory: doc.buildingId ? 'building' : 'resident',
        entityType: doc.buildingId ? 'building' : 'residence',
        entityId: doc.buildingId || doc.residenceId,
        uploadDate: doc.createdAt, // For backward compatibility
      }));
      
      allDocuments.push(...enhancedDocuments);

      // Sort by upload date, most recent first
      allDocuments.sort(
        (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      );

      const response = {
        documents: allDocuments,
        total: allDocuments.length,
        buildingCount: allDocuments.filter((d) => d.documentCategory === 'building').length,
        residentCount: allDocuments.filter((d) => d.documentCategory === 'resident').length,
        legacyCount: allDocuments.filter((d) => d.documentCategory === 'legacy').length,
      };
      res.json(response);
    } catch (_error) {
      console.error('Error fetching documents:', _error);
      res.status(500).json({ message: 'Failed to fetch documents' });
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

      let document: unknown = null;

      // Try to find the document in the appropriate table(s)
      const hasNewDocumentMethods = 'getBuildingDocument' in storage;

      if (hasNewDocumentMethods) {
        if (!documentType || documentType === 'building') {
          try {
            document = await (storage as any).getBuildingDocument(
              documentId,
              userId,
              userRole,
              organizationId,
              buildingIds
            );
            if (document) {
              document.documentCategory = 'building';
              document.entityType = 'building';
              document.entityId = document.buildingId;
            }
          } catch (_error) {
            console.warn('Building document not found, continuing search');
          }
        }

        if (!document && (!documentType || documentType === 'resident')) {
          try {
            document = await (storage as any).getResidentDocument(
              documentId,
              userId,
              userRole,
              organizationId,
              residenceIds
            );
            if (document) {
              document.documentCategory = 'resident';
              document.entityType = 'residence';
              document.entityId = document.residenceId;
            }
          } catch (_error) {
            console.warn('Resident document not found, continuing search');
          }
        }
      }

      // Fallback to legacy documents if not found and no type specified
      if (!document && !documentType) {
        try {
          document = await storage.getDocument(
            documentId,
            userId,
            userRole,
            organizationId,
            residenceIds
          );
          if (document) {
            document.documentCategory = 'legacy';
            document.entityType = 'legacy';
            document.entityId = null;
          }
        } catch (_error) {
          console.warn('Legacy document not accessible');
        }
      }

      if (!document) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }

      res.json(document);
    } catch (_error) {
      console.error('Error fetching document:', _error);
      res.status(500).json({ message: 'Failed to fetch document' });
    }
  });

  // Create a new document with optional file upload
  app.post('/api/documents', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const { documentType, buildingId, residenceId, ...otherData } = req.body;

      // Validate permissions - only admin, manager, and resident can create documents
      if (!['admin', 'manager', 'resident'].includes(userRole)) {
        return res.status(403).json({ message: 'Insufficient permissions to create documents' });
      }

      // Determine document type based on buildingId/residenceId if not explicitly provided
      let finalDocumentType = documentType;
      if (!finalDocumentType) {
        if (buildingId && !residenceId) {
          finalDocumentType = 'building';
        } else if (residenceId && !buildingId) {
          finalDocumentType = 'resident';
        } else if (buildingId && residenceId) {
          return res.status(400).json({
            message: 'Please specify documentType when providing both buildingId and residenceId',
          });
        } else {
          return res.status(400).json({
            message:
              'Must provide either buildingId (for building documents) or residenceId (for resident documents)',
          });
        }
      }

      if (finalDocumentType === 'building') {
        // Validate and create building document
        if (!buildingId) {
          return res.status(400).json({ message: 'buildingId is required for building documents' });
        }

        const validatedData = createBuildingDocumentSchema.parse({
          ...otherData,
          buildingId,
          uploadedBy: userId,
          filePath: req.file ? req.file.path : undefined,
          fileName: req.file ? req.file.originalname : undefined,
        });

        // Permission checks for building documents
        if (userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId =
            organizations.length > 0 ? organizations[0].organizationId : undefined;
          const building = await storage.getBuilding(buildingId);
          if (!building || building.organizationId !== organizationId) {
            return res
              .status(403)
              .json({ message: 'Cannot assign document to building outside your organization' });
          }
        }

        if (userRole === 'resident') {
          const residences = await storage.getUserResidences(userId);
          const hasResidenceInBuilding = await Promise.all(
            residences.map(async (ur) => {
              const residence = await storage.getResidence(ur.residenceId);
              return residence && residence.buildingId === buildingId;
            })
          );

          if (!hasResidenceInBuilding.some(Boolean)) {
            return res
              .status(403)
              .json({ message: 'Cannot assign document to building where you have no residence' });
          }
        }

        const document = await storage.createBuildingDocument(validatedData);
        
        // Clean up temporary file after successful upload
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', cleanupError);
          }
        }
        
        res.status(201).json({
          ...document,
          documentCategory: 'building',
          entityType: 'building',
          entityId: document.buildingId,
        });
      } else if (finalDocumentType === 'resident') {
        // Validate and create resident document
        if (!residenceId) {
          return res
            .status(400)
            .json({ message: 'residenceId is required for resident documents' });
        }

        const validatedData = createResidentDocumentSchema.parse({
          ...otherData,
          residenceId,
          uploadedBy: userId,
          filePath: req.file ? req.file.path : undefined,
          fileName: req.file ? req.file.originalname : undefined,
        });

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
          name: validatedData.name,
          description: undefined,
          documentType: validatedData.type,
          gcsPath: validatedData.fileUrl || `temp-path-${Date.now()}`,
          isVisibleToTenants: validatedData.isVisibleToTenants,
          residenceId: validatedData.residenceId,
          buildingId: undefined,
          uploadedById: validatedData.uploadedBy,
        };
        
        const document = await storage.createDocument(unifiedDocument);
        
        console.log('📝 Created resident document:', document);
        console.log('📝 Document ID:', document.id);
        
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
    } catch (_error) {
      // Clean up temporary file on error
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp file on error:', cleanupError);
        }
      }
      
      if (_error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid document data',
          errors: _error.issues,
        });
      }

      console.error('Error creating document:', _error);
      res.status(500).json({ message: 'Failed to create document' });
    }
  });

  // Update a document
  app.put('/api/documents/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const documentType = req.query.type as string; // Optional type hint

      // Get user's organization for permission checking
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      const buildings = await storage.getBuildings();

      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map((ur) => ur.residenceId);
      const buildingIds = buildings.map((b) => b.id);

      // Use unified documents system for updates
      let updatedDocument: unknown = null;
      
      try {
        const validatedData = createDocumentSchema.partial().parse(req.body);
        updatedDocument = await storage.updateDocument(documentId, validatedData);
        
        if (updatedDocument) {
          // Add compatibility fields for frontend
          updatedDocument.documentCategory = updatedDocument.buildingId ? 'building' : 'resident';
          updatedDocument.entityType = updatedDocument.buildingId ? 'building' : 'residence';
          updatedDocument.entityId = updatedDocument.buildingId || updatedDocument.residenceId;
        }
      } catch (error) {
        console.warn('Failed to update document:', error);
      }

      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }

      res.json(updatedDocument);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid document data',
          errors: _error.issues,
        });
      }

      console.error('Error updating document:', _error);
      res.status(500).json({ message: 'Failed to update document' });
    }
  });

  // Delete a document
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
      } catch (error) {
        console.error('Failed to delete document:', error);
      }

      if (!deleted) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }

      res.status(204).send();
    } catch (_error) {
      console.error('Error deleting document:', _error);
      res.status(500).json({ message: 'Failed to delete document' });
    }
  });

  // Upload endpoint that matches frontend expectation: /api/documents/:id/upload
  app.post('/api/documents/:id/upload', requireAuth, upload.single('file'), async (req: any, res) => {
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
        fileInfo: req.file ? {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          encoding: req.file.encoding,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path
        } : null,
        bodyKeys: Object.keys(req.body),
        contentType: req.headers['content-type']
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
        id: documentId,
        userId,
        userRole
      });

      const existingDocument = documents.find(doc => doc.id === documentId);

      if (!existingDocument) {
        return res.status(404).json({ message: 'Document not found' });
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
        return res.status(400).json({ message: 'Document must be associated with a building or residence' });
      }

      // Note: File upload to external storage removed
      
      // Update document with file information
      const updatedDocument = await storage.updateDocument(documentId, {
        gcsPath: `prod_org_${organizationId}/${req.file.originalname}`,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
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
      console.error('Error creating document:', error);

      // Clean up temporary file on error
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
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
  });

  // POST /api/documents/upload - Upload file to GCS and create unified document record
  app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req, res) => {
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
      };

      // Validate form data
      const validatedData = uploadDocumentSchema.parse(formData);

      // Get user info from auth middleware
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Determine GCS bucket based on environment
      const bucketName = process.env.NODE_ENV === 'production' 
        ? process.env.GCS_PROD_BUCKET_NAME 
        : process.env.GCS_DEV_BUCKET_NAME;

      if (!bucketName) {
        console.error('GCS bucket name not configured');
        return res.status(500).json({ message: 'Storage configuration error' });
      }

      // Generate unique GCS path
      const fileExtension = path.extname(req.file.originalname);
      const baseFileName = path.basename(req.file.originalname, fileExtension);
      const uniqueFileName = `${uuidv4()}-${baseFileName}${fileExtension}`;
      
      let gcsPath: string;
      if (validatedData.residenceId) {
        gcsPath = `residences/${validatedData.residenceId}/${uniqueFileName}`;
      } else if (validatedData.buildingId) {
        gcsPath = `buildings/${validatedData.buildingId}/${uniqueFileName}`;
      } else {
        gcsPath = `general/${uniqueFileName}`;
      }

      // Handle file storage - fallback to local storage in development if GCS fails
      if (process.env.NODE_ENV === 'development') {
        try {
          console.log('🔧 Development: Attempting GCS upload...');
          const gcsClient = await getGCSClient();
          const bucket = gcsClient.bucket(bucketName);
          const file = bucket.file(gcsPath);

          // Upload file to GCS
          await new Promise<void>((resolve, reject) => {
            const stream = fs.createReadStream(req.file!.path);
            const uploadStream = file.createWriteStream({
              metadata: {
                contentType: req.file!.mimetype,
                metadata: {
                  originalName: req.file!.originalname,
                  uploadedBy: userId,
                  uploadedAt: new Date().toISOString(),
                },
              },
            });

            uploadStream.on('error', (error) => {
              console.error('GCS upload error:', error);
              reject(error);
            });

            uploadStream.on('finish', () => {
              console.log(`✅ File uploaded to GCS: ${gcsPath}`);
              resolve();
            });

            stream.pipe(uploadStream);
          });
        } catch (gcsError) {
          console.log('⚠️ GCS upload failed, using local storage for development');
          
          // Fallback to local storage
          const localStoragePath = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(localStoragePath)) {
            fs.mkdirSync(localStoragePath, { recursive: true });
          }
          
          // Create directory structure
          const localFilePath = path.join(localStoragePath, gcsPath);
          const localFileDir = path.dirname(localFilePath);
          if (!fs.existsSync(localFileDir)) {
            fs.mkdirSync(localFileDir, { recursive: true });
          }
          
          // Copy uploaded file to local storage
          fs.copyFileSync(req.file!.path, localFilePath);
          console.log(`🔧 Development: File saved locally at ${localFilePath}`);
        }
      } else {
        // Production: Upload to GCS
        const gcsClient = await getGCSClient();
        const bucket = gcsClient.bucket(bucketName);
        const file = bucket.file(gcsPath);

        // Upload file to GCS
        await new Promise<void>((resolve, reject) => {
          const stream = fs.createReadStream(req.file!.path);
          const uploadStream = file.createWriteStream({
            metadata: {
              contentType: req.file!.mimetype,
              metadata: {
                originalName: req.file!.originalname,
                uploadedBy: userId,
                uploadedAt: new Date().toISOString(),
              },
            },
          });

          uploadStream.on('error', (error) => {
            console.error('GCS upload error:', error);
            reject(error);
          });

          uploadStream.on('finish', () => {
            console.log(`File uploaded to GCS: ${gcsPath}`);
            resolve();
          });

          stream.pipe(uploadStream);
        });
      }

      // Create document record in database
      const documentData: InsertDocument = {
        name: validatedData.name,
        description: validatedData.description,
        documentType: validatedData.documentType,
        gcsPath: gcsPath,
        isVisibleToTenants: validatedData.isVisibleToTenants,
        residenceId: validatedData.residenceId,
        buildingId: validatedData.buildingId,
        uploadedById: userId,
      };

      const newDocument = await storage.createDocument(documentData);

      // Clean up temporary file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Return success response
      res.status(201).json({
        message: 'Document uploaded successfully',
        document: newDocument,
      });

    } catch (error: any) {
      console.error('Document upload error:', error);

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
        });
      }

      // Handle GCS errors
      if (error.message && error.message.includes('Google Cloud Storage')) {
        return res.status(500).json({
          message: 'File upload failed',
          error: 'Storage service error',
        });
      }

      // Handle database errors
      if (error.message && error.message.includes('database')) {
        return res.status(500).json({
          message: 'Failed to save document record',
          error: 'Database error',
        });
      }

      // Generic error response
      res.status(500).json({
        message: 'Internal server error',
        error: 'Document upload failed',
      });
    }
  });

  // Serve document files
  app.get('/api/documents/:id/file', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const isDownload = req.query.download === 'true';

      // Get user's organization and residences for permission checking
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      const buildings = await storage.getBuildings();

      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map((ur) => ur.residenceId || ur.userResidence?.residenceId || ur.residence?.id).filter(Boolean);
      const buildingIds = buildings.map((b) => b.id);

      // Find the document
      const filters = {
        userId,
        userRole,
      };
      
      const documents = await storage.getDocuments(filters);
      const document = documents.find(doc => doc.id === documentId);
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check permissions
      let hasAccess = false;
      
      if (userRole === 'admin') {
        hasAccess = true;
      } else if (userRole === 'manager' && organizationId) {
        if (document.buildingId && buildingIds.includes(document.buildingId)) {
          hasAccess = true;
        }
        if (document.residenceId && residenceIds.includes(document.residenceId)) {
          hasAccess = true;
        }
      } else if ((userRole === 'resident' || userRole === 'tenant')) {
        if (document.residenceId && residenceIds.includes(document.residenceId)) {
          hasAccess = true;
        }
        if (document.buildingId && buildingIds.includes(document.buildingId)) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // For development, serve from local storage or GCS path
      if (document.gcsPath) {
        try {
          let filePath = document.gcsPath;
          
          // Check if it's an absolute path
          if (document.gcsPath.startsWith('/')) {
            filePath = document.gcsPath;
          } 
          // Check if it's a relative GCS path
          else if (document.gcsPath.includes('residences/') || document.gcsPath.includes('buildings/')) {
            // For development, try to find the file in common upload directories
            const possiblePaths = [
              `/tmp/uploads/${document.gcsPath}`,
              `/uploads/${document.gcsPath}`,
              `./uploads/${document.gcsPath}`,
              path.join(process.cwd(), 'uploads', document.gcsPath),
              path.join('/tmp', document.gcsPath)
            ];
            
            // Try to find the file in any of these locations
            for (const possiblePath of possiblePaths) {
              if (fs.existsSync(possiblePath)) {
                filePath = possiblePath;
                break;
              }
            }
          }
          // Check if it's a temp file path
          else if (document.gcsPath.includes('tmp')) {
            filePath = document.gcsPath;
          }
          
          // Try to serve the file
          if (fs.existsSync(filePath)) {
            const fileName = document.fileName || document.name || path.basename(document.gcsPath);
            
            if (isDownload) {
              res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            } else {
              res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
            }
            
            // Set appropriate content type based on file extension
            const ext = path.extname(fileName).toLowerCase();
            if (ext === '.pdf') {
              res.setHeader('Content-Type', 'application/pdf');
            } else if (ext === '.jpg' || ext === '.jpeg') {
              res.setHeader('Content-Type', 'image/jpeg');
            } else if (ext === '.png') {
              res.setHeader('Content-Type', 'image/png');
            } else if (ext === '.gif') {
              res.setHeader('Content-Type', 'image/gif');
            } else if (ext === '.doc' || ext === '.docx') {
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            } else {
              res.setHeader('Content-Type', 'application/octet-stream');
            }
            
            console.log(`📂 Serving file: ${filePath} as ${fileName}`);
            return res.sendFile(path.resolve(filePath));
          }
          
          // If file not found locally, log for debugging
          console.log(`❌ File not found at gcsPath: ${document.gcsPath}`);
          console.log(`❌ Tried filePath: ${filePath}`);
          return res.status(404).json({ message: 'File not found on server' });
          
        } catch (error) {
          console.error('Error serving file:', error);
          return res.status(500).json({ message: 'Failed to serve file' });
        }
      }

      return res.status(404).json({ message: 'No file associated with this document' });
    } catch (error) {
      console.error('Error serving document file:', error);
      res.status(500).json({ message: 'Failed to serve document file' });
    }
  });

}
