import { BadRequestError } from '../../../shared/utils/errors';
import { IPayoutProfile, PayoutResult } from '../withdrawal.types';
import { PayoutProvider } from './payout-provider.types';

export class DecentroPayoutService implements PayoutProvider {
  /**
   * Future Decentro integration: Validate VPA or Bank Account.
   */
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    return profile;
  }

  /**
   * Future Decentro integration: Call Decentro Payout / Money Transfer API.
   */
  async createPayout(
    _profile: IPayoutProfile,
    _amount: number,
    _referenceId: string
  ): Promise<PayoutResult> {
    throw new BadRequestError(
      'Decentro payout provider is not yet configured',
      'DecentroPayoutService.createPayout'
    );
  }

  async getAccountBalance(): Promise<{
    balance: number;
    currency: string;
    isConfigured: boolean;
  }> {
    return {
      balance: 0,
      currency: 'INR',
      isConfigured: false,
    };
  }
}

export const decentroPayoutService = new DecentroPayoutService();
