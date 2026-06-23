import { PoolClient } from 'pg';
import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { userRepository } from '../../auth/repositories/user.repository';
import { rewardTransactionRepository } from '../repositories/reward-transaction.repository';
import {
  IRewardTransaction,
  RewardTransactionType,
} from '../types/rewards.types';

function sanitizeTransaction(tx: IRewardTransaction) {
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
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getBalance: userId=${userId}`);
    }
    return { points: user.rewardPoints };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const { items, total } = await rewardTransactionRepository.findByUserId(
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

  async creditInSession(
    userId: string,
    points: number,
    referenceId: string,
    description: string,
    client?: PoolClient
  ) {
    await userRepository.updateWalletAndPoints(userId, 0, points, client);

    const tx = await rewardTransactionRepository.create(
      {
        userId,
        points,
        type: RewardTransactionType.CREDIT,
        referenceId,
        description,
      },
      client
    );

    return tx;
  }

  async debitInSession(
    userId: string,
    points: number,
    referenceId: string,
    description: string,
    client?: PoolClient
  ) {
    const user = await userRepository.findById(userId, { client });
    if (!user) {
      throw new NotFoundError('User not found', `debitInSession: userId=${userId}`);
    }
    if (user.rewardPoints < points) {
      throw new BadRequestError(
        'Insufficient reward points',
        `debitInSession: points=${user.rewardPoints}, amount=${points}`
      );
    }

    await userRepository.updateWalletAndPoints(userId, 0, -points, client);

    const tx = await rewardTransactionRepository.create(
      {
        userId,
        points,
        type: RewardTransactionType.DEBIT,
        referenceId,
        description,
      },
      client
    );

    return tx;
  }

  async getUserRewardsAdmin(userId: string) {
    const user = await userRepository.findById(userId);
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
