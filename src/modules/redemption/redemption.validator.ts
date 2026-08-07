import { z } from 'zod';

export const redeemSchema = z.object({
  code: z.string().min(1).max(50),
});

export const redemptionSendOtpSchema = z.object({
  code: z.string().min(1).max(50),
});

export const redemptionVerifyOtpSchema = z.object({
  code: z.string().min(1).max(50),
  otp: z.string().min(4).max(8),
});
