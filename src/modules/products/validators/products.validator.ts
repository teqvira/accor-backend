import { z } from 'zod';
import { isOwnBucketObjectUrl } from '../../file-upload/utils/s3Object';
import {
  PRODUCT_STATUSES,
  PRODUCT_TEXT_MAX_LENGTH,
  PRODUCT_TYPES,
} from '../constants/products.constants';

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    schema
  );
}

const productImageUrlSchema = z
  .string()
  .trim()
  .url('Image URL must be valid')
  .refine(isOwnBucketObjectUrl, 'Image URL must be an uploaded product image');

const productBaseSchema = z.object({
  skuCode: z
    .string()
    .trim()
    .min(1, 'SKU code is required')
    .max(PRODUCT_TEXT_MAX_LENGTH),
  name: z.string().trim().min(2).max(PRODUCT_TEXT_MAX_LENGTH),
  productType: z.enum(PRODUCT_TYPES),
  brand: z.string().trim().max(PRODUCT_TEXT_MAX_LENGTH).optional(),
  couponCode: z.string().trim().max(PRODUCT_TEXT_MAX_LENGTH).optional(),
  status: z.enum(PRODUCT_STATUSES).default('active'),
  description: z.string().trim().max(PRODUCT_TEXT_MAX_LENGTH).optional(),
  imageUrl: productImageUrlSchema.optional(),
});

export const createProductSchema = productBaseSchema;

export const updateProductSchema = productBaseSchema
  .partial()
  .extend({
    brand: z.string().trim().max(PRODUCT_TEXT_MAX_LENGTH).nullable().optional(),
    couponCode: z
      .string()
      .trim()
      .max(PRODUCT_TEXT_MAX_LENGTH)
      .nullable()
      .optional(),
    description: z
      .string()
      .trim()
      .max(PRODUCT_TEXT_MAX_LENGTH)
      .nullable()
      .optional(),
    imageUrl: z.union([z.null(), productImageUrlSchema]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  productType: emptyToUndefined(z.enum(PRODUCT_TYPES).optional()),
  status: emptyToUndefined(z.enum(PRODUCT_STATUSES).optional()),
  brand: emptyToUndefined(
    z.string().trim().min(1).max(PRODUCT_TEXT_MAX_LENGTH).optional()
  ),
  search: emptyToUndefined(z.string().trim().min(1).max(200).optional()),
});
