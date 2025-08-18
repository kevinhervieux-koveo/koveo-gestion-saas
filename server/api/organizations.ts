import type { Express } from 'express';
import { storage } from '../storage';
import {
  insertOrganizationSchema,
  type Organization,
  type InsertOrganization,
} from '@shared/schema';
import { z } from 'zod';
import { requireAuth, authorize } from '../auth';

/**
 * Registers all organization-related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerOrganizationRoutes(app: Express): void {
  /**
   * GET /api/organizations - Retrieves all organizations.
   */
  app.get('/api/organizations', requireAuth, authorize('read:organization'), async (req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch organizations',
      });
    }
  });

  /**
   * GET /api/organizations/:id - Retrieves a specific organization by ID.
   */
  app.get('/api/organizations/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Organization ID is required',
        });
      }

      const organization = await storage.getOrganization(id);
      if (!organization) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Organization not found',
        });
      }

      res.json(organization);
    } catch (error) {
      console.error('Failed to fetch organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch organization',
      });
    }
  });

  /**
   * POST /api/organizations - Creates a new organization.
   */
  app.post('/api/organizations', async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);

      // Check if organization with name already exists
      const existingOrganization = await storage.getOrganizationByName(validatedData.name);
      if (existingOrganization) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Organization with this name already exists',
        });
      }

      const organization = await storage.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid organization data',
          details: error.errors,
        });
      }

      console.error('Failed to create organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create organization',
      });
    }
  });

  /**
   * PUT /api/organizations/:id - Updates an existing organization.
   */
  app.put('/api/organizations/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Organization ID is required',
        });
      }

      const updateSchema = insertOrganizationSchema.partial();
      const validatedData = updateSchema.parse(req.body);

      const organization = await storage.updateOrganization(id, {
        ...validatedData,
        updatedAt: new Date(),
      });

      if (!organization) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Organization not found',
        });
      }

      res.json(organization);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid organization data',
          details: error.errors,
        });
      }

      console.error('Failed to update organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update organization',
      });
    }
  });

  /**
   * DELETE /api/organizations/:id - Deactivates an organization (soft delete).
   */
  app.delete('/api/organizations/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Organization ID is required',
        });
      }

      // Soft delete by setting isActive to false
      const organization = await storage.updateOrganization(id, {
        isActive: false,
        updatedAt: new Date(),
      });

      if (!organization) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Organization not found',
        });
      }

      res.json({
        message: 'Organization deactivated successfully',
        id: organization.id,
      });
    } catch (error) {
      console.error('Failed to deactivate organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to deactivate organization',
      });
    }
  });

  /**
   * GET /api/organizations/:id/buildings - Retrieves all buildings for an organization.
   */
  app.get('/api/organizations/:id/buildings', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Organization ID is required',
        });
      }

      // Verify organization exists
      const organization = await storage.getOrganization(id);
      if (!organization) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Organization not found',
        });
      }

      const buildings = await storage.getBuildingsByOrganization(id);
      res.json(buildings);
    } catch (error) {
      console.error('Failed to fetch organization buildings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch organization buildings',
      });
    }
  });
}
