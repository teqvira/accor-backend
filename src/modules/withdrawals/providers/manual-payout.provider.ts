import { IPayoutProfile, PayoutResult } from '../withdrawal.types';
import { PayoutProvider } from './payout-provider.types';

export class ManualPayoutService implements PayoutProvider {
  /**
   * For manual payouts, bank and UPI details are stored directly in our database.
   * No external provider contact or fund account creation is needed.
   */
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    return profile;
  }

  /**
   * Initiates a manual payout request.
   * Instead of transferring immediately via a third-party gateway,
   * the withdrawal remains in 'pending' status for the admin to complete or reject.
   */
  async createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult> {
    console.log(
      `[MANUAL PAYOUT] Queued withdrawal for admin manual transfer. userId=${profile.userId} amount=${amount} ref=${referenceId}`
    );

    return {
      providerPayoutId: referenceId,
      status: 'pending',
      rawResponse: {
        mode: 'manual',
        amount,
        referenceId,
        destination: profile.method,
      },
    };
  }

  async getAccountBalance(): Promise<{
    balance: number;
    currency: string;
    isConfigured: boolean;
  }> {
    return {
      balance: 0,
      currency: 'INR',
      isConfigured: true,
    };
  }
}

export const manualPayoutService = new ManualPayoutService();
