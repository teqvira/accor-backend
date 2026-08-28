import { PoolClient } from 'pg';
import { withTransaction } from '../../database/transactions';
import { signS3ViewUrl } from '../../infrastructure/s3/s3.object-url';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/utils/errors';
import { userRepository } from '../auth/repositories/user.repository';
import { assertPartnerApproved } from '../partners/partners.service';
import { notificationsService } from '../notifications/index';
import { rewardCatalogRepository } from './reward-catalog.repository';
import { rewardRedemptionRepository } from './reward-redemption.repository';
import { rewardTransactionRepository } from './reward-transaction.repository';
import { REWARD_STORE_MILESTONES } from './rewards.constants';
import {
  GiftHandoverDetails,
  IRewardCatalogItem,
  IRewardRedemption,
  IRewardTransaction,
  RewardCategory,
  RewardReferenceType,
  RewardRedemptionStatus,
  RewardStatus,
  RewardTransactionType,
} from './rewards.types';

function buildRedemptionResponse(redemption: IRewardRedemption) {
  return {
    redemption: {
      id: redemption._id,
      idempotencyKey: redemption.idempotencyKey,
      status: redemption.status,
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

async function sanitizeAdminRedemption(redemption: IRewardRedemption) {
  const [rewardImageUrl, handoverImageUrl] = await Promise.all([
    signS3ViewUrl(redemption.rewardImageUrl),
    signS3ViewUrl(redemption.handoverImageUrl),
  ]);

  return {
    id: redemption._id,
    status: redemption.status,
    adminNote: redemption.adminNote,
    processedAt: redemption.processedAt,
    user: {
      id: redemption.userId,
      name: redemption.userName ?? null,
      mobileNumber: redemption.userMobileNumber ?? null,
    },
    reward: {
      id: redemption.rewardId,
      code: redemption.rewardCode,
      name: redemption.rewardName,
      imageUrl: rewardImageUrl,
    },
    pointsSpent: redemption.pointsSpent,
    pointsBalanceAfter: redemption.pointsBalanceAfter,
    redeemedAt: redemption.redeemedAt,
    createdAt: redemption.createdAt,
    handoverImageUrl,
    capturedImageUrl: handoverImageUrl,
    recipientName: redemption.recipientName ?? null,
    recipientPhone: redemption.recipientPhone ?? null,
    recipientNote: redemption.recipientNote ?? null,
    handoverDate: redemption.handoverDate ?? null,
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
    const rewardIds = items.map((item: IRewardCatalogItem) => item._id);
    const redemptionStatuses =
      await rewardRedemptionRepository.findLatestStatusByUserAndRewardIds(
        userId,
        rewardIds
      );
    const pointsEligible = user.userType !== 'mechanic';

    const storeItems = items.map((item: IRewardCatalogItem) => {
      const stockRemaining = item.stockQuantity; // null = unlimited
      const inStock =
        stockRemaining === null || stockRemaining > 0;
      const redemptionStatus = redemptionStatuses.get(item._id) ?? null;
      const alreadyHeld =
        redemptionStatus === 'pending' || redemptionStatus === 'gifted';
      const canRedeem =
        pointsEligible &&
        inStock &&
        !alreadyHeld &&
        user.rewardPoints >= item.pointsCost;

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
        redemptionStatus,
        pointsEligible,
      };
    });

    return {
      points: user.rewardPoints,
      pointsEligible,
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
    await assertPartnerApproved(userId);

    const result = await withTransaction(async (client) => {
      // Lock user row
      const user = await userRepository.findByIdForUpdate(userId, client);
      if (!user) {
        throw new NotFoundError('User not found', `redeemReward: userId=${userId}`);
      }
      if (user.userType === 'mechanic') {
        throw new ForbiddenError(
          'Mechanics can earn cash only and cannot redeem reward points',
          `redeemReward: mechanic userId=${userId}`
        );
      }

      // Pre-lock idempotency re-check (race guard)
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
        return { response: buildRedemptionResponse(existingAfterLock), isNew: false as const };
      }

      const existingForReward =
        await rewardRedemptionRepository.findActiveByUserAndRewardId(
          userId,
          rewardId,
          client
        );
      if (existingForReward) {
        throw new ConflictError(
          existingForReward.status === 'pending'
            ? 'You already have a pending request for this reward'
            : 'You have already redeemed this reward',
          `redeemReward: existing status=${existingForReward.status} userId=${userId} rewardId=${rewardId}`
        );
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
      let redemption: IRewardRedemption;
      try {
        redemption = await rewardRedemptionRepository.create(
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
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.name === 'RewardAlreadyRedeemedError'
        ) {
          throw new ConflictError(
            'You already have a request for this reward',
            `redeemReward: unique userId=${userId} rewardId=${rewardId}`
          );
        }
        throw err;
      }

      // Debit points via rewardsService (updates user balance + inserts ledger row)
      await this.debitInSession(
        userId,
        reward.pointsCost,
        redemption._id,
        `Reward redeemed: ${reward.name}`,
        client,
        'reward_redeem'
      );

      return {
        response: buildRedemptionResponse(redemption),
        isNew: true as const,
        notify: {
          userId,
          redemptionId: redemption._id,
          rewardName: reward.name,
          pointsSpent: reward.pointsCost,
          userName: user.name,
        },
      };
    });

    if (result.isNew && result.notify) {
      notificationsService.notifyRewardRequest(result.notify);
    }

    return result.response;
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

  async listRewardsAdmin(
    page = 1,
    limit = 20,
    filters?: {
      category?: RewardCategory;
      status?: RewardStatus;
      search?: string;
    }
  ) {
    const { items, total } = await rewardCatalogRepository.findAll(
      page,
      limit,
      filters
    );

    return {
      items: items.map((item) => ({
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
        redeemedCount: item.redeemedCount ?? 0,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listRedemptionsAdmin(
    page = 1,
    limit = 20,
    filters?: {
      status?: RewardRedemptionStatus;
      search?: string;
      rewardId?: string;
    }
  ) {
    const { items, total } = await rewardRedemptionRepository.findAllAdmin(
      page,
      limit,
      filters
    );

    return {
      items: await Promise.all(items.map(sanitizeAdminRedemption)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateRedemptionStatus(
    redemptionId: string,
    status: 'gifted' | 'rejected',
    adminNote?: string | null,
    handover?: GiftHandoverDetails
  ) {
    return withTransaction(async (client) => {
      const redemption = await rewardRedemptionRepository.findByIdForUpdate(
        redemptionId,
        client
      );
      if (!redemption) {
        throw new NotFoundError(
          'Redemption request not found',
          `updateRedemptionStatus: redemptionId=${redemptionId}`
        );
      }

      if (redemption.status !== 'pending') {
        throw new BadRequestError(
          `This request is already ${redemption.status}`,
          `updateRedemptionStatus: status=${redemption.status}`
        );
      }

      if (status === 'rejected') {
        const reward = await rewardCatalogRepository.findByIdForUpdate(
          redemption.rewardId,
          client
        );
        if (reward && reward.stockQuantity !== null) {
          await rewardCatalogRepository.incrementStock(
            redemption.rewardId,
            client
          );
        }

        await this.creditInSession(
          redemption.userId,
          redemption.pointsSpent,
          redemption._id,
          `Gift redemption rejected: ${redemption.rewardName}`,
          client,
          'admin_adjustment'
        );
      }

      const updated = await rewardRedemptionRepository.updateStatus(
        redemptionId,
        status,
        adminNote ?? null,
        client,
        status === 'gifted'
          ? {
              handoverImageUrl: handover?.handoverImageUrl,
              recipientName: handover?.recipientName,
              recipientPhone: handover?.recipientPhone,
              recipientNote: handover?.recipientNote,
              handoverDate: handover?.handoverDate ?? new Date(),
            }
          : undefined
      );

      if (!updated) {
        throw new NotFoundError(
          'Redemption request not found',
          `updateRedemptionStatus: update failed redemptionId=${redemptionId}`
        );
      }

      const user = await userRepository.findById(updated.userId, { client });
      return sanitizeAdminRedemption({
        ...updated,
        userName: user?.name ?? null,
        userMobileNumber: user?.mobileNumber ?? null,
      });
    });
  }

  async deleteReward(rewardId: string): Promise<void> {
    const deleted = await rewardCatalogRepository.deleteById(rewardId);
    if (!deleted) {
      throw new NotFoundError(
        'Reward not found',
        `deleteReward: rewardId=${rewardId}`
      );
    }
  }

  async updateReward(
    rewardId: string,
    input: {
      name?: string;
      pointsCost?: number;
      pointsRequired?: number;
      status?: RewardStatus;
      imageUrl?: string | null;
      description?: string | null;
      category?: RewardCategory;
      stockQuantity?: number | null;
      sortOrder?: number;
    }
  ) {
    // Accept either pointsCost or pointsRequired alias
    const pointsCost = input.pointsCost ?? input.pointsRequired;

    const updated = await rewardCatalogRepository.updateById(rewardId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(pointsCost !== undefined && { pointsCost }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.category !== undefined && { category: input.category }),
      ...('imageUrl' in input && { imageUrl: input.imageUrl }),
      ...('description' in input && { description: input.description }),
      ...('stockQuantity' in input && { stockQuantity: input.stockQuantity }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    });

    if (!updated) {
      throw new NotFoundError(
        'Reward not found',
        `updateReward: rewardId=${rewardId}`
      );
    }

    return {
      id: updated._id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      category: updated.category,
      pointsCost: updated.pointsCost,
      imageUrl: updated.imageUrl,
      stockQuantity: updated.stockQuantity,
      status: updated.status,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async getRewardStats() {
    const stats = await rewardRedemptionRepository.getAdminStats();
    return {
      totalRewards: stats.totalRewards,
      activeRewards: stats.activeRewards,
      upcomingRewards: stats.upcomingRewards,
      inactiveRewards: stats.inactiveRewards,
      expiredRewards: stats.expiredRewards,
      totalRedemptionRequests: stats.totalRedemptions,
      pendingRedemptionRequests: stats.pendingRequests,
      totalGiftsRedeemed: stats.giftsRedeemed,
    };
  }
}


export const rewardsService = new RewardsService();


