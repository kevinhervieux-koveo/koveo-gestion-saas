import { z } from 'zod';

// Common enum definitions
export const USER_ROLES = ['admin', 'manager', 'tenant', 'resident'] as const;
export const DEMAND_TYPES = ['maintenance', 'complaint', 'information', 'other'] as const;
export const DEMAND_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export const BILL_STATUSES = ['draft', 'sent', 'overdue', 'paid', 'cancelled'] as const;
export const PAYMENT_TYPES = ['unique', 'recurrent'] as const;
export const SCHEDULE_TYPES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export const BUILDING_TYPES = [
  'condo',
  'apartment',
  'townhouse',
  'commercial',
  'mixed_use',
  'other',
] as const;

export const BILL_CATEGORIES = [
  'insurance',
  'maintenance',
  'salary',
  'utilities',
  'cleaning',
  'security',
  'landscaping',
  'professional_services',
  'administration',
  'repairs',
  'supplies',
  'taxes',
  'technology',
  'reserves',
  'other',
] as const;

export const BUILDING_DOCUMENT_TYPES = [
  'bylaw',
  'financial',
  'maintenance',
  'legal',
  'meeting_minutes',
  'insurance',
  'contracts',
  'permits',
  'inspection',
  'other',
] as const;

export const RESIDENCE_DOCUMENT_TYPES = [
  'lease',
  'inspection',
  'maintenance',
  'legal',
  'insurance',
  'financial',
  'communication',
  'photos',
  'other',
] as const;

