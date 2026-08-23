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

export const REWARD_REDEMPTION_STATUSES = [
  'pending',
  'gifted',
  'rejected',
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

export const adminRedemptionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(REWARD_REDEMPTION_STATUSES).optional(),
  rewardId: z.guid().optional(),
  search: z.string().trim().optional(),
});

export const updateRedemptionStatusSchema = z
  .object({
    status: z.enum(['gifted', 'rejected']),
    adminNote: z.string().trim().max(500).nullable().optional(),
    handoverImageUrl: z
      .string()
      .trim()
      .url('Invalid handover image URL')
      .nullable()
      .optional(),
    recipientName: z.string().trim().min(1).max(100).nullable().optional(),
    recipientPhone: z
      .preprocess(
        (val) => (val === '' || val === undefined ? null : val),
        z
          .string()
          .trim()
          .regex(/^[6-9]\d{9}$/, 'Recipient phone must be a valid 10-digit Indian number')
          .nullable()
          .optional()
      ),
    recipientNote: z.string().trim().max(500).nullable().optional(),
    handoverDate: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status !== 'gifted') return;

    if (!data.handoverImageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handoverImageUrl'],
        message: 'Handover image is required when marking a gift as redeemed',
      });
    }
    if (!data.recipientName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipientName'],
        message: 'Recipient name is required when marking a gift as redeemed',
      });
    }
  });

export const redeemRewardSchema = z.object({
  // Seeded catalog IDs (e.g. 11111111-0000-0000-0000-…) are valid Postgres UUIDs
  // but fail Zod's strict RFC uuid() check — use guid() instead.
  rewardId: z.guid('Invalid reward ID'),
  idempotencyKey: z.guid('Invalid idempotency key'),
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

export const updateRewardSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    pointsCost: z
      .preprocess(
        (val) => (val === undefined || val === null || val === '' ? undefined : val),
        z.coerce.number().int().min(1)
      )
      .optional(),
    pointsRequired: z
      .preprocess(
        (val) => (val === undefined || val === null || val === '' ? undefined : val),
        z.coerce.number().int().min(1)
      )
      .optional(),
    status: z.enum(REWARD_STATUSES).optional(),
    category: z.enum(REWARD_CATEGORIES).optional(),
    imageUrl: z.string().trim().url('Invalid image URL').nullable().optional(),
    description: z.string().trim().nullable().optional(),
    stockQuantity: z
      .preprocess(
        (val) => (val === undefined || val === null || val === '' ? null : val),
        z.coerce.number().int().min(0).nullable()
      )
      .optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

