import { z } from 'zod';

export const walletSummaryQuerySchema = z.object({
  recentLimit: z.coerce.number().int().min(1).max(20).optional(),
});