// Common validation schemas
export const commonFields = {
  // Required string fields
  requiredString: (fieldName: string, maxLength?: number) =>
    maxLength
      ? z.string().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`)
      : z.string().min(1, `${fieldName} is required`),

  // Optional string fields
  optionalString: (maxLength?: number) =>
    maxLength ? z.string().max(maxLength, 'Text is too long').optional() : z.string().optional(),

  // Required ID fields
  requiredId: (fieldName: string) => z.string().min(1, `${fieldName} is required`),

  // Email validation
  email: z.string().email('Invalid email address'),

  // Description with minimum length
  description: (minLength = 10) =>
    z.string().min(minLength, `Description must be at least ${minLength} characters`),

  // Amount/Price validation
  amount: z.string().min(1, 'Amount is required'),

  // Date validation
  date: (fieldName: string) =>
    z
      .string()
      .min(1, `${fieldName} is required`)
      .refine(
        (dateStr) => {
          const date = new Date(dateStr);
          return !isNaN(date.getTime());
        },
        {
          message: `Valid ${fieldName.toLowerCase()} is required`,
        }
      ),

  // Optional date validation
  optionalDate: z.string().optional(),

  // Boolean with default
  booleanWithDefault: (defaultValue: boolean) => z.boolean().default(defaultValue),
};

// Enum validation schemas
export const enumFields = {
  userRole: z.enum(USER_ROLES),
  demandType: z.enum(DEMAND_TYPES),
  demandStatus: z.enum(DEMAND_STATUSES),
  billStatus: z.enum(BILL_STATUSES),
  billCategory: z.enum(BILL_CATEGORIES),
  paymentType: z.enum(PAYMENT_TYPES),
  scheduleType: z.enum(SCHEDULE_TYPES).optional(),
  buildingType: z.enum(BUILDING_TYPES),
  buildingDocumentType: z.enum(BUILDING_DOCUMENT_TYPES),
  residenceDocumentType: z.enum(RESIDENCE_DOCUMENT_TYPES),
};

// Complex field combinations
// First define basic composites that don't depend on others
const addressFields = {
  address: commonFields.requiredString('Address', 500),
  city: commonFields.requiredString('City', 100),
  province: commonFields.requiredString('Province', 100),
  postalCode: commonFields.requiredString('Postal code', 20),
};

const personNameFields = {
  firstName: commonFields.requiredString('First name', 100),
  lastName: commonFields.requiredString('Last name', 100),
};

export const compositeFields = {
  // Standard name fields
  personName: personNameFields,

  // Standard address fields
  address: addressFields,

  // Organization fields
  organizationBase: {
    name: commonFields.requiredString('Organization name', 200),
    type: commonFields.requiredString('Organization type'),
    ...addressFields,
  },

  // Building base fields
  buildingBase: {
    name: commonFields.requiredString('Building name', 255),
    ...addressFields,
    buildingType: enumFields.buildingType,
    organizationId: commonFields.requiredId('Organization'),
  },

  // Document base fields
  documentBase: {
    name: commonFields.requiredString('Name', 255),
    dateReference: commonFields.date('Reference date'),
    isVisibleToTenants: commonFields.booleanWithDefault(true),
  },

  // Bill base fields
  billBase: {
    title: commonFields.requiredString('Title'),
    description: commonFields.optionalString(),
    category: enumFields.billCategory,
    vendor: commonFields.optionalString(),
    paymentType: enumFields.paymentType,
    schedulePayment: enumFields.scheduleType,
    totalAmount: commonFields.amount,
    startDate: commonFields.date('Start date'),
    endDate: commonFields.optionalDate,
    status: enumFields.billStatus,
    notes: commonFields.optionalString(),
  },

  // Demand base fields
  demandBase: {
    type: enumFields.demandType,
    description: commonFields.description(10),
    buildingId: commonFields.requiredId('Building'),
    residenceId: commonFields.optionalString(),
    assignationBuildingId: commonFields.optionalString(),
    assignationResidenceId: commonFields.optionalString(),
  },
};

// Pre-built schemas for common entities
export const schemas = {
  // User schemas
  userCreate: z.object({
    ...compositeFields.personName,
    email: commonFields.email,
    role: enumFields.userRole,
  }),

  // Building document schema
  buildingDocument: z.object({
    ...compositeFields.documentBase,
    type: enumFields.buildingDocumentType,
    buildingId: commonFields.requiredId('Building'),
  }),

  // Residence document schema
  residenceDocument: z.object({
    ...compositeFields.documentBase,
    type: enumFields.residenceDocumentType,
    residenceId: commonFields.requiredId('Residence'),
  }),

  // Bill schema
  bill: z.object(compositeFields.billBase),

  // Demand schema
  demand: z.object(compositeFields.demandBase),

  // Demand review schema (for managers)
  demandReview: z.object({
    status: z.enum(['approved', 'rejected', 'under_review', 'in_progress', 'completed']),
    reviewNotes: commonFields.optionalString(),
    assignationBuildingId: commonFields.optionalString(),
    assignationResidenceId: commonFields.optionalString(),
  }),
};

// Utility functions for validation
export const validationHelpers = {
  // Create form schema with common fields
  createFormSchema: <T extends Record<string, z.ZodTypeAny>>(fields: T) => z.object(fields),

  // Extend existing schema with additional fields
  extendSchema: <T extends z.ZodRawShape, U extends z.ZodRawShape>(
    baseSchema: z.ZodObject<T>,
    extensions: U
  ) => baseSchema.extend(extensions),

  // Create optional version of schema
  makeOptional: <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => schema.partial(),

  // Create pick schema with selected fields
  pickFields: <T extends z.ZodRawShape, K extends keyof T>(schema: z.ZodObject<T>, keys: K[]) =>
    schema.pick(Object.fromEntries(keys.map((k) => [k, true])) as any),

  // Validate enum value
  isValidEnum: <T extends readonly string[]>(enumArray: T, value: string): value is T[number] =>
    enumArray.includes(value as T[number]),
};

// Type inference helpers
/**
 *
 */
export type UserRole = z.infer<typeof enumFields.userRole>;
/**
 *
 */
export type DemandType = z.infer<typeof enumFields.demandType>;
/**
 *
 */
export type DemandStatus = z.infer<typeof enumFields.demandStatus>;
/**
 *
 */
export type BillStatus = z.infer<typeof enumFields.billStatus>;
/**
 *
 */
export type BillCategory = z.infer<typeof enumFields.billCategory>;
/**
 *
 */
export type PaymentType = z.infer<typeof enumFields.paymentType>;
/**
 *
 */
export type ScheduleType = z.infer<typeof enumFields.scheduleType>;
/**
 *
 */
export type BuildingType = z.infer<typeof enumFields.buildingType>;
/**
 *
 */
export type BuildingDocumentType = z.infer<typeof enumFields.buildingDocumentType>;
/**
 *
 */
export type ResidenceDocumentType = z.infer<typeof enumFields.residenceDocumentType>;

// Schema type exports
/**
 *
 */
export type UserCreateSchema = z.infer<typeof schemas.userCreate>;
/**
 *
 */
export type BuildingDocumentSchema = z.infer<typeof schemas.buildingDocument>;
/**
 *
 */
export type ResidenceDocumentSchema = z.infer<typeof schemas.residenceDocument>;
/**
 *
 */
export type BillSchema = z.infer<typeof schemas.bill>;
/**
 *
 */
export type DemandSchema = z.infer<typeof schemas.demand>;
/**
 *
 */
export type DemandReviewSchema = z.infer<typeof schemas.demandReview>;

export default {
  commonFields,
  enumFields,
  compositeFields,
  schemas,
  validationHelpers,
};
