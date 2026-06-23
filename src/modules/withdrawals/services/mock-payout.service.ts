import { IPayoutProfile } from '../types/withdrawal.types';
import { PayoutResult } from '../types/withdrawal.types';
import { payoutProfileRepository } from '../repositories/payout-profile.repository';
import { PayoutProvider } from './payout-provider.types';

export class MockPayoutService implements PayoutProvider {
  async ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile> {
    const providerContactId =
      profile.providerContactId ?? `mock_contact_${profile.userId}`;
    const providerFundAccountId =
      profile.providerFundAccountId ?? `mock_fund_${profile.userId}`;

    if (
      profile.providerContactId === providerContactId &&
      profile.providerFundAccountId === providerFundAccountId
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
