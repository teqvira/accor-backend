import { z } from 'zod';
import {
  DEFAULT_QR_LABEL_SHAPE,
  parseQrLabelColor,
  QR_LABEL_COLORS,
  QR_LABEL_SHAPES,
} from './constants/qr-label.constants';

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

const endDateOnOrAfterStart = <T extends { startDate?: string | null; endDate?: string | null }>(
  data: T
) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
};

const nullableBatchDate = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.union([z.string().min(1), z.null()]).optional()
);

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
  .refine(endDateOnOrAfterStart, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

const optionalNonNegativeNumber = emptyToUndefined(
  z.coerce.number().min(0).optional()
);
const optionalRewardPoints = emptyToUndefined(
  z.coerce.number().int().min(0).optional()
);
const optionalTotalQrs = emptyToUndefined(
  z.coerce.number().int().min(1).max(500000).optional()
);

const optionalActiveStatus = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val !== 'string') return val;
  const normalized = val.trim().toLowerCase();
  if (normalized === 'active' || normalized === 'inactive') return normalized;
  return undefined;
}, z.enum(['active', 'inactive']).optional());

const optionalLabelColor = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val !== 'string') return val;
  return parseQrLabelColor(val) ?? val;
}, z.enum(QR_LABEL_COLORS).optional());

export const updateBatchSchema = z
  .object({
    productId: emptyToUndefined(z.guid().optional()),
    couponName: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.union([z.string().trim().min(1).max(255), z.null()]).optional()
    ),
    totalQrs: optionalTotalQrs,
    status: optionalActiveStatus,
    shape: emptyToUndefined(z.enum(QR_LABEL_SHAPES).optional()),
    color: optionalLabelColor,
    couponValue: optionalNonNegativeNumber,
    rewardPoints: optionalRewardPoints,
    startDate: nullableBatchDate,
    endDate: nullableBatchDate,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  })
  .refine(endDateOnOrAfterStart, {
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
