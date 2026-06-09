import { ClientSession, Types } from 'mongoose';
import { optionalSessionOptions } from '../../../database/transactions';
import { NotFoundError } from '../../../shared/utils/errors';
import { User } from '../../auth/models/user.model';
import {
  RewardTransaction,
  RewardTransactionType,
} from '../models/reward-transaction.model';

function sanitizeTransaction(tx: {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  points: number;
  type: RewardTransactionType;
  referenceId?: Types.ObjectId;
  description?: string;
  createdAt: Date;
}) {
  return {
    id: tx._id,
    userId: tx.userId,
    points: tx.points,
    type: tx.type,
    referenceId: tx.referenceId,
    description: tx.description,
    createdAt: tx.createdAt,
  };
}

export class RewardsService {
  async getBalance(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getBalance: userId=${userId}`);
    }
    return { points: user.rewardPoints };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      RewardTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RewardTransaction.countDocuments({ userId }),
    ]);

    return {
      items: items.map(sanitizeTransaction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async creditInSession(
    userId: Types.ObjectId,
    points: number,
    referenceId: Types.ObjectId,
    description: string,
    session?: ClientSession
  ) {
    await User.findByIdAndUpdate(
      userId,
      { $inc: { rewardPoints: points } },
      optionalSessionOptions(session)
    );

    const [tx] = await RewardTransaction.create(
      [
        {
          userId,
          points,
          type: RewardTransactionType.CREDIT,
          referenceId,
          description,
        },
      ],
      optionalSessionOptions(session)
    );

    return tx;
  }

  async getUserRewardsAdmin(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getUserRewardsAdmin: userId=${userId}`);
    }
    return {
      userId: user._id,
      mobileNumber: user.mobileNumber,
      name: user.name,
      rewardPoints: user.rewardPoints,
    };
  }
}

export const rewardsService = new RewardsService();
