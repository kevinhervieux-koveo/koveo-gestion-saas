/**
 * Validation schemas with translation support
 * This file provides Zod schemas that use translation keys instead of hardcoded error messages
 */

import { z } from 'zod';

/**
 * Creates a login validation schema with translation keys
 * The error messages will be resolved at runtime using the translation system
 */
export const createLoginSchema = () => z.object({
  email: z
    .string()
    .min(1, 'emailRequired')
    .email('invalidEmailFormat')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'passwordRequired')
    .min(8, 'passwordTooShort'),
});

/**
 * Creates an invitation validation schema with translation keys
 */
export const createInvitationSchema = () => z
  .object({
    email: z.string().email('invalidEmailFormat').optional(),
    firstName: z.string().max(50, 'firstNameTooLong').regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'firstNameInvalidCharacters').optional(),
    lastName: z.string().max(50, 'lastNameTooLong').regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'lastNameInvalidCharacters').optional(),
    role: z.enum([
      'admin',
      'manager',
      'tenant',
      'resident',
      'demo_manager',
      'demo_tenant',
      'demo_resident',
    ]),
    organizationId: z.string().min(1, 'organizationRequired'),
    buildingId: z.string().optional(),
    residenceId: z.string().optional(),
    personalMessage: z.string().max(500, 'personalMessageTooLong').optional(),
    expiryDays: z.number().min(1, 'expiryDaysInvalid').max(30, 'expiryDaysInvalid'),
  })
  .refine(
    (data) => {
      if (['demo_manager', 'demo_tenant', 'demo_resident'].includes(data.role)) {
        return !!data.firstName && !!data.lastName;
      }
      return !!data.email;
    },
    {
      message: 'emailOrNameRequired',
      path: ['email'],
    }
  )
  .refine(
    (data) => {
      if (
        ['tenant', 'resident', 'demo_tenant', 'demo_resident'].includes(data.role) &&
        data.buildingId &&
        data.buildingId !== 'none' &&
        data.buildingId !== ''
      ) {
        return !!data.residenceId && data.residenceId !== '';
      }
      return true;
    },
    {
      message: 'residenceRequired',
      path: ['residenceId'],
    }
  );