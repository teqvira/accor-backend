import { Response } from 'express';
import { getQueryNumber } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    const days = getQueryNumber(req.query.days, 30);
    const stats = await dashboardService.getStats(days);
    sendSuccess(res, 'Dashboard stats fetched successfully', { stats });
  }
}

export const dashboardController = new DashboardController();
