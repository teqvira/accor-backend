import { IPayoutProfile } from '../models/payout-profile.model';
import { PayoutResult } from '../types/withdrawal.types';

export interface PayoutProvider {
  ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile>;
  createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult>;
}
