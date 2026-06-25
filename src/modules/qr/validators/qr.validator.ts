import { z } from 'zod';

const batchRewardFields = {
  walletAmount: z.coerce.number().min(0),
  rewardPoints: z.coerce.number().min(0),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
};

export const createBatchSchema = z
  .object({
    productId: z.string().min(1, 'Product is required'),
    totalQrs: z.coerce.number().int().min(1).max(500000),
    description: z.string().trim().max(5000).optional(),
    status: z.enum(['active', 'inactive']).default('active'),
    ...batchRewardFields,
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'End date must be on or after start date',
    path: ['endDate'],
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
