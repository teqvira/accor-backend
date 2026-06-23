import dotenv from 'dotenv';
import { z } from 'zod';
import { PayoutProviderName } from '../modules/withdrawals/constants/withdrawal.constants';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432'),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().default('accor_db'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_RESET_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_RESET_EXPIRES_IN: z.string().default('10m'),
  OTP_EXPIRES_MINUTES: z.coerce.number().default(10),
  OTP_LENGTH: z.coerce.number().min(4).max(8).default(6),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_BUCKET_NAME: z.string().min(1),
  REDEMPTION_BASE_URL: z.string().url().default('http://localhost:7412'),
  QR_CODE_LENGTH: z.coerce.number().min(8).max(21).default(12),
  QR_GENERATION_CHUNK_SIZE: z.coerce.number().min(100).max(10000).default(5000),
  PAYOUT_PROVIDER: z
    .nativeEnum(PayoutProviderName)
    .default(PayoutProviderName.MOCK),
  MIN_WITHDRAWAL_AMOUNT: z.coerce.number().min(1).default(50),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAYX_ACCOUNT_NUMBER: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  CASHFREE_CLIENT_ID: z.string().optional(),
  CASHFREE_CLIENT_SECRET: z.string().optional(),
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
