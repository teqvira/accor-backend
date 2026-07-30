import { z } from 'zod';
import { REWARD_STORE_MAX_LIMIT } from './rewards.constants';

export const REWARD_CATEGORIES = [
  'electronics',
  'vouchers',
  'merchandise',
  'other',
] as const;

export const REWARD_STATUSES = [
  'active',
  'upcoming',
  'inactive',
  'expired',
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

export const adminRewardListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(REWARD_CATEGORIES).optional(),
  status: z.enum(REWARD_STATUSES).optional(),
  search: z.string().trim().optional(),
});

export const redeemRewardSchema = z.object({
  rewardId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const createRewardSchema = z.object({
  name: z.string().trim().min(1, 'Reward name is required').max(255),
  pointsCost: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? undefined : val),
    z.coerce.number().int('Points required must be an integer').min(1, 'Points required must be at least 1')
  ).optional(),
  pointsRequired: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? undefined : val),
    z.coerce.number().int('Points required must be an integer').min(1, 'Points required must be at least 1')
  ).optional(),
  status: z.enum(REWARD_STATUSES).default('upcoming'),
  category: z.enum(REWARD_CATEGORIES).default('other'),
  imageUrl: z
    .string()
    .trim()
    .url('Invalid image URL')
    .nullable()
    .optional(),
  description: z.string().trim().nullable().optional(),
  stockQuantity: z
    .preprocess(
      (val) => (val === undefined || val === null || val === '' ? null : val),
      z.coerce.number().int().min(0).nullable()
    )
    .optional(),
  sortOrder: z.coerce.number().int().default(0),
}).refine((data) => data.pointsCost !== undefined || data.pointsRequired !== undefined, {
  message: 'Points required is required',
  path: ['pointsRequired'],
});
