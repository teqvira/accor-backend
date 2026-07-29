import { NotFoundError } from '../../shared/utils/errors';
import { activityService } from '../activity/activity.service';
import { userRepository } from '../auth/repositories/user.repository';
import { homeRepository } from './home.repository';
import { HomeResponse } from './home.types';

export class HomeService {
  async getHome(userId: string, limit = 10): Promise<HomeResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getHome: userId=${userId}`);
    }

    const [totalScans, pendingWithdrawal, recentActivity] = await Promise.all([
      homeRepository.countTotalScans(userId),
      homeRepository.findPendingWithdrawalSummary(userId),
      activityService.getFeed({
        userId,
        page: 1,
        limit,
        scope: 'all',
      }),
    ]);

    return {
      user: {
        id: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        isVerified: user.isVerified,
      },
      balances: {
        walletBalance: user.walletBalance,
        rewardPoints: user.rewardPoints,
      },
      stats: {
        totalScans,
        pendingWithdrawal,
      },
      recentActivity,
    };
  }
}

export const homeService = new HomeService();
