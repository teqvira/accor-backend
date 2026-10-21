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
  method?: PayoutMethod;
  accountHolderName?: string;
  upiId?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
}

export interface PayoutResult {
  providerPayoutId: string;
  status: 'pending' | 'processing' | 'success';
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
  reviewedBy?: string;
  utrNumber?: string;
  adminNotes?: string;
}

export interface AdminWithdrawalFilters {
  status?: WithdrawalStatus | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AdminWithdrawalItem {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  method: PayoutMethod;
  provider?: PayoutProviderName;
  transactionReference: string;
  providerPayoutId?: string;
  requestedAt: Date;
  processedAt?: Date;
  remarks?: string;
  utrNumber?: string;
  adminNotes?: string;
  reviewedBy?: string;
  user: {
    id: string;
    name?: string;
    mobileNumber?: string;
    role?: string;
    walletBalance: number;
  };
  beneficiary: {
    method: PayoutMethod;
    accountHolderName?: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
  };
}

export interface AdminWithdrawalStats {
  pending: { count: number; totalAmount: number };
  processing: { count: number; totalAmount: number };
  success: { count: number; totalAmount: number };
  failed: { count: number; totalAmount: number };
}

export interface AdminCompleteWithdrawalInput {
  utr?: string;
  remarks?: string;
}

export interface AdminRejectWithdrawalInput {
  reason: string;
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
