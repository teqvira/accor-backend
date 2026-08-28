import { ActivityFeedResult } from '../activity/activity.types';
import { UserType } from '../auth/user.types';
import { ICampaign } from '../campaigns/campaigns.types';
import { WithdrawalStatus } from '../withdrawals/withdrawal.constants';

export interface HomeUserSummary {
  id: string;
  name?: string;
  avatarUrl?: string;
  userType?: UserType;
  profileCompleted: boolean;
  isVerified: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  canAccessApp: boolean;
}

export interface HomeBalances {
  walletBalance: number;
  rewardPoints: number;
  pointsEligible: boolean;
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
  activeCampaigns?: ICampaign[];
}
