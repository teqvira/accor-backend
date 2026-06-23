import { IPayoutProfile } from '../types/withdrawal.types';
import { PayoutResult } from '../types/withdrawal.types';

export interface PayoutProvider {
  ensureFundAccount(profile: IPayoutProfile): Promise<IPayoutProfile>;
  createPayout(
    profile: IPayoutProfile,
    amount: number,
    referenceId: string
  ): Promise<PayoutResult>;
}
