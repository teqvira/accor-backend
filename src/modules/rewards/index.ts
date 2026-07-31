export { default as rewardsUserRoutes } from './rewards.user.routes';
export { default as rewardsAdminRoutes } from './rewards.admin.routes';
export { rewardsService } from './rewards.service';
export { rewardTransactionRepository } from './reward-transaction.repository';
export { rewardCatalogRepository } from './reward-catalog.repository';
export { rewardRedemptionRepository } from './reward-redemption.repository';
export { RewardTransactionType } from './rewards.types';
export type {
  IRewardTransaction,
  IRewardCatalogItem,
  IRewardRedemption,
  RewardCategory,
  RewardStatus,
  RewardRedemptionStatus,
} from './rewards.types';
