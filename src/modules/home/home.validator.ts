import { z } from 'zod';

export const homeQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});
