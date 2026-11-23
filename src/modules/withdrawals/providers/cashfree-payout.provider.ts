import crypto from 'crypto';
import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/utils/errors';
import { PayoutMethod } from '../withdrawal.constants';
import { payoutProfileRepository } from '../repositories/payout-profile.repository';
import { IPayoutProfile, PayoutResult } from '../withdrawal.types';
import { PayoutProvider } from './payout-provider.types';

function getCashfreeBaseUrl(): string {
  return env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/payout'
    : 'https://sandbox.cashfree.com/payout';
}

function getCashfreeHeaders(): Record<string, string> {
  if (!env.CASHFREE_CLIENT_ID || !env.CASHFREE_CLIENT_SECRET) {
    throw new BadRequestError(
      'Cashfree is not configured',
      'Missing CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET'
    );
  }
  return {
    'x-client-id': env.CASHFREE_CLIENT_ID.trim(),
    'x-client-secret': env.CASHFREE_CLIENT_SECRET.trim(),
    'x-api-version': '2024-01-01',
    'Content-Type': 'application/json',
  };
}

export class CashfreePayoutService implements PayoutProvider {
  /**
   * Register or verify the beneficiary on Cashfree (Payouts V2 API).
   */
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    const destinationKey =
      profile.method === PayoutMethod.UPI
        ? (profile.upiId || '').toLowerCase().trim()
        : `${(profile.accountNumber || '').trim()}_${(profile.ifsc || '').toUpperCase().trim()}`;
    const destHash = crypto
      .createHash('md5')
      .update(destinationKey)
      .digest('hex')
      .slice(0, 8);
    const beneficiaryId = `bene_${profile.userId.replace(/-/g, '').slice(0, 16)}_${destHash}`;

    if (profile.cashfreeBeneficiaryId === beneficiaryId) {
      return profile;
    }

    const body = {
      beneficiary_id: beneficiaryId,
      beneficiary_name: profile.accountHolderName,
      beneficiary_instrument_details:
        profile.method === PayoutMethod.UPI
          ? {
              vpa: profile.upiId,
            }
          : {
              bank_account_number: profile.accountNumber,
              bank_ifsc: profile.ifsc,
            },
      beneficiary_contact_details: {
        beneficiary_email: `${profile.userId.replace(/-/g, '').slice(0, 15)}@payout.local`,
        beneficiary_phone: '9999999999',
      },
    };

    const response = await fetch(`${getCashfreeBaseUrl()}/beneficiary`, {
      method: 'POST',
      headers: getCashfreeHeaders(),
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      message?: string;
      code?: string;
      type?: string;
      beneficiary_id?: string;
    };

    // If 200/201 or already exists (409), mark as ready
    const isAlreadyExists =
      response.status === 409 ||
      data.code === 'beneficiary_already_exists' ||
      data.message?.toLowerCase().includes('already exists');

    if (!response.ok && !isAlreadyExists) {
      throw new BadRequestError(
        data.message ?? 'Failed to add Cashfree beneficiary',
        `Cashfree createBeneficiary failed: ${JSON.stringify(data)}`
      );
    }

    const updated = await payoutProfileRepository.update(profile._id, {
      cashfreeBeneficiaryId: beneficiaryId,
    });
    return updated ?? { ...profile, cashfreeBeneficiaryId: beneficiaryId };
  }

