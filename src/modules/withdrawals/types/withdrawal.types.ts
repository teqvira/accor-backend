import { PayoutMethod } from '../constants/withdrawal.constants';

export interface SavePayoutProfileInput {
  method: PayoutMethod;
  accountHolderName: string;
  upiId?: string;
  accountNumber?: string;
  ifsc?: string;
}

export interface CreateWithdrawalInput {
  amount: number;
}

export interface PayoutResult {
  providerPayoutId: string;
  status: 'processing' | 'success';
  rawResponse?: Record<string, unknown>;
}
