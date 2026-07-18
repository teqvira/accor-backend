import { z } from 'zod';
import { UserRole } from './user.types';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian number');

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

export const verifyPasswordOtpSchema = z.object({
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

export const sendMobileOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
});

export const verifyMobileOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
  otp: z.string().min(4).max(8),
});

export const resendMobileOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
});
