import { ActivityFeedResult } from '../activity/activity.types';
import { UserType } from '../auth/user.types';
import { WithdrawalStatus } from '../withdrawals/withdrawal.constants';

export interface HomeUserSummary {
  id: string;
  name?: string;
  avatarUrl?: string;
  userType?: UserType;
  profileCompleted: boolean;
  isVerified: boolean;
}

export interface HomeBalances {
  walletBalance: number;
  rewardPoints: number;
}

export interface HomePendingWithdrawal {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  requestedAt: Date;
}

export interface HomeStats {
  totalScans: number;
  pendingWithdrawal: HomePendingWithdrawal | null;
}

export interface HomeResponse {
  user: HomeUserSummary;
  balances: HomeBalances;
  stats: HomeStats;
  recentActivity: ActivityFeedResult;
}
