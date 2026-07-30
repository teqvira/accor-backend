import { Response } from 'express';
import { getParam } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { rewardsService } from './rewards.service';

export class RewardsAdminController {
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
}

export const rewardsAdminController = new RewardsAdminController();
