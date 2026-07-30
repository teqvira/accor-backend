import { Response } from 'express';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { rewardsService } from './rewards.service';
import { RewardCategory, RewardStatus } from './rewards.types';

export class RewardsAdminController {
  async listRewards(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const category = getOptionalQueryParam(req.query.category) as
      | RewardCategory
      | undefined;
    const status = getOptionalQueryParam(req.query.status) as
      | RewardStatus
      | undefined;
    const search = getOptionalQueryParam(req.query.search);

    const result = await rewardsService.listRewardsAdmin(page, limit, {
      category,
      status,
      search,
    });
    sendSuccess(res, 'Rewards fetched successfully', result);
  }

  async getUserRewards(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.getUserRewardsAdmin(
      getParam(req.params.userId)
    );
    sendSuccess(res, 'User rewards fetched successfully', result);
  }

  async createReward(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.createReward(req.body);
    sendSuccess(res, 'Reward created successfully', result, 201);
  }

  async deleteReward(req: AuthRequest, res: Response): Promise<void> {
    await rewardsService.deleteReward(getParam(req.params.rewardId));
    sendSuccess(res, 'Reward deleted successfully', {}, 200);
  }

  async updateReward(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.updateReward(
      getParam(req.params.rewardId),
      req.body
    );
    sendSuccess(res, 'Reward updated successfully', result);
  }
}

export const rewardsAdminController = new RewardsAdminController();
