import { z } from 'zod';

/**
 * Building data interface for display and editing
 */
export interface BuildingData {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: 'condo' | 'rental';
  yearBuilt?: number;
  totalUnits: number;
  totalFloors?: number;
  parkingSpaces?: number;
  storageSpaces?: number;
  amenities?: string[];
  managementCompany?: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  accessType: 'organization' | 'residence';
  createdAt: string;
}

/**
 * Organization interface for building assignment
 */
export interface Organization {
  id: string;
  name: string;
  type: string;
}

/**
 * Building form schema - only name and organization are required
 */
export const buildingFormSchema = z.object({
  name: z.string().min(1, 'Building name is required'),
  organizationId: z.string().min(1, 'Organization is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  buildingType: z.enum(['condo', 'rental']).optional(),
  yearBuilt: z.number().optional(),
  totalUnits: z.number().optional(),
  totalFloors: z.number().optional(),
  parkingSpaces: z.number().optional(),
  storageSpaces: z.number().optional(),
  managementCompany: z.string().optional(),
});

/**
 * Form data type for building creation and editing
 */
export type BuildingFormData = z.infer<typeof buildingFormSchema>;