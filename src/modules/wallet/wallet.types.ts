export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export type WalletReferenceType =
  | 'qr_redemption'
  | 'withdrawal'
  | 'admin_adjustment';

export interface IWalletTransaction {
  _id: string;
  userId: string;
  amount: number;
  type: WalletTransactionType;
  referenceType?: WalletReferenceType;
  referenceId?: string;
  remarks?: string;
  createdAt: Date;
}

export interface CreateWalletTransactionData {
  userId: string;
  amount: number;
  type: WalletTransactionType;
  referenceType?: WalletReferenceType;
  referenceId?: string;
  remarks?: string;
}

export interface AdminWalletKpiResponse {
  razorpayBalance: number;
  unsettledBalance: number;
  totalWithdrawn: number;
  totalUserWalletBalance: number;
  totalScansCount: number;
  isRazorpayConfigured: boolean;
  currency: string;
}

export interface IAdminWalletTopup {
  id: string;
  adminId?: string;
  orderId: string;
  paymentId?: string;
  amount: number;
  netAmount: number;
  status: 'pending_payment' | 'pending_settlement' | 'settled' | 'failed';
  settlementDate?: Date;
  createdAt: Date;
  settledAt?: Date;
}


export interface AdminWalletScanItem {
  id: string;
  userId: string;
  name: string | null;
  mobileNumber: string | null;
  recentScanValue: number;
  walletBalance: number;
  totalWithdrawn: number;
  lastActivity: Date;
  qrCode: string;
  productName: string | null;
  skuCode: string | null;
  rewardPoints: number;
}

export interface AdminWalletScanQuery {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminTopupDetailsResponse {
  accountNumber: string | null;
  ifsc: string | null;
  beneficiaryName: string | null;
  bankName: string | null;
  instructions: string[];
}

