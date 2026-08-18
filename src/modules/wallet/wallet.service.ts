import crypto from 'crypto';
import { PoolClient } from 'pg';
import { BadRequestError, NotFoundError } from '../../shared/utils/errors';
import { activityService } from '../activity/activity.service';
import { userRepository } from '../auth/repositories/user.repository';
import { walletTransactionRepository } from './wallet-transaction.repository';
import { env } from '../../config/env';
import { razorpayPayoutService } from '../withdrawals/providers/razorpay-payout.provider';
import {
  AdminWalletScanQuery,
  IWalletTransaction,
  WalletReferenceType,
  WalletTransactionType,
} from './wallet.types';

function sanitizeTransaction(tx: IWalletTransaction) {
  return {
    id: tx._id,
    userId: tx.userId,
    amount: tx.amount,
    type: tx.type,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    remarks: tx.remarks,
    createdAt: tx.createdAt,
  };
}

export class WalletService {
  async getBalance(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getBalance: userId=${userId}`);
    }
    return { balance: user.walletBalance };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const { items, total } = await walletTransactionRepository.findByUserId(
      userId,
      page,
      limit
    );

    return {
      items: items.map(sanitizeTransaction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async debitInSession(
    userId: string,
    amount: number,
    referenceId: string,
    remarks: string,
    client?: PoolClient,
    referenceType: WalletReferenceType = 'withdrawal'
  ) {
    const user = await userRepository.findById(userId, { client });
    if (!user) {
      throw new NotFoundError('User not found', `debitInSession: userId=${userId}`);
    }
    if (user.walletBalance < amount) {
      throw new BadRequestError(
        'Insufficient wallet balance',
        `debitInSession: balance=${user.walletBalance}, amount=${amount}`
      );
    }

    await userRepository.updateWalletAndPoints(userId, -amount, 0, client);

    const tx = await walletTransactionRepository.create(
      {
        userId,
        amount,
        type: WalletTransactionType.DEBIT,
        referenceType,
        referenceId,
        remarks,
      },
      client
    );

    return tx;
  }

  async creditInSession(
    userId: string,
    amount: number,
    referenceId: string,
    remarks: string,
    client?: PoolClient,
    referenceType: WalletReferenceType = 'qr_redemption'
  ) {
    await userRepository.updateWalletAndPoints(userId, amount, 0, client);

    const tx = await walletTransactionRepository.create(
      {
        userId,
        amount,
        type: WalletTransactionType.CREDIT,
        referenceType,
        referenceId,
        remarks,
      },
      client
    );

    return tx;
  }

  async getUserWalletAdmin(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getUserWalletAdmin: userId=${userId}`);
    }
    return {
      userId: user._id,
      mobileNumber: user.mobileNumber,
      name: user.name,
      walletBalance: user.walletBalance,
    };
  }

  async getSummary(userId: string, recentLimit = 10) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getSummary: userId=${userId}`);
    }

    const [totalEarned, totalWithdrawn, pendingAmount, recentActivity] =
      await Promise.all([
        walletTransactionRepository.sumTotalEarnedByUserId(userId),
        walletTransactionRepository.sumTotalWithdrawnByUserId(userId),
        walletTransactionRepository.sumPendingAmountByUserId(userId),
        activityService.getFeed({
          userId,
          page: 1,
          limit: recentLimit,
          scope: 'wallet',
        }),
      ]);

    return {
      balance: user.walletBalance,
      totalEarned,
      totalWithdrawn,
      pendingAmount,
      recentActivity,
    };
  }

  async getAdminKpis() {
    const [razorpayInfo, totalWithdrawn, totalUserWalletBalance, totalScansCount] =
      await Promise.all([
        razorpayPayoutService.getAccountBalance(),
        walletTransactionRepository.sumTotalSuccessfulWithdrawals(),
        walletTransactionRepository.sumAllUserWalletBalances(),
        walletTransactionRepository.countTotalScans(),
      ]);

    return {
      razorpayBalance: razorpayInfo.balance,
      totalWithdrawn,
      totalUserWalletBalance,
      totalScansCount,
      isRazorpayConfigured: razorpayInfo.isConfigured,
      currency: razorpayInfo.currency,
    };
  }

  async getAdminScans(page = 1, limit = 20, filters: AdminWalletScanQuery = {}) {
    const { items, total } = await walletTransactionRepository.findAdminScans(
      page,
      limit,
      filters
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async getTopupDetails() {
    const accountNumber = env.RAZORPAYX_ACCOUNT_NUMBER || null;

    return {
      accountNumber,
      ifsc: 'RAZR0000001',
      beneficiaryName: 'ACCOR QR Payouts Account',
      bankName: 'RBL Bank / RazorpayX Virtual Banking',
      instructions: [
        'Transfer funds via NEFT/RTGS/IMPS to the virtual account number above.',
        'Funds will be immediately reflected in your Razorpay X wallet balance.',
        'Ensure your account balance is higher than pending withdrawal requests.',
      ],
    };
  }

  async createOrder(amount: number, currency: string = 'INR') {
    const amountInPaise = Math.round(amount * 100);

    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      const token = Buffer.from(
        `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
      ).toString('base64');

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt: `topup_${Date.now()}`,
        }),
      });

      const data = (await response.json()) as {
        id?: string;
        amount?: number;
        currency?: string;
        error?: { description?: string };
      };

      if (!response.ok || !data.id) {
        throw new BadRequestError(
          data.error?.description ?? 'Failed to create Razorpay order',
          `Razorpay create order failed: ${JSON.stringify(data)}`
        );
      }

      return {
        orderId: data.id,
        id: data.id,
        amount: data.amount ?? amountInPaise,
        currency: data.currency ?? currency,
        keyId: env.RAZORPAY_KEY_ID,
      };
    }

    // Mock order fallback when Razorpay credentials are not set in environment
    const mockOrderId = `order_mock_${Date.now()}`;
    return {
      orderId: mockOrderId,
      id: mockOrderId,
      amount: amountInPaise,
      currency,
      keyId: 'rzp_test_mock',
    };
  }

  async verifyPayment(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount?: number;
  }) {
    if (env.RAZORPAY_KEY_SECRET && !payload.razorpay_order_id.startsWith('order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== payload.razorpay_signature) {
        throw new BadRequestError(
          'Invalid payment signature',
          'Razorpay signature verification failed'
        );
      }
    }

    return {
      verified: true,
      orderId: payload.razorpay_order_id,
      paymentId: payload.razorpay_payment_id,
    };
  }
}

export const walletService = new WalletService();


