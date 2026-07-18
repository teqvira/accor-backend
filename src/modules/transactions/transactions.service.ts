import { userRepository } from '../auth/repositories/user.repository';
import { UserRole } from '../auth/user.types';
import { productRepository } from '../products/product.repository';
import { qrBatchRepository } from '../qr/repositories/qr-batch.repository';
import { qrCodeRepository } from '../qr/repositories/qr-code.repository';
import { rewardTransactionRepository } from '../rewards/reward-transaction.repository';
import { walletTransactionRepository } from '../wallet/wallet-transaction.repository';
import { redemptionTransactionRepository } from './redemption-transaction.repository';

export class TransactionsService {
  async listRedemptions(page = 1, limit = 20) {
    const { items, total } =
      await redemptionTransactionRepository.findAllWithDetails(page, limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getActivitySummary() {
    const [
      totalUsers,
      totalBatches,
      totalQrCodes,
      redeemedQrCodes,
      totalProducts,
      activeProducts,
      totalRedemptions,
      totalWalletCredits,
      totalRewardCredits,
    ] = await Promise.all([
      userRepository.countUsersByRole(UserRole.USER),
      qrBatchRepository.count(),
      qrCodeRepository.count(),
      qrCodeRepository.count({ redeemed: true }),
      productRepository.findAll(1, 1).then((r) => r.total),
      productRepository.countActive(),
      redemptionTransactionRepository.count(),
      walletTransactionRepository.sumCredits(),
      rewardTransactionRepository.sumCredits(),
    ]);

    return {
      totalUsers,
      totalBatches,
      totalQrCodes,
      redeemedQrCodes,
      unredeemedQrCodes: totalQrCodes - redeemedQrCodes,
      totalProducts,
      activeProducts,
      totalRedemptions,
      totalWalletCredits,
      totalRewardCredits,
    };
  }
}

export const transactionsService = new TransactionsService();
