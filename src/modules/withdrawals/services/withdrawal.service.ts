import crypto from 'crypto';
import { Types } from 'mongoose';
import { env } from '../../../config/env';
import {
  optionalSessionOptions,
  withMongoTransaction,
} from '../../../database/transactions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../shared/utils/errors';
import { User } from '../../auth/models/user.model';
import { walletService } from '../../wallet/services/wallet.service';
import { PayoutMethod, WithdrawalStatus } from '../constants/withdrawal.constants';
import { IPayoutProfile, PayoutProfile } from '../models/payout-profile.model';
import { IWithdrawal, Withdrawal } from '../models/withdrawal.model';
import { CreateWithdrawalInput, SavePayoutProfileInput } from '../types/withdrawal.types';
import { getActivePayoutProvider, getPayoutProvider } from './payout-provider.factory';

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
    accountNumberMasked: maskAccountNumber(profile.accountNumber),
    ifsc: profile.ifsc,
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
    createdAt: withdrawal.createdAt,
    updatedAt: withdrawal.updatedAt,
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
    const existing = await PayoutProfile.findOne({ userId })
      .select('+accountNumber');

    const profile = existing
      ? existing
      : new PayoutProfile({
          userId,
          provider,
        });

    profile.method = input.method;
    profile.accountHolderName = input.accountHolderName;
    profile.provider = provider;

    if (input.method === PayoutMethod.UPI) {
      profile.upiId = input.upiId;
      profile.accountNumber = undefined;
      profile.ifsc = undefined;
      profile.providerFundAccountId = undefined;
      profile.cashfreeBeneficiaryId = undefined;
    } else {
      profile.accountNumber = input.accountNumber;
      profile.ifsc = input.ifsc;
      profile.upiId = undefined;
      profile.providerFundAccountId = undefined;
      profile.cashfreeBeneficiaryId = undefined;
    }

    await profile.save();

    const payoutProvider = getPayoutProvider(provider);
    const readyProfile = await payoutProvider.ensureFundAccount(profile);

    return sanitizeProfile(readyProfile);
  }

  async getPayoutProfile(userId: string) {
    const profile = await PayoutProfile.findOne({ userId }).select('+accountNumber');
    if (!profile) {
      throw new NotFoundError(
        'Payout profile not found',
        `getPayoutProfile: userId=${userId}`
      );
    }
    return sanitizeProfile(profile);
  }

  async listWithdrawals(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Withdrawal.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Withdrawal.countDocuments({ userId }),
    ]);

    return {
      items: items.map(sanitizeWithdrawal),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async requestWithdrawal(userId: string, input: CreateWithdrawalInput) {
    if (input.amount < env.MIN_WITHDRAWAL_AMOUNT) {
      throw new BadRequestError(
        `Minimum withdrawal amount is ₹${env.MIN_WITHDRAWAL_AMOUNT}`,
        `requestWithdrawal: amount=${input.amount}`
      );
    }

    const profile = await PayoutProfile.findOne({ userId }).select('+accountNumber');
    if (!profile) {
      throw new BadRequestError(
        'Please add your bank or UPI details before withdrawing',
        `requestWithdrawal: missing payout profile userId=${userId}`
      );
    }

    const pending = await Withdrawal.findOne({
      userId,
      status: { $in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
    });
    if (pending) {
      throw new ConflictError(
        'You already have a withdrawal in progress',
        `requestWithdrawal: pending withdrawal=${pending._id}`
      );
    }

    const referenceId = `wd_${crypto.randomUUID()}`;

    const withdrawal = await withMongoTransaction(async (session) => {
      const user = session
        ? await User.findById(userId).session(session)
        : await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', `requestWithdrawal: userId=${userId}`);
      }
      if (user.walletBalance < input.amount) {
        throw new BadRequestError(
          'Insufficient wallet balance',
          `requestWithdrawal: balance=${user.walletBalance}`
        );
      }

      const [createdWithdrawal] = await Withdrawal.create(
        [
          {
            userId,
            amount: input.amount,
            method: profile.method,
            status: WithdrawalStatus.PENDING,
            provider: profile.provider,
            providerReferenceId: referenceId,
            payoutDestination: getPayoutDestination(profile),
          },
        ],
        optionalSessionOptions(session)
      );

      await walletService.debitInSession(
        new Types.ObjectId(userId),
        input.amount,
        createdWithdrawal._id,
        `Wallet withdrawal ${referenceId}`,
        session
      );

      return createdWithdrawal;
    });

    try {
      const payoutProvider = getPayoutProvider(profile.provider);
      const payout = await payoutProvider.createPayout(
        profile,
        input.amount,
        referenceId
      );

      withdrawal.providerPayoutId = payout.providerPayoutId;
      withdrawal.status =
        payout.status === 'success'
          ? WithdrawalStatus.SUCCESS
          : WithdrawalStatus.PROCESSING;
      await withdrawal.save();

      return sanitizeWithdrawal(withdrawal);
    } catch (error) {
      await this.refundFailedWithdrawal(
        withdrawal,
        error instanceof Error ? error.message : 'Payout initiation failed'
      );
      throw error;
    }
  }

  async refundFailedWithdrawal(withdrawal: IWithdrawal, reason: string) {
    await withMongoTransaction(async (session) => {
      const current = session
        ? await Withdrawal.findById(withdrawal._id).session(session)
        : await Withdrawal.findById(withdrawal._id);
      if (
        !current ||
        current.status === WithdrawalStatus.SUCCESS ||
        current.status === WithdrawalStatus.FAILED
      ) {
        return;
      }

      current.status = WithdrawalStatus.FAILED;
      current.failureReason = reason;
      await current.save(optionalSessionOptions(session));

      await walletService.creditInSession(
        current.userId,
        current.amount,
        current._id,
        `Withdrawal refund ${current.providerReferenceId}`,
        session
      );
    });
  }

  async handleRazorpayWebhook(payload: Record<string, unknown>, signature: string) {
    if (env.RAZORPAY_WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (expected !== signature) {
        throw new BadRequestError('Invalid webhook signature', 'razorpay webhook');
      }
    }

    const event = typeof payload.event === 'string' ? payload.event : '';
    const payoutEntity = (payload.payload as { payout?: { entity?: Record<string, unknown> } })
      ?.payout?.entity;

    if (!payoutEntity) return;

    const referenceId =
      typeof payoutEntity.reference_id === 'string'
        ? payoutEntity.reference_id
        : undefined;
    if (!referenceId) return;

    const withdrawal = await Withdrawal.findOne({ providerReferenceId: referenceId });
    if (!withdrawal) return;

    if (event === 'payout.processed') {
      withdrawal.status = WithdrawalStatus.SUCCESS;
      await withdrawal.save();
      return;
    }

    if (event === 'payout.failed' || event === 'payout.reversed') {
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

    const withdrawal = await Withdrawal.findOne({
      $or: [{ providerReferenceId: transferId }, { providerPayoutId: transferId }],
    });
    if (!withdrawal) return;

    if (status === 'SUCCESS') {
      withdrawal.status = WithdrawalStatus.SUCCESS;
      await withdrawal.save();
      return;
    }

    if (status === 'FAILED' || status === 'REVERSED') {
      const reason =
        typeof payload.reason === 'string' ? payload.reason : 'Cashfree payout failed';
      await this.refundFailedWithdrawal(withdrawal, reason);
    }
  }
}

export const withdrawalService = new WithdrawalService();
