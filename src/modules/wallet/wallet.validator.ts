import { z } from "zod";

export const walletSummaryQuerySchema = z.object({
  recentLimit: z.coerce.number().int().min(1).max(20).optional(),
});

export const adminWalletScansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createWalletOrderSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least 1'),
  currency: z.string().default('INR').optional(),
});

export const verifyWalletPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
  amount: z.number().optional(),
});

