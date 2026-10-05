import { env } from '../../config/env';

export async function sendOtpSms(
  mobileNumber: string,
  otp: string
): Promise<void> {
  if (env.NODE_ENV === 'development' && !env.MSG91_AUTH_KEY) {
    console.log(`[SMS OTP] ${mobileNumber}: ${otp}`);
    return;
  }

  if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
    throw new Error('MSG91 configuration is missing. Cannot send SMS.');
  }

  const formattedMobile = `91${mobileNumber}`;

  const payload = {
    template_id: env.MSG91_TEMPLATE_ID,
    short_url: '0',
    recipients: [
      {
        mobiles: formattedMobile,
        numeric: otp,
      },
    ],
  };

  const response = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      authkey: env.MSG91_AUTH_KEY,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`[SMS OTP] MSG91 Error: ${response.status} ${responseText}`);
    throw new Error('Failed to send SMS OTP via MSG91');
  }

  // Debug log to see exactly what MSG91 returned
  console.log(`[SMS OTP] MSG91 Response:`, responseText);
}
