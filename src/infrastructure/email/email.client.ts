import nodemailer from 'nodemailer';
import { env } from '../../config/env';

const hasSmtp =
  Boolean(env.SMTP_HOST) &&
  Boolean(env.SMTP_USER) &&
  Boolean(env.SMTP_PASS);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

export async function sendOtpEmail(
  to: string,
  otp: string
): Promise<void> {
  const subject = 'Your password reset OTP';
  const text = `Your OTP is: ${otp}. It expires in ${env.OTP_EXPIRES_MINUTES} minutes.`;

  if (!transporter) {
    console.log(`[DEV] OTP for ${to}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM ?? env.SMTP_USER,
    to,
    subject,
    text,
  });
}
