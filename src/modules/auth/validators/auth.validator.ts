import { z } from 'zod';
import { UserRole } from '../models/user.model';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: passwordSchema,
  role: z.nativeEnum(UserRole),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
});

export const resetPasswordWithTokenSchema = z.object({
  resetToken: z.string().min(1),
  newPassword: passwordSchema,
});

export const resetPasswordWithCurrentSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
