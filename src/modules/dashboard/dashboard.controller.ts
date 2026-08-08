import { Response } from 'express';
import {
  getOptionalQueryParam,
  getQueryNumber,
} from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  async getOverview(req: AuthRequest, res: Response): Promise<void> {
    const overview = await dashboardService.getOverview({
      search: getOptionalQueryParam(req.query.search),
      page: getQueryNumber(req.query.page, 1),
      limit: getQueryNumber(req.query.limit, 10),
    });
    sendSuccess(res, 'Dashboard fetched successfully', overview);
  }

  /** @deprecated Prefer getOverview. */
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    const days = getQueryNumber(req.query.days, 30);
    const stats = await dashboardService.getStats(days);
    sendSuccess(res, 'Dashboard stats fetched successfully', { stats });
  }
}

export const dashboardController = new DashboardController();