  /**
   * Initiate fund transfer on Cashfree via V2 Transfers API.
   */
  async createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult> {
    if (!profile.cashfreeBeneficiaryId) {
      throw new BadRequestError(
        'Payout account is not ready',
        'cashfreeBeneficiaryId missing on profile'
      );
    }

    const body = {
      transfer_id: referenceId,
      transfer_amount: Number(amount.toFixed(2)),
      transfer_mode: profile.method === PayoutMethod.UPI ? 'upi' : 'bank',
      beneficiary_details: {
        beneficiary_id: profile.cashfreeBeneficiaryId,
      },
    };

    const response = await fetch(`${getCashfreeBaseUrl()}/transfers`, {
      method: 'POST',
      headers: getCashfreeHeaders(),
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      transfer_id?: string;
      cf_transfer_id?: string;
      status?: string;
      status_code?: string;
      status_description?: string;
      message?: string;
    };

    if (!response.ok) {
      const errorMsg =
        data.status_description ?? data.message ?? 'Cashfree transfer failed';
      console.error(
        `[Cashfree Transfer Failed] status=${response.status}, code=${data.status_code}, error=${errorMsg}`
      );
      throw new BadRequestError(
        errorMsg,
        `Cashfree transfer failed: ${JSON.stringify(data)}`
      );
    }

    const status = (data.status || data.status_code || '').toUpperCase();
    const providerPayoutId =
      data.cf_transfer_id || data.transfer_id || referenceId;

    if (status === 'FAILED' || status === 'REJECTED') {
      const reason =
        data.status_description ?? data.message ?? 'Cashfree transfer was rejected';
      console.error(
        `[Cashfree Transfer Rejected] status=${status}, code=${data.status_code}, reason=${reason}`
      );
      throw new BadRequestError(
        reason,
        `Cashfree transfer failed: ${JSON.stringify(data)}`
      );
    }

    return {
      providerPayoutId,
      status: status === 'SUCCESS' ? 'success' : 'processing',
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Query available balance from Cashfree Payouts.
   */
  async getAccountBalance(): Promise<{
    balance: number;
    currency: string;
    isConfigured: boolean;
  }> {
    if (!env.CASHFREE_CLIENT_ID || !env.CASHFREE_CLIENT_SECRET) {
      return { balance: 0, currency: 'INR', isConfigured: false };
    }

    try {
      const baseUrl = getCashfreeBaseUrl();

      // Step 1: Authorize to get JWT token
      const authRes = await fetch(`${baseUrl}/v1/authorize`, {
        method: 'POST',
        headers: {
          'X-Client-Id': env.CASHFREE_CLIENT_ID.trim(),
          'X-Client-Secret': env.CASHFREE_CLIENT_SECRET.trim(),
          'Content-Type': 'application/json',
        },
      });

      if (!authRes.ok) {
        const errorText = await authRes.text();
        console.error(
          `[Cashfree getAccountBalance] Authorize failed with status ${authRes.status}: ${errorText}`
        );
        return { balance: 0, currency: 'INR', isConfigured: false };
      }

      const authData = (await authRes.json()) as {
        status?: string;
        data?: { token?: string };
      };

      const token = authData.data?.token;
      if (!token) {
        console.error(
          '[Cashfree getAccountBalance] Authorize succeeded but no token returned in data'
        );
        return { balance: 0, currency: 'INR', isConfigured: false };
      }

      // Step 2: Get ledger and available balance
      const balRes = await fetch(`${baseUrl}/v1/getBalance`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!balRes.ok) {
        const errorText = await balRes.text();
        console.error(
          `[Cashfree getAccountBalance] getBalance failed with status ${balRes.status}: ${errorText}`
        );
        return { balance: 0, currency: 'INR', isConfigured: false };
      }

      const balData = (await balRes.json()) as {
        status?: string;
        data?: {
          balance?: string | number;
          availableBalance?: string | number;
        };
      };

      const rawBalance =
        balData.data?.availableBalance ?? balData.data?.balance ?? 0;
      const balance =
        typeof rawBalance === 'number'
          ? rawBalance
          : parseFloat(rawBalance) || 0;

      return {
        balance,
        currency: 'INR',
        isConfigured: true,
      };
    } catch (err) {
      console.error('[Cashfree getAccountBalance] Exception occurred:', err);
      return { balance: 0, currency: 'INR', isConfigured: false };
    }
  }
}

export const cashfreePayoutService = new CashfreePayoutService();
