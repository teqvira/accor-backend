import { userRepository } from '../auth/repositories/user.repository';
import { UserRole } from '../auth/user.types';
import { productRepository } from '../products/product.repository';
import { qrBatchRepository } from '../qr/repositories/qr-batch.repository';
import { qrCodeRepository } from '../qr/repositories/qr-code.repository';
import { rewardTransactionRepository } from '../rewards/reward-transaction.repository';
import { redemptionTransactionRepository } from '../transactions/redemption-transaction.repository';
import { walletTransactionRepository } from '../wallet/wallet-transaction.repository';
import { dashboardRepository } from './dashboard.repository';
import {
  DashboardOverview,
  DashboardPartnerRequest,
  DashboardStats,
} from './dashboard.types';

export interface DashboardOverviewQuery {
  search?: string;
  page?: number;
  limit?: number;
}

function toPercentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export class DashboardService {
  /** Admin home dashboard — summary cards + pending partners + product scan donut. */
  async getOverview(
    query: DashboardOverviewQuery = {}
  ): Promise<DashboardOverview> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [summary, pendingPartners, scanRaw] = await Promise.all([
      dashboardRepository.getSummary(),
      userRepository.findPartners(page, limit, {
        approvalStatus: 'pending',
        search: query.search,
      }),
      dashboardRepository.scanDistributionByProduct(),
    ]);
    const {
      totalPartners,
      pendingApprovals,
      totalQrGenerated,
      rewardAmountDistributed,
      rewardPointsIssued,
    } = summary;

    const partnerItems: DashboardPartnerRequest[] = pendingPartners.items.map(
      (item) => ({
        id: item._id,
        name: item.name ?? null,
        mobileNumber: item.mobileNumber ?? null,
        email: item.email ?? null,
        city: item.city ?? null,
        state: item.state ?? null,
        userType: item.userType ?? null,
        avatarUrl: item.avatarUrl ?? null,
        createdAt: item.createdAt,
      })
    );

    return {
      summary: {
        totalPartners,
        pendingApprovals,
        totalQrGenerated,
        rewardAmountDistributed,
        rewardPointsIssued,
      },
      partnerRequests: {
        items: partnerItems,
        total: pendingPartners.total,
        page,
        limit,
        totalPages: Math.ceil(pendingPartners.total / limit) || 0,
      },
      scanDistribution: {
        totalScans: scanRaw.totalScans,
        items: scanRaw.items.map((item) => ({
          ...item,
          percentage: toPercentage(item.scanCount, scanRaw.totalScans),
        })),
      },
    };
  }

  /** @deprecated Prefer getOverview for the admin home screen. */
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
