import crypto from 'crypto';
import { env } from '../config/env';

export function generateOtp(): string {
  const max = 10 ** env.OTP_LENGTH;
  const otp = crypto.randomInt(0, max).toString().padStart(env.OTP_LENGTH, '0');
  return otp;
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  const candidate = hashOtp(otp);
  if (candidate.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}
