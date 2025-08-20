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
  type InsertDocumentResident
} from '../../shared/schema';
import { ObjectStorageService, ObjectNotFoundError } from '../objectStorage';
import { z } from 'zod';

// Initialize object storage service
const objectStorageService = new ObjectStorageService();

// Document categories for validation
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
  'other'
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

/**
 *
 * @param app
 */
export function registerDocumentRoutes(app: Express): void {
  
  // Get all documents for the authenticated user
  app.get('/api/documents', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentType = req.query.type as string; // 'building', 'resident', or undefined for both
      
      // Get user's organization and residences for filtering
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      const buildings = await storage.getBuildings();
      
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map(ur => ur.residenceId);
      const buildingIds = buildings.map(b => b.id);
      
      const allDocuments: any[] = [];
      
      // Fetch documents based on type parameter
      // Check if storage supports new document methods
      const hasNewDocumentMethods = 'getBuildingDocumentsForUser' in storage;
      
      if (hasNewDocumentMethods) {
        if (!documentType || documentType === 'building') {
          const buildingDocs = await (storage as any).getBuildingDocumentsForUser(
            userId,
            userRole,
            organizationId,
            buildingIds
          );
          // Add document type indicator for frontend
          const enhancedBuildingDocs = buildingDocs.map((doc: any) => ({ 
            ...doc, 
            documentCategory: 'building',
            entityType: 'building',
            entityId: doc.buildingId 
          }));
          allDocuments.push(...enhancedBuildingDocs);
        }
        
        if (!documentType || documentType === 'resident') {
          const residentDocs = await (storage as any).getResidentDocumentsForUser(
            userId,
            userRole,
            organizationId,
            residenceIds
          );
          // Add document type indicator for frontend
          const enhancedResidentDocs = residentDocs.map((doc: any) => ({ 
            ...doc, 
            documentCategory: 'resident',
            entityType: 'residence',
            entityId: doc.residenceId 
          }));
          allDocuments.push(...enhancedResidentDocs);
        }
      }
      
      // If no specific type requested, also include legacy documents during transition
      if (!documentType) {
        try {
          const legacyDocs = await storage.getDocumentsForUser(
            userId,
            userRole,
            organizationId,
            residenceIds
          );
          const enhancedLegacyDocs = legacyDocs.map(doc => ({ 
            ...doc, 
            documentCategory: 'legacy',
            entityType: 'legacy',
            entityId: null 
          }));
          allDocuments.push(...enhancedLegacyDocs);
        } catch (error) {
          // Legacy table might not exist, silently continue
          console.log('Legacy documents table not accessible, skipping');
        }
      }
      
      // Sort by upload date, most recent first
      allDocuments.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      
      res.json({
        documents: allDocuments,
        total: allDocuments.length,
        buildingCount: allDocuments.filter(d => d.documentCategory === 'building').length,
        residentCount: allDocuments.filter(d => d.documentCategory === 'resident').length,
        legacyCount: allDocuments.filter(d => d.documentCategory === 'legacy').length
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
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
      const residenceIds = residences.map(ur => ur.residenceId);
      const buildingIds = buildings.map(b => b.id);
      
      let document: any = null;
      
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
          } catch (error) {
            console.log('Building document not found, continuing search');
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
          } catch (error) {
            console.log('Resident document not found, continuing search');
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
        } catch (error) {
          console.log('Legacy document not accessible');
        }
      }
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      
      res.json(document);
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ message: 'Failed to fetch document' });
    }
  });

  // Create a new document
  app.post('/api/documents', requireAuth, async (req: any, res) => {
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
            message: 'Please specify documentType when providing both buildingId and residenceId' 
          });
        } else {
          return res.status(400).json({ 
            message: 'Must provide either buildingId (for building documents) or residenceId (for resident documents)' 
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
        });
        
        // Permission checks for building documents
        if (userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
          const building = await storage.getBuilding(buildingId);
          if (!building || building.organizationId !== organizationId) {
            return res.status(403).json({ message: 'Cannot assign document to building outside your organization' });
          }
        }
        
        if (userRole === 'resident') {
          const residences = await storage.getUserResidences(userId);
          const hasResidenceInBuilding = await Promise.all(residences.map(async ur => {
            const residence = await storage.getResidence(ur.residenceId);
            return residence && residence.buildingId === buildingId;
          }));
          
          if (!hasResidenceInBuilding.some(Boolean)) {
            return res.status(403).json({ message: 'Cannot assign document to building where you have no residence' });
          }
        }
        
        const document = await (storage as any).createBuildingDocument(validatedData);
        res.status(201).json({ 
          ...document, 
          documentCategory: 'building',
          entityType: 'building',
          entityId: document.buildingId 
        });
        
      } else if (finalDocumentType === 'resident') {
        // Validate and create resident document
        if (!residenceId) {
          return res.status(400).json({ message: 'residenceId is required for resident documents' });
        }
        
        const validatedData = createResidentDocumentSchema.parse({
          ...otherData,
          residenceId,
          uploadedBy: userId,
        });
        
        // Permission checks for resident documents
        if (userRole === 'manager') {
          const organizations = await storage.getUserOrganizations(userId);
          const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
          const residence = await storage.getResidence(residenceId);
          if (residence) {
            const building = await storage.getBuilding(residence.buildingId);
            if (!building || building.organizationId !== organizationId) {
              return res.status(403).json({ message: 'Cannot assign document to residence outside your organization' });
            }
          } else {
            return res.status(404).json({ message: 'Residence not found' });
          }
        }
        
        if (userRole === 'resident') {
          const residences = await storage.getUserResidences(userId);
          const residenceIds = residences.map(ur => ur.residenceId);
          
          if (!residenceIds.includes(residenceId)) {
            return res.status(403).json({ message: 'Cannot assign document to residence you do not own' });
          }
        }
        
        const document = await (storage as any).createResidentDocument(validatedData);
        res.status(201).json({ 
          ...document, 
          documentCategory: 'resident',
          entityType: 'residence',
          entityId: document.residenceId 
        });
        
      } else {
        return res.status(400).json({ 
          message: 'Invalid documentType. Must be either \"building\" or \"resident\"' 
        });
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid document data', 
          errors: error.issues 
        });
      }
      
      console.error('Error creating document:', error);
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
      const residenceIds = residences.map(ur => ur.residenceId);
      const buildingIds = buildings.map(b => b.id);
      
      let updatedDocument: any = null;
      
      // Try to update the document in the appropriate table(s)
      const hasNewDocumentMethods = 'updateBuildingDocument' in storage;
      
      if (hasNewDocumentMethods) {
        if (!documentType || documentType === 'building') {
          try {
            const validatedData = createBuildingDocumentSchema.partial().parse(req.body);
            updatedDocument = await (storage as any).updateBuildingDocument(
              documentId,
              validatedData,
              userId,
              userRole,
              organizationId
            );
            if (updatedDocument) {
              updatedDocument.documentCategory = 'building';
              updatedDocument.entityType = 'building';
              updatedDocument.entityId = updatedDocument.buildingId;
            }
          } catch (error) {
            console.log('Building document not found for update, trying resident documents');
          }
        }
        
        if (!updatedDocument && (!documentType || documentType === 'resident')) {
          try {
            const validatedData = createResidentDocumentSchema.partial().parse(req.body);
            updatedDocument = await (storage as any).updateResidentDocument(
              documentId,
              validatedData,
              userId,
              userRole,
              organizationId
            );
            if (updatedDocument) {
              updatedDocument.documentCategory = 'resident';
              updatedDocument.entityType = 'residence';
              updatedDocument.entityId = updatedDocument.residenceId;
            }
          } catch (error) {
            console.log('Resident document not found for update');
          }
        }
      }
      
      // Fallback to legacy documents if not found and no type specified
      if (!updatedDocument && !documentType) {
        try {
          const validatedData = createDocumentSchema.partial().parse(req.body);
          updatedDocument = await storage.updateDocument(
            documentId,
            validatedData,
            userId,
            userRole,
            organizationId
          );
          if (updatedDocument) {
            updatedDocument.documentCategory = 'legacy';
            updatedDocument.entityType = 'legacy';
            updatedDocument.entityId = null;
          }
        } catch (error) {
          console.log('Legacy document not accessible for update');
        }
      }
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      
      res.json(updatedDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid document data', 
          errors: error.issues 
        });
      }
      
      console.error('Error updating document:', error);
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
      
      let deleted = false;
      
      // Try to delete the document from the appropriate table(s)
      const hasNewDocumentMethods = 'deleteBuildingDocument' in storage;
      
      if (hasNewDocumentMethods) {
        if (!documentType || documentType === 'building') {
          try {
            deleted = await (storage as any).deleteBuildingDocument(
              documentId,
              userId,
              userRole,
              organizationId
            );
          } catch (error) {
            console.log('Building document not found for deletion, trying resident documents');
          }
        }
        
        if (!deleted && (!documentType || documentType === 'resident')) {
          try {
            deleted = await (storage as any).deleteResidentDocument(
              documentId,
              userId,
              userRole,
              organizationId
            );
          } catch (error) {
            console.log('Resident document not found for deletion');
          }
        }
      }
      
      // Fallback to legacy documents if not found and no type specified
      if (!deleted && !documentType) {
        try {
          deleted = await storage.deleteDocument(
            documentId,
            userId,
            userRole,
            organizationId
          );
        } catch (error) {
          console.log('Legacy document not accessible for deletion');
        }
      }
      
      if (!deleted) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ message: 'Failed to delete document' });
    }
  });

  // Get upload URL for object storage
  app.post('/api/documents/upload-url', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      
      // Only admin, manager, and resident can upload documents
      if (!['admin', 'manager', 'resident'].includes(userRole)) {
        return res.status(403).json({ message: 'Insufficient permissions to upload documents' });
      }

      // Extract parameters from request body
      const { organizationId, buildingId, residenceId, documentType } = req.body;

      // Validate required parameters
      if (!organizationId || !documentType) {
        return res.status(400).json({ message: 'Organization ID and document type are required' });
      }

      if (documentType === 'building' && !buildingId) {
        return res.status(400).json({ message: 'Building ID is required for building documents' });
      }

      if (documentType === 'residence' && (!buildingId || !residenceId)) {
        return res.status(400).json({ message: 'Building ID and Residence ID are required for residence documents' });
      }

      if (!['building', 'residence'].includes(documentType)) {
        return res.status(400).json({ message: 'Document type must be either "building" or "residence"' });
      }
      
      const uploadURL = await objectStorageService.getObjectEntityUploadURL({
        organizationId,
        buildingId,
        residenceId,
        documentType: documentType as 'building' | 'residence'
      });
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ message: 'Failed to get upload URL' });
    }
  });

  // Update document with file information after upload
  app.post('/api/documents/:id/upload', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const { fileUrl, fileName, fileSize, mimeType } = req.body;
      
      // Validate required fields
      if (!fileUrl) {
        return res.status(400).json({ message: 'fileUrl is required' });
      }
      
      // Get user's organization for permission checking
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map(ur => ur.residenceId);
      
      // Normalize the object storage path
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(fileUrl);
      
      let updatedDocument: any = null;
      
      // Try to update in building documents first
      const hasNewDocumentMethods = 'updateBuildingDocument' in storage;
      
      if (hasNewDocumentMethods) {
        try {
          updatedDocument = await (storage as any).updateBuildingDocument(
            documentId,
            {
              fileUrl: normalizedPath,
              fileName: fileName || 'document',
              fileSize: fileSize?.toString() || null,
              mimeType: mimeType || 'application/octet-stream',
            },
            userId,
            userRole,
            organizationId
          );
        } catch (error) {
          console.log('Document not found in building documents, trying resident documents');
        }
        
        // If not found in building documents, try resident documents
        if (!updatedDocument) {
          try {
            updatedDocument = await (storage as any).updateResidentDocument(
              documentId,
              {
                fileUrl: normalizedPath,
                fileName: fileName || 'document',
                fileSize: fileSize?.toString() || null,
                mimeType: mimeType || 'application/octet-stream',
              },
              userId,
              userRole,
              organizationId
            );
          } catch (error) {
            console.log('Document not found in resident documents');
          }
        }
      }
      
      // Fallback to legacy documents if not found
      if (!updatedDocument) {
        try {
          updatedDocument = await storage.updateDocument(
            documentId,
            {
              fileUrl: normalizedPath,
              fileName: fileName || 'document',
              fileSize: fileSize?.toString() || null,
              mimeType: mimeType || 'application/octet-stream',
            } as any,
            userId,
            userRole,
            organizationId
          );
        } catch (error) {
          console.log('Document not accessible for update');
        }
      }
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      
      res.json({ 
        message: 'Document file updated successfully',
        document: updatedDocument 
      });
    } catch (error) {
      console.error('Error updating document file:', error);
      res.status(500).json({ message: 'Failed to update document file' });
    }
  });

  // Download/serve document files
  app.get('/api/documents/:id/download', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      
      // Get user's organization and residences for filtering
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map(ur => ur.residenceId);
      
      // Check if user has access to this document
      const document = await storage.getDocument(
        documentId,
        userId,
        userRole,
        organizationId,
        residenceIds
      );
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      
      try {
        // Get the file from object storage
        const fileUrl = (document as any).fileUrl;
        if (!fileUrl) {
          return res.status(404).json({ message: 'Document file URL not found' });
        }
        const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);
        await objectStorageService.downloadObject(objectFile, res);
      } catch (storageError) {
        if (storageError instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: 'Document file not found' });
        }
        throw storageError;
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(500).json({ message: 'Failed to download document' });
    }
  });

  // Update document after file upload (to set the file URL)
  app.put('/api/documents/:id/file', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = user.role;
      const userId = user.id;
      const documentId = req.params.id;
      const { fileUrl, fileName, fileSize, mimeType } = req.body;
      
      if (!fileUrl) {
        return res.status(400).json({ message: 'fileUrl is required' });
      }
      
      // Get user's organization for permission checking
      const organizations = await storage.getUserOrganizations(userId);
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      
      // Normalize the object storage path
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(fileUrl);
      
      const updatedDocument = await storage.updateDocument(
        documentId,
        {
          fileUrl: normalizedPath,
          fileName: fileName || 'document',
          fileSize: fileSize || null,
          mimeType: mimeType || 'application/octet-stream',
        } as any,
        userId,
        userRole,
        organizationId
      );
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      
      res.json({ 
        message: 'Document file updated successfully',
        document: updatedDocument 
      });
    } catch (error) {
      console.error('Error updating document file:', error);
      res.status(500).json({ message: 'Failed to update document file' });
    }
  });
}