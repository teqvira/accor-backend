import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/utils/errors';
import { PayoutMethod } from '../constants/withdrawal.constants';
import { payoutProfileRepository } from '../repositories/payout-profile.repository';
import { IPayoutProfile } from '../types/withdrawal.types';
import { PayoutResult } from '../types/withdrawal.types';
import { PayoutProvider } from './payout-provider.types';

interface CashfreeAuthResponse {
  data?: { token?: string };
  message?: string;
}

interface CashfreeTransferResponse {
  data?: {
    transfer_id?: string;
    status?: string;
  };
  message?: string;
}

function getCashfreeBaseUrl(): string {
  return env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/payout'
    : 'https://sandbox.cashfree.com/payout';
}

async function getCashfreeToken(): Promise<string> {
  if (!env.CASHFREE_CLIENT_ID || !env.CASHFREE_CLIENT_SECRET) {
    throw new BadRequestError(
      'Cashfree is not configured',
      'Missing CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET'
    );
  }

  const response = await fetch(`${getCashfreeBaseUrl()}/v1/authorize`, {
    method: 'POST',
    headers: {
      'X-Client-Id': env.CASHFREE_CLIENT_ID,
      'X-Client-Secret': env.CASHFREE_CLIENT_SECRET,
      'Content-Type': 'application/json',
    },
  });

  const data = (await response.json()) as CashfreeAuthResponse;
  const token = data.data?.token;
  if (!response.ok || !token) {
    throw new BadRequestError(
      data.message ?? 'Cashfree authorization failed',
      `Cashfree authorize failed: ${JSON.stringify(data)}`
    );
  }
  return token;
}

export class CashfreePayoutService implements PayoutProvider {
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    if (profile.cashfreeBeneficiaryId) {
      return profile;
    }

    const token = await getCashfreeToken();
    const beneficiaryId = `bene_${profile.userId}`;

    const body =
      profile.method === PayoutMethod.UPI
        ? {
            beneId: beneficiaryId,
            name: profile.accountHolderName,
            email: `${profile.userId}@payout.local`,
            phone: '9999999999',
            vpa: profile.upiId,
          }
        : {
            beneId: beneficiaryId,
            name: profile.accountHolderName,
            email: `${profile.userId}@payout.local`,
            phone: '9999999999',
            bankAccount: profile.accountNumber,
            ifsc: profile.ifsc,
          };

    const response = await fetch(`${getCashfreeBaseUrl()}/v1/addBeneficiary`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new BadRequestError(
        data.message ?? 'Failed to add Cashfree beneficiary',
        `Cashfree addBeneficiary failed: ${JSON.stringify(data)}`
      );
    }

    const updated = await payoutProfileRepository.update(profile._id, {
      cashfreeBeneficiaryId: beneficiaryId,
    });
    return updated ?? profile;
  }

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

    const token = await getCashfreeToken();
    const response = await fetch(`${getCashfreeBaseUrl()}/v1/requestTransfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        beneId: profile.cashfreeBeneficiaryId,
        amount: amount.toFixed(2),
        transferId: referenceId,
      }),
    });

    const data = (await response.json()) as CashfreeTransferResponse;
    if (!response.ok || !data.data?.transfer_id) {
      throw new BadRequestError(
        data.message ?? 'Cashfree transfer failed',
        `Cashfree requestTransfer failed: ${JSON.stringify(data)}`
      );
    }

    const status = data.data.status?.toUpperCase();
    return {
      providerPayoutId: data.data.transfer_id,
      status: status === 'SUCCESS' ? 'success' : 'processing',
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}

export const cashfreePayoutService = new CashfreePayoutService();
