import { Response } from 'express';
import { getQueryNumber } from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/types/auth.types';
import { transactionsService } from '../services/transactions.service';

export class TransactionsController {
  async listRedemptions(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await transactionsService.listRedemptions(page, limit);
    sendSuccess(res, 'Redemptions fetched successfully', result);
  }

  async getActivity(_req: AuthRequest, res: Response): Promise<void> {
    const result = await transactionsService.getActivitySummary();
    sendSuccess(res, 'Activity summary fetched successfully', result);
  }
}

export const transactionsController = new TransactionsController();
