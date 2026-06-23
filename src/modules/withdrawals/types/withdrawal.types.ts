import {
  PayoutMethod,
  PayoutProviderName,
  WithdrawalStatus,
} from '../constants/withdrawal.constants';

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

export interface IPayoutProfile {
  _id: string;
  userId: string;
  method: PayoutMethod;
  accountHolderName: string;
  upiId?: string;
  accountNumber?: string;
  ifsc?: string;
  provider: PayoutProviderName;
  providerContactId?: string;
  providerFundAccountId?: string;
  cashfreeBeneficiaryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWithdrawal {
  _id: string;
  userId: string;
  amount: number;
  method: PayoutMethod;
  status: WithdrawalStatus;
  provider: PayoutProviderName;
  providerPayoutId?: string;
  providerReferenceId: string;
  failureReason?: string;
  payoutDestination: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWithdrawalData {
  userId: string;
  amount: number;
  method: PayoutMethod;
  status: WithdrawalStatus;
  provider: PayoutProviderName;
  providerReferenceId: string;
  payoutDestination: string;
}

export interface UpdatePayoutProfileData {
  method?: PayoutMethod;
  accountHolderName?: string;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  provider?: PayoutProviderName;
  providerContactId?: string | null;
  providerFundAccountId?: string | null;
  cashfreeBeneficiaryId?: string | null;
}
