import { z } from 'zod';
import { CampaignStatus } from './campaigns.types';

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    schema
  );
}

const PINCODE_REGEX = /^[1-9]\d{5}$/;

export function normalizeBonusTarget(val: unknown): 'cash' | 'reward' | 'both' {
  if (typeof val !== 'string') return 'both';
  const lower = val.trim().toLowerCase();
  if (lower === 'cash' || lower === 'cash rewards' || lower === 'cashback') return 'cash';
  if (lower === 'reward' || lower === 'reward points' || lower === 'rewards') return 'reward';
  return 'both';
}

const bonusTargetSchema = z.preprocess(
  (val) => normalizeBonusTarget(val),
  z.enum(['cash', 'reward', 'both'])
);

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
  applyBonusTo: bonusTargetSchema.optional().default('both'),
  bonusType: z.string().optional(),
  type: z.string().optional(),
  allPincodes: z.boolean().optional(),
  pincodeScope: z.enum(['all', 'specific']).optional(),
  pincode: emptyToUndefined(
    z.string().trim().regex(PINCODE_REGEX, 'Pincode must be a valid 6-digit Indian pincode').optional()
  ),
  pincodes: z
    .array(z.string().trim().regex(PINCODE_REGEX, 'Each pincode must be a valid 6-digit Indian pincode'))
    .optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date format',
  }),
  batchIds: z
    .array(z.string().uuid('Invalid Batch ID'))
    .min(1, 'At least one batch/coupon must be selected'),
  active: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (new Date(data.endDate) < new Date(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date must be on or after start date',
    });
  }

  const isSpecific =
    data.pincodeScope === 'specific' ||
    (data.allPincodes === false) ||
    (Array.isArray(data.pincodes) && data.pincodes.length > 0) ||
    Boolean(data.pincode);

  const isExplicitAll = data.allPincodes === true || data.pincodeScope === 'all';

  if (!isExplicitAll && isSpecific) {
    const hasPincode = Boolean(data.pincode) || (Array.isArray(data.pincodes) && data.pincodes.length > 0);
    if (!hasPincode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pincodes'],
        message: 'At least one pincode is required when targeting specific pincodes',
      });
    }
  }
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
  applyBonusTo: z.preprocess(
    (val) => (val === undefined ? undefined : normalizeBonusTarget(val)),
    z.enum(['cash', 'reward', 'both']).optional()
  ),
  bonusType: emptyToUndefined(z.string().optional()),
  type: emptyToUndefined(z.string().optional()),
  allPincodes: z.boolean().optional(),
  pincodeScope: z.enum(['all', 'specific']).optional(),
  pincode: emptyToUndefined(
    z.string().trim().regex(PINCODE_REGEX, 'Pincode must be a valid 6-digit Indian pincode').nullable().optional()
  ),
  pincodes: z
    .array(z.string().trim().regex(PINCODE_REGEX, 'Each pincode must be a valid 6-digit Indian pincode'))
    .optional(),
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
  active: z.boolean().optional(),
});

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  productId: emptyToUndefined(z.string().uuid().optional()),
  status: emptyToUndefined(z.nativeEnum(CampaignStatus).optional()),
  search: emptyToUndefined(z.string().trim().min(1).max(200).optional()),
  pincode: emptyToUndefined(z.string().trim().regex(PINCODE_REGEX).optional()),
});
