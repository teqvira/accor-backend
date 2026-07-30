// ---- Reward Catalog ----

export type RewardCategory = 'electronics' | 'vouchers' | 'merchandise' | 'other';
export type RewardStatus = 'active' | 'upcoming' | 'inactive' | 'expired';

export interface IRewardCatalogItem {
  _id: string;
  code: string;
  name: string;
  description: string | null;
  category: RewardCategory;
  pointsCost: number;
  imageUrl: string | null;
  stockQuantity: number | null;
  status: RewardStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRewardCatalogData {
  name: string;
  pointsCost: number;
  status?: RewardStatus;
  imageUrl?: string | null;
  description?: string | null;
  category?: RewardCategory;
  stockQuantity?: number | null;
  code?: string;
  sortOrder?: number;
}

export interface UpdateRewardCatalogData {
  name?: string;
  pointsCost?: number;
  status?: RewardStatus;
  imageUrl?: string | null;
  description?: string | null;
  category?: RewardCategory;
  stockQuantity?: number | null;
  sortOrder?: number;
}

export interface IRewardRedemption {
  _id: string;
  userId: string;
  rewardId: string;
  idempotencyKey: string;
  rewardCode: string;
  rewardName: string;
  rewardImageUrl: string | null;
  pointsSpent: number;
  pointsBalanceAfter: number;
  redeemedAt: Date;
  createdAt: Date;
}

export interface CreateRewardRedemptionData {
  userId: string;
  rewardId: string;
  idempotencyKey: string;
  rewardCode: string;
  rewardName: string;
  rewardImageUrl: string | null;
  pointsSpent: number;
  pointsBalanceAfter: number;
}

// ---- Reward Transactions ----

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
