import { NotFoundError } from '../../shared/utils/errors';
import { activityService } from '../activity/activity.service';
import { userRepository } from '../auth/repositories/user.repository';
import { campaignsService } from '../campaigns/campaigns.service';
import { homeRepository } from './home.repository';
import { HomeResponse } from './home.types';

export class HomeService {
  async getHome(userId: string, limit = 10): Promise<HomeResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getHome: userId=${userId}`);
    }

    const [totalScans, pendingWithdrawal, recentActivity, activeCampaigns] = await Promise.all([
      homeRepository.countTotalScans(userId),
      homeRepository.findPendingWithdrawalSummary(userId),
      activityService.getFeed({
        userId,
        page: 1,
        limit,
        scope: 'all',
      }),
      campaignsService.getCampaignsForUser(userId),
    ]);

    return {
      user: {
        id: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        isVerified: user.isVerified,
        approvalStatus: user.approvalStatus,
        canAccessApp: user.approvalStatus === 'approved',
      },
      balances: {
        walletBalance: user.walletBalance,
        rewardPoints: user.rewardPoints,
        pointsEligible: user.userType !== 'mechanic',
      },
      stats: {
        totalScans,
        pendingWithdrawal,
      },
      recentActivity,
      activeCampaigns,
    };
  }
}

export const homeService = new HomeService();
