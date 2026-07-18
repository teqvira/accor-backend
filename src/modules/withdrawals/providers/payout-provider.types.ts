import { IPayoutProfile } from '../withdrawal.types';
import { PayoutResult } from '../withdrawal.types';

export interface PayoutProvider {
  ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile>;
  createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult>;
}
