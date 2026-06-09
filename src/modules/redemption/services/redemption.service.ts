import {
  optionalSessionOptions,
  withMongoTransaction,
} from '../../../database/transactions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../shared/utils/errors';
import { campaignsService } from '../../campaigns/services/campaigns.service';
import { QrCode } from '../../qr/models/qr-code.model';
import { QrBatch } from '../../qr/models/qr-batch.model';
import { rewardsService } from '../../rewards/services/rewards.service';
import { RedemptionTransaction } from '../../transactions/models/redemption-transaction.model';
import { walletService } from '../../wallet/services/wallet.service';

export class RedemptionService {
  async validateCode(code: string) {
    const qrCode = await QrCode.findOne({ code });
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

    const campaign = await campaignsService.getActiveCampaignById(
      campaignId.toString()
    );

    if (!campaignsService.isCampaignCurrentlyValid(campaign)) {
      throw new BadRequestError(
        'The campaign for this QR code is not active or has expired',
        `validateCode: campaign invalid campaignId=${campaignId}`
      );
    }

    const batch = await QrBatch.findById(qrCode.batchId);

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
    return withMongoTransaction(async (session) => {
      const qrCode = session
        ? await QrCode.findOne({ code }).session(session)
        : await QrCode.findOne({ code });
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

      const campaign = await campaignsService.getActiveCampaignById(
        campaignId.toString()
      );

      if (!campaignsService.isCampaignCurrentlyValid(campaign)) {
        throw new BadRequestError(
          'The campaign for this QR code is not active or has expired',
          `redeem: campaign invalid campaignId=${campaignId}`
        );
      }

      const updatedQr = await QrCode.findOneAndUpdate(
        { _id: qrCode._id, redeemed: false },
        {
          $set: {
            redeemed: true,
            redeemedBy: userId,
            redeemedAt: new Date(),
            campaignId: campaign._id,
          },
        },
        { returnDocument: 'after', ...optionalSessionOptions(session) }
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
        session
      );

      await rewardsService.creditInSession(
        updatedQr.redeemedBy!,
        campaign.rewardPoints,
        updatedQr._id,
        `QR redemption: ${code}`,
        session
      );

      const [redemptionTx] = await RedemptionTransaction.create(
        [
          {
            userId,
            qrCodeId: updatedQr._id,
            campaignId: campaign._id,
            walletAmount: campaign.walletAmount,
            rewardPoints: campaign.rewardPoints,
          },
        ],
        optionalSessionOptions(session)
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
