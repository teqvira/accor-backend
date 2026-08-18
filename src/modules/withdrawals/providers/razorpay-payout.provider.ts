import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/utils/errors';
import { PayoutMethod, PayoutProviderName } from '../withdrawal.constants';
import { payoutProfileRepository } from '../repositories/payout-profile.repository';
import { IPayoutProfile } from '../withdrawal.types';
import { PayoutResult } from '../withdrawal.types';
import { PayoutProvider } from './payout-provider.types';

interface RazorpayEntity {
  id: string;
  status?: string;
}

function getRazorpayAuthHeader(): string {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new BadRequestError(
      'Razorpay is not configured',
      'Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET'
    );
  }
  const token = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');
  return `Basic ${token}`;
}

function razorpayXAccountNumber(): string {
  const value = env.RAZORPAYX_ACCOUNT_NUMBER?.trim() ?? '';
  if (!value) {
    throw new BadRequestError(
      'Razorpay payout account is not configured',
      'Missing RAZORPAYX_ACCOUNT_NUMBER'
    );
  }
  if (!/^[A-Za-z0-9]+$/.test(value)) {
    throw new BadRequestError(
      'Razorpay payout account number is invalid',
      `RAZORPAYX_ACCOUNT_NUMBER has invalid characters: ${JSON.stringify(value)}`
    );
  }
  return value;
}

/** Mock / stale IDs must not be reused against real Razorpay. */
function isRazorpayContactId(id?: string | null): boolean {
  return Boolean(id && /^cont_/i.test(id));
}

function isRazorpayFundAccountId(id?: string | null): boolean {
  return Boolean(id && /^fa_/i.test(id));
}

async function razorpayRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: getRazorpayAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as T & { error?: { description?: string } };
  if (!response.ok) {
    throw new BadRequestError(
      data.error?.description ?? 'Razorpay payout request failed',
      `Razorpay ${method} ${path} failed: ${JSON.stringify(data)}`
    );
  }
  return data;
}

export class RazorpayPayoutService implements PayoutProvider {
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    let providerContactId = isRazorpayContactId(profile.providerContactId)
      ? profile.providerContactId
      : undefined;
    let providerFundAccountId = isRazorpayFundAccountId(
      profile.providerFundAccountId
    )
      ? profile.providerFundAccountId
      : undefined;

    // Stale fund account from another Razorpay key / mock era → recreate.
    if (providerFundAccountId) {
      try {
        await razorpayRequest<RazorpayEntity>(
          `/fund_accounts/${providerFundAccountId}`,
          'GET'
        );
      } catch {
        providerFundAccountId = undefined;
        providerContactId = isRazorpayContactId(providerContactId)
          ? providerContactId
          : undefined;
      }
    }

    if (!providerContactId) {
      const contact = await razorpayRequest<RazorpayEntity>('/contacts', 'POST', {
        name: profile.accountHolderName,
        email: `${profile.userId.replace(/-/g, '')}@payout.local`,
        contact: '9999999999',
        type: 'customer',
        reference_id: profile.userId.slice(0, 40),
      });
      providerContactId = contact.id;
    }

    if (!providerFundAccountId) {
      const fundAccountBody =
        profile.method === PayoutMethod.UPI
          ? {
              contact_id: providerContactId,
              account_type: 'vpa',
              vpa: { address: profile.upiId },
            }
          : {
              contact_id: providerContactId,
              account_type: 'bank_account',
              bank_account: {
                name: profile.accountHolderName,
                ifsc: profile.ifsc,
                account_number: profile.accountNumber,
              },
            };

      const fundAccount = await razorpayRequest<RazorpayEntity>(
        '/fund_accounts',
        'POST',
        fundAccountBody
      );
      providerFundAccountId = fundAccount.id;
    }

    if (
      providerContactId === profile.providerContactId &&
      providerFundAccountId === profile.providerFundAccountId &&
      profile.provider === PayoutProviderName.RAZORPAY
    ) {
      return profile;
    }

    const updated = await payoutProfileRepository.update(profile._id, {
      provider: PayoutProviderName.RAZORPAY,
      providerContactId,
      providerFundAccountId,
    });
    return updated ?? profile;
  }

  async createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult> {
    const accountNumber = razorpayXAccountNumber();

    if (!isRazorpayFundAccountId(profile.providerFundAccountId)) {
      throw new BadRequestError(
        'Payout account is not ready',
        'providerFundAccountId missing or invalid on profile'
      );
    }

    const payout = await razorpayRequest<RazorpayEntity & { status: string }>(
      '/payouts',
      'POST',
      {
        account_number: accountNumber,
        fund_account_id: profile.providerFundAccountId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        mode: profile.method === PayoutMethod.UPI ? 'UPI' : 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: referenceId,
      }
    );

    return {
      providerPayoutId: payout.id,
      status: payout.status === 'processed' ? 'success' : 'processing',
      rawResponse: payout as unknown as Record<string, unknown>,
    };
  }

  async getAccountBalance(): Promise<{
    balance: number;
    currency: string;
    isConfigured: boolean;
  }> {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return { balance: 0, currency: 'INR', isConfigured: false };
    }

    try {
      const accountNumber = env.RAZORPAYX_ACCOUNT_NUMBER?.trim();
      if (accountNumber && /^[A-Za-z0-9]+$/.test(accountNumber)) {
        const data = await razorpayRequest<{ balance: number; currency: string }>(
          `/banking/accounts/${accountNumber}/balance`,
          'GET'
        );
        return {
          balance: Number(((data.balance ?? 0) / 100).toFixed(2)),
          currency: data.currency || 'INR',
          isConfigured: true,
        };
      }

      const data = await razorpayRequest<{ balance: number; currency: string }>(
        '/balances',
        'GET'
      );
      return {
        balance: Number(((data.balance ?? 0) / 100).toFixed(2)),
        currency: data.currency || 'INR',
        isConfigured: true,
      };
    } catch (err) {
      console.warn('Failed to fetch Razorpay balance:', err);
      return { balance: 0, currency: 'INR', isConfigured: false };
    }
  }
}

export const razorpayPayoutService = new RazorpayPayoutService();

