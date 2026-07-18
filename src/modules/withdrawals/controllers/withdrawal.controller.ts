import { Response } from 'express';
import { getQueryNumber } from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/auth.types';
import { withdrawalService } from '../withdrawal.service';

export class WithdrawalController {
  async savePayoutProfile(req: AuthRequest, res: Response): Promise<void> {
    const profile = await withdrawalService.savePayoutProfile(
      req.user!.sub,
      req.body
    );
    sendSuccess(res, 'Payout details saved successfully', { profile });
  }

  async getPayoutProfile(req: AuthRequest, res: Response): Promise<void> {
    const profile = await withdrawalService.getPayoutProfile(req.user!.sub);
    sendSuccess(res, 'Payout details fetched successfully', { profile });
  }

  async withdraw(req: AuthRequest, res: Response): Promise<void> {
    const withdrawal = await withdrawalService.requestWithdrawal(
      req.user!.sub,
      req.body
    );
    sendSuccess(res, 'Withdrawal initiated successfully', { withdrawal });
  }

  async listWithdrawals(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await withdrawalService.listWithdrawals(
      req.user!.sub,
      page,
      limit
    );
    sendSuccess(res, 'Withdrawals fetched successfully', result);
  }
}

export const withdrawalController = new WithdrawalController();
