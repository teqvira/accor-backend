import { RedemptionTransaction } from '../models/redemption-transaction.model';
import { WalletTransaction } from '../../wallet/models/wallet-transaction.model';
import { RewardTransaction } from '../../rewards/models/reward-transaction.model';
import { User, UserRole } from '../../auth/models/user.model';
import { QrBatch } from '../../qr/models/qr-batch.model';
import { QrCode } from '../../qr/models/qr-code.model';
import { Campaign } from '../../campaigns/models/campaign.model';

export class TransactionsService {
  async listRedemptions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      RedemptionTransaction.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'mobileNumber name')
        .populate('qrCodeId', 'code')
        .populate('campaignId', 'name')
        .lean(),
      RedemptionTransaction.countDocuments(),
    ]);

    return {
      items: items.map((r) => ({
        id: r._id,
        user: r.userId,
        qrCode: r.qrCodeId,
        campaign: r.campaignId,
        walletAmount: r.walletAmount,
        rewardPoints: r.rewardPoints,
        createdAt: r.createdAt,
      })),
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
      totalCampaigns,
      activeCampaigns,
      totalRedemptions,
      totalWalletCredits,
      totalRewardCredits,
    ] = await Promise.all([
      User.countDocuments({ role: UserRole.USER }),
      QrBatch.countDocuments(),
      QrCode.countDocuments(),
      QrCode.countDocuments({ redeemed: true }),
      Campaign.countDocuments(),
      Campaign.countDocuments({ active: true }),
      RedemptionTransaction.countDocuments(),
      WalletTransaction.aggregate([
        { $match: { type: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      RewardTransaction.aggregate([
        { $match: { type: 'credit' } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
    ]);

    return {
      totalUsers,
      totalBatches,
      totalQrCodes,
      redeemedQrCodes,
      unredeemedQrCodes: totalQrCodes - redeemedQrCodes,
      totalCampaigns,
      activeCampaigns,
      totalRedemptions,
      totalWalletCredits: totalWalletCredits[0]?.total ?? 0,
      totalRewardCredits: totalRewardCredits[0]?.total ?? 0,
    };
  }
}

export const transactionsService = new TransactionsService();
