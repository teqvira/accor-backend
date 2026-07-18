import { z } from 'zod';

export const redeemSchema = z.object({
  code: z.string().min(1).max(50),
});
