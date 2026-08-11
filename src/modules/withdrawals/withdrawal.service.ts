import crypto from 'crypto';
import { env } from '../../config/env';
import { withTransaction } from '../../database/transactions';
import { sendOtpSms } from '../../infrastructure/sms/sms.client';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/errors';
import { generateOtp, hashOtp, verifyOtpHash } from '../auth/otp.util';
import { otpVerificationRepository } from '../auth/repositories/otp-verification.repository';
import { userRepository } from '../auth/repositories/user.repository';
import { notificationsService } from '../notifications/index';
import { assertPartnerApproved } from '../partners/partners.service';
import { walletService } from '../wallet/wallet.service';
import { PayoutMethod, WithdrawalStatus } from './withdrawal.constants';
import { payoutProfileRepository } from './repositories/payout-profile.repository';
import { withdrawalRepository } from './repositories/withdrawal.repository';
import {
  CreateWithdrawalInput,
  IPayoutProfile,
  IWithdrawal,
  SavePayoutProfileInput,
} from './withdrawal.types';
import {
  getActivePayoutProvider,
  getPayoutProvider,
} from './providers/payout-provider.factory';

const WITHDRAWAL_OTP_PURPOSE = 'withdrawal' as const;

function resolveWithdrawalOtp(): string {
  if (env.TEST_STATIC_OTP) {
    return env.TEST_STATIC_OTP;
  }
  return generateOtp();
}

function maskMobile(mobileNumber: string): string {
  const digits = mobileNumber.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `+91 ******${digits.slice(-4)}`;
}

function maskAccountNumber(accountNumber?: string): string | undefined {
  if (!accountNumber) return undefined;
  if (accountNumber.length <= 4) return '****';
  return `****${accountNumber.slice(-4)}`;
}

function sanitizeProfile(profile: IPayoutProfile) {
  return {
    id: profile._id,
    method: profile.method,
    accountHolderName: profile.accountHolderName,
    upiId: profile.upiId,
    bankName: profile.bankName,
    accountNumberMasked: maskAccountNumber(profile.accountNumber),
    ifsc: profile.ifsc,
    isDefault: profile.isDefault,
    provider: profile.provider,
    updatedAt: profile.updatedAt,
  };
}

function sanitizeWithdrawal(withdrawal: IWithdrawal) {
  return {
    id: withdrawal._id,
    amount: withdrawal.amount,
    method: withdrawal.method,
    status: withdrawal.status,
    provider: withdrawal.provider,
    payoutDestination: withdrawal.payoutDestination,
    failureReason: withdrawal.failureReason,
    requestedAt: withdrawal.requestedAt,
    processedAt: withdrawal.processedAt,
    createdAt: withdrawal.createdAt,
  };
}

function getPayoutDestination(profile: IPayoutProfile): string {
  if (profile.method === PayoutMethod.UPI) {
    return profile.upiId ?? '';
  }
  return `${maskAccountNumber(profile.accountNumber)}@${profile.ifsc}`;
}

export class WithdrawalService {
  async savePayoutProfile(userId: string, input: SavePayoutProfileInput) {
    const provider = getActivePayoutProvider();

    const profileData =
      input.method === PayoutMethod.UPI
        ? {
            userId,
            method: input.method,
            accountHolderName: input.accountHolderName,
            provider,
            upiId: input.upiId,
            accountNumber: null,
            ifsc: null,
          }
        : {
            userId,
            method: input.method,
            accountHolderName: input.accountHolderName,
            provider,
            upiId: null,
            accountNumber: input.accountNumber,
            ifsc: input.ifsc,
          };

    const profile = await payoutProfileRepository.upsertByUserId(
      userId,
      profileData
    );

    const payoutProvider = getPayoutProvider(provider);
    const readyProfile = await payoutProvider.ensureFundAccount(profile);

    return sanitizeProfile(readyProfile);
  }

  async getPayoutProfile(userId: string) {
    const profile = await payoutProfileRepository.findByUserId(userId, {
      includeAccountNumber: true,
    });
    if (!profile) {
      throw new NotFoundError(
        'Payout profile not found',
        `getPayoutProfile: userId=${userId}`
      );
    }
    return sanitizeProfile(profile);
  }

