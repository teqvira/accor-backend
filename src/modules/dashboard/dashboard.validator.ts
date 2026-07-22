import { z } from 'zod';

export const dashboardStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).optional(),
});
