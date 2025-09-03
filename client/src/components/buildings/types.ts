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
  name: z.string().min(1, 'Building name is required (example: Maple Tower Condos)').max(100, 'Building name must be less than 100 characters'),
  organizationId: z.string().min(1, 'Please select an organization from the dropdown'),
  address: z.string().nullish(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  postalCode: z.string().nullish().refine((val) => {
    if (!val) return true; // Optional field
    return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(val);
  }, 'Postal code must follow Quebec format (example: H1A 1B1)'),
  buildingType: z.enum(['condo', 'rental']).nullish(),
  yearBuilt: z.number().min(1800, 'Year built must be between 1800 and current year (example: 1985)').max(new Date().getFullYear(), 'Year built must be between 1800 and current year (example: 1985)').nullish(),
  totalUnits: z.number().min(1, 'Total units must be between 1 and 1000 (example: 120)').max(1000, 'Total units must be between 1 and 1000 (example: 120)').nullish(),
  totalFloors: z.number().min(1, 'Total floors must be between 1 and 100 (example: 25)').max(100, 'Total floors must be between 1 and 100 (example: 25)').nullish(),
  parkingSpaces: z.number().min(0, 'Parking spaces must be 0 or more (example: 80)').max(2000, 'Parking spaces must be less than 2000 (example: 80)').nullish(),
  storageSpaces: z.number().min(0, 'Storage spaces must be 0 or more (example: 50)').max(1000, 'Storage spaces must be less than 1000 (example: 50)').nullish(),
  managementCompany: z.string().max(200, 'Management company name must be less than 200 characters').nullish(),
});

/**
 * Form data type for building creation and editing.
 */
export type BuildingFormData = z.infer<typeof buildingFormSchema>;
