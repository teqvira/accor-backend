import { Response } from 'express';
import { getParam, getQueryNumber } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { walletService } from './wallet.service';

export class WalletAdminController {
  async getUserWallet(req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.getUserWalletAdmin(
      getParam(req.params.userId)
    );
    sendSuccess(res, 'User wallet fetched successfully', result);
  }

  async getUserTransactions(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await walletService.getTransactions(
      getParam(req.params.userId),
      page,
      limit
    );
    sendSuccess(res, 'User wallet transactions fetched successfully', result);
  }
}

export const walletAdminController = new WalletAdminController();
