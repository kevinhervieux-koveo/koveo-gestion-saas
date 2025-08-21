import { z } from 'zod';

/**
 * Building creation validation schema.
 */
export const CreateBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').max(255),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(10).optional().default('QC'),
  postalCode: z.string().max(10).optional(),
  buildingType: z.enum(['condo', 'apartment', 'townhouse', 'mixed']).optional().default('condo'),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  totalUnits: z.number().int().min(0).max(1000).optional().default(0),
  totalFloors: z.number().int().min(1).max(200).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  storageSpaces: z.number().int().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  managementCompany: z.string().max(255).optional(),
  organizationId: z.string().uuid('Valid organization ID is required')
});

/**
 * Building update validation schema.
 */
export const UpdateBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').max(255),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(10).optional(),
  postalCode: z.string().max(10).optional(),
  buildingType: z.enum(['condo', 'apartment', 'townhouse', 'mixed']).optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  totalUnits: z.number().int().min(0).max(1000).optional(),
  totalFloors: z.number().int().min(1).max(200).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  storageSpaces: z.number().int().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  managementCompany: z.string().max(255).optional(),
  organizationId: z.string().uuid('Valid organization ID is required')
});

/**
 * Building ID parameter validation.
 */
export const BuildingIdSchema = z.object({
  id: z.string().uuid('Valid building ID is required')
});

/**
 * Validates building creation data.
 * @param data
 */
/**
 * ValidateBuildingCreate function.
 * @param data
 * @returns Function result.
 */
export function validateBuildingCreate(data: unknown) {
  return CreateBuildingSchema.parse(data);
}

/**
 * Validates building update data.
 * @param data
 */
/**
 * ValidateBuildingUpdate function.
 * @param data
 * @returns Function result.
 */
export function validateBuildingUpdate(data: unknown) {
  return UpdateBuildingSchema.parse(data);
}

/**
 * Validates building ID parameter.
 * @param id
 */
/**
 * ValidateBuildingId function.
 * @param id
 * @returns Function result.
 */
export function validateBuildingId(id: string) {
  return BuildingIdSchema.parse({ id });
}

/**
 * Checks if user has permission for building operations.
 * @param userRole
 * @param operation
 */
/**
 * ValidateBuildingPermissions function.
 * @param userRole
 * @param operation
 * @returns Function result.
 */
export function validateBuildingPermissions(userRole: string, operation: 'read' | 'create' | 'update' | 'delete'): boolean {
  switch (operation) {
    case 'read':
      // All authenticated users can read buildings they have access to
      return ['admin', 'manager', 'resident', 'tenant'].includes(userRole);
    
    case 'create':
      // Only admins can create buildings
      return userRole === 'admin';
    
    case 'update':
      // Admins and managers can update buildings
      return ['admin', 'manager'].includes(userRole);
    
    case 'delete':
      // Only admins can delete buildings
      return userRole === 'admin';
    
    default:
      return false;
  }
}

/**
 * Validates user authentication for building operations.
 * @param req
 */
/**
 * ValidateUserAuth function.
 * @param req
 * @returns Function result.
 */
export function validateUserAuth(req: unknown): { user: any; isValid: boolean; error?: string } {
  const user = req.user || req.session?.user;
  
  if (!user && !req.session?.userId) {
    return {
      user: null,
      isValid: false,
      error: 'Authentication required'
    };
  }
  
  // If we have sessionId but no user object, we'll need to fetch it
  if (!user && req.session?.userId) {
    return {
      user: null,
      isValid: false,
      error: 'User session incomplete'
    };
  }
  
  return {
    user,
    isValid: true
  };
}