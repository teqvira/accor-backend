export enum RewardTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export type RewardReferenceType =
  | 'qr_redemption'
  | 'reward_redeem'
  | 'admin_adjustment';

export interface IRewardTransaction {
  _id: string;
  userId: string;
  points: number;
  type: RewardTransactionType;
  referenceType?: RewardReferenceType;
  referenceId?: string;
  remarks?: string;
  createdAt: Date;
}

export interface CreateRewardTransactionData {
  userId: string;
  points: number;
  type: RewardTransactionType;
  referenceType?: RewardReferenceType;
  referenceId?: string;
  remarks?: string;
}
