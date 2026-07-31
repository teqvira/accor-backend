import { z } from 'zod';
import { CampaignStatus } from './campaigns.types';

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    schema
  );
}

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2, 'Campaign name must be at least 2 characters').max(255),
  campaignCode: emptyToUndefined(
    z.string().trim().min(2).max(50).optional()
  ),
  productId: z.string().uuid('Invalid Product ID'),
  multiplier: z.coerce
    .number()
    .min(1.0, 'Multiplier must be at least 1.0')
    .max(100, 'Multiplier must not exceed 100'),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date format',
  }),
  batchIds: z
    .array(z.string().uuid('Invalid Batch ID'))
    .min(1, 'At least one batch/coupon must be selected'),
  description: emptyToUndefined(z.string().trim().max(1000).optional()),
  status: z.nativeEnum(CampaignStatus).optional().default(CampaignStatus.ACTIVE),
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateCampaignSchema = z.object({
  name: emptyToUndefined(z.string().trim().min(2).max(255).optional()),
  campaignCode: emptyToUndefined(z.string().trim().min(2).max(50).optional()),
  productId: emptyToUndefined(z.string().uuid('Invalid Product ID').optional()),
  multiplier: emptyToUndefined(
    z.coerce
      .number()
      .min(1.0, 'Multiplier must be at least 1.0')
      .max(100, 'Multiplier must not exceed 100')
      .optional()
  ),
  startDate: emptyToUndefined(
    z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    }).optional()
  ),
  endDate: emptyToUndefined(
    z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid end date format',
    }).optional()
  ),
  batchIds: emptyToUndefined(
    z.array(z.string().uuid('Invalid Batch ID')).min(1, 'At least one batch/coupon must be selected').optional()
  ),
  description: emptyToUndefined(z.string().trim().max(1000).optional()),
  status: emptyToUndefined(z.nativeEnum(CampaignStatus).optional()),
});

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  productId: emptyToUndefined(z.string().uuid().optional()),
  status: emptyToUndefined(z.nativeEnum(CampaignStatus).optional()),
  search: emptyToUndefined(z.string().trim().min(1).max(200).optional()),
});
