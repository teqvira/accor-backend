import { z } from 'zod';
import {
  DEFAULT_QR_LABEL_SHAPE,
  QR_LABEL_COLORS,
  QR_LABEL_SHAPES,
} from '../constants/qr-label.constants';

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    schema
  );
}

const batchRewardFields = {
  couponValue: z.coerce.number().min(0),
  rewardPoints: z.coerce.number().min(0),
  startDate: emptyToUndefined(z.string().min(1).optional()),
  endDate: emptyToUndefined(z.string().min(1).optional()),
};

export const createBatchSchema = z
  .object({
    productId: z.string().min(1, 'Product is required'),
    couponName: emptyToUndefined(
      z.string().trim().min(1).max(255).optional()
    ),
    totalQrs: z.coerce.number().int().min(1).max(500000),
    status: z.enum(['active', 'inactive']).default('active'),
    shape: z.enum(QR_LABEL_SHAPES).default(DEFAULT_QR_LABEL_SHAPE),
    color: z.enum(QR_LABEL_COLORS),
    ...batchRewardFields,
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  );

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
