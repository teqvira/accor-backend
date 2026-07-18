import crypto from 'crypto';
import { env } from '../../config/env';
import { withTransaction } from '../../database/transactions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/errors';
import { userRepository } from '../auth/repositories/user.repository';
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
import { getActivePayoutProvider, getPayoutProvider } from './providers/payout-provider.factory';

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

  async requestWithdrawal(userId: string, input: CreateWithdrawalInput) {
    if (input.amount < env.MIN_WITHDRAWAL_AMOUNT) {
      throw new BadRequestError(
        `Minimum withdrawal amount is ₹${env.MIN_WITHDRAWAL_AMOUNT}`,
        `requestWithdrawal: amount=${input.amount}`
      );
    }

    const profile = await payoutProfileRepository.findByUserId(userId, {
      includeAccountNumber: true,
    });
    if (!profile) {
      throw new BadRequestError(
        'Please add your bank or UPI details before withdrawing',
        `requestWithdrawal: missing payout profile userId=${userId}`
      );
    }

    const pending = await withdrawalRepository.findPendingByUserId(userId);
    if (pending) {
      throw new ConflictError(
        'You already have a withdrawal in progress',
        `requestWithdrawal: pending withdrawal=${pending._id}`
      );
    }

    const referenceId = `wd_${crypto.randomUUID()}`;

    const withdrawal = await withTransaction(async (client) => {
      const user = await userRepository.findById(userId, { client });
      if (!user) {
        throw new NotFoundError('User not found', `requestWithdrawal: userId=${userId}`);
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

      await walletService.debitInSession(
        userId,
        input.amount,
        createdWithdrawal._id,
        `Wallet withdrawal ${referenceId}`,
        client,
        'withdrawal'
      );

      return createdWithdrawal;
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
        withdrawal._id,
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
          `requestWithdrawal: withdrawalId=${withdrawal._id}`
        );
      }

      return sanitizeWithdrawal(updatedWithdrawal);
    } catch (error) {
      await this.refundFailedWithdrawal(
        withdrawal,
        error instanceof Error ? error.message : 'Payout initiation failed'
      );
      throw error;
    }
  }

  async refundFailedWithdrawal(withdrawal: IWithdrawal, reason: string) {
    await withTransaction(async (client) => {
      const current = await withdrawalRepository.findById(withdrawal._id, client);
      if (
        !current ||
        current.status === WithdrawalStatus.SUCCESS ||
        current.status === WithdrawalStatus.FAILED
      ) {
        return;
      }

      await withdrawalRepository.updateFailure(
        current._id,
        WithdrawalStatus.FAILED,
        reason,
        client
      );

      await walletService.creditInSession(
        current.userId,
        current.amount,
        current._id,
        `Withdrawal refund ${current.providerReferenceId}`,
        client,
        'withdrawal'
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
        typeof payload.reason === 'string' ? payload.reason : 'Cashfree payout failed';
      await this.refundFailedWithdrawal(withdrawal, reason);
    }
  }
}

export const withdrawalService = new WithdrawalService();
