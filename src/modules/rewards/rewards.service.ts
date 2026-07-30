import { PoolClient } from 'pg';
import { withTransaction } from '../../database/transactions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/utils/errors';
import { userRepository } from '../auth/repositories/user.repository';
import { rewardCatalogRepository } from './reward-catalog.repository';
import { rewardRedemptionRepository } from './reward-redemption.repository';
import { rewardTransactionRepository } from './reward-transaction.repository';
import { REWARD_STORE_MILESTONES } from './rewards.constants';
import {
  IRewardCatalogItem,
  IRewardRedemption,
  IRewardTransaction,
  RewardCategory,
  RewardReferenceType,
  RewardStatus,
  RewardTransactionType,
} from './rewards.types';

function buildRedemptionResponse(redemption: IRewardRedemption) {
  return {
    redemption: {
      id: redemption._id,
      idempotencyKey: redemption.idempotencyKey,
      reward: {
        id: redemption.rewardId,
        code: redemption.rewardCode,
        name: redemption.rewardName,
        imageUrl: redemption.rewardImageUrl,
      },
      pointsSpent: redemption.pointsSpent,
      remainingPoints: redemption.pointsBalanceAfter,
      redeemedAt: redemption.redeemedAt,
    },
  };
}

function sanitizeTransaction(tx: IRewardTransaction) {
  return {
    id: tx._id,
    userId: tx.userId,
    points: tx.points,
    type: tx.type,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    remarks: tx.remarks,
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
    remarks: string,
    client?: PoolClient,
    referenceType: RewardReferenceType = 'qr_redemption'
  ) {
    await userRepository.updateWalletAndPoints(userId, 0, points, client);

    const tx = await rewardTransactionRepository.create(
      {
        userId,
        points,
        type: RewardTransactionType.CREDIT,
        referenceType,
        referenceId,
        remarks,
      },
      client
    );

    return tx;
  }

  async debitInSession(
    userId: string,
    points: number,
    referenceId: string,
    remarks: string,
    client?: PoolClient,
    referenceType: RewardReferenceType = 'reward_redeem'
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
        referenceType,
        referenceId,
        remarks,
      },
      client
    );

    return tx;
  }

  // ---- Reward Store ----

  async getStore(
    userId: string,
    page: number,
    limit: number,
    category?: RewardCategory
  ) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', `getStore: userId=${userId}`);
    }

    const { items, total } = await rewardCatalogRepository.findActive(page, limit, category);

    const storeItems = items.map((item: IRewardCatalogItem) => {
      const stockRemaining = item.stockQuantity; // null = unlimited
      const inStock =
        stockRemaining === null || stockRemaining > 0;
      const canRedeem = inStock && user.rewardPoints >= item.pointsCost;

      return {
        id: item._id,
        code: item.code,
        name: item.name,
        description: item.description,
        category: item.category,
        pointsCost: item.pointsCost,
        imageUrl: item.imageUrl,
        stockRemaining,
        available: inStock,
        canRedeem,
      };
    });

    return {
      points: user.rewardPoints,
      milestones: [...REWARD_STORE_MILESTONES],
      items: storeItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async redeemReward(
    userId: string,
    rewardId: string,
    idempotencyKey: string
  ) {
    // Pre-transaction idempotency check (fast path, no lock)
    const existing = await rewardRedemptionRepository.findByUserAndIdempotencyKey(
      userId,
      idempotencyKey
    );
    if (existing) {
      if (existing.rewardId !== rewardId) {
        throw new ConflictError(
          'This idempotency key was already used for a different reward',
          `redeemReward: idempotencyKey=${idempotencyKey} used for rewardId=${existing.rewardId}`
        );
      }
      // Replay prior response
      return buildRedemptionResponse(existing);
    }

    return withTransaction(async (client) => {
      // Lock user row
      const user = await userRepository.findByIdForUpdate(userId, client);
      if (!user) {
        throw new NotFoundError('User not found', `redeemReward: userId=${userId}`);
      }

      // Post-lock idempotency re-check (race guard)
      const existingAfterLock =
        await rewardRedemptionRepository.findByUserAndIdempotencyKey(
          userId,
          idempotencyKey,
          client
        );
      if (existingAfterLock) {
        if (existingAfterLock.rewardId !== rewardId) {
          throw new ConflictError(
            'This idempotency key was already used for a different reward',
            `redeemReward: idempotencyKey=${idempotencyKey} used for rewardId=${existingAfterLock.rewardId}`
          );
        }
        return buildRedemptionResponse(existingAfterLock);
      }

      // Lock reward row
      const reward = await rewardCatalogRepository.findByIdForUpdate(rewardId, client);
      if (!reward) {
        throw new NotFoundError('Reward not found', `redeemReward: rewardId=${rewardId}`);
      }
      if (reward.status !== 'active') {
        throw new BadRequestError(
          'This reward is not available',
          `redeemReward: reward inactive rewardId=${rewardId}`
        );
      }
      if (reward.stockQuantity !== null && reward.stockQuantity <= 0) {
        throw new ConflictError(
          'This reward is out of stock',
          `redeemReward: out of stock rewardId=${rewardId}`
        );
      }
      if (user.rewardPoints < reward.pointsCost) {
        throw new BadRequestError(
          'Insufficient reward points',
          `redeemReward: points=${user.rewardPoints}, cost=${reward.pointsCost}`
        );
      }

      const pointsBalanceAfter = user.rewardPoints - reward.pointsCost;

      // Decrement stock conditionally
      if (reward.stockQuantity !== null) {
        await rewardCatalogRepository.decrementStock(rewardId, client);
      }

      // Insert redemption snapshot first
      const redemption = await rewardRedemptionRepository.create(
        {
          userId,
          rewardId,
          idempotencyKey,
          rewardCode: reward.code,
          rewardName: reward.name,
          rewardImageUrl: reward.imageUrl,
          pointsSpent: reward.pointsCost,
          pointsBalanceAfter,
        },
        client
      );

      // Debit points via rewardsService (updates user balance + inserts ledger row)
      await this.debitInSession(
        userId,
        reward.pointsCost,
        redemption._id,
        `Reward redeemed: ${reward.name}`,
        client,
        'reward_redeem'
      );

      return buildRedemptionResponse(redemption);
    });
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

  async createReward(input: {
    name: string;
    pointsCost?: number;
    pointsRequired?: number;
    status?: RewardStatus;
    imageUrl?: string | null;
    description?: string | null;
    category?: RewardCategory;
    stockQuantity?: number | null;
    sortOrder?: number;
  }) {
    const pointsCost = input.pointsCost ?? input.pointsRequired;
    if (!pointsCost || pointsCost <= 0) {
      throw new BadRequestError('Points required must be a positive integer');
    }

    const code = `RWD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const item = await rewardCatalogRepository.create({
      code,
      name: input.name,
      pointsCost,
      status: input.status ?? 'upcoming',
      imageUrl: input.imageUrl ?? null,
      description: input.description ?? null,
      category: input.category ?? 'other',
      stockQuantity: input.stockQuantity ?? null,
      sortOrder: input.sortOrder ?? 0,
    });

    return {
      id: item._id,
      code: item.code,
      name: item.name,
      description: item.description,
      category: item.category,
      pointsCost: item.pointsCost,
      imageUrl: item.imageUrl,
      stockQuantity: item.stockQuantity,
      status: item.status,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

export const rewardsService = new RewardsService();
