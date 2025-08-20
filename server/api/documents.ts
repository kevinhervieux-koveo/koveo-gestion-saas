import type { Express } from 'express';
import { requireAuth, requireRole } from '../auth';
import { storage } from '../storage';
import { insertDocumentSchema, type Document, type InsertDocument } from '../../shared/schema';
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

// Enhanced insert schema with validation
const createDocumentSchema = insertDocumentSchema.extend({
  category: z.enum(DOCUMENT_CATEGORIES),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  isVisibleToTenants: z.boolean().default(false),
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
      
      // Get user's organization and residences for filtering
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map(ur => ur.residenceId);
      
      const documents = await storage.getDocumentsForUser(
        userId,
        userRole,
        organizationId,
        residenceIds
      );
      
      res.json(documents);
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
      
      // Get user's organization and residences for filtering
      const organizations = await storage.getUserOrganizations(userId);
      const residences = await storage.getUserResidences(userId);
      
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      const residenceIds = residences.map(ur => ur.residenceId);
      
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
      
      // Validate permissions - only admin, manager, and resident can create documents
      if (!['admin', 'manager', 'resident'].includes(userRole)) {
        return res.status(403).json({ message: 'Insufficient permissions to create documents' });
      }
      
      // Validate input
      const validatedData = createDocumentSchema.parse(req.body);
      
      // For managers and residents, ensure they can only assign documents to their organization/residences
      if (userRole === 'manager') {
        const organizations = await storage.getUserOrganizations(userId);
        const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
        
        if (validatedData.organizationId && validatedData.organizationId !== organizationId) {
          return res.status(403).json({ message: 'Cannot assign document to different organization' });
        }
        
        if (validatedData.buildingId) {
          const building = await storage.getBuilding(validatedData.buildingId);
          if (!building || building.organizationId !== organizationId) {
            return res.status(403).json({ message: 'Cannot assign document to building outside your organization' });
          }
        }
      }
      
      if (userRole === 'resident') {
        const residences = await storage.getUserResidences(userId);
        const residenceIds = residences.map(ur => ur.residenceId);
        
        if (validatedData.residenceId && !residenceIds.includes(validatedData.residenceId)) {
          return res.status(403).json({ message: 'Cannot assign document to residence you do not own' });
        }
        
        if (validatedData.buildingId) {
          const building = await storage.getBuilding(validatedData.buildingId);
          const hasResidenceInBuilding = residences.some(ur => {
            const residence = storage.getResidence(ur.residenceId);
            return residence && residence.buildingId === validatedData.buildingId;
          });
          
          if (!hasResidenceInBuilding) {
            return res.status(403).json({ message: 'Cannot assign document to building where you have no residence' });
          }
        }
      }
      
      const documentData: InsertDocument = {
        ...validatedData,
        uploadedBy: userId,
      };
      
      const document = await storage.createDocument(documentData);
      
      res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid document data', 
          errors: error.errors 
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
      
      // Get user's organization for permission checking
      const organizations = await storage.getUserOrganizations(userId);
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      
      // Validate input (partial updates allowed)
      const validatedData = createDocumentSchema.partial().parse(req.body);
      
      const updatedDocument = await storage.updateDocument(
        documentId,
        validatedData,
        userId,
        userRole,
        organizationId
      );
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      
      res.json(updatedDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid document data', 
          errors: error.errors 
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
      
      // Get user's organization for permission checking
      const organizations = await storage.getUserOrganizations(userId);
      const organizationId = organizations.length > 0 ? organizations[0].organizationId : undefined;
      
      const deleted = await storage.deleteDocument(
        documentId,
        userId,
        userRole,
        organizationId
      );
      
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
      
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ message: 'Failed to get upload URL' });
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
        const objectFile = await objectStorageService.getObjectEntityFile(document.fileUrl);
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
        },
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