  async listWithdrawals(userId: string, page = 1, limit = 20) {
    const { items, total } = await withdrawalRepository.findByUserId(
      userId,
      page,
      limit
    );

    return {
      items: items.map(sanitizeWithdrawal),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Pre-checks shared by send-otp and withdraw. */
  private async assertWithdrawalReady(userId: string, amount: number) {
    await assertPartnerApproved(userId);

    if (amount < env.MIN_WITHDRAWAL_AMOUNT) {
      throw new BadRequestError(
        `Minimum withdrawal amount is ₹${env.MIN_WITHDRAWAL_AMOUNT}`,
        `assertWithdrawalReady: amount=${amount}`
      );
    }

    const profile = await payoutProfileRepository.findByUserId(userId, {
      includeAccountNumber: true,
    });
    if (!profile) {
      throw new BadRequestError(
        'Please add your bank or UPI details before withdrawing',
        `assertWithdrawalReady: missing payout profile userId=${userId}`
      );
    }

    const pending = await withdrawalRepository.findPendingByUserId(userId);
    if (pending) {
      throw new ConflictError(
        'You already have a withdrawal in progress',
        `assertWithdrawalReady: pending withdrawal=${pending._id}`
      );
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(
        'User not found',
        `assertWithdrawalReady: userId=${userId}`
      );
    }
    if (user.walletBalance < amount) {
      throw new BadRequestError(
        'Insufficient wallet balance',
        `assertWithdrawalReady: balance=${user.walletBalance}`
      );
    }
    if (!user.mobileNumber) {
      throw new BadRequestError(
        'Mobile number is required to verify this withdrawal',
        `assertWithdrawalReady: missing mobile userId=${userId}`
      );
    }

    return { profile, user };
  }

  /** Validate withdrawal + send OTP to the partner's registered mobile. */
  async sendWithdrawalOtp(userId: string, amount: number) {
    const { user } = await this.assertWithdrawalReady(userId, amount);
    const mobileNumber = user.mobileNumber!;
    const purpose = WITHDRAWAL_OTP_PURPOSE;

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
            `sendWithdrawalOtp: cooldown mobile=${mobileNumber}`
          );
        }
      }
    }

    const otp = resolveWithdrawalOtp();
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
        `[TEST OTP] withdrawal static OTP for ${mobileNumber} amount=${amount}: ${otp} (SMS skipped)`
      );
    } else {
      await sendOtpSms(mobileNumber, otp);
    }

    return {
      mobileNumber: maskMobile(mobileNumber),
      expiresIn: env.OTP_EXPIRES_MINUTES * 60,
      amount,
    };
  }

  /** Verify OTP, then initiate the wallet payout. */
  async verifyWithdrawalOtp(userId: string, amount: number, otp: string) {
    const user = await userRepository.findById(userId);
    if (!user?.mobileNumber) {
      throw new BadRequestError(
        'Mobile number is required to verify this withdrawal',
        `verifyWithdrawalOtp: missing mobile userId=${userId}`
      );
    }

    const mobileNumber = user.mobileNumber;
    const purpose = WITHDRAWAL_OTP_PURPOSE;
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
        `verifyWithdrawalOtp: missing otp mobile=${mobileNumber}`
      );
    }

    const otpValid =
      staticOtpOk ||
      (otpRecord ? verifyOtpHash(otp, otpRecord.otpHash) : false);

    if (!otpValid) {
      throw new BadRequestError(
        'Invalid OTP. Please try again',
        `verifyWithdrawalOtp: bad otp mobile=${mobileNumber}`
      );
    }

    if (otpRecord) {
      await otpVerificationRepository.markVerified(otpRecord._id);
    }

    return this.requestWithdrawal(userId, { amount });
  }

  async requestWithdrawal(userId: string, input: CreateWithdrawalInput) {
    const { profile } = await this.assertWithdrawalReady(userId, input.amount);

    const referenceId = `wd_${crypto.randomUUID()}`;

    const withdrawal = await withTransaction(async (client) => {
      const user = await userRepository.findById(userId, { client });
      if (!user) {
        throw new NotFoundError(
          'User not found',
          `requestWithdrawal: userId=${userId}`
        );
      }
      if (user.walletBalance < input.amount) {
        throw new BadRequestError(
          'Insufficient wallet balance',
          `requestWithdrawal: balance=${user.walletBalance}`
        );
      }

      const createdWithdrawal = await withdrawalRepository.create(
        {
          userId,
          payoutProfileId: profile._id,
          amount: input.amount,
          method: profile.method,
          status: WithdrawalStatus.PENDING,
          provider: profile.provider,
          providerReferenceId: referenceId,
          payoutDestination: getPayoutDestination(profile),
        },
        client
      );

      const walletTx = await walletService.debitInSession(
        userId,
        input.amount,
        createdWithdrawal._id,
        `Wallet withdrawal ${referenceId}`,
        client,
        'withdrawal'
      );

      return { createdWithdrawal, walletTx, userName: user.name };
    });

    notificationsService.notifyWalletTransaction({
      userId,
      transactionId: withdrawal.walletTx._id,
      amount: input.amount,
      direction: 'debit',
      remarks: `Wallet withdrawal ${referenceId}`,
      userName: withdrawal.userName,
    });

    try {
      const providerName = profile.provider ?? getActivePayoutProvider();
      const payoutProvider = getPayoutProvider(providerName);
      const payout = await payoutProvider.createPayout(
        profile,
        input.amount,
        referenceId
      );

      const updatedWithdrawal = await withdrawalRepository.updateProviderDetails(
        withdrawal.createdWithdrawal._id,
        {
          providerPayoutId: payout.providerPayoutId,
          status:
            payout.status === 'success'
              ? WithdrawalStatus.SUCCESS
              : WithdrawalStatus.PROCESSING,
        }
      );

      if (!updatedWithdrawal) {
        throw new NotFoundError(
          'Withdrawal not found',
          `requestWithdrawal: withdrawalId=${withdrawal.createdWithdrawal._id}`
        );
      }

      return sanitizeWithdrawal(updatedWithdrawal);
    } catch (error) {
      await this.refundFailedWithdrawal(
        withdrawal.createdWithdrawal,
        error instanceof Error ? error.message : 'Payout initiation failed'
      );
      throw error;
    }
  }

  async refundFailedWithdrawal(withdrawal: IWithdrawal, reason: string) {
    const refunded = await withTransaction(async (client) => {
      const current = await withdrawalRepository.findById(
        withdrawal._id,
        client
      );
      if (
        !current ||
        current.status === WithdrawalStatus.SUCCESS ||
        current.status === WithdrawalStatus.FAILED
      ) {
        return null;
      }

      await withdrawalRepository.updateFailure(
        current._id,
        WithdrawalStatus.FAILED,
        reason,
        client
      );

      const walletTx = await walletService.creditInSession(
        current.userId,
        current.amount,
        current._id,
        `Withdrawal refund ${current.providerReferenceId}`,
        client,
        'withdrawal'
      );

      return { walletTx, userId: current.userId, amount: current.amount };
    });

    if (refunded) {
      const user = await userRepository.findById(refunded.userId);
      notificationsService.notifyWalletTransaction({
        userId: refunded.userId,
        transactionId: refunded.walletTx._id,
        amount: refunded.amount,
        direction: 'credit',
        remarks: `Withdrawal refund`,
        userName: user?.name,
      });
    }
  }

  async handleRazorpayWebhook(
    payload: Record<string, unknown>,
    signature: string
  ) {
    if (env.RAZORPAY_WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (expected !== signature) {
        throw new BadRequestError(
          'Invalid webhook signature',
          'razorpay webhook'
        );
      }
    }

    const event = typeof payload.event === 'string' ? payload.event : '';
    const payoutEntity = (
      payload.payload as { payout?: { entity?: Record<string, unknown> } }
    )?.payout?.entity;

    if (!payoutEntity) return;

    const referenceId =
      typeof payoutEntity.reference_id === 'string'
        ? payoutEntity.reference_id
        : undefined;
    if (!referenceId) return;

    const withdrawal =
      await withdrawalRepository.findByProviderReferenceId(referenceId);
    if (!withdrawal) return;

    if (event === 'payout.processed') {
      await withdrawalRepository.updateStatus(
        withdrawal._id,
        WithdrawalStatus.SUCCESS
      );
      return;
    }

    if (
      event === 'payout.failed' ||
      event === 'payout.rejected' ||
      event === 'payout.reversed'
    ) {
      const reason =
        typeof payoutEntity.status_details === 'string'
          ? payoutEntity.status_details
          : 'Payout failed';
      await this.refundFailedWithdrawal(withdrawal, reason);
    }
  }

  async handleCashfreeWebhook(payload: Record<string, unknown>) {
    const transferId =
      typeof payload.transferId === 'string' ? payload.transferId : undefined;
    const status =
      typeof payload.status === 'string' ? payload.status.toUpperCase() : '';

    if (!transferId) return;

    const withdrawal =
      await withdrawalRepository.findByProviderReferenceOrPayoutId(transferId);
    if (!withdrawal) return;

    if (status === 'SUCCESS') {
      await withdrawalRepository.updateStatus(
        withdrawal._id,
        WithdrawalStatus.SUCCESS
      );
      return;
    }

    if (status === 'FAILED' || status === 'REVERSED') {
      const reason =
        typeof payload.reason === 'string'
          ? payload.reason
          : 'Cashfree payout failed';
      await this.refundFailedWithdrawal(withdrawal, reason);
    }
  }
}

export const withdrawalService = new WithdrawalService();
