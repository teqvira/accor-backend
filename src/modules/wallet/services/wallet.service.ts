import { PoolClient } from 'pg';
import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { userRepository } from '../../auth/repositories/user.repository';
import { walletTransactionRepository } from '../repositories/wallet-transaction.repository';
import {
  IWalletTransaction,
  WalletReferenceType,
  WalletTransactionType,
} from '../types/wallet.types';

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
}

export const walletService = new WalletService();
