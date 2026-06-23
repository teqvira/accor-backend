import { withTransaction } from '../../../database/transactions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../shared/utils/errors';
import { campaignsService } from '../../campaigns/services/campaigns.service';
import { qrBatchRepository } from '../../qr/repositories/qr-batch.repository';
import { qrCodeRepository } from '../../qr/repositories/qr-code.repository';
import { rewardsService } from '../../rewards/services/rewards.service';
import { redemptionTransactionRepository } from '../../transactions/repositories/redemption-transaction.repository';
import { walletService } from '../../wallet/services/wallet.service';

export class RedemptionService {
  async validateCode(code: string) {
    const qrCode = await qrCodeRepository.findByCode(code);
    if (!qrCode) {
      throw new NotFoundError(
        'QR code not found',
        `validateCode: code=${code}`
      );
    }

    if (qrCode.redeemed) {
      throw new ConflictError(
        'This QR code has already been redeemed',
        `validateCode: already redeemed code=${code}`
      );
    }

    const campaignId = qrCode.campaignId;
    if (!campaignId) {
      throw new BadRequestError(
        'This QR code is not linked to an active campaign yet',
        `validateCode: no campaignId code=${code}`
      );
    }

    const campaign = await campaignsService.getActiveCampaignById(campaignId);

    if (!campaignsService.isCampaignCurrentlyValid(campaign)) {
      throw new BadRequestError(
        'The campaign for this QR code is not active or has expired',
        `validateCode: campaign invalid campaignId=${campaignId}`
      );
    }

    const batch = await qrBatchRepository.findById(qrCode.batchId);

    return {
      code: qrCode.code,
      campaign: {
        id: campaign._id,
        name: campaign.name,
      },
      batch: batch ? { id: batch._id, name: batch.name } : null,
      redeemable: true,
    };
  }

  async redeem(userId: string, code: string) {
    return withTransaction(async (client) => {
      const qrCode = await qrCodeRepository.findByCode(code, client);
      if (!qrCode) {
        throw new NotFoundError('QR code not found', `redeem: code=${code}`);
      }

      if (qrCode.redeemed) {
        throw new ConflictError(
          'This QR code has already been redeemed',
          `redeem: already redeemed code=${code}`
        );
      }

      const campaignId = qrCode.campaignId;
      if (!campaignId) {
        throw new BadRequestError(
          'This QR code is not linked to an active campaign',
          `redeem: no campaignId code=${code}`
        );
      }

      const campaign = await campaignsService.getActiveCampaignById(campaignId);

      if (!campaignsService.isCampaignCurrentlyValid(campaign)) {
        throw new BadRequestError(
          'The campaign for this QR code is not active or has expired',
          `redeem: campaign invalid campaignId=${campaignId}`
        );
      }

      const updatedQr = await qrCodeRepository.markRedeemedByCode(
        code,
        userId,
        campaign._id,
        client
      );

      if (!updatedQr) {
        throw new ConflictError(
          'This QR code has already been redeemed',
          `redeem: race condition code=${code}`
        );
      }

      await walletService.creditInSession(
        updatedQr.redeemedBy!,
        campaign.walletAmount,
        updatedQr._id,
        `QR redemption: ${code}`,
        client
      );

      await rewardsService.creditInSession(
        updatedQr.redeemedBy!,
        campaign.rewardPoints,
        updatedQr._id,
        `QR redemption: ${code}`,
        client
      );

      const redemptionTx = await redemptionTransactionRepository.create(
        {
          userId,
          qrCodeId: updatedQr._id,
          campaignId: campaign._id,
          walletAmount: campaign.walletAmount,
          rewardPoints: campaign.rewardPoints,
        },
        client
      );

      return {
        redemption: {
          id: redemptionTx._id,
          code,
          campaignName: campaign.name,
          walletAmount: campaign.walletAmount,
          rewardPoints: campaign.rewardPoints,
          redeemedAt: updatedQr.redeemedAt,
        },
      };
    });
  }
}

export const redemptionService = new RedemptionService();
