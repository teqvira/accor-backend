import { z } from 'zod';
import { REWARD_STORE_MAX_LIMIT } from './rewards.constants';

export const REWARD_CATEGORIES = [
  'electronics',
  'vouchers',
  'merchandise',
  'other',
] as const;

export const rewardStoreQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(REWARD_STORE_MAX_LIMIT)
    .default(20),
  category: z.enum(REWARD_CATEGORIES).optional(),
});

export const redeemRewardSchema = z.object({
  rewardId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});
