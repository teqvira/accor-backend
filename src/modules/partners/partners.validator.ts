import { z } from 'zod';

const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian number');

export const listPartnersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userType: z.enum(['mechanic', 'dealer']).optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  status: z.enum(['blocked', 'unblocked']).optional(),
  isBlocked: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        if (val === 'true') return true;
        if (val === 'false') return false;
      }
      return val;
    }, z.boolean())
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const createPartnerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobileNumber: mobileNumberSchema,
  userType: z.enum(['mechanic', 'dealer']),
  email: z.string().trim().email(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  aadhaarUrl: z.string().trim().url('Aadhaar document upload is required'),
  panUrl: z.string().trim().url('PAN document upload is required'),
});

export const updatePartnerSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    mobileNumber: mobileNumberSchema.optional(),
    userType: z.enum(['mechanic', 'dealer']).optional(),
    email: z.string().trim().email().optional(),
    city: z.string().trim().min(2).max(100).optional().nullable(),
    state: z.string().trim().min(2).max(100).optional().nullable(),
    aadhaarUrl: z.string().trim().url().optional(),
    panUrl: z.string().trim().url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

export const updatePartnerDocumentsSchema = z
  .object({
    aadhaarUrl: z.string().trim().url().optional(),
    panUrl: z.string().trim().url().optional(),
  })
  .refine((data) => data.aadhaarUrl || data.panUrl, {
    message: 'At least one of aadhaarUrl or panUrl is required',
  });

export const partnerDocumentPresignedSchema = z
  .object({
    purpose: z.enum(['aadhaar', 'pan']),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];
    if (!allowed.includes(data.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentType'],
        message: 'Document must be JPEG, PNG, WebP, GIF, or PDF',
      });
    }
    if (!/\.(jpe?g|png|webp|gif|pdf)$/i.test(data.fileName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fileName'],
        message:
          'File name must end with .jpg, .jpeg, .png, .webp, .gif, or .pdf',
      });
    }
  });

export const rejectPartnerSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const blockPartnerSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

