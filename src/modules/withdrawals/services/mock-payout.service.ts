import { IPayoutProfile } from '../models/payout-profile.model';
import { PayoutResult } from '../types/withdrawal.types';
import { PayoutProvider } from './payout-provider.types';

export class MockPayoutService implements PayoutProvider {
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    if (!profile.providerContactId) {
      profile.providerContactId = `mock_contact_${profile.userId.toString()}`;
    }
    if (!profile.providerFundAccountId) {
      profile.providerFundAccountId = `mock_fund_${profile.userId.toString()}`;
    }
    await profile.save();
    return profile;
  }

  async createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult> {
    console.log(
      `[MOCK PAYOUT] userId=${profile.userId} amount=${amount} ref=${referenceId}`
    );
    return {
      providerPayoutId: `mock_payout_${referenceId}`,
      status: 'success',
      rawResponse: { mode: 'mock', amount },
    };
  }
}

export const mockPayoutService = new MockPayoutService();
