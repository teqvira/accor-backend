import { z } from 'zod';
import { PayoutMethod } from './withdrawal.constants';

const upiIdSchema = z
  .string()
  .trim()
  .regex(/^[\w.\-]{2,}@[\w.\-]{2,}$/, 'Invalid UPI ID format');

const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code');

export const savePayoutProfileSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal(PayoutMethod.UPI),
    accountHolderName: z.string().min(2).max(100),
    upiId: upiIdSchema,
  }),
  z.object({
    method: z.literal(PayoutMethod.BANK),
    accountHolderName: z.string().min(2).max(100),
    accountNumber: z.string().regex(/^\d{9,18}$/, 'Invalid account number'),
    ifsc: ifscSchema,
  }),
]);

export const createWithdrawalSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.nativeEnum(PayoutMethod).optional(),
  accountHolderName: z.string().min(2).max(100).optional(),
  upiId: upiIdSchema.optional(),
  accountNumber: z.string().regex(/^\d{9,18}$/, 'Invalid account number').optional(),
  ifsc: ifscSchema.optional(),
  bankName: z.string().max(100).optional(),
});

export const withdrawalSendOtpSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
});

export const withdrawalVerifyOtpSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  otp: z.string().min(4).max(8),
  method: z.nativeEnum(PayoutMethod).optional(),
  accountHolderName: z.string().min(2).max(100).optional(),
  upiId: upiIdSchema.optional(),
  accountNumber: z.string().regex(/^\d{9,18}$/, 'Invalid account number').optional(),
  ifsc: ifscSchema.optional(),
  bankName: z.string().max(100).optional(),
});

export const adminListWithdrawalsQuerySchema = z.object({
  status: z
    .enum(['pending', 'processing', 'success', 'failed', 'all'])
    .default('pending'),
  search: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminCompleteWithdrawalSchema = z.object({
  utr: z.string().trim().min(1).max(100).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export const adminRejectWithdrawalSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(500),
});

