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
});
