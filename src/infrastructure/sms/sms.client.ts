import { env } from '../../config/env';

export async function sendOtpSms(
  mobileNumber: string,
  otp: string
): Promise<void> {
  if (env.NODE_ENV === 'development') {
    console.log(`[SMS OTP] ${mobileNumber}: ${otp}`);
    return;
  }

  // Integrate SMS provider here when configured
  console.log(`[SMS OTP] ${mobileNumber}: OTP sent`);
}
