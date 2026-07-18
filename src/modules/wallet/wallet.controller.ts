import { Response } from 'express';
import { getParam, getQueryNumber } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { walletService } from './wallet.service';

export class WalletController {
  async getBalance(req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.getBalance(req.user!.sub);
    sendSuccess(res, 'Wallet balance fetched successfully', result);
  }

  async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await walletService.getTransactions(req.user!.sub, page, limit);
    sendSuccess(res, 'Wallet transactions fetched successfully', result);
  }

  async getUserWallet(req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.getUserWalletAdmin(getParam(req.params.userId));
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

export const walletController = new WalletController();
