import { withTransaction } from '../../database/transactions';
import { env } from '../../config/env';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/errors';
import { sendOtpSms } from '../../infrastructure/sms/sms.client';
import { campaignsService } from '../campaigns/campaigns.service';
import { notificationsService } from '../notifications/index';
import { assertMechanicForQr } from '../partners/partners.service';
import { productsService } from '../products/products.service';
import { qrBatchRepository } from '../qr/repositories/qr-batch.repository';
import { qrBatchService } from '../qr/services/qr-batch.service';
import { qrCodeRepository } from '../qr/repositories/qr-code.repository';
import { rewardsService } from '../rewards/rewards.service';
import { redemptionTransactionRepository } from '../transactions/redemption-transaction.repository';
import { userRepository } from '../auth/repositories/user.repository';
import { IUser } from '../auth/user.types';
import { otpVerificationRepository } from '../auth/repositories/otp-verification.repository';
import { generateOtp, hashOtp, verifyOtpHash } from '../auth/otp.util';
import { walletService } from '../wallet/wallet.service';

const QR_REDEMPTION_OTP_PURPOSE = 'qr_redemption' as const;

function resolveRedemptionOtp(): string {
  // QA: when TEST_STATIC_OTP is configured, always use it for scan OTP (any mobile).
  if (env.TEST_STATIC_OTP) {
    return env.TEST_STATIC_OTP;
  }
  return generateOtp();
}

function maskMobile(mobileNumber: string): string {
  if (mobileNumber.length < 4) return mobileNumber;
  return `${mobileNumber.slice(0, 2)}******${mobileNumber.slice(-2)}`;
}

function campaignPayload(
  campaign: Awaited<
    ReturnType<typeof campaignsService.getEligibleCampaignForBatch>
  >
) {
  if (!campaign) return null;
  return {
    id: campaign.campaignId,
    code: campaign.campaignCode,
    name: campaign.campaignName,
    multiplier: campaign.multiplier,
    applyBonusTo: campaign.applyBonusTo,
  };
}

async function resolvePointsRecipient(
  scanner: NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>,
  client?: Parameters<typeof userRepository.findGarageOwnerForWorker>[1]
) {
  if (scanner.garageRole !== 'worker') {
    return {
      userId: scanner._id,
      name: scanner.name ?? 'You',
      isScanner: true as const,
    };
  }

  const owner = await userRepository.findGarageOwnerForWorker(scanner, client);
  if (!owner) {
    return {
      userId: scanner._id,
      name: scanner.garageOwnerName || scanner.name || 'You',
      isScanner: true as const,
      ownerUnresolved: true,
    };
  }

  return {
    userId: owner._id,
    name: owner.name || scanner.garageOwnerName || 'Garage owner',
    isScanner: false as const,
    garageId: owner.garageId ?? scanner.garageId,
  };
}

function earnsRewardPoints(user: IUser): boolean {
  return user.userType !== 'mechanic';
}

