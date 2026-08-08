import { z } from 'zod';

export const dashboardOverviewQuerySchema = z.object({
  /** Search pending partner requests by name, mobile, or email. */
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** @deprecated Use dashboardOverviewQuerySchema. */
export const dashboardStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).optional(),
});
