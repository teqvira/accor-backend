import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/utils/errors';
import { payoutProfileRepository } from '../repositories/payout-profile.repository';
import { PayoutMethod, PayoutProviderName } from '../withdrawal.constants';
import { IPayoutProfile, PayoutResult } from '../withdrawal.types';
import { PayoutProvider } from './payout-provider.types';

interface BulkpeResponse<T = Record<string, unknown>> {
  status?: boolean;
  statusCode?: number;
  message?: string;
  data?: T;
}

interface BulkpeContactData {
  contact_id?: string;
  [key: string]: unknown;
}

interface BulkpePayoutData {
  transaction_id?: string;
  reference_id?: string;
  amount?: number;
  status?: string;
  utr?: string;
  message?: string;
  [key: string]: unknown;
}

interface BulkpeBalanceData {
  Balance?: number | string;
  yetToSettle?: number | string;
  account_number?: string;
  ifsc_code?: string;
  [key: string]: unknown;
}

interface BulkpeStatusData {
  transaction_id?: string;
  reference_id?: string;
  status?: string;
  utr?: string;
  statusDescription?: string;
  [key: string]: unknown;
}

function getBaseUrl(): string {
  return (env.BULKPE_BASE_URL || 'https://api.bulkpe.in').replace(/\/+$/, '');
}

function getBulkpeToken(): string {
  if (!env.BULKPE_API_TOKEN) {
    throw new BadRequestError(
      'Bulkpe is not configured',
      'Missing BULKPE_API_TOKEN'
    );
  }
  return env.BULKPE_API_TOKEN.trim();
}

export class BulkpePayoutService implements PayoutProvider {
  /**
   * Validate destination and optionally sync contact to Bulkpe.
   * Bulkpe allows direct payouts with bank or UPI details even if contact sync is bypassed.
   */
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    if (profile.method === PayoutMethod.UPI) {
      if (!profile.upiId || !profile.upiId.includes('@')) {
        throw new BadRequestError(
          'Invalid UPI ID',
          `Bulkpe UPI requires a valid VPA: ${profile.upiId}`
        );
      }
    } else {
      if (!profile.accountNumber || !profile.ifsc) {
        throw new BadRequestError(
          'Invalid bank details',
          'Bulkpe bank transfer requires account number and IFSC'
        );
      }
    }

    // If contact already registered under Bulkpe, keep existing profile
    if (profile.providerContactId && profile.provider === PayoutProviderName.BULKPE) {
      return profile;
    }

    // Attempt optional contact registration with Bulkpe
    try {
      const token = getBulkpeToken();
      const contactPayload =
        profile.method === PayoutMethod.UPI
          ? {
              reference: `usr_${profile.userId.replace(/-/g, '').slice(0, 20)}`,
              name: profile.accountHolderName,
              type: 'vpa',
              vpa: profile.upiId,
              email: `${profile.userId}@payout.local`,
            }
          : {
              reference: `usr_${profile.userId.replace(/-/g, '').slice(0, 20)}`,
              name: profile.accountHolderName,
              type: 'account_number',
              bank_account_number: profile.accountNumber,
              bank_ifsc_code: profile.ifsc,
              bank_name: profile.bankName ?? '',
              email: `${profile.userId}@payout.local`,
            };

      const response = await fetch(`${getBaseUrl()}/client/createContact`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      });

      const body = (await response.json()) as BulkpeResponse<BulkpeContactData>;
      const contactId = body.data?.contact_id;

      const updated = await payoutProfileRepository.update(profile._id, {
        provider: PayoutProviderName.BULKPE,
        providerContactId: contactId ?? profile.providerContactId ?? null,
      });

      return updated ?? profile;
    } catch {
      // Bulkpe supports direct payout without contact registration,
      // so record Bulkpe as provider without blocking on contact creation.
      const updated = await payoutProfileRepository.update(profile._id, {
        provider: PayoutProviderName.BULKPE,
      });
      return updated ?? profile;
    }
  }

  /**
   * Initiate payout transfer via Bulkpe initiatepayout API
   */
  async createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult> {
    const token = getBulkpeToken();

    const requestBody: Record<string, unknown> = {
      amount: Number(amount),
      reference_id: referenceId,
      transaction_note: `Withdrawal ${referenceId}`,
      beneficiaryName: profile.accountHolderName,
    };

    if (profile.providerContactId) {
      requestBody.contact_id = profile.providerContactId;
    }

    if (profile.method === PayoutMethod.UPI) {
      if (!profile.upiId) {
        throw new BadRequestError('UPI ID is missing', 'createPayout: upiId missing');
      }
      requestBody.payment_mode = 'UPI';
      requestBody.upi = profile.upiId;
    } else {
      if (!profile.accountNumber || !profile.ifsc) {
        throw new BadRequestError(
          'Bank details are missing',
          'createPayout: accountNumber or ifsc missing'
        );
      }
      requestBody.payment_mode = 'IMPS';
      requestBody.account_number = profile.accountNumber;
      requestBody.ifsc = profile.ifsc;
    }

    const response = await fetch(`${getBaseUrl()}/client/initiatepayout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as BulkpeResponse<BulkpePayoutData>;

    if (!response.ok || data.status === false) {
      const errorMsg =
        data.message ?? data.data?.message ?? 'Bulkpe payout initiation failed';
      throw new BadRequestError(
        errorMsg,
        `Bulkpe initiatepayout failed: ${JSON.stringify(data)}`
      );
    }

    const txStatus = data.data?.status?.toUpperCase();
    if (txStatus === 'FAILED') {
      const errorMsg =
        data.data?.message ?? data.message ?? 'Bulkpe payout was rejected';
      throw new BadRequestError(
        errorMsg,
        `Bulkpe payout marked FAILED: ${JSON.stringify(data)}`
      );
    }

    const providerPayoutId = data.data?.transaction_id || referenceId;
    const status: PayoutResult['status'] =
      txStatus === 'SUCCESS' ? 'success' : 'processing';

    return {
      providerPayoutId,
      status,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Fetch current account balance on Bulkpe
   */
  async getAccountBalance(): Promise<{
    balance: number;
    currency: string;
    isConfigured: boolean;
  }> {
    if (!env.BULKPE_API_TOKEN) {
      return {
        balance: 0,
        currency: 'INR',
        isConfigured: false,
      };
    }

    try {
      const response = await fetch(`${getBaseUrl()}/client/fetchBalance`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.BULKPE_API_TOKEN.trim()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { balance: 0, currency: 'INR', isConfigured: false };
      }

      const body = (await response.json()) as BulkpeResponse<BulkpeBalanceData>;
      const rawBalance = body.data?.Balance ?? 0;
      const balance =
        typeof rawBalance === 'number' ? rawBalance : Number(rawBalance) || 0;

      return {
        balance,
        currency: 'INR',
        isConfigured: true,
      };
    } catch {
      return { balance: 0, currency: 'INR', isConfigured: false };
    }
  }

  /**
   * Fetch transaction status from Bulkpe by reference_id or transaction_id
   */
  async fetchStatus(
    referenceOrTxId: string
  ): Promise<BulkpeStatusData | null> {
    const token = getBulkpeToken();
    const isTxId = referenceOrTxId.startsWith('TRAREF');
    const body = isTxId
      ? { transaction_id: referenceOrTxId }
      : { reference_id: referenceOrTxId };

    const response = await fetch(`${getBaseUrl()}/client/fetchStatus`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as BulkpeResponse<BulkpeStatusData>;
    return data.data ?? null;
  }
}

export const bulkpePayoutService = new BulkpePayoutService();

