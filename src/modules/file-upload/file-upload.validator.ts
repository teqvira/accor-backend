import { z } from 'zod';
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  PARTNER_DOCUMENT_PURPOSES,
  PROFILE_UPLOAD_PURPOSES,
} from './file-upload.constants';

export const presignedUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
    .regex(
      /\.(jpe?g|png|webp|gif)$/i,
      'File name must end with a supported image extension'
    ),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    message: 'Only JPEG, PNG, WebP, and GIF images are allowed',
  }),
  folder: z.enum(['products', 'rewards']).optional(),
});

export const partnerDocumentPresignedUploadSchema = z
  .object({
    purpose: z.enum(PARTNER_DOCUMENT_PURPOSES),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(data.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentType'],
        message: 'Document must be JPEG, PNG, WebP, GIF, or PDF',
      });
    }
    if (!/\.(jpe?g|png|webp|gif|pdf)$/i.test(data.fileName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fileName'],
        message:
          'File name must end with .jpg, .jpeg, .png, .webp, .gif, or .pdf',
      });
    }
  });

export const profilePresignedUploadSchema = z
  .object({
    purpose: z.enum(PROFILE_UPLOAD_PURPOSES),
    fileName: z
      .string()
      .trim()
      .min(1, 'File name is required')
      .max(255, 'File name is too long'),
    contentType: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.purpose === 'avatar') {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(data.contentType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contentType'],
          message: 'Avatar must be JPEG, PNG, WebP, or GIF',
        });
      }
      if (!/\.(jpe?g|png|webp|gif)$/i.test(data.fileName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fileName'],
          message:
            'Avatar file name must end with .jpg, .jpeg, .png, .webp, or .gif',
        });
      }
      return;
    }

    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(data.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentType'],
        message: 'Document must be JPEG, PNG, WebP, GIF, or PDF',
      });
    }
    if (!/\.(jpe?g|png|webp|gif|pdf)$/i.test(data.fileName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fileName'],
        message:
          'Document file name must end with .jpg, .jpeg, .png, .webp, .gif, or .pdf',
      });
    }
  });
