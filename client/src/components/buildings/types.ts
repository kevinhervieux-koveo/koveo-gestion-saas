import { z } from 'zod';

/**
 * Building data interface for display and editing.
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
 * Organization interface for building assignment.
 */
export interface Organization {
  id: string;
  name: string;
  type: string;
}

/**
 * Building form schema - only name and organization are required.
 */
export const buildingFormSchema = z.object({
  name: z.string().min(1, 'Building name is required'),
  organizationId: z.string().min(1, 'Organization is required'),
  address: z.string().nullish(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  postalCode: z.string().nullish(),
  buildingType: z.enum(['condo', 'rental']).nullish(),
  yearBuilt: z.number().nullish(),
  totalUnits: z.number().nullish(),
  totalFloors: z.number().nullish(),
  parkingSpaces: z.number().nullish(),
  storageSpaces: z.number().nullish(),
  managementCompany: z.string().nullish(),
});

/**
 * Form data type for building creation and editing.
 */
export type BuildingFormData = z.infer<typeof buildingFormSchema>;
