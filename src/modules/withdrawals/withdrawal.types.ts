import {
  PayoutMethod,
  PayoutProviderName,
  WithdrawalStatus,
} from './withdrawal.constants';

export interface SavePayoutProfileInput {
  method: PayoutMethod;
  accountHolderName: string;
  upiId?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
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
  bankName?: string;
  isDefault: boolean;
  provider?: PayoutProviderName;
  providerContactId?: string;
  providerFundAccountId?: string;
  cashfreeBeneficiaryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWithdrawal {
  _id: string;
  userId: string;
  payoutProfileId: string;
  amount: number;
  method: PayoutMethod;
  status: WithdrawalStatus;
  provider?: PayoutProviderName;
  providerPayoutId?: string;
  providerReferenceId: string;
  failureReason?: string;
  payoutDestination: string;
  requestedAt: Date;
  processedAt?: Date;
  createdAt: Date;
}

export interface CreateWithdrawalData {
  userId: string;
  payoutProfileId: string;
  amount: number;
  method: PayoutMethod;
  status: WithdrawalStatus;
  provider?: PayoutProviderName;
  providerReferenceId: string;
  payoutDestination: string;
}

export interface UpdatePayoutProfileData {
  method?: PayoutMethod;
  accountHolderName?: string;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  bankName?: string | null;
  isDefault?: boolean;
  provider?: PayoutProviderName | null;
  providerContactId?: string | null;
  providerFundAccountId?: string | null;
  cashfreeBeneficiaryId?: string | null;
}
