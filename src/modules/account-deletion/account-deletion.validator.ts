import { z } from 'zod';

const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian number');

export const websiteSendOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
});

export const websiteConfirmDeletionSchema = z.object({
  mobileNumber: mobileNumberSchema,
  otp: z.string().trim().min(4).max(8),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const appDeleteAccountSchema = z.preprocess(
  (val) => (val === undefined || val === null || val === '' ? {} : val),
  z.object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
);

export const listDeletionRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['pending', 'deleted', 'cancelled']).optional(),
  source: z.enum(['app', 'website', 'admin']).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});
