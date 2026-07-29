import { Response } from 'express';
import { getQueryNumber } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import {
  REWARD_STORE_DEFAULT_LIMIT,
  REWARD_STORE_DEFAULT_PAGE,
} from './rewards.constants';
import { rewardsService } from './rewards.service';
import { RewardCategory } from './rewards.types';

function resolveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : getQueryNumber(value, fallback);
}

export class RewardsUserController {
  async getBalance(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.getBalance(req.user!.sub);
    sendSuccess(res, 'Reward points fetched successfully', result);
  }

  async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await rewardsService.getTransactions(
      req.user!.sub,
      page,
      limit
    );
    sendSuccess(res, 'Reward transactions fetched successfully', result);
  }

  async getStore(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.getStore(
      req.user!.sub,
      resolveNumber(req.query.page, REWARD_STORE_DEFAULT_PAGE),
      resolveNumber(req.query.limit, REWARD_STORE_DEFAULT_LIMIT),
      req.query.category as RewardCategory | undefined
    );
    sendSuccess(res, 'Reward store fetched successfully', result);
  }

  async redeemReward(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.redeemReward(
      req.user!.sub,
      req.body.rewardId,
      req.body.idempotencyKey
    );
    sendSuccess(res, 'Reward redeemed successfully', result);
  }
}

export const rewardsUserController = new RewardsUserController();
