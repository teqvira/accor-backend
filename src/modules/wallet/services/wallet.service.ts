import { ClientSession, Types } from 'mongoose';
import { optionalSessionOptions } from '../../../database/transactions';
import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { User } from '../../auth/models/user.model';
import {
  WalletTransaction,
  WalletTransactionType,
} from '../models/wallet-transaction.model';

function sanitizeTransaction(tx: {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  type: WalletTransactionType;
  referenceId?: Types.ObjectId;
  description?: string;
  createdAt: Date;
}) {
  return {
    id: tx._id,
    userId: tx.userId,
    amount: tx.amount,
    type: tx.type,
    referenceId: tx.referenceId,
    description: tx.description,
    createdAt: tx.createdAt,
  };
}

export class WalletService {
  async getBalance(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getBalance: userId=${userId}`);
    }
    return { balance: user.walletBalance };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      WalletTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments({ userId }),
    ]);

    return {
      items: items.map(sanitizeTransaction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async debitInSession(
    userId: Types.ObjectId,
    amount: number,
    referenceId: Types.ObjectId,
    description: string,
    session?: ClientSession
  ) {
    const user = session
      ? await User.findById(userId).session(session)
      : await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `debitInSession: userId=${userId}`);
    }
    if (user.walletBalance < amount) {
      throw new BadRequestError(
        'Insufficient wallet balance',
        `debitInSession: balance=${user.walletBalance}, amount=${amount}`
      );
    }

    user.walletBalance -= amount;
    await user.save(optionalSessionOptions(session));

    const [tx] = await WalletTransaction.create(
      [
        {
          userId,
          amount,
          type: WalletTransactionType.DEBIT,
          referenceId,
          description,
        },
      ],
      optionalSessionOptions(session)
    );

    return tx;
  }

  async creditInSession(
    userId: Types.ObjectId,
    amount: number,
    referenceId: Types.ObjectId,
    description: string,
    session?: ClientSession
  ) {
    await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: amount } },
      optionalSessionOptions(session)
    );

    const [tx] = await WalletTransaction.create(
      [
        {
          userId,
          amount,
          type: WalletTransactionType.CREDIT,
          referenceId,
          description,
        },
      ],
      optionalSessionOptions(session)
    );

    return tx;
  }

  async getUserWalletAdmin(userId: string) {
    const user = await User.findById(userId);
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
