import { Response } from 'express';
import { getParam } from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/auth.types';
import { withdrawalService } from '../withdrawal.service';

export class WithdrawalAdminController {
  async list(req: AuthRequest, res: Response): Promise<void> {
    const filters = req.query as unknown as Parameters<
      typeof withdrawalService.adminListWithdrawals
    >[0];
    const result = await withdrawalService.adminListWithdrawals(filters);
    sendSuccess(res, 'Withdrawals fetched successfully', result);
  }

  async getStats(_req: AuthRequest, res: Response): Promise<void> {
    const stats = await withdrawalService.adminGetStats();
    sendSuccess(res, 'Withdrawal statistics fetched successfully', stats);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const withdrawal = await withdrawalService.adminGetById(id);
    sendSuccess(res, 'Withdrawal fetched successfully', { withdrawal });
  }

  async complete(req: AuthRequest, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const withdrawal = await withdrawalService.adminCompleteWithdrawal(
      id,
      req.body,
      req.user!.sub
    );
    sendSuccess(res, 'Withdrawal completed successfully', { withdrawal });
  }

  async reject(req: AuthRequest, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const withdrawal = await withdrawalService.adminRejectWithdrawal(
      id,
      req.body,
      req.user!.sub
    );
    sendSuccess(res, 'Withdrawal rejected and balance refunded successfully', {
      withdrawal,
    });
  }
}

export const withdrawalAdminController = new WithdrawalAdminController();

