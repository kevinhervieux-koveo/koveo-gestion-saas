import { Express } from 'express';
import { requireAuth } from '../auth';
import { 
  getUserBuildingAccess, 
  checkBuildingAccess, 
  getAccessibleBuildingIds 
} from './buildings/access-control';
import { 
  getAllBuildingsWithOrg, 
  getBuildingsByOrganizations, 
  getBuildingsByUserResidences, 
  getBuildingById, 
  getBuildingStatistics,
  getBuildingDeletionImpact 
} from './buildings/queries';
import { 
  createBuilding, 
  updateBuilding, 
  deleteBuilding, 
  cascadeDeleteBuilding, 
  buildingExists 
} from './buildings/operations';
import { 
  validateBuildingCreate, 
  validateBuildingUpdate, 
  validateBuildingId, 
  validateBuildingPermissions, 
  validateUserAuth 
} from './buildings/validation';
import { 
  addStatisticsToBuildings, 
  addStatisticsToBuilding 
} from './buildings/statistics';

/**
 * Registers refactored building routes with improved modularity and maintainability.
 */
export function registerBuildingRoutesRefactored(app: Express): void {
  
  /**
   * GET /api/manager/buildings - Retrieves buildings based on user role and associations.
   */
  app.get('/api/manager/buildings', async (req: any, res) => {
    try {
      // Validate authentication
      const authResult = validateUserAuth(req);
      if (!authResult.isValid) {
        return res.status(401).json({
          message: authResult.error,
          code: 'AUTH_REQUIRED'
        });
      }

      let currentUser = authResult.user;
      
      // If we only have userId, fetch the user
      if (!currentUser && req.session?.userId) {
        const { storage } = await import('../storage');
        currentUser = await storage.getUser(req.session.userId);
      }
      
      if (!currentUser) {
        return res.status(401).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      console.log(`📊 Fetching buildings for user ${currentUser.id} with role ${currentUser.role}`);

      // Get user access information
      const userAccess = await getUserBuildingAccess(currentUser.id);
      let accessibleBuildings: any[] = [];

      if (userAccess.isKoveoUser) {
        console.log(`🌟 Koveo organization user detected - granting access to ALL buildings`);
        
        // Koveo users can see ALL buildings from ALL organizations
        const allBuildings = await getAllBuildingsWithOrg();
        accessibleBuildings = allBuildings.map(building => ({
          ...building,
          accessType: 'koveo-global'
        }));
        
      } else {
        // Regular users: Get buildings based on role and associations
        if (currentUser.role === 'admin' || currentUser.role === 'manager') {
          if (userAccess.organizationIds.length > 0) {
            const orgBuildings = await getBuildingsByOrganizations(userAccess.organizationIds);
            accessibleBuildings = orgBuildings.map(building => ({
              ...building,
              accessType: 'organization'
            }));
          }
        }

        // Add buildings from user residences
        const residenceBuildings = await getBuildingsByUserResidences(currentUser.id);
        residenceBuildings.forEach(building => {
          const existingBuilding = accessibleBuildings.find(b => b.id === building.id);
          if (!existingBuilding) {
            accessibleBuildings.push({
              ...building,
              accessType: 'residence'
            });
          } else {
            existingBuilding.accessType = 'both';
          }
        });
      }

      // Add statistics to buildings
      const buildingsWithStats = await addStatisticsToBuildings(accessibleBuildings);

      // Sort buildings by name
      buildingsWithStats.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ Found ${buildingsWithStats.length} accessible buildings for user ${currentUser.id}`);

      res.json({
        buildings: buildingsWithStats,
        meta: {
          total: buildingsWithStats.length,
          userRole: currentUser.role,
          userId: currentUser.id
        }
      });

    } catch (error) {
      console.error('Failed to fetch manager buildings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch buildings'
      });
    }
  });

  /**
   * GET /api/manager/buildings/:id - Get a specific building with detailed information.
   */
  app.get('/api/manager/buildings/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user;
      const buildingId = req.params.id;
      
      if (!currentUser) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Validate building ID
      try {
        validateBuildingId(buildingId);
      } catch (validationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid building ID format'
        });
      }

      console.log(`📊 Fetching building ${buildingId} for user ${currentUser.id} with role ${currentUser.role}`);

      // Check if user has access to this building
      const accessCheck = await checkBuildingAccess(currentUser.id, buildingId, currentUser.role);
      
      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this building'
        });
      }

      // Get building details
      const building = await getBuildingById(buildingId);
      
      if (!building) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Building not found'
        });
      }

      // Add statistics to building
      const buildingWithStats = await addStatisticsToBuilding({
        ...building,
        accessType: accessCheck.accessType
      });

      res.json({
        building: buildingWithStats
      });

    } catch (error) {
      console.error('Failed to fetch building details:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch building details'
      });
    }
  });

  /**
   * POST /api/admin/buildings - Create a new building (Admin only).
   */
  app.post('/api/admin/buildings', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check permissions
      if (!validateBuildingPermissions(currentUser.role, 'create')) {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      // Validate request data
      let buildingData;
      try {
        buildingData = validateBuildingCreate(req.body);
      } catch (validationError: any) {
        return res.status(400).json({
          error: 'Validation error',
          message: validationError.message || 'Invalid building data'
        });
      }

      console.log(`🏢 Admin ${currentUser.id} creating building: ${buildingData.name}`);

      // Create building
      const newBuilding = await createBuilding(buildingData);

      console.log(`✅ Building created successfully with ID: ${newBuilding.id}`);

      res.status(201).json({
        message: 'Building created successfully',
        building: newBuilding
      });

    } catch (error) {
      console.error('❌ Error creating building:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create building'
      });
    }
  });

  /**
   * PUT /api/admin/buildings/:id - Update a building (Admin and Manager).
   */
  app.put('/api/admin/buildings/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check permissions
      if (!validateBuildingPermissions(currentUser.role, 'update')) {
        return res.status(403).json({
          message: 'Admin or Manager access required',
          code: 'ADMIN_MANAGER_REQUIRED'
        });
      }

      const buildingId = req.params.id;

      // Validate building ID
      try {
        validateBuildingId(buildingId);
      } catch (validationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid building ID format'
        });
      }

      // Validate request data
      let buildingData;
      try {
        buildingData = validateBuildingUpdate(req.body);
      } catch (validationError: any) {
        return res.status(400).json({
          error: 'Validation error',
          message: validationError.message || 'Invalid building data'
        });
      }

      console.log(`🏢 ${currentUser.role} ${currentUser.id} updating building: ${buildingId}`);

      // Check if building exists
      if (!(await buildingExists(buildingId))) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Building not found'
        });
      }

      // Update building
      const updatedBuilding = await updateBuilding(buildingId, buildingData);

      console.log(`✅ Building updated successfully: ${buildingId}`);

      res.json({
        message: 'Building updated successfully',
        building: updatedBuilding
      });

    } catch (error) {
      console.error('❌ Error updating building:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update building'
      });
    }
  });

  /**
   * GET /api/admin/buildings/:id/deletion-impact - Analyze building deletion impact.
   */
  app.get('/api/admin/buildings/:id/deletion-impact', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check permissions
      if (!validateBuildingPermissions(currentUser.role, 'delete')) {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const buildingId = req.params.id;

      // Validate building ID
      try {
        validateBuildingId(buildingId);
      } catch (validationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid building ID format'
        });
      }

      console.log(`🔍 Admin ${currentUser.id} analyzing deletion impact for building: ${buildingId}`);

      // Check if building exists
      if (!(await buildingExists(buildingId))) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Building not found'
        });
      }

      // Get deletion impact
      const impact = await getBuildingDeletionImpact(buildingId);

      res.json({
        buildingId,
        impact: {
          ...impact,
          warning: impact.residencesCount > 0 || impact.documentsCount > 0 || impact.affectedUsersCount > 0
            ? 'This action will affect multiple entities. Use cascade delete to proceed.'
            : null
        }
      });

    } catch (error) {
      console.error('❌ Error analyzing building deletion impact:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to analyze deletion impact'
      });
    }
  });

  /**
   * DELETE /api/admin/buildings/:id/cascade - Cascade delete a building.
   */
  app.delete('/api/admin/buildings/:id/cascade', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check permissions
      if (!validateBuildingPermissions(currentUser.role, 'delete')) {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const buildingId = req.params.id;

      // Validate building ID
      try {
        validateBuildingId(buildingId);
      } catch (validationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid building ID format'
        });
      }

      console.log(`🗑️ Admin ${currentUser.id} cascading delete building: ${buildingId}`);

      // Perform cascade delete
      const deletedBuilding = await cascadeDeleteBuilding(buildingId);

      console.log(`✅ Building cascading delete completed: ${buildingId}`);

      res.json({
        message: 'Building and related entities deleted successfully',
        deletedBuilding: deletedBuilding.name
      });

    } catch (error: any) {
      if (error.message === 'Building not found') {
        return res.status(404).json({
          error: 'Not found',
          message: 'Building not found'
        });
      }

      console.error('❌ Error cascading delete building:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete building and related entities'
      });
    }
  });
}