export class RedemptionService {
  async validateCode(code: string, userId?: string) {
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

    const scanner = userId ? await userRepository.findById(userId) : null;
    const activeCampaign = await campaignsService.getEligibleCampaignForBatch(
      batch._id,
      scanner?.pincode
    );
    const multiplier = activeCampaign ? activeCampaign.multiplier : 1.0;
    const applyBonusTo = activeCampaign?.applyBonusTo || 'both';

    const cashMultiplier =
      applyBonusTo === 'cash' || applyBonusTo === 'both' ? multiplier : 1.0;
    const pointsMultiplier =
      applyBonusTo === 'reward' || applyBonusTo === 'both' ? multiplier : 1.0;

    const effectiveWalletAmount = Number(
      (batch.walletAmount * cashMultiplier).toFixed(2)
    );
    const mechanicCashOnly = scanner ? !earnsRewardPoints(scanner) : false;
    const effectiveRewardPoints = mechanicCashOnly
      ? 0
      : Math.round(batch.rewardPoints * pointsMultiplier);
    const pointsRecipient = scanner
      ? await resolvePointsRecipient(scanner)
      : {
          userId: userId ?? '',
          name: 'You',
          isScanner: true,
        };

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
        baseWalletAmount: batch.walletAmount,
        baseRewardPoints: mechanicCashOnly ? 0 : batch.rewardPoints,
        walletAmount: effectiveWalletAmount,
        rewardPoints: effectiveRewardPoints,
      },
      campaign: campaignPayload(activeCampaign),
      allocation: {
        cashTo: 'self',
        pointsTo: mechanicCashOnly
          ? 'none'
          : pointsRecipient.isScanner
            ? 'self'
            : 'owner',
        pointsRecipientName:
          mechanicCashOnly || pointsRecipient.isScanner
            ? null
            : pointsRecipient.name,
      },
      redeemable: true,
    };
  }

  /** Validate QR is redeemable, then send OTP to the mechanic's mobile. */
  async sendRedemptionOtp(userId: string, code: string) {
    await assertMechanicForQr(userId);
    await this.validateCode(code, userId);

    const user = await userRepository.findById(userId);
    if (!user?.mobileNumber) {
      throw new BadRequestError(
        'Mobile number is required to verify this redemption',
        `sendRedemptionOtp: missing mobile userId=${userId}`
      );
    }

    const mobileNumber = user.mobileNumber;
    const purpose = QR_REDEMPTION_OTP_PURPOSE;

    if (!env.TEST_STATIC_OTP) {
      const latest = await otpVerificationRepository.findLatest({
        mobileNumber,
        purpose,
      });
      if (latest) {
        const elapsed = Date.now() - latest.createdAt.getTime();
        const cooldown = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
        if (elapsed < cooldown) {
          const waitSeconds = Math.ceil((cooldown - elapsed) / 1000);
          throw new BadRequestError(
            `Please wait ${waitSeconds} seconds before requesting a new OTP`,
            `sendRedemptionOtp: cooldown mobile=${mobileNumber}`
          );
        }
      }
    }

    const otp = resolveRedemptionOtp();
    await otpVerificationRepository.invalidateActive({
      mobileNumber,
      purpose,
    });
    await otpVerificationRepository.create({
      mobileNumber,
      otpHash: hashOtp(otp),
      purpose,
      expiresAt: new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000),
    });

    if (env.TEST_STATIC_OTP) {
      console.log(
        `[TEST OTP] qr_redemption static OTP for ${mobileNumber} code=${code}: ${otp} (SMS skipped)`
      );
    } else {
      await sendOtpSms(mobileNumber, otp);
    }

    return {
      mobileNumber: maskMobile(mobileNumber),
      expiresIn: env.OTP_EXPIRES_MINUTES * 60,
    };
  }

  /** Verify scan OTP, then redeem the QR (same result as redeem). */
  async verifyRedemptionOtp(userId: string, code: string, otp: string) {
    await assertMechanicForQr(userId);

    const user = await userRepository.findById(userId);
    if (!user?.mobileNumber) {
      throw new BadRequestError(
        'Mobile number is required to verify this redemption',
        `verifyRedemptionOtp: missing mobile userId=${userId}`
      );
    }

    const mobileNumber = user.mobileNumber;
    const purpose = QR_REDEMPTION_OTP_PURPOSE;
    const otpRecord = await otpVerificationRepository.findLatestActive({
      mobileNumber,
      purpose,
    });

    const staticOtpOk = Boolean(
      env.TEST_STATIC_OTP && otp === env.TEST_STATIC_OTP
    );

    if (!otpRecord && !staticOtpOk) {
      throw new BadRequestError(
        'No OTP request found. Please request a new OTP',
        `verifyRedemptionOtp: missing otp mobile=${mobileNumber}`
      );
    }

    const otpValid =
      staticOtpOk ||
      (otpRecord ? verifyOtpHash(otp, otpRecord.otpHash) : false);

    if (!otpValid) {
      throw new BadRequestError(
        'Invalid OTP. Please try again',
        `verifyRedemptionOtp: bad otp mobile=${mobileNumber}`
      );
    }

    if (otpRecord) {
      await otpVerificationRepository.markVerified(otpRecord._id);
    }

    return this.redeem(userId, code);
  }

  async redeem(userId: string, code: string) {
    await assertMechanicForQr(userId);

    const result = await withTransaction(async (client) => {
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

      const scanner = await userRepository.findById(userId, { client });
      if (!scanner) {
        throw new NotFoundError('User not found', `redeem: userId=${userId}`);
      }

      const activeCampaign = await campaignsService.getEligibleCampaignForBatch(
        batch._id,
        scanner.pincode
      );
      const multiplier = activeCampaign ? activeCampaign.multiplier : 1.0;
      const applyBonusTo = activeCampaign?.applyBonusTo || 'both';

      const cashMultiplier =
        applyBonusTo === 'cash' || applyBonusTo === 'both' ? multiplier : 1.0;
      const pointsMultiplier =
        applyBonusTo === 'reward' || applyBonusTo === 'both' ? multiplier : 1.0;

      const effectiveWalletAmount = Number(
        (batch.walletAmount * cashMultiplier).toFixed(2)
      );
      const mechanicCashOnly = !earnsRewardPoints(scanner);
      const effectiveRewardPoints = mechanicCashOnly
        ? 0
        : Math.round(batch.rewardPoints * pointsMultiplier);
      const pointsRecipient = await resolvePointsRecipient(scanner, client);

      if (
        scanner.garageRole === 'worker' &&
        !pointsRecipient.isScanner &&
        pointsRecipient.garageId &&
        !scanner.garageId
      ) {
        await userRepository.update(
          scanner._id,
          { garageId: pointsRecipient.garageId },
          { client }
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

      const bonusSuffix = activeCampaign
        ? ` (${activeCampaign.campaignName} - ${multiplier}x ${applyBonusTo.toUpperCase()})`
        : '';
      const remarkText = `QR redemption: ${code}${bonusSuffix}`;
      const pointsRemark = pointsRecipient.isScanner
        ? remarkText
        : `${remarkText} (from worker ${scanner.name ?? scanner.mobileNumber})`;

      const walletTx = await walletService.creditInSession(
        updatedQr.redeemedBy!,
        effectiveWalletAmount,
        updatedQr._id,
        remarkText,
        client,
        'qr_redemption'
      );

      if (effectiveRewardPoints > 0) {
        await rewardsService.creditInSession(
          pointsRecipient.userId,
          effectiveRewardPoints,
          updatedQr._id,
          pointsRemark,
          client,
          'qr_redemption'
        );
      }

      const redemptionTx = await redemptionTransactionRepository.create(
        {
          userId,
          qrCodeId: updatedQr._id,
          batchId: batch._id,
          productId: batch.productId!,
          walletAmount: effectiveWalletAmount,
          rewardPoints: effectiveRewardPoints,
          campaignId: activeCampaign?.campaignId,
          multiplierApplied: multiplier,
          pointsCreditedToUserId:
            effectiveRewardPoints > 0 ? pointsRecipient.userId : undefined,
          redeemedAt: updatedQr.redeemedAt,
        },
        client
      );

      return {
        response: {
          redemption: {
            id: redemptionTx._id,
            code,
            batchName: batch.name,
            productName: batch.product?.name,
            walletAmount: effectiveWalletAmount,
            rewardPoints: effectiveRewardPoints,
            campaign: activeCampaign
              ? {
                  id: activeCampaign.campaignId,
                  name: activeCampaign.campaignName,
                  multiplier,
                  applyBonusTo,
                }
              : null,
            allocation: {
              cashTo: 'self',
              pointsTo: mechanicCashOnly
                ? 'none'
                : pointsRecipient.isScanner
                  ? 'self'
                  : 'owner',
              pointsRecipientName:
                mechanicCashOnly || pointsRecipient.isScanner
                  ? null
                  : pointsRecipient.name,
            },
            redeemedAt: updatedQr.redeemedAt,
          },
        },
        walletTxId: walletTx._id,
        walletAmount: effectiveWalletAmount,
        remarks: remarkText,
      };
    });

    const user = await userRepository.findById(userId);
    notificationsService.notifyWalletTransaction({
      userId,
      transactionId: result.walletTxId,
      amount: result.walletAmount,
      direction: 'credit',
      remarks: result.remarks,
      userName: user?.name,
    });

    return result.response;
  }
}

export const redemptionService = new RedemptionService();
