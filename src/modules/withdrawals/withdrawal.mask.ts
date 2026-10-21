import { PayoutMethod } from './withdrawal.constants';

/**
 * Mask a bank account number for list and user-facing responses.
 * Example: "123456789012" -> "XXXXXXXX9012", "1234561234" -> "XXXXXX1234"
 */
export function maskAccountNumber(
  accountNumber?: string | null
): string | undefined {
  if (!accountNumber) return undefined;
  const clean = accountNumber.toString().trim();
  if (clean.length === 0) return undefined;
  if (clean.length <= 4) return 'XXXX';
  const last4 = clean.slice(-4);
  const prefixLen = Math.max(6, clean.length - 4);
  return `${'X'.repeat(prefixLen)}${last4}`;
}

/**
 * Mask a UPI ID for list and user-facing responses.
 * Example: "9876543210@paytm" -> "98XXXXXX10@paytm", "john.doe@okaxis" -> "joXXXXoe@okaxis"
 */
export function maskUpiId(upiId?: string | null): string | undefined {
  if (!upiId) return undefined;
  const clean = upiId.trim();
  if (clean.length === 0) return undefined;

  if (!clean.includes('@')) {
    if (clean.length <= 4) return 'XXXX';
    return `${'X'.repeat(Math.max(6, clean.length - 2))}${clean.slice(-2)}`;
  }

  const [username, handle] = clean.split('@');
  if (!username || username.length === 0) {
    return `XXXX@${handle}`;
  }
  if (username.length === 1) {
    return `X@${handle}`;
  }
  if (username.length === 2) {
    return `${username[0]}X@${handle}`;
  }
  if (username.length <= 4) {
    return `${username[0]}${'X'.repeat(username.length - 2)}${username.slice(-1)}@${handle}`;
  }

  const first2 = username.slice(0, 2);
  const last2 = username.slice(-2);
  const maskLen = Math.max(4, username.length - 4);
  return `${first2}${'X'.repeat(maskLen)}${last2}@${handle}`;
}

/**
 * Mask an IFSC code for list and user-facing responses.
 * Preserves bank prefix (4 chars), masks branch details.
 * Example: "SBIN0001234" -> "SBINXXXXX34"
 */
export function maskIfsc(ifsc?: string | null): string | undefined {
  if (!ifsc) return undefined;
  const clean = ifsc.trim().toUpperCase();
  if (clean.length === 0) return undefined;
  if (clean.length <= 4) return 'XXXX';
  const bankPrefix = clean.slice(0, 4);
  const last2 = clean.slice(-2);
  const maskLen = Math.max(4, clean.length - 6);
  return `${bankPrefix}${'X'.repeat(maskLen)}${last2}`;
}

/**
 * Mask a mobile number.
 * Example: "9876543210" -> "+91 ******3210"
 */
export function maskMobile(mobileNumber?: string | null): string | undefined {
  if (!mobileNumber) return undefined;
  const digits = mobileNumber.toString().replace(/\D/g, '');
  if (digits.length === 0) return undefined;
  if (digits.length < 4) return '****';
  return `+91 ******${digits.slice(-4)}`;
}

/**
 * Format masked payout destination for user lists, feeds, and records.
 */
export function formatMaskedDestination(params: {
  method?: PayoutMethod | string | null;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
}): string {
  if (
    params.method === PayoutMethod.UPI ||
    (!params.accountNumber && params.upiId)
  ) {
    return maskUpiId(params.upiId) ?? '';
  }
  const maskedAccount = maskAccountNumber(params.accountNumber) ?? 'XXXX';
  const maskedIfsc = maskIfsc(params.ifsc);
  return maskedIfsc ? `${maskedAccount}@${maskedIfsc}` : maskedAccount;
}
