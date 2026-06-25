import { z } from 'zod';
import {
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
} from '../constants/products.constants';

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    schema
  );
}

const productBaseSchema = z.object({
  skuCode: z
    .string()
    .trim()
    .min(2, 'SKU code must be at least 2 characters')
    .max(50, 'SKU code must be at most 50 characters')
    .regex(
      /^[A-Za-z0-9-]+$/,
      'SKU code may only contain letters, numbers, and hyphens'
    ),
  name: z.string().trim().min(2).max(500),
  productType: z.enum(PRODUCT_TYPES),
  brand: z.string().trim().min(1).max(100).optional(),
  couponCode: z.string().trim().min(1).max(100).optional(),
  status: z.enum(PRODUCT_STATUSES).default('active'),
  description: z.string().trim().max(5000).optional(),
  imageUrl: z.string().trim().url('Image URL must be valid').optional(),
});

export const createProductSchema = productBaseSchema;

export const updateProductSchema = productBaseSchema
  .partial()
  .extend({
    brand: z.string().trim().min(1).max(100).nullable().optional(),
    couponCode: z.string().trim().min(1).max(100).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    imageUrl: z.string().trim().url('Image URL must be valid').nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  productType: emptyToUndefined(z.enum(PRODUCT_TYPES).optional()),
  status: emptyToUndefined(z.enum(PRODUCT_STATUSES).optional()),
  brand: emptyToUndefined(z.string().trim().min(1).max(100).optional()),
  search: emptyToUndefined(z.string().trim().min(1).max(200).optional()),
});
