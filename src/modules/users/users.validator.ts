import { z } from 'zod';
import { UserRole } from '../auth/user.types';

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    schema
  );
}

const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian number');

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  role: emptyToUndefined(z.nativeEnum(UserRole).optional()),
  isActive: emptyToUndefined(
    z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional()
  ),
  isVerified: emptyToUndefined(
    z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional()
  ),
  search: emptyToUndefined(z.string().trim().min(1).max(200).optional()),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().nullable().optional(),
    mobileNumber: mobileNumberSchema.nullable().optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const PINCODE_REGEX = /^[1-9]\d{5}$/;
const pincodeSchema = z
  .string()
  .trim()
  .regex(PINCODE_REGEX, 'Pincode must be a valid 6-digit Indian pincode');

export const completeProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email(),
    dateOfBirth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD'),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: pincodeSchema,
    userType: z.enum(['mechanic', 'dealer']),
    garageRole: z.enum(['owner', 'worker']).optional(),
    garageName: z.string().trim().min(2).max(255).optional(),
    garageOwnerName: z.string().trim().min(2).max(100).optional(),
    avatarUrl: z.string().trim().url().optional(),
    aadhaarUrl: z.string().trim().url(),
    panUrl: z.string().trim().url(),
  })
  .superRefine((data, ctx) => {
    if (data.userType !== 'mechanic') return;

    if (!data.garageRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['garageRole'],
        message: 'Select Garage Owner or Worker',
      });
    }
    if (!data.garageName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['garageName'],
        message: 'Garage name is required',
      });
    }
    if (data.garageRole === 'worker' && !data.garageOwnerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['garageOwnerName'],
        message: 'Garage owner name is required for workers',
      });
    }
  });
