import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  productId: z.string().min(1, 'Product is required'),
  campaignId: z.string().min(1).optional(),
  description: z.string().trim().max(5000).optional(),
  totalQrs: z.coerce.number().int().min(1).max(500000),
});

export const assignCampaignSchema = z.object({
  campaignId: z.string().min(1),
});

export const listCodesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  batchId: z.string().optional(),
  redeemed: z.enum(['true', 'false']).optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['png', 'pdf', 'zip']).default('zip'),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
});
