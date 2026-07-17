import { z } from 'zod';
import { UserRole } from '../../auth/types/user.types';

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
