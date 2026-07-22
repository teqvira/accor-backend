import { userRepository } from '../auth/repositories/user.repository';
import { UserRole } from '../auth/user.types';
import { productRepository } from '../products/product.repository';
import { qrBatchRepository } from '../qr/repositories/qr-batch.repository';
import { qrCodeRepository } from '../qr/repositories/qr-code.repository';
import { rewardTransactionRepository } from '../rewards/reward-transaction.repository';
import { redemptionTransactionRepository } from '../transactions/redemption-transaction.repository';
import { walletTransactionRepository } from '../wallet/wallet-transaction.repository';
import { dashboardRepository } from './dashboard.repository';
import { DashboardStats } from './dashboard.types';

export class DashboardService {
  async getStats(days = 30): Promise<DashboardStats> {
    const [
      totalUsers,
      totalAdmins,
      totalBatches,
      totalQrCodes,
      redeemedQrCodes,
      totalProducts,
      activeProducts,
      totalRedemptions,
      totalWalletCredits,
      totalRewardCredits,
      pendingWithdrawals,
      successfulWithdrawals,
      redemptionsOverTime,
      newUsersOverTime,
      productsByType,
      withdrawalsByStatus,
    ] = await Promise.all([
      userRepository.countUsersByRole(UserRole.USER),
      userRepository.countAdmins(),
      qrBatchRepository.count(),
      qrCodeRepository.count(),
      qrCodeRepository.count({ redeemed: true }),
      productRepository.findAll(1, 1).then((r) => r.total),
      productRepository.countActive(),
      redemptionTransactionRepository.count(),
      walletTransactionRepository.sumCredits(),
      rewardTransactionRepository.sumCredits(),
      dashboardRepository.countPendingWithdrawals(),
      dashboardRepository.countSuccessfulWithdrawals(),
      dashboardRepository.redemptionsOverTime(days),
      dashboardRepository.newUsersOverTime(days),
      dashboardRepository.productsByType(),
      dashboardRepository.withdrawalsByStatus(),
    ]);

    return {
      cards: {
        totalUsers,
        totalAdmins,
        totalProducts,
        activeProducts,
        totalBatches,
        totalQrCodes,
        redeemedQrCodes,
        unredeemedQrCodes: totalQrCodes - redeemedQrCodes,
        totalRedemptions,
        totalWalletCredits,
        totalRewardCredits,
        pendingWithdrawals,
        successfulWithdrawals,
      },
      charts: {
        redemptionsOverTime,
        newUsersOverTime,
        qrStatus: {
          redeemed: redeemedQrCodes,
          unredeemed: totalQrCodes - redeemedQrCodes,
        },
        productsByType,
        withdrawalsByStatus,
      },
    };
  }
}

export const dashboardService = new DashboardService();
