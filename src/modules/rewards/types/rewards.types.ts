export enum RewardTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export interface IRewardTransaction {
  _id: string;
  userId: string;
  points: number;
  type: RewardTransactionType;
  referenceId?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRewardTransactionData {
  userId: string;
  points: number;
  type: RewardTransactionType;
  referenceId?: string;
  description?: string;
}
