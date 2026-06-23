export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export interface IWalletTransaction {
  _id: string;
  userId: string;
  amount: number;
  type: WalletTransactionType;
  referenceId?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWalletTransactionData {
  userId: string;
  amount: number;
  type: WalletTransactionType;
  referenceId?: string;
  description?: string;
}
