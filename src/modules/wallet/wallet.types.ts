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
