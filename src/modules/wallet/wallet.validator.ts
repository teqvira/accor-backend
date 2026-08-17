import { z } from 'zod';

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

