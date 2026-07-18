import { withTransaction } from '../../database/transactions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/errors';
import { productsService } from '../products/products.service';
import { qrBatchRepository } from '../qr/repositories/qr-batch.repository';
import { qrBatchService } from '../qr/services/qr-batch.service';
import { qrCodeRepository } from '../qr/repositories/qr-code.repository';
import { rewardsService } from '../rewards/rewards.service';
import { redemptionTransactionRepository } from '../transactions/redemption-transaction.repository';
import { walletService } from '../wallet/wallet.service';

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

    const batch = await qrBatchRepository.findById(qrCode.batchId);
    if (!batch) {
      throw new BadRequestError(
        'This QR code is not linked to a coupon batch',
        `validateCode: no batch code=${code}`
      );
    }

    if (qrCode.productId) {
      await productsService.getActiveProductById(qrCode.productId);
    }

    if (!qrBatchService.isBatchRedeemable(batch)) {
      throw new BadRequestError(
        'This coupon batch is not active or has expired',
        `validateCode: invalid batch batchId=${batch._id}`
      );
    }

    return {
      code: qrCode.code,
      product: batch.product
        ? {
            id: batch.product.id,
            name: batch.product.name,
            skuCode: batch.product.skuCode,
          }
        : null,
      batch: {
        id: batch._id,
        name: batch.name,
        walletAmount: batch.walletAmount,
        rewardPoints: batch.rewardPoints,
      },
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

      const batch = await qrBatchRepository.findById(qrCode.batchId);
      if (!batch) {
        throw new BadRequestError(
          'This QR code is not linked to a coupon batch',
          `redeem: no batch code=${code}`
        );
      }

      if (qrCode.productId) {
        await productsService.getActiveProductById(qrCode.productId);
      }

      if (!qrBatchService.isBatchRedeemable(batch)) {
        throw new BadRequestError(
          'This coupon batch is not active or has expired',
          `redeem: invalid batch batchId=${batch._id}`
        );
      }

      const updatedQr = await qrCodeRepository.markRedeemedByCode(
        code,
        userId,
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
        batch.walletAmount,
        updatedQr._id,
        `QR redemption: ${code}`,
        client,
        'qr_redemption'
      );

      await rewardsService.creditInSession(
        updatedQr.redeemedBy!,
        batch.rewardPoints,
        updatedQr._id,
        `QR redemption: ${code}`,
        client,
        'qr_redemption'
      );

      const redemptionTx = await redemptionTransactionRepository.create(
        {
          userId,
          qrCodeId: updatedQr._id,
          batchId: batch._id,
          productId: batch.productId!,
          walletAmount: batch.walletAmount,
          rewardPoints: batch.rewardPoints,
          redeemedAt: updatedQr.redeemedAt,
        },
        client
      );

      return {
        redemption: {
          id: redemptionTx._id,
          code,
          batchName: batch.name,
          productName: batch.product?.name,
          walletAmount: batch.walletAmount,
          rewardPoints: batch.rewardPoints,
          redeemedAt: updatedQr.redeemedAt,
        },
      };
    });
  }
}

export const redemptionService = new RedemptionService();
