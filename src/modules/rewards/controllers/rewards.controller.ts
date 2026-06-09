import { Response } from 'express';
import { getParam, getQueryNumber } from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/types/auth.types';
import { rewardsService } from '../services/rewards.service';

export class RewardsController {
  async getBalance(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.getBalance(req.user!.sub);
    sendSuccess(res, 'Reward points fetched successfully', result);
  }

  async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await rewardsService.getTransactions(req.user!.sub, page, limit);
    sendSuccess(res, 'Reward transactions fetched successfully', result);
  }

  async getUserRewards(req: AuthRequest, res: Response): Promise<void> {
    const result = await rewardsService.getUserRewardsAdmin(getParam(req.params.userId));
    sendSuccess(res, 'User rewards fetched successfully', result);
  }
}

export const rewardsController = new RewardsController();
