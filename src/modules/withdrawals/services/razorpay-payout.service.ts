import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/utils/errors';
import { PayoutMethod } from '../constants/withdrawal.constants';
import { payoutProfileRepository } from '../repositories/payout-profile.repository';
import { IPayoutProfile } from '../types/withdrawal.types';
import { PayoutResult } from '../types/withdrawal.types';
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
    let providerContactId = profile.providerContactId;
    let providerFundAccountId = profile.providerFundAccountId;

    if (!providerContactId) {
      const contact = await razorpayRequest<RazorpayEntity>('/contacts', 'POST', {
        name: profile.accountHolderName,
        email: `${profile.userId}@payout.local`,
        contact: '9999999999',
        type: 'customer',
        reference_id: profile.userId,
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
      providerFundAccountId === profile.providerFundAccountId
    ) {
      return profile;
    }

    const updated = await payoutProfileRepository.update(profile._id, {
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
    if (!env.RAZORPAYX_ACCOUNT_NUMBER) {
      throw new BadRequestError(
        'Razorpay payout account is not configured',
        'Missing RAZORPAYX_ACCOUNT_NUMBER'
      );
    }

    if (!profile.providerFundAccountId) {
      throw new BadRequestError(
        'Payout account is not ready',
        'providerFundAccountId missing on profile'
      );
    }

    const payout = await razorpayRequest<RazorpayEntity & { status: string }>(
      '/payouts',
      'POST',
      {
        account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
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
}

export const razorpayPayoutService = new RazorpayPayoutService();
